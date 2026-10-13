// ============================================================================
// ApexSovereign.ai - MULTI-MODAL INTELLIGENCE CRATE ROOT
// File: crates/multimodal/src/lib.rs
// ============================================================================

pub mod services;
pub mod transcription;

pub use services::{
    AudioMusicSynth, BindingPose, GroundedSearchFact, GroundingSearchQuery, MolecularDockingRequest,
    MolecularDockingResult, MusicGenerationRequest, MusicGenerationResult, ScienceEngine,
    SovereignGrounding, SovereignGroundingResponse, SpatialRouteTelemetry, VideoGenerationRequest,
    VideoGenerationResult, VisionVideoStudio,
};
pub use transcription::{
    AudioChunkPacket, AudioFormat, SovereignTranscriptionDaemon, TranscriptionEvent,
    TranscriptionSession, WordTiming,
};
