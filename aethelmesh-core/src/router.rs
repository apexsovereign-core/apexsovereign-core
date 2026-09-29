use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Default)]
pub struct AppState;

#[derive(Debug, Deserialize)]
pub struct ComputeRouteRequest {
    pub gpu_model: String,      // e.g., "H100", "B200", "A100"
    pub required_vram_gb: u32,
    pub max_cost_per_hr: f64,   // Threshold in USD
    pub max_latency_ms: u32,
}

#[derive(Debug, Serialize)]
pub struct ComputeRouteResponse {
    pub selected_node_id: String,
    pub location_region: String,
    pub power_source: String,
    pub spot_price_usd_hr: f64,
    pub estimated_latency_ms: u32,
    pub savings_percentage: f64,
    pub action: String,
}

pub async fn evaluate_gpu_route(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<ComputeRouteRequest>,
) -> Result<Json<ComputeRouteResponse>, (StatusCode, Json<serde_json::Value>)> {
    if payload.required_vram_gb == 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "INVALID_VRAM_REQUIREMENT"})),
        ));
    }

    // High-efficiency energy arbitrage route evaluation
    let (node_id, region, power_type, base_price, latency) = match payload.gpu_model.as_str() {
        "B200" => ("node-is-bio-01", "Iceland-Reykjanes", "Geothermal", 2.10, 12),
        "H100" => ("node-no-hydro-04", "Norway-Nord", "Hydroelectric", 1.45, 14),
        _ => ("node-us-solar-09", "US-West-SMR", "Nuclear/Solar", 0.85, 11),
    };

    let retail_reference_price = match payload.gpu_model.as_str() {
        "B200" => 4.50,
        "H100" => 3.20,
        _ => 1.80,
    };

    let savings = ((retail_reference_price - base_price) / retail_reference_price) * 100.0;

    if base_price > payload.max_cost_per_hr {
        return Err((
            StatusCode::PRECONDITION_FAILED,
            Json(serde_json::json!({
                "error": "COST_THRESHOLD_EXCEEDED",
                "lowest_available": base_price,
                "offered_max": payload.max_cost_per_hr
            })),
        ));
    }

    Ok(Json(ComputeRouteResponse {
        selected_node_id: node_id.to_string(),
        location_region: region.to_string(),
        power_source: power_type.to_string(),
        spot_price_usd_hr: base_price,
        estimated_latency_ms: latency,
        savings_percentage: (savings * 100.0).round() / 100.0,
        action: "LOCK_AND_DISPATCH".to_string(),
    }))
}
