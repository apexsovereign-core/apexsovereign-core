/**
 * Sole source of truth for compute-credit pricing in the frontend.
 * The backend (app/paypal.py) enforces the same pack ids and amounts.
 * Invariant: $1.00 USD = 100 CU (integer CU).
 */
export const CU_PER_USD = 100;

export interface PricingPack {
  id: 'developer' | 'prototype' | 'enterprise' | 'sovereign';
  name: string;
  amountUsd: number;
  cu: number;
  note: string;
}

export const PRICING = {
  currency: 'USD',
  cuPerUsd: CU_PER_USD,
  packs: [
    {
      id: 'developer',
      name: 'Developer Pack',
      amountUsd: 50,
      cu: 5000,
      note: 'Evaluation and small inference jobs',
    },
    {
      id: 'prototype',
      name: 'Prototype Pack',
      amountUsd: 100,
      cu: 10000,
      note: 'Multi-node prototyping',
    },
    {
      id: 'enterprise',
      name: 'Enterprise Cluster Pack',
      amountUsd: 500,
      cu: 50000,
      note: 'Production cluster allocation',
    },
    {
      id: 'sovereign',
      name: 'Sovereign Scale Pack',
      amountUsd: 1000,
      cu: 100000,
      note: 'Institutional clearing capacity',
    },
  ] satisfies PricingPack[],
} as const;

export function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCu(value: number): string {
  return `${value.toLocaleString('en-US')} CU`;
}
