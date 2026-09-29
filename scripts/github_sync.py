#!/usr/bin/env python3
# scripts/github_sync.py
"""
ApexSovereign Holdings - Direct GitHub REST API Synchronization Engine
Pushes production code deliverables and configurations directly to ApexSovereign/enterprise-core
using authenticated GitHub REST API (PUT /repos/{owner}/{repo}/contents/{path}).
"""

import os
import sys
import base64
import json
import logging
from typing import Dict, Any, List
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [GITHUB_SYNC] %(message)s")
logger = logging.getLogger("github_sync")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    logger.critical("FATAL: Environment variable 'GITHUB_TOKEN' is missing. Terminating sync.")
    sys.exit(1)

TARGET_OWNER = os.getenv("GITHUB_OWNER", "ApexSovereign")
TARGET_REPO = os.getenv("GITHUB_REPO", "enterprise-core")
TARGET_BRANCH = os.getenv("GITHUB_BRANCH", "main")
API_BASE_URL = f"https://api.github.com/repos/{TARGET_OWNER}/{TARGET_REPO}/contents"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ApexSovereign-Sync-Engine/1.0"
}

FILES_TO_SYNC: List[str] = [
    "crates/aethelmesh/src/ebpf_sentinel.rs",
    "services/aurapharm/basal_load_sweeper.py",
    "supabase/migrations/20260930_insolvency_protection_rpc.sql",
    ".github/workflows/production_sentinels_ci.yml"
]


def get_existing_file_sha(file_path: str) -> str | None:
    url = f"{API_BASE_URL}/{file_path}?ref={TARGET_BRANCH}"
    response = requests.get(url, headers=HEADERS, timeout=10)
    if response.status_code == 200:
        return response.json().get("sha")
    elif response.status_code == 404:
        return None
    else:
        logger.error(f"Failed to query existing file metadata for '{file_path}': {response.status_code} {response.text}")
        return None


def commit_file_to_github(file_path: str, commit_message: str):
    if not os.path.exists(file_path):
        logger.error(f"Local file '{file_path}' does not exist. Skipping.")
        return False

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    b64_content = base64.b64encode(file_bytes).decode("utf-8")
    existing_sha = get_existing_file_sha(file_path)

    payload: Dict[str, Any] = {
        "message": commit_message,
        "content": b64_content,
        "branch": TARGET_BRANCH
    }
    if existing_sha:
        payload["sha"] = existing_sha

    url = f"{API_BASE_URL}/{file_path}"
    response = requests.put(url, headers=HEADERS, json=payload, timeout=15)

    if response.status_code in [200, 201]:
        logger.info(f"SUCCESS: Pushed '{file_path}' to {TARGET_OWNER}/{TARGET_REPO}@{TARGET_BRANCH} (HTTP {response.status_code}).")
        return True
    else:
        logger.error(f"FAILURE: Could not push '{file_path}': HTTP {response.status_code} - {response.text}")
        return False


def run_synchronization():
    logger.info("================================================================================")
    logger.info(f"APEXSOVEREIGN HOLDINGS - GITHUB API SYNC TO {TARGET_OWNER}/{TARGET_REPO}@{TARGET_BRANCH}")
    logger.info("================================================================================")

    success_count = 0
    for relative_path in FILES_TO_SYNC:
        msg = f"feat(sentinel): synchronize production deliverable {relative_path}"
        if commit_file_to_github(relative_path, msg):
            success_count += 1

    logger.info(f"Sync complete. {success_count}/{len(FILES_TO_SYNC)} files pushed to production.")
    if success_count != len(FILES_TO_SYNC):
        sys.exit(1)


if __name__ == "__main__":
    run_synchronization()
