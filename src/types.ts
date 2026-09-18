export interface CodeFile {
  id: string;
  path: string;
  name: string;
  category: 'core' | 'db' | 'services' | 'api' | 'schemas' | 'infra' | 'tests' | 'frontend' | 'backend';
  language: 'python' | 'sql' | 'yaml' | 'dockerfile' | 'markdown' | 'text' | 'html' | 'javascript' | 'json';
  description: string;
  keyFeatures: string[];
  content: string;
}

export interface ResourceTier {
  id: string;
  name: string;
  category: 'CPU' | 'GPU';
  hourlyBase: number;
  cpuDefault: number;
  memoryMbDefault: number;
  gpuCountDefault: number;
  specs: string;
}

export interface SimulatedLedgerEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  type: 'CREDIT_PURCHASE' | 'COMPUTE_USAGE' | 'REFUND';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  idempotencyKey: string;
  referenceId: string;
  status: 'COMMITTED' | 'REVERTED' | 'REPLAYED';
}

export interface WebhookSimulationLog {
  id: string;
  timestamp: string;
  eventType: string;
  transmissionId: string;
  certUrl: string;
  signatureStatus: 'VERIFIED' | 'FAILED_SIGNATURE' | 'BLOCKED_SSRF' | 'REPLAY_DETECTED';
  tenantId: string;
  creditsAllocated: number;
  details: string;
}
