import unittest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from backend.db.models import User, ChaosSession, Report
from backend.api.sessions import get_session
from backend.api.reports import get_report


class MultiTenancyIsolationTests(unittest.IsolatedAsyncioTestCase):

    async def test_session_isolation_cross_tenant_access_blocked(self):
        user1 = User(id="user_1", github_username="alice")
        user2 = User(id="user_2", github_username="bob")

        session_user1 = ChaosSession(id="sess_1", user_id="user_1", target_url="https://api.alice.com")

        mock_db = AsyncMock()
        mock_db.get.return_value = session_user1
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # User 1 accessing own session -> OK
        res = await get_session(session_id="sess_1", db=mock_db, user=user1)
        assert res["id"] == "sess_1"

        # User 2 accessing User 1's session -> 404
        with self.assertRaises(HTTPException) as exc:
            await get_session(session_id="sess_1", db=mock_db, user=user2)
        assert exc.exception.status_code == 404

    async def test_report_isolation_cross_tenant_access_blocked(self):
        user1 = User(id="user_1", github_username="alice")
        user2 = User(id="user_2", github_username="bob")

        session_user1 = ChaosSession(id="sess_1", user_id="user_1")
        report_user1 = Report(id="rep_1", session_id="sess_1", risk_score=42, fixes=[])

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # User 1 accessing own report -> OK
        mock_db.get.side_effect = [report_user1, session_user1]
        res = await get_report(report_id="rep_1", db=mock_db, current_user=user1)
        assert res["id"] == "rep_1"

        # Reset mock for User 2
        mock_db.get.side_effect = [report_user1, session_user1]
        with self.assertRaises(HTTPException) as exc:
            await get_report(report_id="rep_1", db=mock_db, current_user=user2)
        assert exc.exception.status_code == 404
