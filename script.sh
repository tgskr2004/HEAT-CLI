set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HPROF_FILE="${1:-sample.hprof}"
HEAP_TOOL_DIR="/Applications/MemoryAnalyzer.app/Contents/Eclipse"
HTML2PDF_SCRIPT="$SCRIPT_DIR/html_to_pdf.py"
VMARGS="-Xmx8g"

if [[ ! -f "$HPROF_FILE" ]]; then
  echo "ERROR: .hprof file not found at '$HPROF_FILE'."
  exit 1
fi

if [[ ! -x "${HEAP_TOOL_DIR}/ParseHeapDump.sh" ]]; then
  echo "ERROR: Cannot execute '${HEAP_TOOL_DIR}/ParseHeapDump.sh' - check HEAP_TOOL_DIR."
  exit 1
fi

if [[ ! -f "$HTML2PDF_SCRIPT" ]]; then
  echo "ERROR: HTML→PDF script not found at '$HTML2PDF_SCRIPT'."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORKDIR="$(pwd)/hprof_workflow_${TIMESTAMP}"
mkdir -p "$WORKDIR"
echo "→ Working directory will be: $WORKDIR"

echo ">>> Step 1: Running ParseHeapDump.sh on '$HPROF_FILE'…"
"${HEAP_TOOL_DIR}/ParseHeapDump.sh" "$HPROF_FILE" \
    org.eclipse.mat.api:suspects \
    -vmargs "$VMARGS"

HPROF_BASENAME="$(basename "$HPROF_FILE" .hprof)"
HPROF_DIR="$(cd "$(dirname "$HPROF_FILE")" && pwd)"
SUSPECT_ZIP="$HPROF_DIR/${HPROF_BASENAME}_leak_suspects.zip"

if [[ ! -f "$SUSPECT_ZIP" ]]; then
  echo "ERROR: Expected ${HPROF_BASENAME}_leak_suspects.zip but didn’t find it in $HPROF_DIR."
  exit 1
fi
echo "    → Detected suspects ZIP at: $SUSPECT_ZIP"

echo ">>> Step 2: Extracting '$SUSPECT_ZIP'…"
LEAK_HTML_DIR="$WORKDIR/leak-suspects"
mkdir -p "$LEAK_HTML_DIR"
unzip -q "$SUSPECT_ZIP" -d "$LEAK_HTML_DIR"
echo "    → HTML folder ready at: $LEAK_HTML_DIR"

echo ">>> Step 3: Converting all HTML under '$LEAK_HTML_DIR' to PDFs…"
PDF_OUTDIR="$WORKDIR/Report_PDFs"
mkdir -p "$PDF_OUTDIR"

TOC_HTML="$LEAK_HTML_DIR/toc.html"

if [[ -f "$TOC_HTML" ]]; then
  echo ">>> TOC found. Will merge PDFs based on TOC order…"
  python3 "$HTML2PDF_SCRIPT" \
      --input_dir "$LEAK_HTML_DIR" \
      --output_dir "$PDF_OUTDIR" \
      --merge_pdf \
      --toc_html "$TOC_HTML"
else
  echo ">>> No TOC found. Converting HTMLs without merging…"
  python3 "$HTML2PDF_SCRIPT" \
      --input_dir "$LEAK_HTML_DIR" \
      --output_dir "$PDF_OUTDIR"
fi


echo "→ All done!"
echo "    • Suspects ZIP:     $SUSPECT_ZIP"
echo "    • Extracted HTML:   $LEAK_HTML_DIR"
echo "    • PDFs generated:   $PDF_OUTDIR"
