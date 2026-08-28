import hashlib
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import BackgroundTasks, HTTPException

from backend.api.sdk import (
    SdkErrorPayload,
    StackFrame,
    _compute_fingerprint,
    _hash_key,
    _validate_api_key,
    ingest_error,
    sdk_ping,
)
from backend.api.sites import _generate_raw_key
from backend.core.redactor import redact_dict, redact_stack_frame, redact_string
from backend.core.sdk_incident_pipeline import _is_blocked
from backend.db.models import MonitoredSite, SiteApiKey


class RedactorTests(unittest.TestCase):
    def test_redact_secrets_in_text(self):
        text = "Failed to connect: password=supersecret123 to host"
        redacted = redact_string(text)
        self.assertNotIn("supersecret123", redacted)
        self.assertIn("***REDACTED***", redacted)

    def test_redact_bearer_token(self):
        text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"
        redacted = redact_string(text)
        self.assertNotIn("eyJhbGci", redacted)
        self.assertIn("Bearer ***REDACTED***", redacted)

    def test_redact_database_dsn(self):
        text = "Connection error: postgresql://admin:secret_pass@db.internal.com:5432/prod_db"
        redacted = redact_string(text)
        self.assertNotIn("secret_pass", redacted)
        self.assertIn("postgresql://***REDACTED***", redacted)

    def test_redact_email_addresses(self):
        text = "Error sending invoice to user customer.john@example.com in system"
        redacted = redact_string(text)
        self.assertNotIn("customer.john@example.com", redacted)
        self.assertIn("***EMAIL***", redacted)

    def test_redact_stack_frame(self):
        frame = {
            "filename": "src/services/order.py",
            "lineno": 42,
            "function": "process_payment",
            "context_line": "res = client.post(url, secret='secret123')",
            "vars": {
                "token": "tok_1234567890abcdef",
                "email": "user@test.com",
                "count": 5,
            },
        }
        safe_frame = redact_stack_frame(frame)
        self.assertEqual(safe_frame["filename"], "src/services/order.py")
        self.assertEqual(safe_frame["lineno"], 42)
        self.assertEqual(safe_frame["function"], "process_payment")
        self.assertNotIn("secret123", safe_frame["context_line"])
        self.assertEqual(safe_frame["vars"]["count"], 5)
        self.assertNotIn("user@test.com", str(safe_frame["vars"]))


class KeyAndFingerprintTests(unittest.TestCase):
    def test_generate_raw_key_format(self):
        key = _generate_raw_key()
        self.assertTrue(key.startswith("pf_live_"))
        self.assertEqual(len(key), 8 + 64)  # "pf_live_" + 64 hex chars (32 bytes)

    def test_hash_key_sha256(self):
        raw = "pf_live_testkey123"
        expected = hashlib.sha256(raw.encode()).hexdigest()
        self.assertEqual(_hash_key(raw), expected)

    def test_compute_fingerprint_deterministic(self):
        fp1 = _compute_fingerprint("site-1", "TypeError", "app/main.py", 100)
        fp2 = _compute_fingerprint("site-1", "TypeError", "app/main.py", 100)
        fp3 = _compute_fingerprint("site-1", "ValueError", "app/main.py", 100)
        fp4 = _compute_fingerprint("site-2", "TypeError", "app/main.py", 100)

        self.assertEqual(fp1, fp2)
        self.assertNotEqual(fp1, fp3)
        self.assertNotEqual(fp1, fp4)


class BlocklistTests(unittest.TestCase):
    def test_blocks_sensitive_files(self):
        blocked, reason = _is_blocked("backend/auth/login.py", "authenticate_user")
        self.assertTrue(blocked)
        self.assertIn("auth", reason)

        blocked, reason = _is_blocked("src/controllers/payment_checkout.ts", "charge")
        self.assertTrue(blocked)
        self.assertIn("payment", reason)

        blocked, reason = _is_blocked("alembic/versions/001_init.py", "upgrade")
        self.assertTrue(blocked)
        self.assertIn("alembic", reason)

        blocked, reason = _is_blocked("app/admin/users.py", "render_admin")
        self.assertTrue(blocked)
        self.assertIn("admin", reason)

    def test_allows_normal_application_files(self):
        blocked, _ = _is_blocked("src/pages/Notes.tsx", "handleCreateNote")
        self.assertFalse(blocked)

        blocked, _ = _is_blocked("app/api/products.py", "get_product_list")
        self.assertFalse(blocked)

        blocked, _ = _is_blocked("controllers/reports.go", "GenerateReport")
        self.assertFalse(blocked)


class SdkEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_validate_api_key_valid(self):
        raw_key = "pf_live_secret123456"
        key_hash = _hash_key(raw_key)

        site = MonitoredSite(id="site-123", name="My App", active=True)
        key_record = SiteApiKey(id="key-123", site_id="site-123", key_hash=key_hash, active=True)

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = key_record
        mock_db.execute.return_value = mock_result
        mock_db.get.return_value = site

        ret_key, ret_site = await _validate_api_key(raw_key, mock_db)
        self.assertEqual(ret_key.id, "key-123")
        self.assertEqual(ret_site.id, "site-123")

    async def test_validate_api_key_inactive_site(self):
        raw_key = "pf_live_secret123456"
        key_hash = _hash_key(raw_key)

        site = MonitoredSite(id="site-123", name="My App", active=False)
        key_record = SiteApiKey(id="key-123", site_id="site-123", key_hash=key_hash, active=True)

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = key_record
        mock_db.execute.return_value = mock_result
        mock_db.get.return_value = site

        ret_key, ret_site = await _validate_api_key(raw_key, mock_db)
        self.assertIsNone(ret_key)
        self.assertIsNone(ret_site)

    async def test_sdk_ping_success(self):
        raw_key = "pf_live_testkey"
        key_hash = _hash_key(raw_key)
        site = MonitoredSite(id="site-1", name="Demo Site", active=True)
        key_record = SiteApiKey(id="key-1", site_id="site-1", key_hash=key_hash, active=True)

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = key_record
        mock_db.execute.return_value = mock_result
        mock_db.get.return_value = site

        res = await sdk_ping(db=mock_db, x_patchflow_key=raw_key)
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["site"], "Demo Site")
        self.assertEqual(site.sdk_status, "active")
        self.assertIsNotNone(site.sdk_last_seen)

    async def test_ingest_error_missing_key_raises_401(self):
        mock_db = AsyncMock()
        payload = SdkErrorPayload(error_type="ValueError", error_message="Invalid input")
        bg_tasks = BackgroundTasks()

        with self.assertRaises(HTTPException) as ctx:
            await ingest_error(
                payload=payload,
                background_tasks=bg_tasks,
                db=mock_db,
                x_patchflow_key=None,
                authorization=None,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    async def test_ingest_error_threshold_triggering(self):
        raw_key = "pf_live_testkey"
        key_hash = _hash_key(raw_key)
        site = MonitoredSite(id="site-1", name="Demo App", github_repo="owner/demo", active=True)
        key_record = SiteApiKey(id="key-1", site_id="site-1", key_hash=key_hash, active=True)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        # Mock _validate_api_key
        mock_validate_result = MagicMock()
        mock_validate_result.scalar_one_or_none.return_value = key_record

        # Simulate 2 existing errors in db for this fingerprint
        existing_error_1 = MagicMock(processed=False)
        existing_error_2 = MagicMock(processed=False)
        mock_existing_result = MagicMock()
        mock_existing_result.scalars.return_value.all.return_value = [existing_error_1, existing_error_2]

        # Mock active incident dedup query
        mock_active_inc_result = MagicMock()
        mock_active_inc_result.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [mock_validate_result, mock_existing_result, mock_active_inc_result]
        mock_db.get.return_value = site

        payload = SdkErrorPayload(
            error_type="NullReferenceError",
            error_message="Cannot read property of undefined",
            endpoint="/api/notes",
            method="GET",
            stack_frames=[
                StackFrame(
                    filename="src/pages/Notes.tsx",
                    lineno=139,
                    function="renderNotes",
                    context_line="const title = note.title;",
                )
            ],
            framework="nextjs",
        )

        bg_tasks = BackgroundTasks()

        res = await ingest_error(
            payload=payload,
            background_tasks=bg_tasks,
            db=mock_db,
            x_patchflow_key=raw_key,
        )

        # 2 existing + 1 new = 3 occurrences -> threshold reached (pipeline_triggered = True)
        self.assertEqual(res["status"], "received")
        self.assertEqual(res["occurrence"], 3)
        self.assertTrue(res["pipeline_triggered"])
        self.assertEqual(len(bg_tasks.tasks), 1)


if __name__ == "__main__":
    unittest.main()
