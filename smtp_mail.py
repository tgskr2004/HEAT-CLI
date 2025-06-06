import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
EMAIL_TO = os.getenv('EMAIL_TO', '').split(',')

def send_email(subject: str, body: str, attachment_path: str):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_USER
    msg['To'] = ', '.join(EMAIL_TO)
    msg.set_content(body)
    with open(attachment_path, 'rb') as f:
        data = f.read()
        maintype, subtype = 'application', 'pdf'
        msg.add_attachment(data, maintype=maintype, subtype=subtype,
                           filename=os.path.basename(attachment_path))
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

    print(f"✉️ Email sent to {EMAIL_TO} (attached: {attachment_path})")
