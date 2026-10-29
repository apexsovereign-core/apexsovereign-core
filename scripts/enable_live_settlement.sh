#!/usr/bin/env bash
# ==============================================================================
# APEXSOVEREIGN.AI — LIVE PRODUCTION SETTLEMENT CUTOVER HARDENER
# File: scripts/enable_live_settlement.sh
# Purpose: Locks .env.production to 100% Live Commercial Arbitrage & Settlement
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"
BACKUP_FILE="${ROOT_DIR}/.env.production.bak.$(date +%s)"
FOUNDER_OVERRIDE_PHRASE="I_ACCEPT_LIVE_PAYPAL_SETTLEMENT_RISK"

if [ "${FOUNDER_PAYPAL_LIVE_OVERRIDE:-}" != "${FOUNDER_OVERRIDE_PHRASE}" ]; then
  echo "[FATAL] Refusing live cutover: FOUNDER_PAYPAL_LIVE_OVERRIDE is not set." >&2
  echo "[FATAL] Live settlement requires a documented founder review and the" >&2
  echo "[FATAL] exact confirmation phrase in FOUNDER_PAYPAL_LIVE_OVERRIDE." >&2
  exit 4
fi

echo "================================================================================"
echo "APEXSOVEREIGN.AI — INITIATING LIVE COMMERCIAL SETTLEMENT CUTOVER"
echo "TARGET: .env.production | JURISDICTION: Delaware C-Corp | ENTITY: ApexSovereign.ai, Inc."
echo "================================================================================"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[FATAL] Target configuration ${ENV_FILE} not found." >&2
  exit 1
fi

# 1. Create timestamped cryptographic configuration snapshot
cp "${ENV_FILE}" "${BACKUP_FILE}"
echo "[SNAPSHOT] Created emergency rollback snapshot: ${BACKUP_FILE}"

# 2. Hardening and verifying live settlement parameters
echo "[ENFORCING] Flipping PAYPAL_ENV to live with the founder override..."

# Update or insert live parameters using sed with strict regex boundaries
sed -i 's/^PAYPAL_ENV=.*/PAYPAL_ENV=live/' "${ENV_FILE}"
sed -i "s/^FOUNDER_PAYPAL_LIVE_OVERRIDE=.*/FOUNDER_PAYPAL_LIVE_OVERRIDE=${FOUNDER_OVERRIDE_PHRASE}/" "${ENV_FILE}"
sed -i 's/^USD_TO_CU_RATIO=.*/USD_TO_CU_RATIO=100.000000/' "${ENV_FILE}"
sed -i 's/^MIN_ESCROW_DEPOSIT_USD=.*/MIN_ESCROW_DEPOSIT_USD=10.00/' "${ENV_FILE}"
sed -i 's/^REDIS_IDEMPOTENCY_TTL_SECONDS=.*/REDIS_IDEMPOTENCY_TTL_SECONDS=86400/' "${ENV_FILE}"

# 3. Cryptographic Invariance Assertion Patrol
echo "[AUDITING] Verifying core atomic invariants..."

PAYPAL_ENV_VAL=$(grep '^PAYPAL_ENV=' "${ENV_FILE}" | cut -d '=' -f2-)
FOUNDER_OVERRIDE_VAL=$(grep '^FOUNDER_PAYPAL_LIVE_OVERRIDE=' "${ENV_FILE}" | cut -d '=' -f2-)
RATIO_VAL=$(grep '^USD_TO_CU_RATIO=' "${ENV_FILE}" | cut -d '=' -f2-)
MIN_DEPOSIT_VAL=$(grep '^MIN_ESCROW_DEPOSIT_USD=' "${ENV_FILE}" | cut -d '=' -f2-)
IDEMPOTENCY_VAL=$(grep '^REDIS_IDEMPOTENCY_TTL_SECONDS=' "${ENV_FILE}" | cut -d '=' -f2-)
DB_URL_VAL=$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d '=' -f2-)
WEBHOOK_SECRET_VAL=$(grep '^PAYPAL_WEBHOOK_SECRET=' "${ENV_FILE}" | cut -d '=' -f2-)

if [ "${PAYPAL_ENV_VAL}" != "live" ]; then
  echo "[ERROR] Assertion failed: PAYPAL_ENV is ${PAYPAL_ENV_VAL}, expected 'live'." >&2
  exit 1
fi

if [ "${FOUNDER_OVERRIDE_VAL}" != "${FOUNDER_OVERRIDE_PHRASE}" ]; then
  echo "[ERROR] Assertion failed: FOUNDER_PAYPAL_LIVE_OVERRIDE is not the founder phrase." >&2
  exit 1
fi

if [ "${RATIO_VAL}" != "100.000000" ]; then
  echo "[ERROR] Assertion failed: USD_TO_CU_RATIO is ${RATIO_VAL}, expected '100.000000'." >&2
  exit 1
fi

if [ "${MIN_DEPOSIT_VAL}" != "10.00" ]; then
  echo "[ERROR] Assertion failed: MIN_ESCROW_DEPOSIT_USD is ${MIN_DEPOSIT_VAL}, expected '10.00'." >&2
  exit 1
fi

if [ "${IDEMPOTENCY_VAL}" != "86400" ]; then
  echo "[ERROR] Assertion failed: REDIS_IDEMPOTENCY_TTL_SECONDS is ${IDEMPOTENCY_VAL}, expected '86400'." >&2
  exit 1
fi

if [[ ! "${DB_URL_VAL}" =~ sslmode=require ]]; then
  echo "[ERROR] Assertion failed: DATABASE_URL must enforce ?sslmode=require." >&2
  exit 1
fi

if [ -z "${WEBHOOK_SECRET_VAL}" ]; then
  echo "[ERROR] Assertion failed: PAYPAL_WEBHOOK_SECRET is empty." >&2
  exit 1
fi

# 4. Enforce strict POSIX file permissions
chmod 0600 "${ENV_FILE}"

echo "--------------------------------------------------------------------------------"
echo "[SUCCESS] LIVE SETTLEMENT CUTOVER COMPLETE"
echo "  * PAYPAL_ENV:                   ${PAYPAL_ENV_VAL} (Live Production Active)"
echo "  * USD_TO_CU_RATIO:              ${RATIO_VAL} (\$1.00 USD = 100 CU)"
echo "  * MIN_ESCROW_DEPOSIT_USD:       \$${MIN_DEPOSIT_VAL}"
echo "  * REDIS_IDEMPOTENCY_TTL:        ${IDEMPOTENCY_VAL}s (24-Hour Non-Replay Window)"
echo "  * SUPABASE POSTGRESQL SSL:      VERIFIED (sslmode=require)"
echo "  * PAYPAL WEBHOOK HMAC BINDING:  LOCKED"
echo "  * PERMISSIONS:                  chmod 0600 active"
echo "================================================================================"
