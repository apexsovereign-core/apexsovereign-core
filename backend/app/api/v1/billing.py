"""
ApexSovereign.ai - Enterprise Work OS & Autonomous Compute Broker
Module: Enterprise Payment & Webhook Gateway Router
Author: Principal Systems Architect

Features:
- PayPal Checkout Order Initialization with Idempotency Key.
- Order Capture with Immediate Ledger Crediting.
- Cryptographic Webhook Ingestion verified against PAYPAL_WEBHOOK_ID.
- Safe state mutation committed only upon cryptographic verification.
"""

from __future__ import annotations

import datetime
import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from asyncpg.connection import Connection

from backend.app.api.deps import get_db_tx, get_paypal, require_api_key
from backend.app.schemas.billing import (
    CheckoutCaptureRequest,
    CheckoutCaptureResponse,
    CheckoutInitiateRequest,
    CheckoutInitiateResponse,
    WebhookProcessingResult,
)
from backend.app.services.ledger_service import LedgerService
from backend.app.services.paypal_service import PayPalService

logger = logging.getLogger("apexsovereign.billing.router")
router = APIRouter(prefix="/billing", tags=["Enterprise Billing & Payments"])


@router.post(
    "/checkout/initiate",
    response_model=CheckoutInitiateResponse,
    summary="Initialize PayPal Checkout Order",
    description="Creates a PayPal order for credit top-up and returns the client approval URL.",
)
async def initiate_checkout(
    payload: CheckoutInitiateRequest,
    conn: Connection = Depends(get_db_tx),
    paypal: PayPalService = Depends(get_paypal),
    _api_key: str = Depends(require_api_key),
) -> CheckoutInitiateResponse:
    """
    Creates an authorized PayPal checkout order.
    Protected by X-API-Key header.
    """
    try:
        order_data = await paypal.create_checkout_order(
            tenant_id=payload.tenant_id,
            amount=payload.amount,
            currency=payload.currency,
            credits_allocated=payload.credits_requested,
            idempotency_key=payload.idempotency_key,
            return_url=payload.return_url,
            cancel_url=payload.cancel_url,
        )

        order_id = order_data["id"]
        status_val = order_data.get("status", "CREATED")

        approval_url = None
        for link in order_data.get("links", []):
            if link.get("rel") == "approve":
                approval_url = link.get("href")
                break

        # Persist pending payment record
        insert_payment_query = """
            INSERT INTO payment_transactions (
                tenant_id, provider, provider_order_id, amount, currency,
                credits_allocated, status, idempotency_key, raw_payload
            )
            VALUES ($1, 'PAYPAL', $2, $3, $4, $5, 'CREATED', $6, $7::jsonb)
            ON CONFLICT (provider_order_id) DO NOTHING;
        """
        import json
        await conn.execute(
            insert_payment_query,
            payload.tenant_id,
            order_id,
            payload.amount,
            payload.currency,
            payload.credits_requested,
            payload.idempotency_key,
            json.dumps(order_data),
        )

        return CheckoutInitiateResponse(
            order_id=order_id,
            status=status_val,
            approval_url=approval_url,
            idempotency_key=payload.idempotency_key,
        )
    except Exception as exc:
        logger.error("Checkout initiation failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PayPal checkout initialization failed: {str(exc)}",
        )


@router.post(
    "/checkout/capture",
    response_model=CheckoutCaptureResponse,
    summary="Capture PayPal Order and Credit Ledger",
    description="Captures the approved PayPal order and atomically credits the tenant's ledger.",
)
async def capture_checkout(
    payload: CheckoutCaptureRequest,
    conn: Connection = Depends(get_db_tx),
    paypal: PayPalService = Depends(get_paypal),
    _api_key: str = Depends(require_api_key),
) -> CheckoutCaptureResponse:
    """
    Captures an approved PayPal order and executes transactional ledger crediting.
    """
    try:
        # Retrieve pending payment record
        row = await conn.fetchrow(
            "SELECT * FROM payment_transactions WHERE provider_order_id = $1;",
            payload.order_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Order reference not found.")

        if row["status"] == "COMPLETED":
            # Already fulfilled idempotently
            tenant_row = await conn.fetchrow("SELECT credit_balance FROM tenants WHERE id = $1;", payload.tenant_id)
            return CheckoutCaptureResponse(
                status="ALREADY_FULFILLED",
                order_id=payload.order_id,
                capture_id=row["provider_capture_id"],
                credits_allocated=float(row["credits_allocated"]),
                new_balance=float(tenant_row["credit_balance"]) if tenant_row else 0.0,
                ledger_entry_id="IDEMPOTENT_REPLAY",
            )

        # Execute PayPal capture
        capture_result = await paypal.capture_order(
            order_id=payload.order_id,
            idempotency_key=payload.idempotency_key,
        )

        capture_id = None
        purchase_units = capture_result.get("purchase_units", [])
        if purchase_units:
            payments = purchase_units[0].get("payments", {})
            captures = payments.get("captures", [])
            if captures:
                capture_id = captures[0].get("id")

        # Atomically credit tenant ledger
        fulfillment = await LedgerService.fulfill_payment_idempotent(
            conn=conn,
            tenant_id=payload.tenant_id,
            amount_currency=float(row["amount"]),
            currency=row["currency"],
            credits_allocated=float(row["credits_allocated"]),
            provider_order_id=payload.order_id,
            provider_capture_id=capture_id,
            webhook_event_id=None,
            idempotency_key=payload.idempotency_key,
            raw_payload=capture_result,
        )

        return CheckoutCaptureResponse(
            status="COMPLETED",
            order_id=payload.order_id,
            capture_id=capture_id,
            credits_allocated=fulfillment["credits_allocated"],
            new_balance=fulfillment["balance_after"],
            ledger_entry_id=fulfillment["ledger_id"],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Order capture failed: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"Order capture failure: {str(exc)}")


@router.post(
    "/webhook",
    response_model=WebhookProcessingResult,
    summary="PayPal Cryptographic Webhook Receiver",
    description="Ingests PayPal webhooks, cryptographically validates the transmission signature against PAYPAL_WEBHOOK_ID, and commits idempotent ledger changes.",
)
async def handle_paypal_webhook(
    request: Request,
    conn: Connection = Depends(get_db_tx),
    paypal: PayPalService = Depends(get_paypal),
) -> WebhookProcessingResult:
    """
    Public webhook receiver endpoint for PayPal.
    STRICT SECURITY: Cryptographically verifies headers against PAYPAL_WEBHOOK_ID before DB mutations.
    """
    raw_body = await request.json()
    headers_dict = dict(request.headers)

    # 1. Cryptographic Signature Validation
    is_valid = await paypal.verify_webhook_signature(headers=headers_dict, raw_body=raw_body)
    if not is_valid:
        logger.warning("Rejected unverified PayPal webhook event.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cryptographic verification failed: Webhook signature does not match configured PAYPAL_WEBHOOK_ID.",
        )

    # 2. Extract Event Details
    event_id = raw_body.get("id", "UNKNOWN_EVENT")
    event_type = raw_body.get("event_type", "UNKNOWN_TYPE")
    resource = raw_body.get("resource", {})

    logger.info("Processing verified PayPal webhook: %s (%s)", event_type, event_id)

    idempotent_replay = False
    details: Dict[str, Any] = {"raw_event_type": event_type}

    # 3. Handle PAYMENT.CAPTURE.COMPLETED
    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        custom_id = resource.get("custom_id", "")
        capture_id = resource.get("id")
        amount_dict = resource.get("amount", {})
        amount_val = float(amount_dict.get("value", 0.0))
        currency = amount_dict.get("currency_code", "USD")

        # custom_id format: "{tenant_id}:{credits_allocated}:{idempotency_key}"
        if custom_id and ":" in custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id, credits_str, idemp_key = parts[0], parts[1], parts[2]
                credits_alloc = float(credits_str)

                # Order reference can be linked or fallback to capture_id
                order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id", capture_id)

                fulfillment = await LedgerService.fulfill_payment_idempotent(
                    conn=conn,
                    tenant_id=tenant_id,
                    amount_currency=amount_val,
                    currency=currency,
                    credits_allocated=credits_alloc,
                    provider_order_id=order_id,
                    provider_capture_id=capture_id,
                    webhook_event_id=event_id,
                    idempotency_key=f"WH_{event_id}_{idemp_key}",
                    raw_payload=raw_body,
                )
                idempotent_replay = fulfillment.get("is_replay", False)
                details["fulfillment"] = fulfillment

    # 4. Handle PAYMENT.CAPTURE.REFUNDED, REVERSED, and CUSTOMER.DISPUTE.*
    elif event_type in (
        "PAYMENT.CAPTURE.REFUNDED",
        "PAYMENT.CAPTURE.REVERSED",
        "CUSTOMER.DISPUTE.CREATED",
        "CUSTOMER.DISPUTE.RESOLVED",
    ):
        from backend.app.services.dispute_reversal_engine import PayPalDisputeReversalEngine
        dispute_engine = PayPalDisputeReversalEngine()
        try:
            dispute_result = await dispute_engine.process_dispute_or_refund_event(
                conn=conn,
                event_type=event_type,
                resource=resource,
            )
            details["dispute_reversal"] = dispute_result
        finally:
            await dispute_engine.close()

    return WebhookProcessingResult(
        status="PROCESSED",
        event_type=event_type,
        event_id=event_id,
        processed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        idempotent_replay=idempotent_replay,
        details=details,
    )
