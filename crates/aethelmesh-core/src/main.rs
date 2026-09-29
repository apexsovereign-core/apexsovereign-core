mod arbitrage;
mod state;

use arbitrage::compute_optimal_arbitrage_route;
use state::MeshState;
use axum::{
    routing::{get, post},
    Router,
};
use once_cell::sync::Lazy;
use prometheus::{register_counter, register_histogram, Counter, Histogram};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

static HTTP_REQUESTS_TOTAL: Lazy<Counter> = Lazy::new(|| {
    register_counter!("aethelmesh_http_requests_total", "Total incoming HTTP requests").unwrap()
});

static ROUTE_LATENCY_HISTOGRAM: Lazy<Histogram> = Lazy::new(|| {
    register_histogram!(
        "aethelmesh_route_latency_ms",
        "Arbitrage routing latency in milliseconds"
    )
    .unwrap()
});

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(MeshState::default());

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/healthz", get(health_check))
        .route("/metrics", get(metrics_scraper))
        .route("/api/v1/arbitrage/route", post(compute_optimal_arbitrage_route))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse::<u16>().unwrap();
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("[AETHELMESH_CORE] High-speed GPU arbitrage mesh running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("Failed to bind TCP listener");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server encountered fatal error");
}

async fn health_check() -> axum::Json<serde_json::Value> {
    HTTP_REQUESTS_TOTAL.inc();
    axum::Json(serde_json::json!({
        "status": "HEALTHY",
        "mesh_version": "v0.3.0",
        "latency_sla": "<18ms",
        "arbitrage_spread": "32%-40%"
    }))
}

async fn metrics_scraper() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    tracing::warn!("[AETHELMESH_CORE] Shutdown signal caught. Evacuating connections...");
}
