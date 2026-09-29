# tests/test_geofence_matrix.py
"""
ApexSovereign.ai - Tier 3: Jurisdictional Geofence Boundary Stress Test
Automated test matrix verifying cross-border routing rules (GDPR_EU, BSI_DE, FEDRAMP_US)
ensuring unauthorized ingress/egress is deterministically dropped with HTTP 451.
"""

import os
import sys
import logging
import pytest
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [GEOFENCE_TEST] %(message)s")
logger = logging.getLogger("geofence_test")

BASE_TARGET = os.getenv("TARGET_URL")
if not BASE_TARGET:
    logger.critical("FATAL: Environment variable 'TARGET_URL' is missing. Terminating test.")
    sys.exit(1)

# Derive compliance route endpoint from base target URL
BASE_URL = f"{BASE_TARGET.split('/v1/')[0]}/v1/compliance/geofence/validate-route"

# Test matrix: (jurisdiction, target_node, contains_pii, expected_status, expected_error)
GEOFENCE_MATRIX = [
    # Compliant In-Jurisdiction Paths (HTTP 200)
    ("GLOBAL", "node-us-east-01", False, 200, None),
    ("GLOBAL", "node-eu-central-01", False, 200, None),
    ("GDPR_EU", "node-eu-central-01", True, 200, None),
    ("GDPR_EU", "node-eu-west-01", False, 200, None),
    ("FEDRAMP_US", "node-us-gov-east-01", True, 200, None),
    ("BSI_DE", "node-eu-central-01", True, 200, None),

    # Non-Compliant Cross-Border Breaches (Mandatory HTTP 451 Drop)
    ("GDPR_EU", "node-us-east-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("GDPR_EU", "node-us-central-02", False, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("FEDRAMP_US", "node-eu-central-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("BSI_DE", "node-eu-west-01", False, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("BSI_DE", "node-us-east-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),

    # Invalid Regimes (PII without defined sovereign boundary -> HTTP 400)
    ("GLOBAL", "node-us-east-01", True, 400, None),
]


@pytest.mark.parametrize("jurisdiction,target_node,contains_pii,expected_status,expected_error", GEOFENCE_MATRIX)
def test_geofence_boundary_enforcement(jurisdiction, target_node, contains_pii, expected_status, expected_error):
    payload = {
        "tenant_id": "tenant-compliance-audit-01",
        "workload_id": f"wl-audit-{jurisdiction.lower()}",
        "target_node_id": target_node,
        "jurisdiction": jurisdiction,
        "contains_pii": contains_pii,
        "data_classification": "RESTRICTED",
    }

    with httpx.Client(timeout=5.0) as client:
        resp = client.post(BASE_URL, json=payload)
        assert resp.status_code == expected_status, (
            f"Boundary Violation Check Failed: {jurisdiction} -> {target_node} returned HTTP {resp.status_code}: {resp.text}"
        )
        if expected_error:
            data = resp.json()
            assert data["detail"]["error"] == expected_error, (
                f"Error signature mismatch: Expected {expected_error}, got {data.get('detail')}"
            )
