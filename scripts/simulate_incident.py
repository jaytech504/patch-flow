#!/usr/bin/env python3
"""
PatchFlow Incident Simulator
============================
Simulates real production errors captured by the PatchFlow Agent SDK
to trigger and test the autonomous fix & draft PR pipeline.

Usage:
  python scripts/simulate_incident.py --api-key pf_live_...
  python scripts/simulate_incident.py --api-key pf_live_... --framework nextjs --count 3
  python scripts/simulate_incident.py --api-key pf_live_... --host http://localhost:8000
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
    "nextjs": {
        "error_type": "TypeError",
        "error_message": "Cannot read properties of undefined (reading 'title')",
        "endpoint": "/api/notes",
        "method": "GET",
        "status_code": 500,
        "framework": "nextjs",
        "stack_frames": [
            {
                "filename": "node_modules/next/dist/server/base-server.js",
                "lineno": 1120,
                "function": "renderToHTML",
                "context_line": "await renderReq(req, res);",
            },
            {
                "filename": "src/pages/Notes.tsx",
                "lineno": 139,
                "function": "NotesPage",
                "context_line": "const title = note.title;",
            },
        ],
    },
    "fastapi": {
        "error_type": "httpx.TimeoutException",
        "error_message": "Timed out after 5.0 seconds waiting for downstream payment gateway",
        "endpoint": "/api/payments/charge",
        "method": "POST",
        "status_code": 500,
        "framework": "fastapi",
        "stack_frames": [
            {
                "filename": "starlette/middleware/errors.py",
                "lineno": 162,
                "function": "__call__",
                "context_line": "await self.app(scope, receive, _send)",
            },
            {
                "filename": "app/services/payment.py",
                "lineno": 74,
                "function": "charge_customer",
                "context_line": "resp = await client.post('/charges', json=payload)",
            },
        ],
    },
    "express": {
        "error_type": "UnhandledPromiseRejection",
        "error_message": "Unhandled rejection in async handler: User not found in database",
        "endpoint": "/api/users/profile",
        "method": "GET",
        "status_code": 500,
        "framework": "express",
        "stack_frames": [
            {
                "filename": "node_modules/express/lib/router/layer.js",
                "lineno": 95,
                "function": "handle_request",
                "context_line": "fn(req, res, next);",
            },
            {
                "filename": "src/routes/users.js",
                "lineno": 48,
                "function": "getUserProfile",
                "context_line": "const profile = await db.findUser(req.params.id);",
            },
        ],
    },
    "hono": {
        "error_type": "Error",
        "error_message": "Database pool exhausted: connection failed after 3000ms",
        "endpoint": "/api/items",
        "method": "GET",
        "status_code": 500,
        "framework": "hono",
        "stack_frames": [
            {
                "filename": "src/index.ts",
                "lineno": 33,
                "function": "getItems",
                "context_line": "const items = await pool.query('SELECT * FROM items');",
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
    parser.add_argument("--host", default="http://localhost:8000", help="PatchFlow API host (default: http://localhost:8000)")
    parser.add_argument(
        "--framework",
        choices=["nextjs", "fastapi", "express", "hono"],
        default="nextjs",
        help="Framework template to simulate (default: nextjs)",
    )
    parser.add_argument("--count", type=int, default=3, help="Number of error occurrences to send (default: 3 to trigger pipeline)")
    parser.add_argument("--message", help="Custom error message override")
    parser.add_argument("--endpoint", help="Custom endpoint path override")

    args = parser.parse_args()
    host = args.host.rstrip("/")
    api_key = args.api_key.strip()

    print("\n" + "=" * 60)
    print("  🚀 PatchFlow Incident Simulator")
    print(f"  Target Host: {host}")
    print(f"  Framework:   {args.framework}")
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
    if args.message:
        scenario["error_message"] = args.message
    if args.endpoint:
        scenario["endpoint"] = args.endpoint

    print(f" [2/3] Dispatching {args.count} Simulated Error Events:")
    print(f"       Type:     {scenario['error_type']}")
    print(f"       Message:  {scenario['error_message']}")
    print(f"       Endpoint: {scenario['method']} {scenario['endpoint']}\n")

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
