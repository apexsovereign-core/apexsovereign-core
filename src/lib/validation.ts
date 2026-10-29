/**
 * Trust-boundary validation contracts for ApexSovereign.ai.
 *
 * Shared by the Vercel serverless functions, local test servers, and the
 * Playwright contract suite so that every surface validates the same shapes.
 *
 * Invariants encoded here:
 * - $1.00 USD = 100 CU, quoted as an integer number of CU.
 * - USD amounts use at most two decimal places (no sub-cent money).
 * - A checkout quote never mints: credited CU is always zero.
 * - PayPal capture webhooks must carry a positive USD amount before any
 *   downstream handler may act on them.
 *
 * Zod schemas are validation contracts only. They do not authorize a tenant,
 * verify a PayPal signature, or write to the ledger.
 */
import { z } from 'zod';

export const CU_PER_USD = 100;
export const MIN_USD_AMOUNT = 0.01;
export const MAX_USD_AMOUNT = 1_000_000;
export const MAX_CUSTOMER_ID_LENGTH = 128;

export const PAYPAL_CAPTURE_COMPLETED = 'PAYMENT.CAPTURE.COMPLETED';
export const PAYPAL_CAPTURE_REFUNDED = 'PAYMENT.CAPTURE.REFUNDED';
export const PAYPAL_CAPTURE_REVERSED = 'PAYMENT.CAPTURE.REVERSED';

const iso8601Schema = z
  .string()
  .min(20)
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'must be a valid ISO-8601 timestamp',
  });

/**
 * Stable, log-safe tenant/customer identifier.
 *
 * The handler has no way to authenticate a tenant from this value, so the
 * schema only bounds the character set and length. Authorization must happen
 * against a verified server-side claim before any tenant-scoped read/write.
 */
export const customerIdSchema = z
  .string()
  .trim()
  .min(1, 'customer_id is required')
  .max(MAX_CUSTOMER_ID_LENGTH, `customer_id must be at most ${MAX_CUSTOMER_ID_LENGTH} characters`)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/,
    'customer_id may contain letters, digits, dot, underscore, colon, at-sign, and hyphen',
  );

/**
 * USD amount with at most two decimal places.
 *
 * `Number(value.toFixed(2)) === value` rejects 0.001 and 1.005 while accepting
 * 0.07, 12.34, and 100. This is a request-shape guard; ledger writes must
 * still convert to integer CU/cents with explicit integer arithmetic.
 */
export const usdAmountSchema = z
  .number({ error: 'usd_amount must be a number' })
  .finite('usd_amount must be finite')
  .min(MIN_USD_AMOUNT, `usd_amount must be at least ${MIN_USD_AMOUNT}`)
  .max(MAX_USD_AMOUNT, `usd_amount must be at most ${MAX_USD_AMOUNT}`)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: 'usd_amount must have at most two decimal places',
  });

export const checkoutPayloadSchema = z
  .object({
    customer_id: customerIdSchema,
    usd_amount: usdAmountSchema,
  })
  .strict();

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;

/**
 * Checkout quote response contract.
 *
 * `compute_units_credited`, `credited`, `minted_by`, and
 * `requires_webhook_confirmation` are literals so a quote response can never
 * claim that compute units were minted.
 */
export const checkoutQuoteSchema = z
  .object({
    status: z.literal('initialized'),
    checkout_reference: z
      .string()
      .regex(/^apex_chk_[A-Za-z0-9_]+$/, 'checkout_reference has an unexpected format'),
    customer_id: customerIdSchema,
    usd_amount: usdAmountSchema,
    compute_units_quoted: z.number().int().nonnegative(),
    compute_units_credited: z.literal(0),
    credited: z.literal(false),
    gateway_status: z.literal('awaiting_payment_approval'),
    minted_by: z.literal('paypal_webhook_only'),
    requires_webhook_confirmation: z.literal(true),
    timestamp: iso8601Schema,
  })
  .strict();

export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

export const healthResponseSchema = z
  .object({
    status: z.enum(['operational', 'degraded', 'unavailable']),
    system: z.literal('ApexSovereign.ai'),
    exchange: z.enum(['live', 'degraded', 'suspended']),
    ledger_rate: z.literal('$1.00 = 100 CU'),
    timestamp: iso8601Schema,
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const usdMoneySchema = z
  .object({
    currency_code: z.literal('USD'),
    value: z
      .string()
      .regex(/^(?:0|[1-9]\d*)\.\d{2}$/, 'amount.value must be a decimal string with two places')
      .refine((value) => Number(value) > 0, {
        message: 'amount.value must be greater than zero',
      }),
  })
  .passthrough();

const paypalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'must contain only letters, digits, underscore, and hyphen',
  );

const paypalCustomIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/,
    'custom_id must be a log-safe tenant:credits:idempotency value',
  );

/**
 * PayPal CAPTURE.COMPLETED resource.
 *
 * PayPal owns the full resource schema, so unknown sibling fields are allowed
 * (`passthrough`). The fields that drive settlement are required and typed.
 */
export const paypalCaptureResourceSchema = z
  .object({
    id: paypalIdSchema,
    custom_id: paypalCustomIdSchema.optional(),
    amount: usdMoneySchema,
    supplementary_data: z
      .object({
        related_ids: z
          .object({
            order_id: paypalIdSchema.optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    payer: z
      .object({
        email_address: z.string().email().max(254).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PayPalCaptureResource = z.infer<typeof paypalCaptureResourceSchema>;

const captureCompletedWebhookSchema = z
  .object({
    id: paypalIdSchema,
    event_type: z.literal(PAYPAL_CAPTURE_COMPLETED),
    resource: paypalCaptureResourceSchema,
  })
  .passthrough();

const otherWebhookEventSchema = z
  .object({
    id: paypalIdSchema,
    event_type: z
      .string()
      .trim()
      .min(3)
      .max(128)
      .refine((value) => value !== PAYPAL_CAPTURE_COMPLETED, {
        message: 'capture-completed events must include a validated resource',
      }),
    resource: z.unknown(),
  })
  .passthrough();

/**
 * PayPal webhook envelope.
 *
 * Capture-completed events are strictly validated because they are the only
 * event class that can mint CU. Other event types retain a bounded envelope so
 * refunds/disputes can be routed without pretending their resource shape is
 * the capture shape.
 *
 * This schema does not replace PayPal signature verification. Callers must
 * verify the transmission against PAYPAL_WEBHOOK_ID before parsing business
 * fields or touching the database.
 */
export const paypalWebhookPayloadSchema = z.union([
  captureCompletedWebhookSchema,
  otherWebhookEventSchema,
]);

export type PayPalWebhookPayload = z.infer<typeof paypalWebhookPayloadSchema>;

/** Convert a validated, two-decimal USD amount into integer compute units. */
export function usdToComputeUnits(usdAmount: number): number {
  const parsed = usdAmountSchema.parse(usdAmount);
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error('usd_amount could not be represented as integer cents');
  }
  // $1.00 = 100 CU, therefore 1 cent = 1 CU.
  return cents;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Convert a ZodError into a bounded, value-free issue list for 400 responses.
 * Never echo the rejected input; it may contain tenant identifiers or secrets.
 */
export function validationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, 10).map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}
