require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF(threadDumpPath, outputPdfPath) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

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
    analyzeBasedOnSelection(); // starts chart generation
  }, rawThreadDumpContent, process.env.SPECIAL_CLASS || '', threadStates);

  // ✅ Wait until all charts have completed rendering
  await page.screenshot({ path: 'debug-failure.png', fullPage: true });

  await page.waitForFunction(() =>
    document.body.getAttribute('charts-render-complete') === 'true',
    { timeout: 20000 }
  );

  // Hide input UI for PDF
  await page.evaluate(() => {
    ['filterForm', 'TEXTAREA', 'FILE'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('form, p, .form-group, .btn, h1, label').forEach(el => {
      el.style.display = 'none';
    });
  });

  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });

  await browser.close();
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node runner.js <input.jstack> <output.pdf>');
  process.exit(1);
}
const [inputPath, outputPath] = args;

generatePDF(inputPath, outputPath)
  .then(() => {
    console.log(`✅ PDF saved to ${outputPath}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error in generatePDF:', err);
    process.exit(1);
  });
