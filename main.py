import os
import sys
import time
import subprocess
from pathlib import Path
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from concurrent.futures import ThreadPoolExecutor

from mailer import send_report_email

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent
FILES_DIR = BASE_DIR / "files"
HEAP_DIR = FILES_DIR / "heapdumps"
THREAD_DIR = FILES_DIR / "Jstack files"
JMAP_DIR = FILES_DIR / "Jmap files"
REPORT_DIR = BASE_DIR / "report"

FILES_DIR.mkdir(exist_ok=True)
HEAP_DIR.mkdir(exist_ok=True)
JMAP_DIR.mkdir(exist_ok=True)
THREAD_DIR.mkdir(exist_ok=True)

NODE_CMD = "node"
HEAP_SCRIPT = "./script.sh"
THREAD_JS = REPORT_DIR / "runner.js"

email_flag = 0

_default = os.getenv("EMAIL_TO", "")
user_in = input("📧 Enter recipient email(s) (comma-separated): ").strip()
if user_in:
    RECIPIENTS = [e.strip() for e in user_in.split(",") if e.strip()]
elif _default:
    RECIPIENTS = [e.strip() for e in _default.split(",") if e.strip()]
else:
    print("No recipients configured. Mailing won't be enabled")
    email_flag = 1

# ✅ Thread pool executor (global)
executor = ThreadPoolExecutor(max_workers=4)


def get_latest_heap_pdf_folder(base_path="."):
    workflow_dirs = sorted(
        Path(base_path).glob("files/heapdumps/hprof_workflow_*"),
        key=lambda d: d.stat().st_mtime,
        reverse=True
    )
    for d in workflow_dirs:
        pdf_dir = d / "Report_PDFs"
        if pdf_dir.exists():
            return pdf_dir
    return None


def process_heap_file(hprof_path):
    print(f"📦 New heap dump (.hprof) file detected: {hprof_path.name}")
    try:
        subprocess.run(["bash", HEAP_SCRIPT, str(hprof_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        latest_pdf_folder = get_latest_heap_pdf_folder()
        if latest_pdf_folder:
            if email_flag == 1:
                print("📤 Mailing the Heap Dump Report...")
                send_report_email(
                    recipient=RECIPIENTS[0],
                    subject=f"Heap Dump Report: {hprof_path.name}",
                    body=f"Heap dump report for {hprof_path.name} attached below",
                    pdf_paths=list(latest_pdf_folder.glob("*.pdf")),
                    report_type="heap"
                )
        else:
            print("❌ No PDF folder found after processing heap dump.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during heap dump processing: {e}")
    print(f"✅ Done with heap dump: {hprof_path.name}\n")


def process_thread_file(txt_path):
    pdf_path = txt_path.with_suffix(".pdf")
    stack_pdf_path = txt_path.with_name(txt_path.stem + "_stack_report.pdf")  # 👈 Add this

    print(f"🧵 New thread dump (.txt) detected: {txt_path.name}")
    try:
        subprocess.run([NODE_CMD, str(THREAD_JS), str(txt_path), str(pdf_path)], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error generating PDF for thread dump: {txt_path.name}: {e}")
        return
    if email_flag == 1:
        try:
            print("📤 Mailing the Jstack Thread Dump Report...")
            attachments = [str(pdf_path)]
            if stack_pdf_path.exists():
                attachments.append(str(stack_pdf_path))  # 👈 Add stack trace PDF if it exists

            send_report_email(
                recipient=RECIPIENTS[0],
                subject=f"Thread Dump Report: {pdf_path.name}",
                body=f"Attached is the thread dump report for {txt_path.name}",
                pdf_paths=attachments,
                report_type="thread"
            )
        except Exception as exc:
            print(f"❌ Email error for thread dump: {exc}")
    print(f"✅ Done with thread dump: {txt_path.name}\n")


def process_jmap_file(jmap_path):
    pdf_path = jmap_path.with_suffix(".pdf")
    print(f"📊 New JMAP file detected: {jmap_path.name}")
    try:
        subprocess.run([NODE_CMD, str(THREAD_JS), str(jmap_path), str(pdf_path)], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error generating PDF for JMAP file: {jmap_path.name}: {e}")
        return
    if email_flag == 1:
        try:
            print("📤 Mailing the JMAP Report...")
            send_report_email(
                recipient=RECIPIENTS[0],
                subject=f"JMAP Heap Report: {pdf_path.name}",
                body=f"The heap usage report from JMAP file: {jmap_path.name} attached below",
                pdf_paths=[str(pdf_path)],
                report_type="jmap"
            )
        except Exception as exc:
            print(f"❌ Email error for JMAP file: {exc}")
    print(f"✅ Done with JMAP file: {jmap_path.name}\n")


class HeapHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".hprof"):
            return
        executor.submit(process_heap_file, Path(event.src_path))


class ThreadHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".txt"):
            return
        executor.submit(process_thread_file, Path(event.src_path))


class JmapHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".txt"):
            return
        executor.submit(process_jmap_file, Path(event.src_path))


if __name__ == "__main__":
    print("📡 Watching folders:")
    print(f"   HEAP:   {HEAP_DIR}")
    print(f"   JSTACK: {THREAD_DIR}")
    print(f"   JMAP:   {JMAP_DIR}")
    observer = Observer()
    observer.schedule(HeapHandler(), str(HEAP_DIR), recursive=False)
    observer.schedule(ThreadHandler(), str(THREAD_DIR), recursive=False)
    observer.schedule(JmapHandler(), str(JMAP_DIR), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    finally:
        executor.shutdown(wait=True)
    observer.join()
