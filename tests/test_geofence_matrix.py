# tests/test_geofence_matrix.py
"""
ApexSovereign.ai - Tier 3: Jurisdictional Geofence Boundary Stress Test
Automated test matrix verifying cross-border routing rules (GDPR_EU, BSI_DE, FEDRAMP_US)
ensuring unauthorized ingress/egress is deterministically dropped with HTTP 451.
"""

import pytest
import httpx

BASE_URL = "http://127.0.0.1:3000/v1/compliance/geofence/validate-route"

# Test matrix: (jurisdiction, target_node, contains_pii, expected_status, expected_error)
GEOFENCE_MATRIX = [
    # Compliant paths
    ("GLOBAL", "node-us-east-01", False, 200, None),
    ("GLOBAL", "node-eu-central-01", False, 200, None),
    ("GDPR_EU", "node-eu-central-01", True, 200, None),
    ("GDPR_EU", "node-eu-west-01", False, 200, None),
    ("FEDRAMP_US", "node-us-gov-east-01", True, 200, None),
    ("BSI_DE", "node-eu-central-01", True, 200, None),

    # Non-compliant cross-border breach paths (Must return HTTP 451)
    ("GDPR_EU", "node-us-east-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("GDPR_EU", "node-us-central-02", False, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("FEDRAMP_US", "node-eu-central-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("BSI_DE", "node-eu-west-01", False, 451, "SOVEREIGNTY_BREACH_DETECTED"),
    ("BSI_DE", "node-us-east-01", True, 451, "SOVEREIGNTY_BREACH_DETECTED"),

    # Invalid regime declarations (PII declared without explicit sovereign boundary)
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
            f"Boundary Failure: Expected HTTP {expected_status} for {jurisdiction} -> {target_node}, "
            f"received HTTP {resp.status_code}: {resp.text}"
        )

        if expected_error:
            data = resp.json()
            assert data["detail"]["error"] == expected_error, (
                f"Error signature mismatch: Expected {expected_error}, got {data.get('detail')}"
            )
