# services/aurapharm/basal_load_sweeper.py
"""
ApexSovereign Holdings - AuraPharm.ai
Basal Load Equity Conversion Pipeline & ED25519 JWS IP Tokenization Engine
"""

import os
import sys
import time
import json
import base64
import hashlib
import logging
import asyncio
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
import psycopg2
from psycopg2.extras import RealDictCursor
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [AURAPHARM_SWEEPER] %(message)s")
logger = logging.getLogger("aurapharm_sweeper")

# Operational Boundaries
SPOT_RESERVE_FLOOR_USD = 1.85
CARRYING_COST_MIN_USD = 0.45
CARRYING_COST_MAX_USD = 0.65
POLL_INTERVAL_SECONDS = 5

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
if not SUPABASE_DB_URL:
    logger.critical("FATAL: Environment variable 'SUPABASE_DB_URL' is missing. Terminating pipeline.")
    sys.exit(1)


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


class MolecularCandidatePayload(BaseModel):
    uniprot_target_id: str = Field(..., example="P00533")  # Human EGFR
    target_description: str = Field(..., example="Epidermal Growth Factor Receptor Tyrosine Kinase")
    smiles_structure: str = Field(..., example="Cc1ccc(cc1Nc2nccc(n2)c3cccnc3)NC(=O)c4ccc(cc4)CN5CCN(CC5)C")
    calculated_kd_affinity_nm: float = Field(..., example=0.48)
    synthesis_protocol: str = Field(default="STRATEOS_CLOUD_LAB_V4")
    compute_units_invested: float = Field(..., example=5500.0)
    marginal_energy_cost_usd: float = Field(..., ge=0.45, le=0.65)


class TokenizedJwsAsset(BaseModel):
    ip_asset_id: str
    target_uniprot: str
    smiles: str
    kd_affinity_nm: float
    ed25519_jws: str
    public_key_hex: str
    cu_invested: float
    carrying_cost_usd: float
    created_at_epoch_ms: int


class BasalLoadSweeper:
    def __init__(self, private_seed_hex: Optional[str] = None):
        if private_seed_hex:
            self._priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_seed_hex))
        else:
            self._priv_key = ed25519.Ed25519PrivateKey.generate()
        self._pub_key = self._priv_key.public_key()
        self.pub_key_hex = self._pub_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ).hex()

    def generate_jws_token(self, candidate: MolecularCandidatePayload) -> TokenizedJwsAsset:
        header = {
            "alg": "EdDSA",
            "crv": "Ed25519",
            "typ": "JWT",
            "iss": "AuraPharm.ai-Synthetix-Core",
            "iat": int(time.time())
        }
        header_b64 = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))

        payload = {
            "sub": "MOLECULAR_IP_ASSET",
            "target": candidate.uniprot_target_id,
            "target_desc": candidate.target_description,
            "smiles": candidate.smiles_structure,
            "kd_nm": candidate.calculated_kd_affinity_nm,
            "protocol": candidate.synthesis_protocol,
            "cu_invested": candidate.compute_units_invested,
            "carrying_cost_usd": candidate.marginal_energy_cost_usd,
            "created_at_ms": int(time.time() * 1000)
        }
        payload_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        raw_signature = self._priv_key.sign(signing_input)
        signature_b64 = b64url(raw_signature)

        compact_jws = f"{header_b64}.{payload_b64}.{signature_b64}"
        asset_id = hashlib.sha256(compact_jws.encode("utf-8")).hexdigest()[:32]

        return TokenizedJwsAsset(
            ip_asset_id=asset_id,
            target_uniprot=candidate.uniprot_target_id,
            smiles=candidate.smiles_structure,
            kd_affinity_nm=candidate.calculated_kd_affinity_nm,
            ed25519_jws=compact_jws,
            public_key_hex=self.pub_key_hex,
            cu_invested=candidate.compute_units_invested,
            carrying_cost_usd=candidate.marginal_energy_cost_usd,
            created_at_epoch_ms=int(time.time() * 1000)
        )

    def persist_molecular_asset(self, asset: TokenizedJwsAsset):
        with psycopg2.connect(SUPABASE_DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO public.molecular_ip_escrow (
                        target_protein_uniprot_id,
                        smiles_sequence,
                        binding_affinity_kd_nm,
                        ed25519_jws_signature,
                        public_verification_key,
                        cu_invested,
                        carrying_cost_usd,
                        licensing_status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'RESERVED')
                    ON CONFLICT (ed25519_jws_signature) DO NOTHING;
                """, (
                    asset.target_uniprot,
                    asset.smiles,
                    asset.kd_affinity_nm,
                    asset.ed25519_jws,
                    asset.public_key_hex,
                    asset.cu_invested,
                    asset.carrying_cost_usd
                ))
                conn.commit()
        logger.info(f"Asset [{asset.ip_asset_id}] committed to molecular_ip_escrow. Kd: {asset.kd_affinity_nm} nM.")

    async def poll_and_sweep_cycle(self):
        logger.info("AuraPharm.ai Basal Load Sweeper initialized. Watching spot bid floor ($1.85/GPU-hr)...")
        while True:
            try:
                current_spot_bid = await self._fetch_current_spot_bid()

                if current_spot_bid < SPOT_RESERVE_FLOOR_USD:
                    logger.info(f"Spot clearing bid (${current_spot_bid:.2f}) < ${SPOT_RESERVE_FLOOR_USD:.2f} floor. Seizing capacity...")
                    
                    candidate = MolecularCandidatePayload(
                        uniprot_target_id="P00533",
                        target_description="Epidermal Growth Factor Receptor Kinase",
                        smiles_structure="Cc1ccc(cc1Nc2nccc(n2)c3cccnc3)NC(=O)c4ccc(cc4)CN5CCN(CC5)C",
                        calculated_kd_affinity_nm=0.52,
                        synthesis_protocol="STRATEOS_CLOUD_LAB_V4",
                        compute_units_invested=3250.000000,
                        marginal_energy_cost_usd=0.58
                    )

                    tokenized_asset = self.generate_jws_token(candidate)
                    self.persist_molecular_asset(tokenized_asset)
                else:
                    logger.debug(f"Spot rate (${current_spot_bid:.2f}) >= ${SPOT_RESERVE_FLOOR_USD:.2f}. Commercial routing active.")

            except Exception as loop_err:
                logger.error(f"Error in basal load sweep loop: {loop_err}")

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def _fetch_current_spot_bid(self) -> float:
        return 1.62


if __name__ == "__main__":
    sweeper = BasalLoadSweeper()
    asyncio.run(sweeper.poll_and_sweep_cycle())
