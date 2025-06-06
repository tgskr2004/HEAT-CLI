require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF(threadDumpPath, outputPdfPath) {
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


    const analyzerIndex = path.resolve(__dirname, '..', 'index.html');
    await page.goto(`file://${analyzerIndex}`, { waitUntil: 'networkidle0' });

    const rawThreadDumpContent = fs.readFileSync(threadDumpPath, 'utf8');

    const allStates = ['RUNNABLE', 'BLOCKED', 'NEW', 'TERMINATED', 'TIMED_WAITING', 'WAITING'];
    const threadStates = process.env.THREAD_STATES
      ? process.env.THREAD_STATES.split(',').map(s => s.trim()).filter(s => s)
      : allStates;

    await page.evaluate((text, specialClass, threadStatesArr) => {
      document.getElementById('TEXTAREA').value = text;
      if (specialClass) {
        document.getElementById('specialClass').value = specialClass;
      }
      if (Array.isArray(threadStatesArr)) {
        const select = document.getElementById('threadStates');
        Array.from(select.options).forEach(opt => opt.selected = threadStatesArr.includes(opt.value));
      }
      if (typeof analyzeBasedOnSelection === 'function') {
        analyzeBasedOnSelection(); // starts chart generation
      } else {
        console.error('analyzeBasedOnSelection function not found on the page.');

      }
    }, rawThreadDumpContent, process.env.SPECIAL_CLASS || '', threadStates);

    console.log('Waiting for charts to render...');
    await page.waitForFunction(() =>
      document.body.getAttribute('charts-render-complete') === 'true',
      { timeout: 30000 } // Increased timeout for potentially complex charts
    );
    console.log('Charts rendered.');


    // Hide input UI for PDF
    await page.evaluate(() => {
      // Hide specific known UI elements by ID
      const idsToHide = [
        'filterForm', 'TEXTAREA', 'FILE', 'specialClass', 'threadStatesLabel', 
        'threadStates', 'analyzeButton', 'loadSampleButton', 'clearButton',
        // Add any other specific IDs of UI elements you want to hide
      ];
      idsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // Hide general UI elements: forms, most input types, buttons, and common UI grouping classes.
      document.querySelectorAll(
        'form, ' +
        'button, input[type="button"], input[type="submit"], input[type="reset"], ' +
        'input[type="text"], input[type="password"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], ' +
        'input[type="checkbox"], input[type="radio"], ' +
        'input[type="file"], ' +
        'select, ' +
        'textarea, ' + // Though TEXTAREA is hidden by ID, this is a general catch-all
        '.btn, .button, ' +
        '.form-group, .input-group, .controls, .form-check, .mb-3' // Added .form-check and .mb-3 as common bootstrap classes
        // Add any other generic selectors for UI elements that need to be hidden.
        // Be careful with 'label' if labels are also used for chart titles or axis descriptions.
        // If you need to hide specific labels, target them by 'for' attribute or a specific class.
      ).forEach(el => {
        // Example: If your report content is within a specific container (e.g., <div id="chartsContainer">),
        // you could add a check here to avoid hiding elements within that container:
        const chartsContainer = document.getElementById('chartsContainer'); // Assuming your charts are in 'chartsContainer'
        if (chartsContainer && chartsContainer.contains(el)) {
           // If the element is part of the charts container, decide if it should be hidden.
           // For example, you might still want to hide buttons or inputs even if they are inside.
           // This example will NOT hide elements that are descendants of 'chartsContainer'.
           // You might need more specific logic if UI elements are mixed with chart elements.
           return;
        }
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
  console.error('Usage: node runner.js <input.jstack_or_tdump> <output.pdf>');
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