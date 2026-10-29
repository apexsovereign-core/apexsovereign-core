#!/usr/bin/env python3
"""Closed-loop vLLM OpenAI-compatible inference benchmark.

This harness measures the endpoint it is pointed at. It does not simulate a
GPU, invent a baseline, or claim a production SLA. Results are written as a
timestamped JSON report plus a Markdown summary under docs/benchmarks/.

Metrics:
- End-to-end request latency (p50/p90/p95/p99, mean, min, max)
- Time to first token (TTFT) and time per output token (TPOT) when streaming
- Request throughput, output-token throughput, and total-token throughput
- Error count and error rate

Requires only the Python standard library. No retries are performed: retries
would distort the latency distribution and hide upstream instability.

Example:
    python benchmarks/vllm_test.py \
        --base-url http://127.0.0.1:8000 \
        --model Qwen/Qwen2.5-7B-Instruct \
        --requests 64 --concurrency 8 --max-tokens 256

Dry run (no endpoint is contacted, output goes to docs/benchmarks/dry-run/):

    python benchmarks/vllm_test.py --dry-run --model dry-run-model
    python benchmarks/vllm_test.py --validate-dry-run
"""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

HARNESS_VERSION = "1.0.0"
CU_INVARIANT = "$1.00 = 100 CU"
DEFAULT_PROMPT = (
    "Write one concise technical paragraph explaining why deterministic "
    "distributed systems require idempotent write paths."
)
DEFAULT_MAX_TOKENS = 128
MAX_REQUESTS = 10_000
MAX_CONCURRENCY = 256
MAX_TOKENS_LIMIT = 4_096
MAX_SAMPLES = 1_000
MAX_ERROR_CHARS = 1_024
USER_AGENT = f"apex-vllm-benchmark/{HARNESS_VERSION}"
DRY_RUN_HARDWARE = "none"
DRY_RUN_DIRNAME = "dry-run"


class ConfigError(ValueError):
    """Raised when CLI input is not safe or usable."""


@dataclass
class RequestResult:
    index: int
    ok: bool
    latency_ms: float
    ttft_ms: float | None
    tpot_ms: float | None
    prompt_tokens: int | None
    completion_tokens: int | None
    token_source: str
    error: str | None = None


def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def log(message: str) -> None:
    print(f"[vllm-bench] {message}", file=sys.stderr, flush=True)


def bounded_int(minimum: int, maximum: int):
    def parse(value: str) -> int:
        try:
            parsed = int(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError("must be an integer") from exc
        if parsed < minimum or parsed > maximum:
            raise argparse.ArgumentTypeError(
                f"must be between {minimum} and {maximum}"
            )
        return parsed

    return parse


def validate_base_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urllib.parse.urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        raise argparse.ArgumentTypeError("base URL must use http:// or https://")
    if not parsed.netloc:
        raise argparse.ArgumentTypeError("base URL must include a host")
    if parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError(
            "base URL must not include a query string or fragment"
        )
    return normalized


def validate_label(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise argparse.ArgumentTypeError("label must not be empty")
    if len(cleaned) > 64:
        raise argparse.ArgumentTypeError("label must be at most 64 characters")
    return cleaned


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Measure vLLM OpenAI-compatible throughput and latency.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--base-url",
        type=validate_base_url,
        default=os.environ.get("VLLM_BASE_URL", "http://127.0.0.1:8000"),
        help="vLLM OpenAI-compatible base URL",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("VLLM_MODEL", ""),
        help="model id; discover from /v1/models when omitted",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("VLLM_API_KEY", ""),
        help="bearer token; prefer VLLM_API_KEY over the CLI",
    )
    parser.add_argument(
        "--requests",
        type=bounded_int(1, MAX_REQUESTS),
        default=32,
        help="measured requests",
    )
    parser.add_argument(
        "--concurrency",
        type=bounded_int(1, MAX_CONCURRENCY),
        default=4,
        help="in-flight request limit",
    )
    parser.add_argument(
        "--max-tokens",
        type=bounded_int(1, MAX_TOKENS_LIMIT),
        default=DEFAULT_MAX_TOKENS,
        help="output token cap per request",
    )
    parser.add_argument(
        "--warmup",
        type=bounded_int(0, 100),
        default=2,
        help="unmeasured warmup requests",
    )
    parser.add_argument(
        "--timeout",
        type=bounded_int(1, 600),
        default=120,
        help="per-request timeout in seconds",
    )
    parser.add_argument(
        "--prompt",
        default=DEFAULT_PROMPT,
        help="fixed prompt sent to every measured request",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repo_root / "docs" / "benchmarks",
        help="directory for JSON and Markdown reports",
    )
    parser.add_argument(
        "--label",
        type=validate_label,
        default=None,
        help="optional run label stored in the report",
    )
    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="disable streaming; TTFT/TPOT will be reported as not measured",
    )
    parser.add_argument(
        "--allow-errors",
        action="store_true",
        help="exit 0 when some requests fail (report still records the failures)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "write a non-measured report under docs/benchmarks/dry-run/; "
            "never contacts the endpoint"
        ),
    )
    parser.add_argument(
        "--validate-dry-run",
        action="store_true",
        help="validate every dry-run report and exit",
    )
    return parser.parse_args(argv)


def collect_hardware() -> dict[str, Any]:
    hardware: dict[str, Any] = {
        "platform": platform.platform(),
        "python": platform.python_version(),
        "machine": platform.machine(),
        "gpu": None,
        "cuda_driver": None,
    }
    try:
        completed = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,driver_version",
                "--format=csv,noheader",
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return hardware

    if completed.returncode == 0 and completed.stdout.strip():
        rows = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
        hardware["gpu"] = rows
        if rows:
            parts = [part.strip() for part in rows[0].split(",")]
            if len(parts) >= 3:
                hardware["cuda_driver"] = parts[2]
    return hardware


def git_commit() -> str | None:
    repo_root = Path(__file__).resolve().parents[1]
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None
    value = completed.stdout.strip()
    if completed.returncode == 0 and re.fullmatch(r"[0-9a-f]{40}", value):
        return value
    return None


def dry_run_directory() -> Path:
    return Path(__file__).resolve().parents[1] / "docs" / "benchmarks" / DRY_RUN_DIRNAME


def validate_dry_run_reports(directory: Path) -> list[Path]:
    """Reject any dry-run report that does not declare ``hardware: none``.

    Dry-run files record no measurement. A file in this directory that claims
    real hardware, measured samples, or a measured status is either misplaced
    or fabricated, and validation fails rather than letting it be cited.
    """
    if not directory.is_dir():
        return []

    validated: list[Path] = []
    for path in sorted(directory.rglob("*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ConfigError(f"{path.name}: unreadable dry-run report ({exc})") from exc
        if not isinstance(report, dict):
            raise ConfigError(f"{path.name}: dry-run report must be a JSON object")
        if report.get("dry_run") is not True:
            raise ConfigError(f"{path.name}: missing dry_run: true")
        if report.get("hardware") != DRY_RUN_HARDWARE:
            raise ConfigError(
                f'{path.name}: hardware must be the literal string "{DRY_RUN_HARDWARE}"'
            )
        summary = report.get("summary")
        if not isinstance(summary, dict) or summary.get("status") != "dry_run":
            raise ConfigError(f'{path.name}: summary.status must be "dry_run"')
        if summary.get("requests_total") != 0 or report.get("samples") != []:
            raise ConfigError(f"{path.name}: dry-run report must contain no measurements")
        validated.append(path)
    return validated


def dry_run_markdown(report: dict[str, Any]) -> str:
    return "\n".join(
        [
            "# vLLM inference benchmark — dry run",
            "",
            f"- Generated: `{report['generated_at']}`",
            f"- Harness: `{report['harness']} {report['harness_version']}`",
            f"- Label: `{report.get('label') or 'none'}`",
            f"- Endpoint (not contacted): `{report['endpoint']}`",
            f"- Model: `{report['model']}`",
            f"- Git commit: `{report.get('git_commit') or 'not available'}`",
            f"- Hardware: `{report['hardware']}`",
            "",
            "## What this report is",
            "",
            "This is a dry-run artifact. No endpoint was contacted, no GPU was",
            "measured, and no latency, throughput, or token value was produced.",
            "Every dry-run report must declare `hardware: none`;",
            "`--validate-dry-run` rejects any file in this directory that does",
            "not.",
            "",
        ]
    )


def run_dry_run(args: argparse.Namespace) -> int:
    directory = dry_run_directory()
    directory.mkdir(parents=True, exist_ok=True)

    report: dict[str, Any] = {
        "schema_version": 1,
        "harness": "apex-vllm-benchmark",
        "harness_version": HARNESS_VERSION,
        "generated_at": utc_now(),
        "dry_run": True,
        "label": args.label or None,
        "git_commit": git_commit(),
        "endpoint": args.base_url,
        "model": args.model.strip() or "dry-run-model",
        "parameters": {
            "requests": args.requests,
            "concurrency": args.concurrency,
            "max_tokens": args.max_tokens,
            "warmup": args.warmup,
            "timeout_s": args.timeout,
            "stream": not args.no_stream,
            "temperature": 0.0,
            "prompt_chars": len(args.prompt),
        },
        "hardware": DRY_RUN_HARDWARE,
        "summary": {
            "status": "dry_run",
            "requests_total": 0,
            "requests_ok": 0,
            "requests_failed": 0,
            "error_rate": None,
            "wall_time_s": 0.0,
            "concurrency": args.concurrency,
            "max_tokens": args.max_tokens,
            "request_throughput_rps": None,
            "output_tokens_total": 0,
            "output_token_throughput_per_s": None,
            "total_token_throughput_per_s": None,
            "prompt_tokens_total": None,
            "token_sources": [],
            "latency_ms": None,
            "ttft_ms": None,
            "tpot_ms": None,
        },
        "samples": [],
        "samples_truncated": False,
        "notes": [
            "Dry run only: no endpoint was contacted.",
            'Hardware is the literal string "none"; no GPU was measured.',
            "No latency, throughput, or token metric in this file was measured.",
        ],
    }

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", report["model"]).strip("_")
    slug = (slug or "model")[:80]
    stem = f"vllm_dry_run_{timestamp}_{slug}"

    json_path = directory / f"{stem}.json"
    markdown_path = directory / f"{stem}.md"
    json_tmp = json_path.with_suffix(".json.tmp")
    json_tmp.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(json_tmp, json_path)

    markdown_tmp = markdown_path.with_suffix(".md.tmp")
    markdown_tmp.write_text(dry_run_markdown(report), encoding="utf-8")
    os.replace(markdown_tmp, markdown_path)

    validated = validate_dry_run_reports(directory)
    log(f"wrote {json_path}")
    log(f"wrote {markdown_path}")
    log(f"validated {len(validated)} dry-run report(s)")
    return 0


def percentile(values: Iterable[float], p: float) -> float | None:
    ordered = sorted(values)
    if not ordered:
        return None
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * (p / 100.0)
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return ordered[lower]
    fraction = rank - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def distribution(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    return {
        "count": len(values),
        "mean": round(sum(values) / len(values), 3),
        "min": round(min(values), 3),
        "p50": round(percentile(values, 50) or 0.0, 3),
        "p90": round(percentile(values, 90) or 0.0, 3),
        "p95": round(percentile(values, 95) or 0.0, 3),
        "p99": round(percentile(values, 99) or 0.0, 3),
        "max": round(max(values), 3),
    }


def bounded_error(message: str) -> str:
    compact = " ".join(str(message).split())
    return compact[:MAX_ERROR_CHARS]


class BenchmarkClient:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str,
        max_tokens: int,
        timeout: float,
        prompt: str,
        stream: bool,
    ) -> None:
        self.base_url = base_url
        self.model = model
        self.api_key = api_key
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.prompt = prompt
        self.stream = stream

    def _headers(self, stream: bool) -> dict[str, str]:
        headers = {
            "Accept": "text/event-stream" if stream else "application/json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(self, *, stream: bool, max_tokens: int) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": self.prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.0,
            "stream": stream,
        }
        if stream:
            payload["stream_options"] = {"include_usage": True}
        return payload

    def run_request(self, index: int, *, warmup: bool = False) -> RequestResult:
        max_tokens = min(16, self.max_tokens) if warmup else self.max_tokens
        stream = self.stream and not warmup
        payload = self._payload(stream=stream, max_tokens=max_tokens)
        request = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=self._headers(stream),
            method="POST",
        )

        started = time.perf_counter()
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                if stream:
                    return self._read_stream(index, response, started)
                return self._read_json(index, response, started)
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read(MAX_ERROR_CHARS).decode("utf-8", errors="replace")
            except Exception:
                detail = ""
            return RequestResult(
                index=index,
                ok=False,
                latency_ms=(time.perf_counter() - started) * 1_000.0,
                ttft_ms=None,
                tpot_ms=None,
                prompt_tokens=None,
                completion_tokens=None,
                token_source="none",
                error=bounded_error(f"HTTP {exc.code}: {detail}"),
            )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            return RequestResult(
                index=index,
                ok=False,
                latency_ms=(time.perf_counter() - started) * 1_000.0,
                ttft_ms=None,
                tpot_ms=None,
                prompt_tokens=None,
                completion_tokens=None,
                token_source="none",
                error=bounded_error(f"{type(exc).__name__}: {reason}"),
            )

    def _read_json(
        self,
        index: int,
        response: Any,
        started: float,
    ) -> RequestResult:
        body = response.read()
        latency_ms = (time.perf_counter() - started) * 1_000.0
        payload = json.loads(body.decode("utf-8"))
        usage = payload.get("usage") if isinstance(payload, dict) else None
        usage = usage if isinstance(usage, dict) else {}
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
        token_source = "usage" if isinstance(completion_tokens, int) else "missing"
        return RequestResult(
            index=index,
            ok=True,
            latency_ms=latency_ms,
            ttft_ms=None,
            tpot_ms=None,
            prompt_tokens=prompt_tokens if isinstance(prompt_tokens, int) else None,
            completion_tokens=(
                completion_tokens if isinstance(completion_tokens, int) else None
            ),
            token_source=token_source,
        )

    def _read_stream(
        self,
        index: int,
        response: Any,
        started: float,
    ) -> RequestResult:
        first_token_at: float | None = None
        content_chunks = 0
        usage: dict[str, Any] = {}

        for raw_line in response:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict):
                continue
            event_usage = event.get("usage")
            if isinstance(event_usage, dict):
                usage = event_usage
            choices = event.get("choices")
            if not isinstance(choices, list) or not choices:
                continue
            choice = choices[0] if isinstance(choices[0], dict) else {}
            delta = choice.get("delta")
            if not isinstance(delta, dict):
                continue
            content = delta.get("content")
            if not isinstance(content, str) or not content:
                continue
            content_chunks += 1
            if first_token_at is None:
                first_token_at = time.perf_counter()

        finished = time.perf_counter()
        latency_ms = (finished - started) * 1_000.0
        ttft_ms = (
            (first_token_at - started) * 1_000.0
            if first_token_at is not None
            else None
        )
        usage_completion = usage.get("completion_tokens")
        completion_tokens = (
            usage_completion
            if isinstance(usage_completion, int)
            else content_chunks
        )
        prompt_tokens = usage.get("prompt_tokens")
        token_source = (
            "usage"
            if isinstance(usage_completion, int)
            else "chunk_estimate"
        )
        tpot_ms = None
        if (
            ttft_ms is not None
            and isinstance(completion_tokens, int)
            and completion_tokens > 1
        ):
            tpot_ms = (latency_ms - ttft_ms) / (completion_tokens - 1)

        return RequestResult(
            index=index,
            ok=True,
            latency_ms=latency_ms,
            ttft_ms=ttft_ms,
            tpot_ms=tpot_ms,
            prompt_tokens=prompt_tokens if isinstance(prompt_tokens, int) else None,
            completion_tokens=completion_tokens,
            token_source=token_source,
        )


def discover_models(
    base_url: str,
    api_key: str,
    timeout: float = 10.0,
) -> list[str]:
    request = urllib.request.Request(
        f"{base_url}/v1/models",
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
            json.JSONDecodeError):
        return []

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return []
    models: list[str] = []
    for entry in data:
        if isinstance(entry, dict) and isinstance(entry.get("id"), str):
            models.append(entry["id"])
    return models


def summarize(
    results: list[RequestResult],
    wall_time_s: float,
    *,
    concurrency: int,
    max_tokens: int,
) -> dict[str, Any]:
    successes = [result for result in results if result.ok]
    failures = [result for result in results if not result.ok]
    latencies = [result.latency_ms for result in successes]
    ttfts = [result.ttft_ms for result in successes if result.ttft_ms is not None]
    tpots = [result.tpot_ms for result in successes if result.tpot_ms is not None]
    completion_tokens = [
        result.completion_tokens
        for result in successes
        if isinstance(result.completion_tokens, int)
    ]
    prompt_tokens = [
        result.prompt_tokens
        for result in successes
        if isinstance(result.prompt_tokens, int)
    ]
    token_sources = sorted({result.token_source for result in successes})

    total_completion = sum(completion_tokens)
    total_prompt = sum(prompt_tokens) if len(prompt_tokens) == len(successes) else None
    request_rate = len(successes) / wall_time_s if wall_time_s > 0 else None
    completion_rate = (
        total_completion / wall_time_s if wall_time_s > 0 else None
    )
    total_rate = (
        (total_completion + total_prompt) / wall_time_s
        if wall_time_s > 0 and total_prompt is not None
        else None
    )

    status = "ok"
    if not successes:
        status = "failed"
    elif failures:
        status = "partial"

    return {
        "status": status,
        "requests_total": len(results),
        "requests_ok": len(successes),
        "requests_failed": len(failures),
        "error_rate": round(len(failures) / len(results), 6) if results else None,
        "wall_time_s": round(wall_time_s, 3),
        "concurrency": concurrency,
        "max_tokens": max_tokens,
        "request_throughput_rps": (
            round(request_rate, 3) if request_rate is not None else None
        ),
        "output_tokens_total": total_completion,
        "output_token_throughput_per_s": (
            round(completion_rate, 3) if completion_rate is not None else None
        ),
        "total_token_throughput_per_s": (
            round(total_rate, 3) if total_rate is not None else None
        ),
        "prompt_tokens_total": total_prompt,
        "token_sources": token_sources,
        "latency_ms": distribution(latencies),
        "ttft_ms": distribution(ttfts),
        "tpot_ms": distribution(tpots),
    }


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines: list[str] = []
    title = "# vLLM inference benchmark"
    if report.get("label"):
        title += f" — {report['label']}"
    lines.extend(
        [
            title,
            "",
            f"- Generated: `{report['generated_at']}`",
            f"- Harness: `{report['harness']} {report['harness_version']}`",
            f"- Endpoint: `{report['endpoint']}`",
            f"- Model: `{report['model']}`",
            f"- Git commit: `{report.get('git_commit') or 'not available'}`",
            f"- Status: **{summary['status']}**",
            f"- CU invariant: `{CU_INVARIANT}` (context only; no ledger writes here)",
            "",
            "## Load",
            "",
            "| Metric | Value |",
            "| --- | ---: |",
            f"| Requests | {summary['requests_total']} |",
            f"| Successful | {summary['requests_ok']} |",
            f"| Failed | {summary['requests_failed']} |",
            f"| Error rate | {summary['error_rate']} |",
            f"| Concurrency | {summary['concurrency']} |",
            f"| Max output tokens | {summary['max_tokens']} |",
            f"| Wall time (s) | {summary['wall_time_s']} |",
            f"| Request throughput (rps) | {summary['request_throughput_rps']} |",
            f"| Output token throughput (tok/s) | {summary['output_token_throughput_per_s']} |",
            f"| Total token throughput (tok/s) | {summary['total_token_throughput_per_s']} |",
            "",
            "## Latency",
            "",
            "| Metric | Count | Mean | p50 | p90 | p95 | p99 | Max |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for key, label in (
        ("latency_ms", "End-to-end latency (ms)"),
        ("ttft_ms", "TTFT (ms)"),
        ("tpot_ms", "TPOT (ms)"),
    ):
        stats = summary.get(key)
        if stats:
            lines.append(
                f"| {label} | {stats['count']} | {stats['mean']} | "
                f"{stats['p50']} | {stats['p90']} | {stats['p95']} | "
                f"{stats['p99']} | {stats['max']} |"
            )
        else:
            lines.append(f"| {label} | 0 | — | — | — | — | — | — |")

    lines.extend(
        [
            "",
            "## Method",
            "",
            "- Closed-loop concurrency; each request is a single chat completion "
            "with `temperature: 0.0`.",
            "- No retries. A failed request is recorded as a failure and excluded "
            "from latency and throughput aggregates.",
            "- TTFT/TPOT require streaming; `--no-stream` reports them as "
            "not measured.",
            "- Token counts come from the server `usage` block when available; "
            "otherwise streaming chunk counts are labelled `chunk_estimate`.",
            "- This is a synthetic microbenchmark of the measured run, not a "
            "production SLA or a cross-provider comparison.",
            "",
        ]
    )

    hardware = report.get("hardware") or {}
    if hardware.get("gpu"):
        lines.extend(["## Hardware", ""])
        for row in hardware["gpu"]:
            lines.append(f"- GPU: `{row}`")
        lines.append(f"- Python: `{hardware.get('python')}`")
        lines.append(f"- Platform: `{hardware.get('platform')}`")
        lines.append("")

    if summary["requests_failed"]:
        lines.extend(
            [
                "## Failures",
                "",
                f"{summary['requests_failed']} request(s) failed. Error strings "
                "are bounded in the JSON report; no prompt or response content "
                "is stored.",
                "",
            ]
        )

    return "\n".join(lines)


def write_reports(report: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", report["model"]).strip("_")
    slug = (slug or "model")[:80]
    stem = f"vllm_{timestamp}_{slug}"

    json_path = output_dir / f"{stem}.json"
    markdown_path = output_dir / f"{stem}.md"

    json_tmp = json_path.with_suffix(".json.tmp")
    json_tmp.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(json_tmp, json_path)

    markdown_tmp = markdown_path.with_suffix(".md.tmp")
    markdown_tmp.write_text(markdown_report(report), encoding="utf-8")
    os.replace(markdown_tmp, markdown_path)

    return json_path, markdown_path


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.validate_dry_run:
        validated = validate_dry_run_reports(dry_run_directory())
        log(f"validated {len(validated)} dry-run report(s)")
        return 0

    if args.dry_run:
        return run_dry_run(args)

    if args.requests > MAX_REQUESTS:
        raise ConfigError(f"requests must not exceed {MAX_REQUESTS}")

    stream = not args.no_stream
    model = args.model.strip()
    discovered: list[str] = []
    if not model:
        log(f"discovering models from {args.base_url}/v1/models")
        discovered = discover_models(args.base_url, args.api_key)
        if not discovered:
            log(
                "could not discover a model; pass --model or set VLLM_MODEL"
            )
            return 2
        model = discovered[0]

    client = BenchmarkClient(
        base_url=args.base_url,
        model=model,
        api_key=args.api_key,
        max_tokens=args.max_tokens,
        timeout=float(args.timeout),
        prompt=args.prompt,
        stream=stream,
    )

    log(
        f"endpoint={args.base_url} model={model} requests={args.requests} "
        f"concurrency={args.concurrency} max_tokens={args.max_tokens} "
        f"stream={stream}"
    )

    for warmup_index in range(args.warmup):
        result = client.run_request(-1 - warmup_index, warmup=True)
        if not result.ok:
            log(f"warmup {warmup_index + 1}/{args.warmup} failed: {result.error}")
        else:
            log(f"warmup {warmup_index + 1}/{args.warmup} ok")

    started = time.perf_counter()
    results: list[RequestResult] = []
    progress_step = max(1, args.requests // 10)
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(client.run_request, index)
            for index in range(args.requests)
        ]
        for completed_count, future in enumerate(as_completed(futures), start=1):
            results.append(future.result())
            if completed_count % progress_step == 0 or completed_count == args.requests:
                log(f"completed {completed_count}/{args.requests}")
    wall_time_s = time.perf_counter() - started

    results.sort(key=lambda result: result.index)
    summary = summarize(
        results,
        wall_time_s,
        concurrency=args.concurrency,
        max_tokens=args.max_tokens,
    )

    report = {
        "schema_version": 1,
        "harness": "apex-vllm-benchmark",
        "harness_version": HARNESS_VERSION,
        "generated_at": utc_now(),
        "label": args.label or None,
        "git_commit": git_commit(),
        "endpoint": args.base_url,
        "model": model,
        "discovered_models": discovered,
        "parameters": {
            "requests": args.requests,
            "concurrency": args.concurrency,
            "max_tokens": args.max_tokens,
            "warmup": args.warmup,
            "timeout_s": args.timeout,
            "stream": stream,
            "temperature": 0.0,
            "prompt_chars": len(args.prompt),
        },
        "hardware": collect_hardware(),
        "summary": summary,
        "samples": [
            asdict(result)
            for result in results[:MAX_SAMPLES]
        ],
        "samples_truncated": len(results) > MAX_SAMPLES,
        "notes": [
            "No retries; failures are excluded from latency aggregates.",
            "TTFT and TPOT are only measured when streaming.",
            "Token counts use server usage when available; chunk estimates are labelled.",
            "Synthetic run measurement; not a production SLA.",
        ],
    }

    json_path, markdown_path = write_reports(report, args.output_dir)
    log(f"wrote {json_path}")
    log(f"wrote {markdown_path}")
    log(
        f"status={summary['status']} ok={summary['requests_ok']} "
        f"failed={summary['requests_failed']} "
        f"rps={summary['request_throughput_rps']} "
        f"p50_ms={summary['latency_ms']['p50'] if summary['latency_ms'] else None}"
    )

    if summary["status"] == "failed":
        return 1
    if summary["status"] == "partial" and not args.allow_errors:
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("interrupted")
        sys.exit(130)
    except ConfigError as exc:
        log(f"configuration error: {exc}")
        sys.exit(2)
