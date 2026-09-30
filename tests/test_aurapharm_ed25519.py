import os
import json
import time
import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
import jwt

def test_ed25519_jws_mint_and_verify():
    """Validates ED25519 cryptographic minting and signature verification for AuraPharm molecular IP."""
    # Generate ephemeral keypair
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    payload = {
        "job_id": "job-bio-test-1001",
        "target_protein": "EGFR_MUTANT_V3",
        "sequence_hash": "sha256-a8f10b83e490c21",
        "gpu_cluster_id": "cluster-iceland-geo-01",
        "energy_cost_usd_hr": 0.55,
        "timestamp": time.time()
    }
    
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="EdDSA",
        headers={"typ": "JWT", "alg": "EdDSA", "entity": "AuraPharm.ai"}
    )
    
    assert token is not None
    assert len(token.split(".")) == 3
    
    # Verify using public key
    decoded = jwt.decode(token, public_pem, algorithms=["EdDSA"])
    assert decoded["job_id"] == payload["job_id"]
    assert decoded["target_protein"] == "EGFR_MUTANT_V3"
    assert decoded["energy_cost_usd_hr"] == 0.55

def test_ed25519_invalid_signature_rejected():
    """Ensures tampered payloads fail verification."""
    private_key_1 = ed25519.Ed25519PrivateKey.generate()
    private_key_2 = ed25519.Ed25519PrivateKey.generate()
    
    private_pem = private_key_1.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_pem_2 = private_key_2.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    token = jwt.encode({"job_id": "forged-job"}, private_pem, algorithm="EdDSA")
    
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, public_pem_2, algorithms=["EdDSA"])
