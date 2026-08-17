#!/usr/bin/env python3
"""
PatchFlow Incident Simulator
============================
Simulates real production errors captured by the PatchFlow Agent SDK
to trigger and test the autonomous fix & draft PR pipeline.

Usage:
  python scripts/simulate_incident.py --api-key pf_live_... --framework fastapi
  python scripts/simulate_incident.py --api-key pf_live_... --endpoint /crash --file app.py --line 20
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# ── Preset Error Scenarios ───────────────────────────────────────────────────

SCENARIOS = {
    "fastapi": {
        "error_type": "TypeError",
        "error_message": "'NoneType' object is not subscriptable",
        "endpoint": "/crash",
        "method": "GET",
        "status_code": 500,
        "framework": "fastapi",
        "stack_frames": [
            {
                "filename": "app.py",
                "lineno": 25,
                "function": "crash",
                "context_line": "title = data['title']",
            },
        ],
    },
    "nextjs": {
        "error_type": "TypeError",
        "error_message": "Cannot read properties of undefined (reading 'title')",
        "endpoint": "/crash",
        "method": "GET",
        "status_code": 500,
        "framework": "nextjs",
        "stack_frames": [
            {
                "filename": "app/crash/route.ts",
                "lineno": 8,
                "function": "GET",
                "context_line": "const title = data.notes.title;",
            },
        ],
    },
    "express": {
        "error_type": "TypeError",
        "error_message": "Cannot read property 'title' of undefined",
        "endpoint": "/api/notes",
        "method": "GET",
        "status_code": 500,
        "framework": "express",
        "stack_frames": [
            {
                "filename": "src/routes/notes.js",
                "lineno": 24,
                "function": "getNote",
                "context_line": "const title = note.title;",
            },
        ],
    },
    "hono": {
        "error_type": "Error",
        "error_message": "Item not found in cache",
        "endpoint": "/api/items",
        "method": "GET",
        "status_code": 500,
        "framework": "hono",
        "stack_frames": [
            {
                "filename": "src/index.ts",
                "lineno": 33,
                "function": "getItems",
                "context_line": "const items = cache.get('items');",
            },
        ],
    },
}


def make_request(url: str, method: str = "GET", headers: dict = None, data: dict = None) -> tuple[int, dict]:
    headers = headers or {}
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = res.read().decode("utf-8")
            return res.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="PatchFlow Production Incident Simulator")
    parser.add_argument("--api-key", required=True, help="Site API key (pf_live_...)")
    parser.add_argument("--host", default="https://patchflow-backend-xax6.onrender.com", help="PatchFlow API host")
    parser.add_argument(
        "--framework",
        choices=["fastapi", "nextjs", "express", "hono"],
        default="fastapi",
        help="Framework template to simulate (default: fastapi)",
    )
    parser.add_argument("--count", type=int, default=3, help="Number of error occurrences to send (default: 3 to trigger pipeline)")
    parser.add_argument("--endpoint", default="/crash", help="Endpoint path to test (default: /crash)")
    parser.add_argument("--file", help="Source filename override (e.g. app.py)")
    parser.add_argument("--line", type=int, help="Source line number override")
    parser.add_argument("--error-type", help="Error type override (e.g. TypeError, KeyError)")
    parser.add_argument("--message", help="Custom error message override")

    args = parser.parse_args()
    host = args.host.rstrip("/")
    api_key = args.api_key.strip()

    print("\n" + "=" * 60)
    print("  🚀 PatchFlow Incident Simulator")
    print(f"  Target Host: {host}")
    print(f"  Framework:   {args.framework}")
    print(f"  Endpoint:    {args.endpoint}")
    print(f"  Key Prefix:  {api_key[:14]}...")
    print(f"  Occurrences: {args.count}")
    print("=" * 60 + "\n")

    # Step 1: Health Ping
    print(" [1/3] Testing SDK Connection with Heartbeat Ping...")
    ping_status, ping_res = make_request(
        f"{host}/api/sdk/ping",
        method="POST",
        headers={"X-PatchFlow-Key": api_key},
    )

    if ping_status != 200:
        print(f" ❌ Ping failed (HTTP {ping_status}): {ping_res}")
        print(" Please verify your API key and that the PatchFlow backend is running.")
        sys.exit(1)

    site_name = ping_res.get("site", "Unknown Site")
    print(f" ✅ SDK Connected! Monitored Site: '{site_name}' (Status: Active)\n")

    # Step 2: Build Payload
    scenario = SCENARIOS[args.framework].copy()
    scenario["endpoint"] = args.endpoint
    if args.message:
        scenario["error_message"] = args.message
    if args.error_type:
        scenario["error_type"] = args.error_type
    if args.file:
        scenario["stack_frames"] = [
            {
                "filename": args.file,
                "lineno": args.line or 1,
                "function": "handler",
                "context_line": "",
            }
        ]

    top_frame = scenario["stack_frames"][-1]
    print(f" [2/3] Dispatching {args.count} Simulated Error Events:")
    print(f"       Type:     {scenario['error_type']}")
    print(f"       Message:  {scenario['error_message']}")
    print(f"       Endpoint: {scenario['method']} {scenario['endpoint']}")
    print(f"       Culprit:  {top_frame['filename']}:{top_frame['lineno']}\n")

    for i in range(1, args.count + 1):
        err_status, err_res = make_request(
            f"{host}/api/sdk/errors",
            method="POST",
            headers={"X-PatchFlow-Key": api_key},
            data=scenario,
        )

        if err_status == 200:
            occ = err_res.get("occurrence", i)
            triggered = err_res.get("pipeline_triggered", False)
            trigger_badge = "🔥 [AUTONOMOUS PIPELINE TRIGGERED]" if triggered else f"[Accumulating: {occ}/3]"
            print(f"   → Event {i}/{args.count}: Accepted by PatchFlow. {trigger_badge}")
        else:
            print(f"   → Event {i}/{args.count}: Failed (HTTP {err_status}): {err_res}")

        if i < args.count:
            time.sleep(0.3)

    print("\n [3/3] Event Dispatch Complete!")
    if args.count >= 3:
        print(" ✅ Threshold reached (>= 3 occurrences).")
        print(" 🤖 PatchFlow is now executing:")
        print("    1. FixAgent   → Cloning repo & generating syntax-validated patch")
        print("    2. ReviewAgent→ Senior developer verification")
        print("    3. GitHubAgent→ Opening draft PR with full incident context")
        print("\n Check your Dashboard or /incidents in the web app to view the live PR status!\n")
    else:
        print(f" ℹ️  Sent {args.count} occurrence(s). Send {3 - args.count} more to trigger auto-patching.\n")


if __name__ == "__main__":
    main()
