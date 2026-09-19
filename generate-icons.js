const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

// Логотип из index.html (.login-logo) — адаптируем под иконки PWA
// Цвета: primary #6366f1, primary-light #818cf8, surface #1e1e36
const SVG_TPL = (size, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.29)}" fill="#6366f1"/>
  <path d="M${pad + size * 0.29} ${pad + size * 0.71}V${pad + size * 0.38}
    C${pad + size * 0.29} ${pad + size * 0.33} ${pad + size * 0.36} ${pad + size * 0.31}
    ${pad + size * 0.42} ${pad + size * 0.31}H${pad + size * 0.65}
    C${pad + size * 0.71} ${pad + size * 0.31} ${pad + size * 0.78} ${pad + size * 0.33}
    ${pad + size * 0.78} ${pad + size * 0.38}V${pad + size * 0.71}
    C${pad + size * 0.78} ${pad + size * 0.76} ${pad + size * 0.71} ${pad + size * 0.79}
    ${pad + size * 0.65} ${pad + size * 0.79}H${pad + size * 0.42}
    C${pad + size * 0.36} ${pad + size * 0.79} ${pad + size * 0.29} ${pad + size * 0.76}
    ${pad + size * 0.29} ${pad + size * 0.71}Z"
    fill="#818cf8"/>
  <rect x="${pad + size * 0.42}" y="${pad + size * 0.44}"
    width="${size * 0.17}" height="${size * 0.13}" rx="${size * 0.04}"
    fill="#1e1e36"/>
  <path d="M${pad + size * 0.21} ${pad + size * 0.80}
    C${pad + size * 0.21} ${pad + size * 0.82} ${pad + size * 0.23} ${pad + size * 0.83}
    ${pad + size * 0.25} ${pad + size * 0.83}H${pad + size * 0.75}
    C${pad + size * 0.77} ${pad + size * 0.83} ${pad + size * 0.79} ${pad + size * 0.82}
    ${pad + size * 0.79} ${pad + size * 0.80}V${pad + size * 0.80}
    C${pad + size * 0.79} ${pad + size * 0.82} ${pad + size * 0.77} ${pad + size * 0.83}
    ${pad + size * 0.75} ${pad + size * 0.83}H${pad + size * 0.25}
    C${pad + size * 0.23} ${pad + size * 0.83} ${pad + size * 0.21} ${pad + size * 0.82}
    ${pad + size * 0.21} ${pad + size * 0.80}V${pad + size * 0.80}Z"
    fill="#818cf8"/>
  <circle cx="${size * 0.5}" cy="${size * 0.37}" r="${size * 0.083}" fill="#6366f1"/>
</svg>`;

function svgToPng(svg, width) {
  // Используем нативный DOM для рендера через Blob + Image (работает в Node с canvas или в браузере)
  // В Node.js без нативных модулей — пишем SVG и конвертируем через lightweight-метод.
  return null; // сигнал: нужен внешний инструмент
}

// Пытаемся генерировать PNG через доступные инструменты
async function generatePng(svgPath, outPath, size) {
  // Пробуем sharp
  try {
    const sharp = require('sharp');
    return sharp(svgPath).resize(size, size).png().toFile(outPath);
  } catch (_) {}
  // Пробуем canvas (node-canvas)
  try {
    const { createCanvas, registerFont } = require('canvas');
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = fs.readFileSync(svgPath);
    });
    ctx.drawImage(img, 0, 0, size, size);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);
    return;
  } catch (_) {}
  console.warn(`[icons] Не удалось сгенерировать PNG для ${size}: нет sharp/canvas. Оставлен SVG.`);
}

async function main() {
  const sizes = [192, 512];
  for (const size of sizes) {
    const svgPath = path.join(ICONS_DIR, `icon-${size}.svg`);
    const pngPath = path.join(ICONS_DIR, `icon-${size}.png`);
    fs.writeFileSync(svgPath, SVG_TPL(size));
    console.log(`[icons] SVG записан: ${svgPath}`);
    await generatePng(svgPath, pngPath, size).catch(() => {});
  }
  console.log('[icons] Готово');
}

main().catch(e => { console.error(e); process.exit(1); });
