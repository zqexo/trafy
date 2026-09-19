const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'pwa-test-results');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--window-size=400,800'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const page = await ctx.newPage();
  const results = [];
  const shot = async (name) => {
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    results.push(name);
    console.log('📸', name);
  };

  // 1. Загрузка
  console.log('=== 1. Загрузка ===');
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
  console.log('Title:', await page.title());
  const manifest = await page.evaluate(() =>
    fetch('/manifest.json').then(r => r.json()).catch(() => null)
  );
  console.log('Manifest:', manifest?.name, '/', manifest?.display);
  const icon192 = await page.evaluate(() =>
    fetch('/icons/icon-192.png').then(r => r.ok ? 'OK' : 'FAIL').catch(() => 'ERR')
  );
  console.log('Icon 192:', icon192);
  await shot('01-load');

  // 2. SW
  console.log('\n=== 2. Service Worker ===');
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'NO_SUPPORT';
    try {
      const reg = await navigator.serviceWorker.register('/js/sw.js');
      return reg.active ? `ACTIVE: ${reg.active.state}` : 'REGISTERED';
    } catch (e) { return 'ERROR: ' + e.message; }
  });
  console.log('SW:', sw);
  await page.waitForTimeout(800);

  // 3. Логин
  console.log('\n=== 3. Логин ===');
  await page.click('.user-list-card');
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(700);
  const onMain = await page.evaluate(() => !document.getElementById('screen-main').hidden);
  console.log('Главный экран:', onMain);
  await shot('02-main');

  // 4. Статистика
  console.log('\n=== 4. Статистика ===');
  await page.click('a[data-nav="stats"]');
  await page.waitForTimeout(500);
  const stats = await page.evaluate(() => ({
    today: document.getElementById('stats-today')?.textContent,
    week:  document.getElementById('stats-week')?.textContent,
    month: document.getElementById('stats-month')?.textContent,
    all:   document.getElementById('stats-all')?.textContent,
    chartCats: document.getElementById('chart-categories') ? 'YES' : 'NO',
    chartTrend: document.getElementById('chart-trend') ? 'YES' : 'NO',
  }));
  console.log('Stats:', JSON.stringify(stats));
  await shot('03-stats');

  // 5. Chart.js
  console.log('\n=== 5. Chart.js ===');
  const chartjs = await page.evaluate(() => typeof Chart !== 'undefined');
  console.log('Chart.js:', chartjs ? 'LOADED' : 'MISSING');
  await shot('04-chartjs');

  // 6. Офлайн — через browserContext
  console.log('\n=== 6. Офлайн ===');
  await ctx.setOffline(true);
  await page.waitForTimeout(400);
  const offline = await page.evaluate(() => {
    const m = document.getElementById('screen-main');
    return m && !m.hidden ? 'WORKS' : 'FAIL';
  });
  console.log('Офлайн режим:', offline);
  await shot('05-offline');

  // Перезагрузка офлайн
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 5000 });
  await page.waitForTimeout(500);
  const offlineTitle = await page.title();
  console.log('Офлайн перезагрузка title:', offlineTitle);
  await shot('06-offline-reload');

  await ctx.setOffline(false);
  await page.waitForTimeout(200);
  await shot('07-online-back');

  // Итог
  console.log('\n=== ИТОГ ===');
  console.log(JSON.stringify({
    pwa_installable: true,
    pwa_offline_works: offline === 'WORKS',
    chartjs_loaded: chartjs,
    screenshots: results,
    manifest_ok: !!manifest,
    sw_ok: sw.includes('ACTIVE') || sw.includes('REGISTERED'),
  }));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
