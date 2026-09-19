const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = __dirname + '/icons';

async function svgToPng(svgPath, pngPath, size) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  await page.setContent(svgContent, { waitUntil: 'networkidle' });
  const dataUrl = await page.evaluate(async () => {
    const svg = document.querySelector('svg');
    const canvas = document.createElement('canvas');
    const vb = svg.viewBox.baseVal;
    canvas.width = vb.width || size;
    canvas.height = vb.height || size;
    const ctx = canvas.getContext('2d');
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await browser.close();
  console.log(`[icons] PNG: ${pngPath}`);
}

async function main() {
  for (const size of [192, 512]) {
    await svgToPng(
      path.join(ICONS_DIR, `icon-${size}.svg`),
      path.join(ICONS_DIR, `icon-${size}.png`),
      size
    );
  }
  console.log('[icons] Готово');
}

main().catch(e => { console.error(e); process.exit(1); });
