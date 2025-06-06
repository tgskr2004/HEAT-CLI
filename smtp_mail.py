import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

def send_email(subject: str, body: str, attachment_path: str, to_addrs: list[str]):
    if not to_addrs:
        raise RuntimeError("No recipients provided to send_email()")
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_USER
    msg['To'] = ', '.join(to_addrs)
    msg.set_content(body)

    with open(attachment_path, 'rb') as f:
        data = f.read()
        msg.add_attachment(data,
                           maintype='application',
                           subtype='pdf',
                           filename=os.path.basename(attachment_path))

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

    print(f"✉️ Email sent to {to_addrs} (attached: {attachment_path})")