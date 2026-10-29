import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  routeCompute,
  type AllocationRequest,
  type ComputeNode,
} from '../../src/lib/computeRouter';

const MAX_BODY_BYTES = 4_096;

const allocationSchema = z.object({
  resource_tier: z.enum(['GPU_H100', 'GPU_B200', 'GPU_A100', 'GPU_L40S']).default('GPU_A100'),
  duration_hours: z.number().positive().max(720).default(1),
  tenant_id: z.string().min(1).max(128),
});

// In production these come from Supabase. For the edge function we use a
// static snapshot that is refreshed by the telemetry pipeline. The router
// itself is non-autoregressive: every node is scored independently.
const NODE_SNAPSHOT: ComputeNode[] = [
  { id: 'node-us-east-01', model: 'NVIDIA H100 80GB SXM5', region: 'us-east', status: 'available', rateCuHr: 194, thermalHeadroomC: 12, rttMs: 4 },
  { id: 'node-us-east-02', model: 'NVIDIA A100 80GB SXM4', region: 'us-east', status: 'available', rateCuHr: 142, thermalHeadroomC: 8, rttMs: 5 },
  { id: 'node-eu-central-01', model: 'NVIDIA H100 80GB SXM5', region: 'eu-central', status: 'available', rateCuHr: 210, thermalHeadroomC: 10, rttMs: 28 },
  { id: 'node-apac-01', model: 'NVIDIA L40S 48GB PCIe', region: 'apac', status: 'available', rateCuHr: 78, thermalHeadroomC: 15, rttMs: 45 },
];

function readBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
  return req.body;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', code: 'method_not_allowed' });
  }

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload Too Large', code: 'payload_too_large' });
  }

  const body = readBody(req);
  const parsed = allocationSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      code: 'invalid_allocation_request',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const request: AllocationRequest = {
    resourceTier: parsed.data.resource_tier,
    durationHours: parsed.data.duration_hours,
    tenantId: parsed.data.tenant_id,
  };

  const decision = routeCompute(NODE_SNAPSHOT, request);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ALLOCATED',
    allocation_id: decision.allocationId,
    tenant_id: parsed.data.tenant_id,
    resource_tier: request.resourceTier,
    target_gpu: decision.model,
    assigned_node: `${decision.nodeId} (${decision.region})`,
    duration_hours: decision.durationHours,
    metered_cu: decision.meteredCu,
    routing_score: decision.score,
    decided_at: decision.decidedAt,
    // CU deduction happens via Supabase RPC, not here. This is a quote.
    cu_deducted: false,
    requires_ledger_confirmation: true,
  });
}
