/**
 * Non-autoregressive compute routing model for ApexSovereign.ai.
 *
 * Scores every candidate GPU node independently (parallel, no sequential
 * dependency) and returns a ranked allocation decision. This avoids the
 * greedy sequential bottleneck of autoregressive routers where each assignment
 * depends on the previous one.
 *
 * Scoring factors (all normalised to [0,1]):
 *   - price:      lower CU/hr is better (weight 0.35)
 *   - availability: available status is best (weight 0.25)
 *   - thermal:   higher thermal headroom is better (weight 0.20)
 *   - latency:   lower RTT is better (weight 0.20)
 *
 * Target: allocation decision in < 18ms (edge to Supabase RPC).
 */

export const CU_PER_USD = 100;

export interface ComputeNode {
  id: string;
  model: string;
  region: string;
  status: 'available' | 'allocated' | 'maintenance' | 'offline';
  rateCuHr: number;
  thermalHeadroomC: number;
  rttMs: number;
}

export interface AllocationRequest {
  resourceTier: 'GPU_H100' | 'GPU_B200' | 'GPU_A100' | 'GPU_L40S';
  durationHours: number;
  tenantId: string;
}

export interface NodeScore {
  nodeId: string;
  model: string;
  region: string;
  score: number;
  priceScore: number;
  availabilityScore: number;
  thermalScore: number;
  latencyScore: number;
}

export interface AllocationDecision {
  allocationId: string;
  nodeId: string;
  model: string;
  region: string;
  durationHours: number;
  meteredCu: number;
  score: number;
  rankedNodes: NodeScore[];
  decidedAt: string;
}

const WEIGHTS = {
  price: 0.35,
  availability: 0.25,
  thermal: 0.20,
  latency: 0.20,
} as const;

const TIER_CU_PER_HOUR: Record<AllocationRequest['resourceTier'], number> = {
  GPU_H100: 16,
  GPU_B200: 28.5,
  GPU_A100: 8,
  GPU_L40S: 7.8,
};

const STATUS_SCORE: Record<ComputeNode['status'], number> = {
  available: 1.0,
  allocated: 0.3,
  maintenance: 0.1,
  offline: 0.0,
};

/**
 * Score a single node. Pure function — no side effects, no I/O.
 * This is the non-autoregressive unit: every node is scored independently.
 */
export function scoreNode(node: ComputeNode, maxRate: number, maxRtt: number): NodeScore {
  const priceScore = maxRate > 0 ? 1 - node.rateCuHr / maxRate : 0;
  const availabilityScore = STATUS_SCORE[node.status] ?? 0;
  const thermalScore = Math.min(1, Math.max(0, node.thermalHeadroomC / 20));
  const latencyScore = maxRtt > 0 ? 1 - node.rttMs / maxRtt : 0;

  const score =
    priceScore * WEIGHTS.price +
    availabilityScore * WEIGHTS.availability +
    thermalScore * WEIGHTS.thermal +
    latencyScore * WEIGHTS.latency;

  return {
    nodeId: node.id,
    model: node.model,
    region: node.region,
    score,
    priceScore,
    availabilityScore,
    thermalScore,
    latencyScore,
  };
}

/**
 * Non-autoregressive routing decision: score all nodes in parallel, then
 * pick the highest-scoring available node. O(n) where n = number of nodes.
 */
export function routeCompute(
  nodes: ComputeNode[],
  request: AllocationRequest,
): AllocationDecision {
  if (nodes.length === 0) {
    throw new Error('No compute nodes available for routing');
  }

  const maxRate = Math.max(...nodes.map((n) => n.rateCuHr), 1);
  const maxRtt = Math.max(...nodes.map((n) => n.rttMs), 1);

  // Non-autoregressive: all nodes scored independently in a single pass.
  const ranked = nodes.map((node) => scoreNode(node, maxRate, maxRtt));
  ranked.sort((a, b) => b.score - a.score);

  // Pick the best available node (status === 'available').
  const best = ranked.find((s) => {
    const node = nodes.find((n) => n.id === s.nodeId);
    return node?.status === 'available';
  }) ?? ranked[0];

  const cuPerHour = TIER_CU_PER_HOUR[request.resourceTier];
  const meteredCu = cuPerHour * request.durationHours;

  return {
    allocationId: `alloc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    nodeId: best.nodeId,
    model: best.model,
    region: best.region,
    durationHours: request.durationHours,
    meteredCu,
    score: best.score,
    rankedNodes: ranked,
    decidedAt: new Date().toISOString(),
  };
}
