import argparse
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup
from PyPDF2 import PdfMerger

def get_rewrite_links(output_dir: Path) -> str:
    report_pdf_dir_uri = output_dir.resolve().as_uri()
    return rf"""
    (() => {{
      const pdfBase = "{report_pdf_dir_uri}/";
      document.querySelectorAll('a[href]').forEach(a => {{
        const href = a.getAttribute('href');
        if (!href || /^(https?:|\/\/|file:|#)/i.test(href)) return;

        const match = href.match(/([^/\\]+)\.html(#.*)?$/i);
        if (match) {{
          const filename = match[1];
          const anchor = match[2] || '';
          a.setAttribute('href', pdfBase + filename + '.pdf' + anchor);
        }}
      }});
    }})();
    """

def get_expand_all_sections() -> str: #deals with hidden divs that appear on clicking arrow
    return r"""
    (() => {
      const anchors = document.querySelectorAll('a[onclick*="hide(this"]');
      for (const anchor of anchors) {
        const onclick = anchor.getAttribute('onclick');
        const match = onclick.match(/hide\(this,\s*'([^']+)'/);
        if (match && match[1]) {
          const targetId = match[1];
          const target = document.getElementById(targetId);
          if (target) {
            target.style.display = 'block';
          }
        }
      }
    })();
    """

def convert_all_html_to_pdf(input_dir: Path, output_dir: Path, hprof_filename: str, timeout_ms: int = 30000):
    html_paths = list(input_dir.rglob('*.html'))
    if not html_paths:
        print(f"No HTML files found under {input_dir.resolve()}", file=sys.stderr)
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        used_names = set()

        for html_path in html_paths:
            filename = html_path.name
            pdf_name = Path(filename).with_suffix('.pdf')
            pdf_name = Path(f"{hprof_filename}_{pdf_name.stem}{pdf_name.suffix}")
            out_pdf = output_dir / pdf_name

            if pdf_name.name in used_names:
                continue
            used_names.add(pdf_name.name)

            out_pdf.parent.mkdir(parents=True, exist_ok=True)
            file_url = html_path.resolve().as_uri()

            try:
                page = browser.new_page(viewport={"width": 1280, "height": 800})
                page.goto(file_url, wait_until='networkidle', timeout=timeout_ms)
                page.evaluate(get_rewrite_links(output_dir))
                page.evaluate(get_expand_all_sections())

                page.pdf(
                    path=str(out_pdf),
                    print_background=True,
                    width="1280px",
                    scale=1.0
                )
                page.close()
            except PlaywrightTimeoutError:
                print("✒ Timeout loading page (skipped).")
            except Exception as e:
                print(f"✒ Error: {e}")

        browser.close()

def extract_pdf_order_from_toc_html(toc_html_path: Path) -> list[str]:
    with open(toc_html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    seen = set()
    ordered = []

    for a in soup.find_all("a", href=True):
        href = a["href"].split("#")[0]
        if href.endswith(".html"):
            html_name = Path(href).name
            pdf_name = Path(html_name).with_suffix(".pdf").name
            if pdf_name not in seen:
                seen.add(pdf_name)
                ordered.append(pdf_name)

    return ordered

def merge_pdfs_by_toc_html(toc_html_path: Path, pdf_dir: Path, output_pdf: Path, hprof_filename: str):
    order = extract_pdf_order_from_toc_html(toc_html_path)
    merger = PdfMerger()
    toc_pdf = pdf_dir / f"{hprof_filename}_toc.pdf"
    merger.append(str(toc_pdf))
    for pdf_name in order:
        if pdf_name == "toc.pdf":
            continue
        pdf_path = pdf_dir / f"{hprof_filename}_{Path(pdf_name).stem}.pdf"
        merger.append(str(pdf_path))
    merger.write(str(output_pdf))
    merger.close()
    print(f"[✓] Complete heap dump report written to: {output_pdf}")

def main():
    parser = argparse.ArgumentParser(description="Convert HTML to flat-structured PDFs (no folders) with links preserved.")
    parser.add_argument('--input_dir', '-i', type=Path, required=True, help="Input folder with .html files")
    parser.add_argument('--output_dir', '-o', type=Path, required=True, help="Output folder for .pdf files")
    parser.add_argument('--merge_pdf', action='store_true', help="Merge PDFs into single file using TOC order")
    parser.add_argument('--toc_html', type=Path, help="Path to toc.html (used for merging order)")
    parser.add_argument('--hprof_filename', type=str, required=True, help="Name of the HPROF file being analyzed")
    args = parser.parse_args()

    input_dir = args.input_dir.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not input_dir.is_dir():
        print(f"ERROR: input_dir {input_dir} is not a directory.", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    convert_all_html_to_pdf(input_dir, output_dir, args.hprof_filename)

    if args.merge_pdf:
        if not args.toc_html:
            sys.exit(1)
        merge_pdfs_by_toc_html(args.toc_html.resolve(), output_dir, output_dir / f"{args.hprof_filename}_Complete_Report.pdf", args.hprof_filename)

if __name__ == '__main__':
    main()
