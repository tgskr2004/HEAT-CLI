import os
import sys
import time
import subprocess
from pathlib import Path
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from mailer import send_report_email

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
HEAP_DIR = BASE_DIR / "heap_files"
THREAD_DIR = BASE_DIR / "thread_files"
REPORT_DIR = BASE_DIR / "report"

HEAP_DIR.mkdir(exist_ok=True)
THREAD_DIR.mkdir(exist_ok=True)

NODE_CMD = "node"
HEAP_SCRIPT = "./script.sh"
THREAD_JS = REPORT_DIR / "runner.js"

# 📧 Prompt for email recipient
_default = os.getenv("EMAIL_TO", "")
user_in = input("📧 Enter recipient email(s) (comma-separated): ").strip()
if user_in:
    RECIPIENTS = [e.strip() for e in user_in.split(",") if e.strip()]
elif _default:
    RECIPIENTS = [e.strip() for e in _default.split(",") if e.strip()]
else:
    print("❌ No recipients configured. Exiting.")
    sys.exit(1)


# 🔍 Utility to find latest heap PDF folder
def get_latest_heap_pdf_folder(base_path="."):
    workflow_dirs = sorted(
        Path(base_path).glob("hprof_workflow_*"),
        key=lambda d: d.stat().st_mtime,
        reverse=True
    )
    for d in workflow_dirs:
        pdf_dir = d / "Report_PDFs"
        if pdf_dir.exists():
            return pdf_dir
    return None


# 📂 Heap dump file watcher
class HeapHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".hprof"):
            return

        hprof_path = Path(event.src_path)
        print(f"📁 New .hprof detected: {hprof_path.name}")

        try:
            subprocess.run(["bash", HEAP_SCRIPT, str(hprof_path)], check=True)
            latest_pdf_folder = get_latest_heap_pdf_folder()
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            if latest_pdf_folder:
                send_report_email(
                    recipient=RECIPIENTS[0],
                    subject=f"Heap Dump Report: {hprof_path.name}",
                    body=f"Attached is the heap dump report for {hprof_path.name}",
                    pdf_paths=list(latest_pdf_folder.glob("*.pdf")),
                    report_type="heap"
                )
            else:
                print("❌ No PDF folder found after processing.")
        except subprocess.CalledProcessError as e:
            print(f"❌ Error during heap dump processing: {e}")
        print(f"✅ Done with {hprof_path.name}\n")


# 🧵 Thread dump file watcher
class ThreadHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".txt"):
            return

        txt_path = Path(event.src_path)
        pdf_path = txt_path.with_suffix(".pdf")

        print(f"🧾 New thread dump detected: {txt_path.name}")
        try:
            subprocess.run(
                [NODE_CMD, str(THREAD_JS), str(txt_path), str(pdf_path)],
                check=True
            )
        except subprocess.CalledProcessError as e:
            print(f"❌ Error generating PDF for {txt_path.name}: {e}")
            return

        try:
            send_report_email(
                recipient=RECIPIENTS[0],
                subject=f"Thread Dump Report: {pdf_path.name}",
                body=f"Attached is the thread dump report for {txt_path.name}",
                pdf_paths=[str(pdf_path)],
                report_type="thread"
            )
        except Exception as exc:
            print(f"❌ Email error: {exc}")
        print(f"✅ Done with {txt_path.name}\n")


# 🎯 Main execution
if __name__ == "__main__":
    print(f"👀 Watching {HEAP_DIR} for .hprof and {THREAD_DIR} for .txt")

    observer = Observer()
    observer.schedule(HeapHandler(), str(HEAP_DIR), recursive=False)
    observer.schedule(ThreadHandler(), str(THREAD_DIR), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
