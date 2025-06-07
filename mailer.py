import smtplib
import os
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))


def send_report_email(
    recipient,
    subject,
    body,
    pdf_paths,  # list or str
    report_type="heap"  # or "thread"
):
    if isinstance(pdf_paths, str):
        pdf_paths = [pdf_paths]

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = recipient
    msg.set_content(body)

    for pdf_path in pdf_paths:
        if not os.path.exists(pdf_path):
            print(f"⚠️ PDF not found: {pdf_path}")
            continue
        with open(pdf_path, "rb") as f:
            filename = os.path.basename(pdf_path)
            msg.add_attachment(
                f.read(),
                maintype="application",
                subtype="pdf",
                filename=filename
            )

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
            print(f"📬 {report_type.capitalize()} report email sent to {recipient}")
    except Exception as e:
        print(f"❌ Failed to send {report_type} email: {e}")
