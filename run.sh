#!/usr/bin/env bash
python3 apexsovereign-agency/agent_swarm.py &
uvicorn apexsovereign-agency.main:app --host 0.0.0.0 --port ${PORT:-10000}
