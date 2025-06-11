require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF(inputPath, outputPdfPath) {
  let browser;
  let page;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Page Console Error: ${msg.text()}`);
      }
    });
    page.on('pageerror', error => {
      console.error(`Page Error: ${error.message}`);
    });

    const analyzerIndex = path.resolve(__dirname, '..', 'Analyzer', 'index.html');

    await page.goto(`file://${analyzerIndex}`, { waitUntil: 'networkidle0' });

    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const isJmapFile =inputPath.toLowerCase().includes("jmap");
    const isJstackFile = inputPath.toLowerCase().includes("jstack");

    const title = isJmapFile ? "JMAP File Report" : isJstackFile ? "JSTACK File Report" : "Heap Dump/Thread Dump Report";

    const allStates = ['RUNNABLE', 'BLOCKED', 'NEW', 'TERMINATED', 'TIMED_WAITING', 'WAITING'];
    const threadStates = process.env.THREAD_STATES
      ? process.env.THREAD_STATES.split(',').map(s => s.trim()).filter(s => s)
      : allStates;

    if (isJmapFile) {
      await page.evaluate((text, reportTitle) => {
        document.getElementById('TEXTAREA').value = text;
        document.title = reportTitle;  
        if (typeof analyzeHeapDump === 'function') {
          const output = analyzeHeapDump(text);
          displayOutput(output);
        } else {
          console.error('analyzeHeapDump function not found.');
        }
      }, rawContent, title);

      await page.waitForSelector('#OUTPUT table', { timeout: 10000 });

      await page.evaluate(() => {
        const outputDiv = document.getElementById('OUTPUT_DIV');
        if (outputDiv) {
          outputDiv.querySelectorAll('.chart-container').forEach(chart => chart.remove());
          outputDiv.querySelectorAll('h2').forEach(header => header.remove());
        }

        document.body.style.marginTop = '0px';
        document.body.style.paddingTop = '0px';

        const table = document.querySelector('#OUTPUT table');
        if (table) {
          table.scrollIntoView({ behavior: "auto", block: "start" });
        }
      });
    } else {
      await page.evaluate((text, specialClass, threadStatesArr, reportTitle) => {
        document.getElementById('TEXTAREA').value = text;
        document.title = reportTitle;  // Set title dynamically
        if (specialClass) {
          document.getElementById('specialClass').value = specialClass;
        }
        if (Array.isArray(threadStatesArr)) {
          const select = document.getElementById('threadStates');
          Array.from(select.options).forEach(opt => opt.selected = threadStatesArr.includes(opt.value));
        }
        if (typeof analyzeBasedOnSelection === 'function') {
          analyzeBasedOnSelection();
        } else {
          console.error('analyzeBasedOnSelection function not found.');
        }
      }, rawContent, process.env.SPECIAL_CLASS || '', threadStates, title);

      await page.waitForFunction(() =>
        document.body.getAttribute('charts-render-complete') === 'true',
        { timeout: 30000 }
      );
    }

    await page.evaluate(() => {
      document.querySelector('h1').style.display = 'none';
      const idsToHide = [
        'filterForm', 'TEXTAREA', 'FILE', 'specialClass', 'threadStatesLabel',
        'threadStates', 'analyzeButton', 'loadSampleButton', 'clearButton',
      ];
      idsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      document.querySelectorAll(
        'form, ' +
        'button, input[type="button"], input[type="submit"], input[type="reset"], ' +
        'input[type="text"], input[type="password"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], ' +
        'input[type="checkbox"], input[type="radio"], ' +
        'input[type="file"], ' +
        'select, ' +
        'textarea, ' +
        '.btn, .button, ' +
        '.form-group, .input-group, .controls, .form-check, .mb-3'
      ).forEach(el => {
        const chartsContainer = document.getElementById('chartsContainer');
        if (chartsContainer && chartsContainer.contains(el)) return;
        el.style.display = 'none';
      });

      document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = 'none';
      });

      document.documentElement.style.backgroundColor = '#FFFFFF';
      document.body.style.backgroundColor = '#FFFFFF';
    });

    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    console.log(`✅ PDF successfully generated at ${outputPdfPath}`);
    const stackHtmlPath = outputPdfPath.replace(/\.pdf$/, '_stack_report.html');
    const stackPdfPath = outputPdfPath.replace(/\.pdf$/, '_stack_report.pdf');

    const stackHtml = await page.evaluate(() => window.stackTraceHTML);
    if (stackHtml) {
      fs.writeFileSync(stackHtmlPath, stackHtml, 'utf8');

      const stackPage = await browser.newPage();
      await stackPage.goto(`file://${stackHtmlPath}`, { waitUntil: 'networkidle0' });
      await stackPage.pdf({
        path: stackPdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
      });
      await stackPage.close();
      fs.unlinkSync(stackHtmlPath);
      console.log(`✅ Stack trace report saved: ${stackPdfPath}`);
    } 
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node runner.js <input.jstack_or_heap.txt> <output.pdf>');
  process.exit(1);
}
const [inputPath, outputPath] = args;

generatePDF(inputPath, outputPath)
  .then(() => {
    console.log(`Report generation process finished successfully.`);
    process.exit(0);
  })
  .catch(err => {
    process.exit(1);
  });
