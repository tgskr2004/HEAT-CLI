# 🧠 Java Diagnostic Toolkit — Thread & Heap Dump Analyzer

This unified tool provides automation, analysis, and PDF report generation for:

- 🧵 **Java Thread Dumps** (based on [Spotify's Thread Dump Analyzer](https://github.com/spotify/threaddump-analyzer) with visualization enhancements)
- 📦 **Java Heap Dumps** (using [Eclipse Memory Analyzer (MAT)](https://www.eclipse.org/mat/))

It supports **automated watching**, **PDF generation**, and **email delivery** for both `.txt` (thread dump) and `.hprof` (heap dump) files.

---

## ✅ Features

### 📊 Thread Dump Analyzer
- Paste or upload Java thread dump (`.txt`)
- Filter by:
  - Thread states (RUNNABLE, WAITING, etc.)
  - Specific stack trace keywords
- Visualize:
  - Thread state pie chart
  - Stack trace bar chart
  - Daemon vs Non-Daemon doughnut chart
- Auto-generate PDF via headless browser
- Auto-send via email

### 🗃️ Heap Dump Analyzer
- Supports `.hprof` files
- Uses Eclipse MAT internally
- Automatically generates PDF reports
- Auto-sends to your email

---

## 📦 Requirements

- **Node.js** and `npm` for the thread dump tool (tested on Node 13+)
- **Python 3.6+**
- **Eclipse MAT** installed (for heap dump analysis)

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
2. Watch the following:
   - `heap_files/` for new `.hprof` files
   - `thread_files/` for new `.txt` thread dumps
3. Automatically:
   - Analyze the new file
   - Generate PDF reports
   - Email the results

---

## 🧪 Manual Thread Dump Analysis (Browser)

You can also run the thread analyzer manually:

```bash
npm install
```

Then open:

```
index.html
```

> Use the file input or paste your thread dump into the textbox and click **Analyze**.

---

## 📌 Notes

- Eclipse MAT must be installed and its path updated in `script.sh`:
  ```bash
  HEAP_TOOL_DIR="/Applications/MemoryAnalyzer.app/Contents/Eclipse"  # macOS default
  ```

- PDF generation for thread dumps uses Puppeteer in headless mode (no browser opens).
- Thread charts and tables are rendered before printing — no manual interaction needed.

---

## 📤 Output Structure

For each file:

### 🧵 Thread Dump:
- `<file>.pdf` is generated beside the input `.txt`
- Emailed automatically

### 📦 Heap Dump:
- Folder like `hprof_workflow_20250602-145501/` is created
- Inside: 
  - `Report_PDFs/`: final PDF(s)
  - `leak-suspects/`: raw HTML from MAT
- PDF(s) are emailed after generation

---

## 🛠️ Built With

- [Node.js](https://nodejs.org/)
- [Python 3](https://www.python.org/)
- [Puppeteer](https://pptr.dev/)
- [Eclipse Memory Analyzer](https://www.eclipse.org/mat/)
- [Spotify Thread Dump Analyzer](https://github.com/spotify/threaddump-analyzer)

---

## 🏁 Final Tips

- Refresh the HTML page or use **Clear All** before doing multiple analyses in one session.
- Ensure Chrome/Chromium is installed for Puppeteer to function properly.
- Supports both Mac and Windows environments.
