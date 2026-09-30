use std::sync::Arc;
use std::time::Instant;
use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

use crate::energy_bridge::EnergyMonitor;

pub const SPOT_PRICE_FLOOR_USD_HR: f64 = 1.85;
pub const SUB_18MS_LATENCY_THRESHOLD_MS: u32 = 18;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableGpuNode {
    pub node_id: String,
    pub region: String,
    pub arch: String,
    pub spot_price_usd_hr: f64,
    pub ping_latency_ms: u32,
    pub free_gpus: u32,
    pub power_zone_id: String,
}

pub struct AppState {
    pub energy_monitor: Arc<EnergyMonitor>,
    pub inventory_pool: Vec<AvailableGpuNode>,
}

impl AppState {
    pub fn new(energy_monitor: Arc<EnergyMonitor>) -> Self {
        let inventory_pool = vec![
            AvailableGpuNode {
                node_id: "node-is-geo-01".to_string(),
                region: "eu-north-ice".to_string(),
                arch: "H100_SXM5".to_string(),
                spot_price_usd_hr: 1.45,
                ping_latency_ms: 11,
                free_gpus: 64,
                power_zone_id: "ICELAND_GEO_01".to_string(),
            },
            AvailableGpuNode {
                node_id: "node-se-hydro-02".to_string(),
                region: "eu-north-swe".to_string(),
                arch: "H100_SXM5".to_string(),
                spot_price_usd_hr: 1.72,
                ping_latency_ms: 14,
                free_gpus: 32,
                power_zone_id: "NORDIC_HYDRO_02".to_string(),
            },
            AvailableGpuNode {
                node_id: "node-us-smr-03".to_string(),
                region: "us-west-smr".to_string(),
                arch: "B200_NVL72".to_string(),
                spot_price_usd_hr: 2.85,
                ping_latency_ms: 9,
                free_gpus: 48,
                power_zone_id: "US_WEST_SMR_01".to_string(),
            },
            AvailableGpuNode {
                node_id: "node-us-east-pjm".to_string(),
                region: "us-east-pjm".to_string(),
                arch: "A100_SXM4".to_string(),
                spot_price_usd_hr: 1.25,
                ping_latency_ms: 7,
                free_gpus: 96,
                power_zone_id: "PJM_EAST_GRID".to_string(),
            },
        ];

        Self {
            energy_monitor,
            inventory_pool,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MeshRoutingRequest {
    pub gpu_architecture: String,
    pub gpu_count: u32,
    pub max_acceptable_latency_ms: Option<u32>,
    pub max_cost_limit_usd_hr: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct MeshRoutingResponse {
    pub status: String,
    pub selected_node_id: String,
    pub target_region: String,
    pub spot_price_usd_hr: f64,
    pub retail_benchmark_usd_hr: f64,
    pub arbitrage_savings_pct: f64,
    pub estimated_latency_ms: u32,
    pub grid_lmp_usd_mwh: f64,
    pub routing_decision: String,
    pub evaluation_duration_micros: u128,
}

pub async fn evaluate_mesh_route(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MeshRoutingRequest>,
) -> Result<Json<MeshRoutingResponse>, (StatusCode, Json<serde_json::Value>)> {
    let t_start = Instant::now();
    let latency_cutoff = payload.max_acceptable_latency_ms.unwrap_or(SUB_18MS_LATENCY_THRESHOLD_MS);

    // 1. Filter candidates matching architecture, capacity, and latency boundary
    let candidates: Vec<&AvailableGpuNode> = state
        .inventory_pool
        .iter()
        .filter(|n| {
            n.arch.eq_ignore_ascii_case(&payload.gpu_architecture)
                && n.free_gpus >= payload.gpu_count
                && n.ping_latency_ms <= latency_cutoff
        })
        .collect();

    if candidates.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "ROUTING_FAILED",
                "message": "No nodes available satisfying required architecture, free GPUs, and latency envelope."
            })),
        ));
    }

    // 2. Select optimal node prioritizing spot price and power LMP efficiency
    let selected = candidates
        .into_iter()
        .min_by(|a, b| a.spot_price_usd_hr.partial_cmp(&b.spot_price_usd_hr).unwrap())
        .unwrap();

    let retail_reference_rate = match payload.gpu_architecture.to_uppercase().as_str() {
        "B200_NVL72" => 6.80,
        "H100_SXM5" => 4.10,
        _ => 2.45,
    };

    let savings_pct = ((retail_reference_rate - selected.spot_price_usd_hr) / retail_reference_rate) * 100.0;

    // Fetch corresponding grid LMP
    let zones_guard = state.energy_monitor.zones.read().await;
    let lmp = zones_guard
        .iter()
        .find(|z| z.zone_id == selected.power_zone_id)
        .map(|z| z.lmp_usd_per_mwh)
        .unwrap_or(35.0);

    let elapsed_micros = t_start.elapsed().as_micros();

    let decision = if selected.spot_price_usd_hr <= SPOT_PRICE_FLOOR_USD_HR {
        "SOVEREIGN_OPTIMAL_DISPATCH"
    } else {
        "STANDARD_COMMERCIAL_ROUTE"
    };

    Ok(Json(MeshRoutingResponse {
        status: "ROUTE_CONFIRMED".to_string(),
        selected_node_id: selected.node_id.clone(),
        target_region: selected.region.clone(),
        spot_price_usd_hr: selected.spot_price_usd_hr,
        retail_benchmark_usd_hr: retail_reference_rate,
        arbitrage_savings_pct: (savings_pct * 10.0).round() / 10.0,
        estimated_latency_ms: selected.ping_latency_ms,
        grid_lmp_usd_mwh: lmp,
        routing_decision: decision.to_string(),
        evaluation_duration_micros: elapsed_micros,
    }))
}
