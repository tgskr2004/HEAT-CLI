
import os
import time
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
load_dotenv()

BASE_DIR = Path(__file__).parent
FILES_DIR = BASE_DIR / 'files'
WATCHER_DIR = BASE_DIR / 'report'        
NODE_CMD = 'node'                         
#from smtp_mail import send_email

class JStackHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        new_path = Path(event.src_path)
        if new_path.suffix.lower() != '.txt':
            return
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

        # try:
        #   subject = f"Thread Dump Report: {pdf_path.name}"
        #   body = f"Attached is the thread dump report for {new_path.name}"
        #   send_email(subject, body, str(pdf_path))
        # except Exception as exc:
        #     print(f"❌ Error sending email with {pdf_path.name}: {exc}", file=sys.stderr)
        #     return

        print(f"✅ Done processing {new_path.name}\n")

def main():
    FILES_DIR.mkdir(exist_ok=True)
    print(f"▶ Watching directory for jstack text files: {FILES_DIR.resolve()}")
    event_handler = JStackHandler()
    observer = Observer()
    observer.schedule(event_handler, str(FILES_DIR), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == '__main__':
    main()
