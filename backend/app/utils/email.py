import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _send_sync(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    smtp_host = (settings.smtp_host or "").strip()
    smtp_from = (settings.smtp_from or "").strip() or (settings.smtp_username or "").strip()
    smtp_username = (settings.smtp_username or "").strip()
    # Gmail app passwords are displayed with spaces - strip them for SMTP login
    smtp_password = (settings.smtp_password or "").replace(" ", "").strip()

    if not smtp_host or not smtp_from:
        logger.error(
            "SMTP not configured - skipping email to %s (subject: %s). smtp_host=%r smtp_from=%r smtp_username=%r",
            to_email,
            subject,
            smtp_host,
            smtp_from,
            smtp_username,
        )
        logger.info("OTP email fallback (SMTP not configured) - to=%s body=%s", to_email, text_body or html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    server = None
    try:
        # Use SMTP with STARTTLS (587) or SSL (465)
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, settings.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, settings.smtp_port, timeout=15)
            server.ehlo()
            if settings.smtp_port == 587:
                server.starttls()
                server.ehlo()
        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from, [to_email], msg.as_string())
        logger.info("Email sent successfully to %s via %s:%s", to_email, smtp_host, settings.smtp_port)
    except Exception as e:
        logger.exception("Failed to send email to %s via %s:%s - %s", to_email, smtp_host, settings.smtp_port, e)
        raise
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass


async def send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    await asyncio.to_thread(_send_sync, to_email, subject, html_body, text_body)


async def send_otp_email(to_email: str, otp: str) -> None:
    subject = "Verify your email - Urban Intelligence Platform"
    text_body = f"Your verification code is: {otp}\nThis code expires in {settings.otp_expire_minutes} minutes. Do not share it."
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #2c3e50;">Verify your email</h2>
      <p>Your verification code is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 16px; background: #f4f6f8; border-radius: 8px; margin: 16px 0;">{otp}</div>
      <p style="color: #666; font-size: 13px;">This code expires in <b>{settings.otp_expire_minutes} minutes</b>. Do not share it with anyone.</p>
      <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
    </div>
    """
    await send_email(to_email, subject, html_body, text_body)
