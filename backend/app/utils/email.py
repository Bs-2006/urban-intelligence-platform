import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _send_sync(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        logger.warning("SMTP not configured - skipping email to %s (subject: %s)", to_email, subject)
        logger.info("OTP email fallback - to=%s body=%s", to_email, text_body or html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Use SMTP with STARTTLS (587) or SSL (465)
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            server.ehlo()
            if settings.smtp_port == 587:
                server.starttls()
                server.ehlo()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to_email], msg.as_string())
        server.quit()
        logger.info("Email sent to %s", to_email)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        raise


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
