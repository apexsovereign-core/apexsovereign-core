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

export interface CustomerUser {
  id: string;
  email: string;
  fullName: string;
  company: string;
  tenantId: string;
  role: 'customer' | 'admin';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  computeCredits: number;
  maxQuota: number;
  apiKey: string;
  createdAt: string;
  subscriptionExpiresAt: string;
}

export interface SubscriptionTier {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  computeUnits: number;
  description: string;
  popular?: boolean;
  features: string[];
  badge?: string;
  paypalPlanId: string;
}

export interface PaymentTransaction {
  id: string;
  paypalOrderId: string;
  tenantId: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  timestamp: string;
  transmissionId: string;
  creditsAwarded: number;
  captureId?: string;
  ledgerEntryId?: string;
  payerEmail?: string;
}

export interface ComputeJob {
  id: string;
  name: string;
  type: string;
  costCredits: number;
  status: 'RUNNING' | 'COMPLETED' | 'QUEUED';
  timestamp: string;
  durationSec: number;
}
