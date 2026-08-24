"""Billing guards, tier limits, and quota enforcement for PatchFlow."""

from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import User


TIER_LIMITS = {
    "free": {
        "tier": "free",
        "name": "Hobby (Free)",
        "price_monthly": 0,
        "price_annual": 0,
        "max_monitored_sites": 1,
        "auto_fixes_enabled": False,
        "max_monthly_auto_fixes": 0,
        "max_monthly_chaos_scans": 3,
        "failure_modes_count": 18,
        "compiler_build_check": False,
        "ai_priority": "standard",
        "email_alerts": True,
        "description": "Real-time error monitoring and email alerts for 1 site with 3 chaos scans/mo.",
    },
    "pro": {
        "tier": "pro",
        "name": "Pro (Developer)",
        "price_monthly": 14,
        "price_annual": 132,  # $11/mo
        "max_monitored_sites": 5,
        "auto_fixes_enabled": True,
        "max_monthly_auto_fixes": 100,
        "max_monthly_chaos_scans": 30,
        "failure_modes_count": 18,
        "compiler_build_check": True,
        "ai_priority": "priority",
        "email_alerts": True,
        "description": "Autonomous GitHub PR fixes, pre-merge build verification, and 5 sites.",
    },
    "team": {
        "tier": "team",
        "name": "Team (Business)",
        "price_monthly": 42,
        "price_annual": 408,  # $34/mo
        "max_monitored_sites": 999999,  # unlimited
        "auto_fixes_enabled": True,
        "max_monthly_auto_fixes": 999999,  # unlimited
        "max_monthly_chaos_scans": 999999,  # unlimited
        "failure_modes_count": 18,
        "compiler_build_check": True,
        "ai_priority": "dedicated",
        "email_alerts": True,
        "description": "Unlimited sites, unlimited autonomous PRs, and dedicated fast-lane AI queue.",
    },
}


def get_tier_limits(tier: str | None) -> dict:
    """Return dictionary of features and limits for a given subscription tier."""
    normalized = (tier or "free").lower()
    return TIER_LIMITS.get(normalized, TIER_LIMITS["free"])


def ensure_monthly_usage_reset(user: User) -> bool:
    """
    Check if a month (30 days) has passed since usage_reset_at.
    If so, reset monthly usage counters. Returns True if reset occurred.
    """
    now = datetime.utcnow()
    last_reset = user.usage_reset_at or user.created_at or now

    if now - last_reset >= timedelta(days=30):
        user.monthly_incident_fixes_used = 0
        user.monthly_chaos_scans_used = 0
        user.usage_reset_at = now
        return True
    return False


def can_create_site(user: Optional[User], current_site_count: int) -> tuple[bool, str]:
    """
    Check if the user is allowed to connect a new monitored site under their plan.
    """
    if not user:
        # Default guest / unauthenticated allowance (matches free)
        if current_site_count >= 1:
            return False, "Free plan allows 1 monitored site. Upgrade to Pro ($14/mo) to connect up to 5 sites."
        return True, ""

    ensure_monthly_usage_reset(user)
    tier = (user.subscription_tier or "free").lower()
    limits = get_tier_limits(tier)
    max_sites = limits["max_monitored_sites"]

    if current_site_count >= max_sites:
        if tier == "free":
            return False, "The Free plan includes 1 monitored site. Upgrade to Pro ($14/mo) to monitor up to 5 sites."
        elif tier == "pro":
            return False, "Pro plan includes 5 monitored sites. Upgrade to Team ($42/mo) for unlimited sites."
        return False, f"Maximum site limit ({max_sites}) reached for {limits['name']} plan."

    return True, ""


def can_run_auto_fix(user: Optional[User]) -> tuple[bool, str]:
    """
    Check if the user's plan permits generating automated code fixes & opening GitHub PRs.
    Free tier users receive alerts and logs, but fixes are gated.
    """
    if not user:
        return False, "Auto-patching is locked on the Free tier. Upgrade to Pro ($14/mo) to enable autonomous GitHub Pull Requests."

    ensure_monthly_usage_reset(user)
    tier = (user.subscription_tier or "free").lower()
    limits = get_tier_limits(tier)

    # 1. Free tier gate: alerts only, no fixes
    if not limits["auto_fixes_enabled"]:
        return False, "Auto-patching is locked on the Free tier. Upgrade to Pro ($14/mo) to unlock autonomous code fixes and PR generation."

    # 2. Monthly quota check
    fixes_used = user.monthly_incident_fixes_used or 0
    max_fixes = limits["max_monthly_auto_fixes"]

    if fixes_used >= max_fixes:
        return False, f"Monthly auto-patch limit reached ({fixes_used}/{max_fixes} fixes). Upgrade to Team for unlimited fixes."

    return True, ""


def can_run_chaos_scan(user: Optional[User]) -> tuple[bool, str]:
    """
    Check if the user's plan permits running another chaos testing scan this month.
    """
    if not user:
        # Default unauthenticated guest allows 3 scans
        return True, ""

    ensure_monthly_usage_reset(user)
    tier = (user.subscription_tier or "free").lower()
    limits = get_tier_limits(tier)

    scans_used = user.monthly_chaos_scans_used or 0
    max_scans = limits["max_monthly_chaos_scans"]

    if scans_used >= max_scans:
        if tier == "free":
            return False, f"Monthly chaos scan limit reached ({scans_used}/{max_scans} scans). Upgrade to Pro ($14/mo) for 30 scans/mo."
        elif tier == "pro":
            return False, f"Monthly chaos scan limit reached ({scans_used}/{max_scans} scans). Upgrade to Team ($42/mo) for unlimited scans."
        return False, f"Monthly chaos scan limit reached ({scans_used}/{max_scans})."

    return True, ""


async def increment_fix_usage(db: AsyncSession, user: Optional[User]):
    """Increment the user's monthly auto-fix usage counter."""
    if not user:
        return
    ensure_monthly_usage_reset(user)
    user.monthly_incident_fixes_used = (user.monthly_incident_fixes_used or 0) + 1
    try:
        await db.commit()
    except Exception as exc:
        logger.warning(f"[Billing] Could not increment fix usage: {exc}")


async def increment_scan_usage(db: AsyncSession, user: Optional[User]):
    """Increment the user's monthly chaos scan usage counter."""
    if not user:
        return
    ensure_monthly_usage_reset(user)
    user.monthly_chaos_scans_used = (user.monthly_chaos_scans_used or 0) + 1
    try:
        await db.commit()
    except Exception as exc:
        logger.warning(f"[Billing] Could not increment scan usage: {exc}")
