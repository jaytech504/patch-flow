"""Lemon Squeezy Billing API, checkout generation, and webhook processor."""

from __future__ import annotations
import hmac
import hashlib
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
import httpx

from backend.db.session import get_db
from backend.db.models import User, MonitoredSite
from backend.auth.dependencies import get_current_user, get_optional_user
from backend.core.config import get_settings
from backend.core.billing_guards import (
    TIER_LIMITS,
    get_tier_limits,
    ensure_monthly_usage_reset,
)

settings = get_settings()
router = APIRouter()


# ── Pydantic Request Models ───────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    tier: str  # "pro" or "team"
    billing_cycle: str = "monthly"  # "monthly" or "annual"
    redirect_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans():
    """Return all available subscription plans, pricing, and feature comparison."""
    return {
        "plans": [
            TIER_LIMITS["free"],
            TIER_LIMITS["pro"],
            TIER_LIMITS["team"],
        ],
        "currency": "USD",
    }


@router.get("/subscription")
async def get_user_subscription(
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Return current user's subscription details, renewal dates, and usage counters."""
    if not user:
        # Default guest representation
        return {
            "tier": "free",
            "tier_name": "Hobby (Free)",
            "status": "none",
            "limits": TIER_LIMITS["free"],
            "usage": {
                "monitored_sites_count": 0,
                "monthly_incident_fixes_used": 0,
                "monthly_chaos_scans_used": 0,
            },
            "renews_at": None,
            "ends_at": None,
        }

    ensure_monthly_usage_reset(user)
    await db.commit()

    # Count user's current monitored sites
    sites_res = await db.execute(
        select(MonitoredSite).where(MonitoredSite.user_id == user.id)
    )
    sites_count = len(sites_res.scalars().all())

    tier = (user.subscription_tier or "free").lower()
    limits = get_tier_limits(tier)

    return {
        "tier": tier,
        "tier_name": limits["name"],
        "status": user.subscription_status or "none",
        "limits": limits,
        "usage": {
            "monitored_sites_count": sites_count,
            "monthly_incident_fixes_used": user.monthly_incident_fixes_used or 0,
            "monthly_chaos_scans_used": user.monthly_chaos_scans_used or 0,
        },
        "renews_at": user.subscription_renews_at.isoformat() if user.subscription_renews_at else None,
        "ends_at": user.subscription_ends_at.isoformat() if user.subscription_ends_at else None,
        "has_active_subscription": user.subscription_status == "active" and tier in ("pro", "team"),
    }


@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generate a Lemon Squeezy hosted checkout URL for Pro ($14/mo) or Team ($42/mo).
    Prefills customer email and embeds user_id in checkout custom data for webhook mapping.
    """
    tier = body.tier.lower()
    cycle = body.billing_cycle.lower()

    if tier not in ("pro", "team"):
        raise HTTPException(status_code=400, detail="Invalid tier. Choose 'pro' or 'team'.")

    # Determine variant ID from configuration
    variant_id = None
    if tier == "pro":
        variant_id = (
            settings.lemon_squeezy_pro_annual_variant_id
            if cycle == "annual"
            else settings.lemon_squeezy_pro_monthly_variant_id
        )
    elif tier == "team":
        variant_id = (
            settings.lemon_squeezy_team_annual_variant_id
            if cycle == "annual"
            else settings.lemon_squeezy_team_monthly_variant_id
        )

    redirect_url = body.redirect_url or f"{settings.frontend_url.rstrip('/')}/settings/billing?checkout=success"

    # If Lemon Squeezy API key and variant_id are configured, create hosted checkout via API
    if settings.lemon_squeezy_api_key and variant_id and settings.lemon_squeezy_store_id:
        checkout_data: dict = {
            "custom": {
                "user_id": user.id,
                "target_tier": tier,
                "billing_cycle": cycle,
            },
        }
        if user.email and "@" in user.email:
            checkout_data["email"] = user.email.strip()
        if user.github_username:
            checkout_data["name"] = user.github_username.strip()

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    "https://api.lemonsqueezy.com/v1/checkouts",
                    headers={
                        "Authorization": f"Bearer {settings.lemon_squeezy_api_key}",
                        "Accept": "application/vnd.api+json",
                        "Content-Type": "application/vnd.api+json",
                    },
                    json={
                        "data": {
                            "type": "checkouts",
                            "attributes": {
                                "checkout_data": checkout_data,
                                "product_options": {
                                    "redirect_url": redirect_url,
                                },
                            },
                            "relationships": {
                                "store": {
                                    "data": {
                                        "type": "stores",
                                        "id": str(settings.lemon_squeezy_store_id),
                                    }
                                },
                                "variant": {
                                    "data": {
                                        "type": "variants",
                                        "id": str(variant_id),
                                    }
                                },
                            },
                        }
                    },
                )
                if res.status_code in (200, 201):
                    data = res.json()
                    checkout_url = data["data"]["attributes"]["url"]
                    return {"checkout_url": checkout_url}
                else:
                    err_msg = res.text
                    try:
                        err_json = res.json()
                        errors = err_json.get("errors", [])
                        if errors:
                            err_msg = errors[0].get("detail", err_msg)
                    except Exception:
                        pass
                    logger.warning(f"[LemonSqueezy] API checkout error ({res.status_code}): {err_msg}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Lemon Squeezy Checkout Error: {err_msg}",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"[LemonSqueezy] Failed to call Lemon Squeezy API: {exc}")
            raise HTTPException(
                status_code=502,
                detail=f"Could not connect to payment processor: {exc}",
            )

    # Fallback simulation URL for local/testing environments without active Lemon Squeezy store keys
    mock_url = f"{settings.frontend_url.rstrip('/')}/settings/billing?simulated_checkout={tier}&cycle={cycle}"
    return {
        "checkout_url": mock_url,
        "is_simulated": True,
        "note": "Configure LEMON_SQUEEZY_API_KEY and variant IDs in backend/.env for live Lemon Squeezy checkout.",
    }


@router.post("/portal")
async def get_customer_portal_url(
    user: User = Depends(get_current_user),
):
    """
    Retrieve or generate the Lemon Squeezy Customer Portal URL where users
    can update payment methods, download invoices, or cancel/pause subscriptions.
    """
    if not user.lemon_subscription_id and not user.lemon_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No active Lemon Squeezy subscription found for this account.",
        )

    if settings.lemon_squeezy_api_key and user.lemon_subscription_id:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(
                    f"https://api.lemonsqueezy.com/v1/subscriptions/{user.lemon_subscription_id}",
                    headers={
                        "Authorization": f"Bearer {settings.lemon_squeezy_api_key}",
                        "Accept": "application/vnd.api+json",
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    urls = data["data"]["attributes"]["urls"]
                    portal_url = urls.get("customer_portal") or urls.get("update_payment_method")
                    if portal_url:
                        return {"portal_url": portal_url}
        except Exception as exc:
            logger.error(f"[LemonSqueezy] Error fetching customer portal: {exc}")

    return {
        "portal_url": "https://app.lemonsqueezy.com/my-orders",
    }


# ── Webhook Handler ───────────────────────────────────────────────────────────

@router.post("/webhook")
async def handle_lemon_squeezy_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Lemon Squeezy webhook events with HMAC-SHA256 signature verification.
    Events handled:
    - subscription_created
    - subscription_updated
    - subscription_cancelled
    - subscription_resumed
    - subscription_expired
    - subscription_payment_success
    """
    raw_body = await request.body()

    # 1. Verify HMAC SHA-256 signature if secret is configured
    if settings.lemon_squeezy_webhook_secret:
        if not x_signature:
            logger.warning("[LemonSqueezy Webhook] Missing X-Signature header")
            raise HTTPException(status_code=401, detail="Missing X-Signature header")

        digest = hmac.new(
            settings.lemon_squeezy_webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(digest, x_signature):
            logger.warning("[LemonSqueezy Webhook] Invalid HMAC signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    meta = payload.get("meta", {})
    event_name = meta.get("event_name", "")
    custom_data = meta.get("custom_data", {})
    data = payload.get("data", {})
    attributes = data.get("attributes", {})

    logger.info(f"[LemonSqueezy Webhook] Received event: {event_name}")

    # Extract user_id
    user_id = custom_data.get("user_id")
    subscription_id = str(data.get("id", ""))
    customer_id = str(attributes.get("customer_id", ""))
    variant_id = str(attributes.get("variant_id", ""))
    status = attributes.get("status", "active").lower()
    product_name = attributes.get("product_name", "").lower()
    variant_name = attributes.get("variant_name", "").lower()

    # Locate user
    user = None
    if user_id:
        user = await db.get(User, user_id)
    if not user and subscription_id:
        res = await db.execute(select(User).where(User.lemon_subscription_id == subscription_id))
        user = res.scalar_one_or_none()
    if not user and attributes.get("user_email"):
        res = await db.execute(select(User).where(User.email == attributes["user_email"]))
        user = res.scalar_one_or_none()

    if not user:
        logger.warning(f"[LemonSqueezy Webhook] Could not associate event {event_name} with any user.")
        return {"status": "ignored_unknown_user"}

    # Determine target tier (pro or team)
    target_tier = custom_data.get("target_tier")
    if not target_tier:
        if "team" in product_name or "team" in variant_name:
            target_tier = "team"
        else:
            target_tier = "pro"

    # Parse renews_at / ends_at
    renews_at_str = attributes.get("renews_at")
    ends_at_str = attributes.get("ends_at")
    renews_at = datetime.fromisoformat(renews_at_str.replace("Z", "+00:00")) if renews_at_str else None
    ends_at = datetime.fromisoformat(ends_at_str.replace("Z", "+00:00")) if ends_at_str else None

    # Handle event types
    if event_name in ("subscription_created", "subscription_resumed", "subscription_payment_success"):
        user.subscription_tier = target_tier
        user.subscription_status = "active"
        user.lemon_subscription_id = subscription_id or user.lemon_subscription_id
        user.lemon_customer_id = customer_id or user.lemon_customer_id
        user.lemon_variant_id = variant_id or user.lemon_variant_id
        if renews_at:
            user.subscription_renews_at = renews_at
        logger.info(f"[LemonSqueezy] User {user.id} upgraded to {target_tier} (Active)")

    elif event_name == "subscription_updated":
        user.subscription_status = status
        user.lemon_variant_id = variant_id or user.lemon_variant_id
        if renews_at:
            user.subscription_renews_at = renews_at
        if status in ("past_due", "unpaid", "paused"):
            user.subscription_status = status
            logger.info(f"[LemonSqueezy] User {user.id} subscription status: {status}")

    elif event_name == "subscription_cancelled":
        user.subscription_status = "cancelled"
        if ends_at:
            user.subscription_ends_at = ends_at
        logger.info(f"[LemonSqueezy] User {user.id} cancelled subscription (Access until {ends_at})")

    elif event_name == "subscription_expired":
        user.subscription_tier = "free"
        user.subscription_status = "none"
        user.lemon_subscription_id = None
        logger.info(f"[LemonSqueezy] User {user.id} subscription expired -> Reverted to Free tier")

    await db.commit()
    return {"status": "success", "event": event_name, "user_id": user.id, "tier": user.subscription_tier}
