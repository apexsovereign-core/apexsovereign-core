"""HTTP control plane for the manifest-driven enterprise agent fabric."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from agent_engine import AgentEngine, AgentPlatformError, build_default_engine
from agent_middleware import audit_context, verify_webhook_signature


agent_router = APIRouter(prefix="/agent-platform", tags=["agent-platform"])
engine: AgentEngine = build_default_engine()


class AgentRunRequest(BaseModel):
    agent_name: str = Field(..., min_length=2, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)


class AgentEventRequest(BaseModel):
    event_type: str = Field(..., min_length=3, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)


def _serialize_run(run: Any) -> Dict[str, Any]:
    return {
        "run_id": run.run_id,
        "tenant_id": run.tenant_id,
        "agent_name": run.agent_name,
        "status": run.status,
        "input_payload": run.input_payload,
        "output": run.output,
        "steps": run.steps,
        "error": run.error,
        "idempotency_key": run.idempotency_key,
        "created_at": run.created_at,
    }


def _register_builtin_handlers() -> None:
    def classify_lead(context: Dict[str, Any]) -> Dict[str, Any]:
        lead = context.get("lead", {})
        has_business_email = bool(lead.get("email")) and not str(lead.get("email", "")).endswith(("gmail.com", "yahoo.com", "hotmail.com"))
        return {"lead": {**lead, "qualification": "HIGH" if has_business_email and lead.get("company") else "REVIEW"}}

    def classify_ticket(context: Dict[str, Any]) -> Dict[str, Any]:
        ticket = context.get("ticket", {})
        subject = str(ticket.get("subject", "")).lower()
        classification = "URGENT" if any(word in subject for word in ("outage", "security", "breach")) else "GENERAL"
        return {"ticket": {**ticket, "classification": classification}}

    def create_activity(context: Dict[str, Any]) -> Dict[str, Any]:
        return {"activity": {"event": "agent_step_completed", "entity": "lead" if "lead" in context else "ticket"}}

    def advance_deal(context: Dict[str, Any]) -> Dict[str, Any]:
        deal = context.get("deal", {})
        return {"deal": {**deal, "stage": "QUALIFIED" if context.get("lead", {}).get("qualification") == "HIGH" else deal.get("stage", "REVIEW")}}

    def draft_resolution(context: Dict[str, Any]) -> Dict[str, Any]:
        ticket = context.get("ticket", {})
        return {"resolution_plan": "Escalate to security response" if ticket.get("classification") == "URGENT" else "Prepare standard support response"}

    for action, handler in {"classify_lead": classify_lead, "classify_ticket": classify_ticket, "create_activity": create_activity, "advance_deal": advance_deal, "draft_resolution": draft_resolution}.items():
        engine.register_handler(action, handler)


_register_builtin_handlers()


@agent_router.get("/manifest")
async def get_manifest() -> Dict[str, Any]:
    return {"version": engine.manifest["version"], "platform": engine.manifest["platform"], "agents": engine.manifest["agents"], "integrations": engine.manifest["integrations"], "entities": engine.manifest["entities"]}


@agent_router.get("/agents")
async def list_agents() -> Dict[str, Any]:
    return {"agents": [{"name": agent.name, "description": agent.description, "triggers": agent.triggers, "capabilities": agent.capabilities, "approval_required": agent.approval_required} for agent in engine.agents()]}


@agent_router.post("/runs", status_code=status.HTTP_201_CREATED)
async def start_run(request: Request, body: AgentRunRequest, x_tenant_id: str = Header(...), x_idempotency_key: str = Header(...)) -> Dict[str, Any]:
    try:
        run = engine.run(tenant_id=x_tenant_id, agent_name=body.agent_name, payload=body.payload, idempotency_key=x_idempotency_key)
        return {"run": _serialize_run(run), "audit": audit_context(request, body.payload)}
    except AgentPlatformError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@agent_router.get("/runs/{run_id}")
async def get_run(run_id: str, x_tenant_id: str = Header(...)) -> Dict[str, Any]:
    run = engine.get_run(run_id)
    if run is None or run.tenant_id != x_tenant_id:
        raise HTTPException(status_code=404, detail="agent run not found")
    return {"run": _serialize_run(run)}


@agent_router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_event(request: Request, body: AgentEventRequest, x_tenant_id: str = Header(...), x_idempotency_key: str = Header(...), x_apex_signature: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    secret = os.getenv("AGENT_WEBHOOK_SECRET", "")
    if secret:
        raw_body = await request.body()
        if not verify_webhook_signature(raw_body, x_apex_signature or "", secret):
            raise HTTPException(status_code=401, detail="invalid webhook signature")
    routes = {trigger: agent.name for agent in engine.agents() for trigger in agent.triggers}
    agent_name = routes.get(body.event_type)
    if not agent_name:
        raise HTTPException(status_code=422, detail=f"no agent configured for event {body.event_type}")
    try:
        run = engine.run(tenant_id=x_tenant_id, agent_name=agent_name, payload=body.payload, idempotency_key=x_idempotency_key)
        return {"accepted": True, "event_type": body.event_type, "run": _serialize_run(run)}
    except AgentPlatformError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
