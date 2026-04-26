import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, 'pitch-deck.html');
const pdfPath = path.join(dir, 'pitch-deck.pdf');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

// Make all slides visible for PDF
await page.evaluate(() => {
  document.querySelectorAll('.slide').forEach(s => {
    s.style.display = 'block';
    s.style.position = 'relative';
  });
  document.getElementById('deck').style.transform = 'none';
  document.getElementById('deck').style.margin = '0';
  document.querySelectorAll('.nav-arrow, #counter').forEach(e => e.style.display = 'none');
});

await page.pdf({
  path: pdfPath,
  width: '1440px',
  height: '900px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();
console.log(`PDF saved to ${pdfPath}`);
