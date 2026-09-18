"""
ApexSovereign.ai - Main FastAPI Application & Lifecycle Manager
Production-grade deployment entrypoint for Render.
"""

import os
import time
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load local environment variables if .env exists
load_dotenv()

# ---------------------------------------------------------------------------
# Sentry APM & Exception Monitoring Initialization
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=os.getenv("RENDER_ENVIRONMENT", os.getenv("ENVIRONMENT", "production")),
            release=os.getenv("RENDER_GIT_COMMIT", "apexsovereign-v2.5.0"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
        )
        print("[ApexSovereign Sentry] Enterprise APM & Exception Monitoring initialized.")
    except Exception as sentry_err:
        print(f"[ApexSovereign Sentry Warning] Sentry initialization deferred: {sentry_err}")
else:
    print("[ApexSovereign Sentry] Note: SENTRY_DSN not configured. APM tracing deferred.")

# Import database, metrics, and routers
from compute_broker import init_db, get_db_health, compute_router, get_db, Session
from payment_router import payment_router
from metrics import PrometheusMetricsMiddleware, generate_prometheus_metrics_text

# Ensure models are imported into Base.metadata before init_db
try:
    import invoicing
    import gpu_discovery_engine
except Exception as model_import_err:
    print(f"[ApexSovereign DB] Model registration note: {model_import_err}")

# Track process startup timestamp
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup table schema verification and graceful shutdown.
    """
    print("[ApexSovereign] Initializing system engine & database schemas...")
    try:
        init_db()
        print("[ApexSovereign] Database connection and schema verified successfully.")
    except Exception as exc:
        print(f"[ApexSovereign] WARNING: Database auto-initialization error: {exc}")
        print("[ApexSovereign] Server will continue to start. Please verify DATABASE_URL.")

    # Autonomous 24/7 background worker thread
    try:
        import threading
        from worker_engine import run_asynchronous_worker
        if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
            worker_thread = threading.Thread(target=run_asynchronous_worker, daemon=True)
            worker_thread.start()
            print("[ApexSovereign] Autonomous 24/7 background worker thread initialized.")
    except Exception as worker_exc:
        print(f"[ApexSovereign Worker] Worker startup note: {worker_exc}")

    yield

    print("[ApexSovereign] Graceful shutdown completed. Releasing thread pools.")


# Initialize FastAPI Application
app = FastAPI(
    title="ApexSovereign.ai API",
    description="Autonomous Work OS & Sovereign Compute Broker Platform",
    version="2.4.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Configuration (Production Hardened for apexsovereign.ai)
# ---------------------------------------------------------------------------
IS_PROD = os.getenv("RENDER_ENVIRONMENT", os.getenv("ENVIRONMENT", "production")).lower() == "production"

custom_origins = [
    origin.strip() 
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") 
    if origin.strip()
]

production_origins = [
    "https://apexsovereign.ai",
    "https://www.apexsovereign.ai",
]

dev_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

if IS_PROD and not os.getenv("ALLOW_DEV_ORIGINS"):
    allowed_origins = list(set(production_origins + custom_origins))
    origin_regex = r"^https://([a-zA-Z0-9_-]+\.)?apexsovereign\.ai$"
else:
    allowed_origins = list(set(production_origins + dev_origins + custom_origins))
    origin_regex = r"^https://([a-zA-Z0-9_-]+\.)*(vercel\.app|apexsovereign\.ai)$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global Exception Handler & Sentry Capture
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ApexSovereign Critical Error] Unhandled exception on {request.method} {request.url.path}: {exc}")
    if SENTRY_DSN:
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass
    return JSONResponse(
        status_code=500,
        content={
            "status": "ERROR",
            "detail": "Internal sovereign server exception encountered.",
            "path": request.url.path,
        },
    )

# ---------------------------------------------------------------------------
# Prometheus Telemetry Middleware
# ---------------------------------------------------------------------------
app.add_middleware(PrometheusMetricsMiddleware)


# ---------------------------------------------------------------------------
# Root, Health Check & Telemetry Metrics Endpoints
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
async def root_status() -> Dict[str, Any]:
    """
    Root endpoint returning service identity, uptime, and operational status.
    """
    uptime_seconds = round(time.time() - START_TIME, 2)
    db_status = get_db_health()

    return {
        "service": "ApexSovereign.ai Autonomous Compute Broker",
        "status": "OPERATIONAL",
        "version": "2.5.0",
        "uptime_seconds": uptime_seconds,
        "database": db_status,
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "metrics": "/metrics",
            "compute": "/compute",
            "invoices": "/invoices",
            "billing": "/billing",
            "gateway": "/v3/engine/telemetry/billing/gateway",
        },
    }


@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, Any]:
    """
    Standard health check probe endpoint for Render, load balancers, and frontend.
    """
    uptime_seconds = round(time.time() - START_TIME, 2)
    db_status = get_db_health()

    is_healthy = db_status.get("connected", False)

    return JSONResponse(
        status_code=200 if is_healthy else 200,  # Return 200 so health probes pass during DB warmup
        content={
            "status": "HEALTHY" if is_healthy else "DEGRADED",
            "uptime_seconds": uptime_seconds,
            "database": db_status,
            "environment": os.getenv("RENDER_ENVIRONMENT", "production"),
        },
    )


@app.get("/metrics", tags=["Telemetry"])
async def prometheus_metrics_endpoint() -> JSONResponse:
    """
    Prometheus metrics exposition endpoint (RFC-compliant text format).
    Exposes request latencies, active compute transactions, and webhook processing volumes.
    """
    from fastapi.responses import Response
    metrics_text = generate_prometheus_metrics_text()
    return Response(
        content=metrics_text,
        media_type="text/plain; version=0.0.4; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )


# ---------------------------------------------------------------------------
# Mount Business Logic Routers
# ---------------------------------------------------------------------------
app.include_router(compute_router)
app.include_router(payment_router)

# Enterprise Wire / ACH Invoicing Router
try:
    from invoicing import invoicing_router
    app.include_router(invoicing_router)
    print("[ApexSovereign] Enterprise Invoicing router registered successfully.")
except Exception as inv_err:
    print(f"[ApexSovereign] Note: invoicing_router not mounted: {inv_err}")

# Cryptographic PayPal Telemetry Gateway Router
try:
    from paypal_gateway import paypal_gateway_router
    app.include_router(paypal_gateway_router)
    print("[ApexSovereign] PayPal Gateway router registered successfully.")
except Exception as e:
    print(f"[ApexSovereign] Note: paypal_gateway not mounted: {e}")

# AI Automation Agency (AAA) & Institutional Clearance Router
try:
    from app.agency import router as agency_router
    app.include_router(agency_router)
    print("[ApexSovereign] AI Automation Agency (AAA) router registered successfully.")
except Exception as agency_err:
    print(f"[ApexSovereign] Note: agency_router not mounted: {agency_err}")


# ---------------------------------------------------------------------------
# GPU Spot Inventory Real-Time Query Endpoint
# ---------------------------------------------------------------------------
@app.get("/compute/spot/inventory", tags=["Compute Broker"])
async def list_spot_inventory(
    tier: str = None,
    min_margin: float = None,
    db: Session = Depends(get_db),
):
    """
    Returns live bare-metal GPU spot nodes discovered by the autonomous broker engine,
    filtered by catalog tier and minimum profit margin.
    """
    from sqlalchemy import desc
    from gpu_discovery_engine import GpuSpotNode

    query = db.query(GpuSpotNode).filter(GpuSpotNode.status == "AVAILABLE")
    if tier:
        query = query.filter(GpuSpotNode.catalog_tier == tier.upper())
    if min_margin is not None:
        query = query.filter(GpuSpotNode.gross_margin_pct >= min_margin)

    nodes = query.order_by(desc(GpuSpotNode.gross_margin_pct)).limit(50).all()

    return {
        "count": len(nodes),
        "inventory": [
            {
                "node_id": n.node_id,
                "provider": n.provider,
                "region": n.region,
                "gpu_model": n.gpu_model,
                "catalog_tier": n.catalog_tier,
                "gpu_count": n.gpu_count,
                "vram_gb_total": n.vram_gb_total,
                "spot_ask_rate": float(n.spot_ask_rate),
                "catalog_retail_rate": float(n.catalog_retail_rate),
                "gross_margin_pct": float(n.gross_margin_pct),
                "pcie_bandwidth_gbps": n.pcie_bandwidth_gbps,
                "thermal_status": n.thermal_status,
                "network_latency_ms": n.network_latency_ms,
                "status": n.status,
                "last_heartbeat": n.last_heartbeat_at.isoformat() if n.last_heartbeat_at else None,
            }
            for n in nodes
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
