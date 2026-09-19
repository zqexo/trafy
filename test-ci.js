const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  // LOGIN SCREEN
  console.log('=== LOGIN ===');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))));
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  const users = await page.locator('.user-list-card').count();
  console.log('Users:', users);
  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  
  // LOGIN ALEXANDER
  console.log('=== LOGIN ALEX ===');
  await page.locator('.user-list-card').first().click();
  await page.waitForTimeout(1500);
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  const today = await page.textContent('#stat-today');
  const week = await page.textContent('#stat-week');
  const month = await page.textContent('#stat-month');
  const recentCount = await page.locator('#recent-list .expense-item').count();
  const recentTotal = await page.textContent('#recent-total');
  console.log(`Stats: today=${today} week=${week} month=${month}`);
  console.log(`Recent: ${recentCount} items, total=${recentTotal}`);
  
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });
  
  // LIST
  console.log('=== LIST ===');
  await page.evaluate(() => document.getElementById('btn-see-all').click());
  await page.waitForTimeout(2000);
  const listCount = await page.locator('#list-full-list .expense-item').count();
  const listTotal = await page.textContent('#list-total');
  const listCountText = await page.textContent('#list-count');
  console.log(`List: ${listCount} items, ${listTotal}, ${listCountText}`);
  
  await page.evaluate(() => document.querySelector('[data-filter="period"][data-value="today"]').click());
  await page.waitForTimeout(1000);
  const todayCount = await page.locator('#list-full-list .expense-item').count();
  console.log(`Today filter: ${todayCount} items`);
  
  await page.evaluate(() => document.querySelector('[data-filter="period"][data-value="all"]').click());
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  
  // ADD EXPENSE
  console.log('=== ADD ===');
  await page.evaluate(() => {
    document.getElementById('quick-amount').value = '750';
    document.getElementById('quick-category').value = 'cat-1';
    document.getElementById('quick-description').value = 'Обед в кафе';
    document.getElementById('quick-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('quick-category').dispatchEvent(new Event('change'));
    document.getElementById('btn-quick-add').click();
  });
  await page.waitForTimeout(5000);
  
  const afterAddUrl = page.url();
  const afterAddRecent = await page.locator('#recent-list .expense-item').count();
  const afterAddTotal = await page.textContent('#recent-total');
  console.log(`After add: URL=${afterAddUrl}, recent=${afterAddRecent}, total=${afterAddTotal}`);
  
  await page.evaluate(() => document.getElementById('btn-see-all').click());
  await page.waitForTimeout(2000);
  const afterAddList = await page.locator('#list-full-list .expense-item').count();
  const afterAddListTotal = await page.textContent('#list-total');
  console.log(`List after add: ${afterAddList} items, ${afterAddListTotal}`);
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  
  // DELETE
  console.log('=== DELETE ===');
  const delBtn = await page.locator('#list-full-list .expense-item .btn-icon-sm[aria-label="Удалить"]').first();
  await delBtn.click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.getElementById('delete-modal-confirm').click());
  await page.waitForTimeout(3000);
  const afterDel = await page.locator('#list-full-list .expense-item').count();
  const afterDelTotal = await page.textContent('#list-total');
  console.log(`After delete: ${afterDel} items, ${afterDelTotal}`);
  
  await page.screenshot({ path: 'screenshot-after-delete.png', fullPage: true });
  
  // STATS
  console.log('=== STATS ===');
  await page.evaluate(() => document.querySelector('a[data-nav="stats"]').click());
  await page.waitForTimeout(3000);
  const sToday = await page.textContent('#stats-today');
  const sWeek = await page.textContent('#stats-week');
  const sMonth = await page.textContent('#stats-month');
  const sAll = await page.textContent('#stats-all');
  const catBars = await page.locator('#category-bars .cat-bar-row').count();
  const trendBars = await page.locator('#trend-chart .trend-bar-col').count();
  const topItems = await page.locator('#top-expenses .top-exp-item').count();
  console.log(`Stats: today=${sToday} week=${sWeek} month=${sMonth} all=${sAll}`);
  console.log(`Charts: catBars=${catBars} trendBars=${trendBars} topItems=${topItems}`);
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  
  // CATEGORIES
  console.log('=== CATEGORIES ===');
  await page.evaluate(() => document.querySelector('a[data-nav="categories"]').click());
  await page.waitForTimeout(2000);
  const catCards = await page.locator('#categories-grid .category-card').count();
  console.log(`Categories: ${catCards} cards`);
  
  await page.evaluate(() => document.getElementById('btn-category-add').click());
  await page.waitForTimeout(1000);
  const modalVis = !(await page.locator('#modal-category').evaluate(el => el.classList.contains('hidden')));
  console.log(`Modal visible: ${modalVis}`);
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.evaluate(() => document.getElementById('cat-modal-save').click());
  await page.waitForTimeout(2000);
  const catAfter = await page.locator('#categories-grid .category-card').count();
  console.log(`Categories after add: ${catAfter}`);
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  
  // SETTINGS
  console.log('=== SETTINGS ===');
  await page.evaluate(() => document.querySelector('a[data-nav="settings"]').click());
  await page.waitForTimeout(2000);
  const dispName = await page.textContent('#settings-display-name');
  const email = await page.textContent('#settings-email');
  const currency = await page.inputValue('#settings-currency');
  console.log(`Settings: name=${dispName} email=${email} currency=${currency}`);
  
  await page.evaluate(() => {
    document.getElementById('settings-name-input').value = 'Алекс';
    document.getElementById('settings-name-save').click();
  });
  await page.waitForTimeout(1000);
  console.log(`Name after save: ${await page.textContent('#settings-display-name')}`);
  
  await page.evaluate(() => document.getElementById('settings-currency').value = '$');
  await page.evaluate(() => document.getElementById('settings-currency').dispatchEvent(new Event('change')));
  await page.waitForTimeout(1000);
  console.log(`Currency after change: ${await page.inputValue('#settings-currency')}`);
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  
  // LOGOUT
  console.log('=== LOGOUT ===');
  await page.evaluate(() => document.getElementById('btn-logout').click());
  await page.waitForTimeout(3000);
  const logoutUrl = page.url();
  const loginShown = !(await page.locator('#screen-login').evaluate(el => el.hidden));
  console.log(`Logout: URL=${logoutUrl}, login shown=${loginShown}`);
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  
  // LOGIN MARIA
  console.log('=== LOGIN MARIA ===');
  await page.locator('.user-list-card').last().click();
  await page.waitForTimeout(1000);
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  const mRecent = await page.locator('#recent-list .expense-item').count();
  const mTotal = await page.textContent('#recent-total');
  console.log(`Maria: ${mRecent} items, total=${mTotal}`);
  
  await page.evaluate(() => document.getElementById('btn-see-all').click());
  await page.waitForTimeout(2000);
  const mList = await page.locator('#list-full-list .expense-item').count();
  const mListTotal = await page.textContent('#list-total');
  console.log(`Maria list: ${mList} items, ${mListTotal}`);
  
  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  
  // FINAL
  console.log('\n=== RESULTS ===');
  console.log(`Console errors: ${errors.length}`);
  errors.forEach(e => console.log(`  ERROR: ${e}`));
  
  const storage = await page.evaluate(() => {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try { d[k] = JSON.parse(localStorage.getItem(k)).toString(); } catch(e) { d[k] = localStorage.getItem(k); }
    }
    return d;
  });
  console.log('\nlocalStorage keys:', Object.keys(storage));
  Object.entries(storage).forEach(([k,v]) => console.log(`  ${k}: ${v.substring(0,80)}`));
  
  const dbInfo = await page.evaluate(() => indexedDB.databases());
  console.log('\nIndexedDB:', JSON.stringify(dbInfo));
  
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
