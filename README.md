
# 🧠 HEAT (Heap Evaluation Analysis Tool) — Thread, Heap & JMAP Dump Analyzer

This unified tool provides automation, analysis, and PDF report generation for:

- 🧵 **Jstack Java Thread Dumps** 
- 📦 **Java Heap Dumps** 
- 📊 **JMAP Text Output Files** (e.g., from `jmap -histo` or similar)

It supports **automated watching**, **PDF generation**, and **email delivery** for:

- `.txt` (thread dumps or JMAP output)
- `.hprof` (heap dumps)

---

## ✅ Features

### 🧵 Thread Dump Analyzer
- Paste or upload Java thread dump (`.txt`)
- Filter by:
  - Thread states (RUNNABLE, WAITING, etc.)
  - Specific stack trace keywords
- Visualize:
  - Thread state pie chart
  - Stack trace bar chart
  - Daemon vs Non-Daemon doughnut chart

---

### 🗃️ Heap Dump Analyzer (`.hprof`)
- Uses Eclipse MAT internally
- Parses `.hprof` files for leak suspects and top components

---

### 📊 JMAP File Analyzer
- Supports `.txt` files generated from tools like `jmap`
- Parses class-level memory data (instances, size, class names)
- Sorts and presents in a structured table
- Generates clean PDF reports 

---

## 📦 Requirements

- **Node.js** and `npm` for the thread & JMAP analyzer (tested on Node 13+)
- **Python 3.6+**
- **Eclipse MAT** installed (for `.hprof` heap dump analysis)

---

## 🔧 Installation

Clone this repository, then run the following:

### Step 1: Install JavaScript Dependencies

```bash
npm install
```

### Step 2: Set up Python environment

#### ✅ On macOS / Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

#### ✅ On Windows (PowerShell):

```powershell
python -m venv venv
.env\Scripts\Activate.ps1
```

Then:

```bash
pip install -r requirements.txt
```

---

## 📧 .env Configuration

Create a `.env` file in the project root:

```env
SMTP_USER=your.email@example.com
SMTP_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
EMAIL_TO=recipient@example.com
```

> 💡 Use an **App Password** if you're using Gmail with 2FA enabled.

---

## 🚀 Running the Analyzer

To start the automated system:

```bash
python main.py
```

This will:

1. Prompt for email address (or use `.env` default)
2. Watch these folders:
   - `heapdumps/` for new `.hprof` files
   - `Jstack files/` for `.txt` thread dumps
   - `Jmap files/` for `.txt` JMAP files
3. Automatically:
   - Analyze the new file
   - Generate PDF reports
   - Email the results

---

## 🧪 Manual Thread/JMAP Analysis (Browser)

You can also run the analyzer manually in a browser:

```bash
npm install
```

Then open:

```
index.html
```

Paste the text into the input box or upload your `.txt` file (thread dump or JMAP), and click **Analyze**.

---

## 📌 Notes

- Eclipse MAT must be installed and path configured in `script.sh`:
  ```bash
  HEAP_TOOL_DIR="/Applications/MemoryAnalyzer.app/Contents/Eclipse"  # macOS default
  ```
- Puppeteer is used to render charts or JMAP tables before printing
- JMAP PDFs:
  - Skip charts entirely
  - Start from the data table
  - Are cleanly formatted for printing

---

## 📤 Output Structure

### 🧵 Thread Dump (`.txt`)
- `<file>.pdf` is generated beside the input `.txt`
- Emailed automatically

### 📦 Heap Dump (`.hprof`)
- Creates a folder like `hprof_workflow_YYYYMMDD-HHMMSS/`
- Inside:
  - `Report_PDFs/`: final PDF(s)
  - `leak-suspects/`: raw HTML from MAT
- PDF(s) emailed automatically

### 📊 JMAP File (`.txt`)
- `<file>.pdf` generated beside input `.txt`
- Contains sorted class-level memory data
- Charts and placeholders are removed
- Emailed automatically

---

## 🏁 Final Tips

- Refresh the browser page or click **Clear All** before multiple analyses
- Make sure Chromium is installed (for Puppeteer)
- JMAP `.txt` files must be plain text (e.g. output of `jmap -histo`)
- The tool supports both **macOS** and **Windows**
