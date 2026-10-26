"""
ApexSovereign.ai - Master Configuration Engine
Pydantic Settings v2 with strict validation and no secret fallbacks.

Required secrets are declared without defaults. Importing this module in an
environment that is missing any of them raises a ValidationError, which aborts
startup before the service can serve traffic.
"""

from typing import List, Dict, Optional
import json

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Core Environment & Service
    ENV: str = Field(default="production", description="production, staging, development")
    BUILD_ID: str = Field(default="apex-v2.4.8-gold")
    LAUNCH_MODE: str = Field(default="early_access")
    PROVIDER_MODE: str = Field(default="simulated", description="simulated or supplier")
    LIVE_PAYMENTS_ACK: str = Field(default="")
    DEMO_MODE: bool = Field(
        default=False,
        description="Explicit opt-in for offline/demo operation. Never fabricates balances.",
    )

    # Ingress & Networking
    RENDER_EXTERNAL_HOSTNAME: str = Field(default="apexsovereign-mesh.onrender.com")
    PORT: int = Field(default=10000)
    ALLOWED_ORIGINS: str = Field(
        ...,
        min_length=1,
        description="Comma-separated allowed CORS origins (required, no default)",
    )

    # Supabase & Database (schema 'apex')
    DATABASE_URL: str = Field(..., min_length=1, description="Direct PostgreSQL connection string")
    SUPABASE_URL: str = Field(default="")
    SUPABASE_ANON_KEY: str = Field(default="")
    SUPABASE_JWT_SECRET: str = Field(..., min_length=1)

    # Cryptographic Ledger Signing
    LEDGER_HMAC_KID: str = Field(..., min_length=1)
    LEDGER_HMAC_KEYS_JSON: str = Field(
        ...,
        min_length=1,
        description='JSON object mapping key IDs to secrets, e.g. {"k1":"..."}',
    )

    # PayPal REST API v2
    PAYPAL_ENV: str = Field(..., pattern="^(sandbox|live)$")
    PAYPAL_CLIENT_ID: str = Field(..., min_length=1)
    PAYPAL_CLIENT_SECRET: str = Field(..., min_length=1)
    PAYPAL_WEBHOOK_ID: str = Field(..., min_length=1)

    # Deposit Limits (cents: $1.00 = 100 CU = 100 cents)
    DEPOSIT_MAX_TX_CENTS: int = Field(default=100000)
    DEPOSIT_MAX_DAY_CENTS: int = Field(default=200000)
    DEPOSIT_MAX_NEW_ACCOUNT_DAY_CENTS: int = Field(default=50000)

    # Waitlist & Privacy Salt (required secret)
    WAITLIST_IP_SALT: str = Field(..., min_length=1)

    # External Compute Supplier Adapter (when PROVIDER_MODE=supplier)
    SUPPLIER_BASE_URL: str = Field(default="")
    SUPPLIER_API_KEY: str = Field(default="")

    # Observability
    SENTRY_DSN: Optional[str] = Field(default=None)

    @model_validator(mode="after")
    def _validate_ledger_keyring(self) -> "Settings":
        try:
            keys = json.loads(self.LEDGER_HMAC_KEYS_JSON)
        except Exception as exc:
            raise ValueError("LEDGER_HMAC_KEYS_JSON must be valid JSON") from exc
        if not isinstance(keys, dict) or not keys:
            raise ValueError("LEDGER_HMAC_KEYS_JSON must be a non-empty JSON object")
        for kid, secret in keys.items():
            if not isinstance(kid, str) or not kid:
                raise ValueError("LEDGER_HMAC_KEYS_JSON contains an invalid key id")
            if not isinstance(secret, str) or not secret:
                raise ValueError(f"Ledger key {kid!r} has an empty secret")
        if self.LEDGER_HMAC_KID not in keys:
            raise ValueError(
                f"LEDGER_HMAC_KID {self.LEDGER_HMAC_KID!r} is not present in LEDGER_HMAC_KEYS_JSON"
            )
        return self

    @computed_field
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @computed_field
    def hmac_keys(self) -> Dict[str, str]:
        """Validated at construction time; never falls back to a default key."""
        return json.loads(self.LEDGER_HMAC_KEYS_JSON)

    @computed_field
    def is_production(self) -> bool:
        return self.ENV == "production" or self.PAYPAL_ENV == "live"

    @computed_field
    def payments_enabled(self) -> bool:
        """
        Payments are enabled only when:
        1. PAYPAL_ENV == 'sandbox', or
        2. PAYPAL_ENV == 'live' AND PROVIDER_MODE == 'supplier' AND
           LIVE_PAYMENTS_ACK == 'I_CONFIRM_SERVICE_CAN_BE_DELIVERED'.
        """
        if self.PAYPAL_ENV == "sandbox":
            return True
        if self.PAYPAL_ENV == "live":
            return (
                self.PROVIDER_MODE == "supplier"
                and self.LIVE_PAYMENTS_ACK == "I_CONFIRM_SERVICE_CAN_BE_DELIVERED"
            )
        return False

    def validate_runtime(self) -> None:
        """Explicit runtime guard used by the FastAPI lifespan."""
        missing = []
        for name in (
            "DATABASE_URL",
            "SUPABASE_JWT_SECRET",
            "PAYPAL_CLIENT_ID",
            "PAYPAL_CLIENT_SECRET",
            "PAYPAL_WEBHOOK_ID",
            "LEDGER_HMAC_KID",
            "LEDGER_HMAC_KEYS_JSON",
            "WAITLIST_IP_SALT",
            "ALLOWED_ORIGINS",
        ):
            if not str(getattr(self, name, "")).strip():
                missing.append(name)
        if missing:
            raise RuntimeError(
                "Missing required environment variables: " + ", ".join(sorted(missing))
            )
        # Re-validate the keyring in case the object was mutated after construction.
        keys = self.hmac_keys
        if self.LEDGER_HMAC_KID not in keys:
            raise RuntimeError("LEDGER_HMAC_KID is not present in LEDGER_HMAC_KEYS_JSON")


settings = Settings()
