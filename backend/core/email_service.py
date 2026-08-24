"""Email notification service for PatchFlow incident alerts."""

from __future__ import annotations
import httpx
from typing import Optional
from loguru import logger

from backend.core.config import get_settings

settings = get_settings()


async def send_incident_alert_email(
    to_email: str,
    site_name: str,
    error_type: str,
    error_message: str,
    culprit: str,
    incident_id: str,
    occurrence_count: int,
    is_pro: bool,
    pr_url: Optional[str] = None,
    dashboard_url: Optional[str] = None,
) -> bool:
    """
    Send a real-time incident alert email to the site owner.
    Works for all tiers (Free, Pro, Team).
    """
    if not to_email:
        logger.debug("[Email] No recipient email provided — skipping email alert.")
        return False

    frontend_base = settings.frontend_url.rstrip("/")
    incidents_link = dashboard_url or f"{frontend_base}/incidents"
    upgrade_link = f"{frontend_base}/settings/billing"

    subject = f"🚨 [{site_name}] {error_type}: {(error_message or '')[:60]}"

    if is_pro and pr_url:
        cta_button = f"""
        <div style="margin-top: 24px; margin-bottom: 24px;">
            <a href="{pr_url}" style="background-color: #16A34A; color: #ffffff; padding: 12px 24px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Auto-Generated Pull Request &rarr;
            </a>
        </div>
        """
        tier_badge = '<span style="background-color: #DCFCE7; color: #16A34A; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 4px; text-transform: uppercase;">Pro • Auto-Patched</span>'
    elif not is_pro:
        cta_button = f"""
        <div style="margin-top: 24px; margin-bottom: 24px; background-color: #FEF3C7; border: 1px solid #FCD34D; padding: 16px; border-radius: 8px;">
            <div style="font-weight: 700; color: #92400E; margin-bottom: 6px;">⚡ Auto-Patching is locked on the Free plan</div>
            <div style="font-size: 13px; color: #B45309; margin-bottom: 12px;">Upgrade to Pro ($14/mo) to have PatchFlow automatically generate and compiler-test a GitHub Pull Request for this crash.</div>
            <a href="{upgrade_link}" style="background-color: #EA580C; color: #ffffff; padding: 10px 20px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
                Upgrade to Pro ($14/mo) &rarr;
            </a>
        </div>
        """
        tier_badge = '<span style="background-color: #F3F4F6; color: #4B5563; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 4px; text-transform: uppercase;">Free • Alert Only</span>'
    else:
        cta_button = f"""
        <div style="margin-top: 24px; margin-bottom: 24px;">
            <a href="{incidents_link}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Incident in Dashboard &rarr;
            </a>
        </div>
        """
        tier_badge = '<span style="background-color: #DBEAFE; color: #1E40AF; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 4px; text-transform: uppercase;">Active</span>'

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="background-color: #111827; padding: 20px 24px; border-bottom: 1px solid #374151;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">PatchFlow</span>
                    {tier_badge}
                </div>
            </div>
            
            <div style="padding: 24px;">
                <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 12px;">
                    Production Crash Detected on <span style="color: #2563EB;">{site_name}</span>
                </h2>
                
                <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                    PatchFlow SDK captured unhandled exceptions meeting your notification threshold (<strong>{occurrence_count} occurrences</strong>).
                </p>

                <div style="background-color: #f3f4f6; border-left: 4px solid #DC2626; padding: 16px; border-radius: 4px; margin-bottom: 20px; font-family: monospace; font-size: 13px;">
                    <div style="color: #DC2626; font-weight: 700; margin-bottom: 4px;">{error_type}</div>
                    <div style="color: #1f2937; margin-bottom: 8px;">{error_message or 'No exception message provided'}</div>
                    <div style="color: #6b7280; font-size: 12px;">Culprit: {culprit or 'Unknown file'}</div>
                </div>

                {cta_button}

                <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                    You received this alert because error notifications are enabled for site '{site_name}'.<br>
                    <a href="{incidents_link}" style="color: #6b7280; text-decoration: underline;">View Incidents</a> &bull; 
                    <a href="{upgrade_link}" style="color: #6b7280; text-decoration: underline;">Manage Notification Settings</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

    # If Resend API Key is available, dispatch via Resend REST API
    if settings.resend_api_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": settings.email_from,
                        "to": [to_email],
                        "subject": subject,
                        "html": html_content,
                    },
                )
                if res.status_code in (200, 201):
                    logger.info(f"[Email] Dispatched incident alert to {to_email}")
                    return True
                else:
                    logger.warning(f"[Email] Resend API error ({res.status_code}): {res.text}")
        except Exception as exc:
            logger.error(f"[Email] Failed to send email alert via Resend: {exc}")

    # Fallback log output for dev/demo
    logger.info(f"[Email-Alert-Simulation] To: {to_email} | Subject: {subject} | Culprit: {culprit}")
    return True
