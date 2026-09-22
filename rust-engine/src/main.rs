use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    env,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing::info;

#[derive(Clone, Default)]
struct AppState {
    service_name: Arc<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: String,
    version: &'static str,
    timestamp: u64,
}

#[derive(Serialize)]
struct TelemetryResponse {
    status: &'static str,
    accepted: bool,
    event_id: String,
}

#[derive(Deserialize)]
struct TelemetryEvent {
    event_id: Option<String>,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: (*state.service_name).clone(),
        version: env!("CARGO_PKG_VERSION"),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |duration| duration.as_secs()),
    })
}

async fn ingest(Json(event): Json<TelemetryEvent>) -> (StatusCode, Json<TelemetryResponse>) {
    let event_id = event
        .event_id
        .unwrap_or_else(|| format!("telemetry-{}", uuid_like_timestamp()));
    (
        StatusCode::ACCEPTED,
        Json(TelemetryResponse {
            status: "accepted",
            accepted: true,
            event_id,
        }),
    )
}

fn uuid_like_timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos())
}

async fn fallback() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "ApexSovereign route not found")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "info".to_owned()))
        .compact()
        .init();

    let port = env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let state = AppState {
        service_name: Arc::new("ApexSovereign Neural Mesh".to_owned()),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/telemetry/ingest", post(ingest))
        .fallback(fallback)
        .nest_service(
            "/",
            ServeDir::new("dist").append_index_html_on_directories(true),
        )
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(address).await?;
    info!(%address, "apex_ingestion_engine listening");
    axum::serve(listener, app).await?;
    Ok(())
}
