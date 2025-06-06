import os
import time
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

load_dotenv()

# 1) Prompt for recipients, fall back to .env if blank
_default = os.getenv('EMAIL_TO', '')
prompt = "Enter recipient email(s) (separated by comma): "
user_in = input(prompt).strip()
if user_in:
    EMAIL_TO = [e.strip() for e in user_in.split(',') if e.strip()]
elif _default:
    EMAIL_TO = [e.strip() for e in _default.split(',') if e.strip()]
else:
    print("No recipients configured. Exiting.")
    sys.exit(1)

from smtp_mail import send_email

BASE_DIR   = Path(__file__).parent
FILES_DIR  = BASE_DIR / 'files'
WATCHER_DIR= BASE_DIR / 'report'
NODE_CMD   = 'node'

class JStackHandler(FileSystemEventHandler):
    def __init__(self, recipients: list[str]):
        super().__init__()
        self.recipients = recipients

    def on_created(self, event):
        if event.is_directory: return
        new_path = Path(event.src_path)
        if new_path.suffix.lower() != '.txt': return

        print(f"🆕 New jstack file detected: {new_path.name}")
        time.sleep(1)

        pdf_path = new_path.with_suffix('.pdf')
        node_script = WATCHER_DIR / 'runner.js'

        try:
            print(f"▶ Generating PDF: {pdf_path.name}")
            subprocess.run(
                [NODE_CMD, str(node_script), str(new_path), str(pdf_path)],
                check=True
            )
        except subprocess.CalledProcessError as exc:
            print(f"❌ Error generating PDF for {new_path.name}: {exc}", file=sys.stderr)
            return

        try:
            subject = f"Thread Dump Report: {pdf_path.name}"
            body    = f"Attached is the thread dump report for {new_path.name}"
            send_email(subject, body, str(pdf_path), self.recipients)
        except Exception as exc:
            print(f"❌ Error sending email with {pdf_path.name}: {exc}", file=sys.stderr)
            return

        print(f"✅ Done processing {new_path.name}\n")


def main():
    FILES_DIR.mkdir(exist_ok=True)
    print(f"▶ Watching directory for jstack text files: {FILES_DIR.resolve()}")
    handler  = JStackHandler(EMAIL_TO)
    observer = Observer()
    observer.schedule(handler, str(FILES_DIR), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == '__main__':
    main()