# Inference benchmarks

This directory holds timestamped reports produced by
`benchmarks/vllm_test.py`. The harness measures one OpenAI-compatible vLLM
endpoint with a fixed prompt and records latency, throughput, token counts, and
failure counts.

## Run

```bash
python benchmarks/vllm_test.py \
  --base-url http://127.0.0.1:8000 \
  --model Qwen/Qwen2.5-7B-Instruct \
  --requests 64 \
  --concurrency 8 \
  --max-tokens 256 \
  --label "aws-h100-spot-poc"
```

For the SkyPilot PoC, start the manifest first:

```bash
sky launch -c apex-vllm-poc infra/skypilot/cluster.yaml
sky status --endpoint 8000 apex-vllm-poc
```

Then point `--base-url` at the returned endpoint. Tear the cluster down when
the run is complete:

```bash
sky down apex-vllm-poc
```

## Output

Each run writes two files:

- `vllm_<UTC timestamp>_<model>.json` — machine-readable report with parameters,
  hardware observations, summary aggregates, and bounded per-request samples.
- `vllm_<UTC timestamp>_<model>.md` — human-readable summary.

No report is created when model discovery fails or the harness is interrupted
before the measured phase. A failed run still writes a report with
`status: "failed"` and the bounded error strings; it does not fabricate
throughput or latency values.

## Dry run

`--dry-run` writes a non-measured report under `docs/benchmarks/dry-run/`. It
never contacts the endpoint, never loads a model, and records
`hardware: "none"`. Use it to validate CLI wiring and report metadata, not to
claim performance.

```bash
python benchmarks/vllm_test.py --dry-run --model dry-run-model
python benchmarks/vllm_test.py --validate-dry-run
```

Validation fails if any JSON report under `docs/benchmarks/dry-run/` is
missing `hardware: "none"`, `dry_run: true`, `summary.status: "dry_run"`, or
an empty `samples` array. A dry-run file must not contain measured values.

## Interpretation rules

- These are synthetic measurements of one run against one endpoint. They are
  not a production SLA, a cross-provider comparison, or a guarantee of future
  performance.
- Failed requests are excluded from latency and throughput aggregates and
  counted in `error_rate`. The harness does not retry.
- `TTFT` and `TPOT` require streaming. With `--no-stream` they are reported as
  not measured.
- Token counts use the server's `usage` block when present. Otherwise streaming
  chunk counts are labelled `chunk_estimate`; do not present those as exact.
- The harness performs no ledger writes and asserts no CU balance. The
  `$1.00 = 100 CU` invariant is context only.
- Do not hand-edit report metrics. Re-run the harness instead.

## Licensing

The harness uses only the Python standard library. vLLM and SkyPilot are
Apache-2.0 projects; model weights and NVIDIA container images carry their own
license terms. Verify those terms before changing the model or image in
`infra/skypilot/cluster.yaml`.
