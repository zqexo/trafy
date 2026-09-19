const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const logs = [];
  page.on('console', msg => {
    logs.push('[' + msg.type() + '] ' + msg.text());
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
    logs.push('PAGE ERROR: ' + err.message);
  });
  
  // ─── 1. LOGIN SCREEN ───
  console.log('=== 1. LOGIN SCREEN ===');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  await page.evaluate(() => {
    indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  const brandTitle = await page.textContent('.login-brand-title');
  console.log('Brand:', brandTitle);
  
  const userNames = await page.locator('.user-list-card .user-list-name').allTextContents();
  console.log('Users:', userNames);
  
  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  console.log('✓ screenshot-login.png');
  
  // ─── 2. LOGIN AS ALEXANDER ───
  console.log('\n=== 2. LOGIN AS ALEXANDER ===');
  await page.locator('.user-list-card').first().click();
  await page.waitForTimeout(1500);
  
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('Header:', await page.textContent('#header-title'));
  console.log('Today stat:', await page.textContent('#stat-today'));
  console.log('Week stat:', await page.textContent('#stat-week'));
  console.log('Month stat:', await page.textContent('#stat-month'));
  
  const recentItems = await page.locator('#recent-list .expense-item').count();
  console.log('Recent items:', recentItems);
  console.log('Recent total:', await page.textContent('#recent-total'));
  
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });
  console.log('✓ screenshot-main.png');
  
  // ─── 3. EXPENSE LIST ───
  console.log('\n=== 3. EXPENSE LIST ===');
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  const listItems = await page.locator('#list-full-list .expense-item').count();
  console.log('List items:', listItems);
  console.log('List total:', await page.textContent('#list-total'));
  console.log('List count:', await page.textContent('#list-count'));
  
  // Фильтр "Сегодня"
  await page.click('[data-filter="period"][data-value="today"]');
  await page.waitForTimeout(1000);
  console.log('With "Today" filter:', await page.locator('#list-full-list .expense-item').count());
  
  await page.click('[data-filter="period"][data-value="all"]');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  console.log('✓ screenshot-list.png');
  
  // ─── 4. ADD EXPENSE (navigate to add screen) ───
  console.log('\n=== 4. ADD EXPENSE ===');
  await page.click('a[data-nav="main"]');
  await page.waitForTimeout(2000);
  
  // Use the full form (add screen) instead of quick-add
  await page.click('a[href="#add"]');
  await page.waitForTimeout(2000);
  
  const formTitle = await page.textContent('#form-title');
  console.log('Form title:', formTitle);
  
  await page.fill('#form-amount', '750');
  await page.selectOption('#form-category', 'Еда');
  await page.fill('#form-description', 'Обед в кафе');
  await page.waitForTimeout(500);
  
  await page.click('#btn-form-save');
  await page.waitForTimeout(5000);
  
  console.log('URL after add:', page.url());
  console.log('List items after add:', (await page.locator('#list-full-list .expense-item').count()));
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  console.log('✓ screenshot-list-after-add.png');
  
  // ─── 5. STATISTICS ───
  console.log('\n=== 5. STATISTICS ===');
  await page.click('a[data-nav="stats"]');
  await page.waitForTimeout(3000);
  
  console.log('Stats today:', await page.textContent('#stats-today'));
  console.log('Stats week:', await page.textContent('#stats-week'));
  console.log('Stats month:', await page.textContent('#stats-month'));
  console.log('Stats all:', await page.textContent('#stats-all'));
  console.log('Category bars:', await page.locator('#category-bars .cat-bar-row').count());
  console.log('Trend bars:', await page.locator('#trend-chart .trend-bar-col').count());
  console.log('Top expenses:', await page.locator('#top-expenses .top-exp-item').count());
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  console.log('✓ screenshot-stats.png');
  
  // ─── 6. CATEGORIES ───
  console.log('\n=== 6. CATEGORIES ===');
  await page.click('a[data-nav="categories"]');
  await page.waitForTimeout(2000);
  
  const catCards = await page.locator('#categories-grid .category-card').count();
  console.log('Category cards:', catCards);
  
  await page.click('#btn-category-add');
  await page.waitForTimeout(1000);
  console.log('Modal visible:', !(await page.locator('#modal-category').evaluate(el => el.classList.contains('hidden'))));
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.click('#cat-modal-save');
  await page.waitForTimeout(2000);
  console.log('Categories after add:', await page.locator('#categories-grid .category-card').count());
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('✓ screenshot-categories.png');
  
  // ─── 7. SETTINGS ───
  console.log('\n=== 7. SETTINGS ===');
  await page.click('a[data-nav="settings"]');
  await page.waitForTimeout(2000);
  
  console.log('Display name:', await page.textContent('#settings-display-name'));
  console.log('Email:', await page.textContent('#settings-email'));
  
  await page.selectOption('#settings-currency', '$');
  await page.waitForTimeout(1000);
  console.log('Currency after change:', await page.inputValue('#settings-currency'));
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('✓ screenshot-settings.png');
  
  // ─── 8. LOGOUT ───
  console.log('\n=== 8. LOGOUT ===');
  await page.click('#btn-logout');
  await page.waitForTimeout(3000);
  
  console.log('URL after logout:', page.url());
  console.log('Login screen visible:', !(await page.locator('#screen-login').evaluate(el => el.hidden)));
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  console.log('✓ screenshot-logout.png');
  
  // ─── 9. LOGIN AS MARIA ───
  console.log('\n=== 9. LOGIN AS MARIA ===');
  await page.locator('.user-list-card').last().click();
  await page.waitForTimeout(1000);
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  console.log('Maria URL:', page.url());
  console.log('Maria recent items:', await page.locator('#recent-list .expense-item').count());
  console.log('Maria recent total:', await page.textContent('#recent-total'));
  console.log('Maria list items:', (await page.locator('#list-full-list .expense-item').count()));
  
  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  console.log('✓ screenshot-maria-main.png');
  
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('✓ screenshot-maria-list.png');
  
  // ─── FINAL REPORT ───
  console.log('\n========================================');
  console.log('           TEST RESULTS');
  console.log('========================================');
  console.log('Screens tested: login, main, list, add, stats, categories, settings');
  console.log('User flows: Alexander, Maria');
  console.log('Console errors:', errors.length);
  errors.forEach(e => console.log('  ERR: ' + e));
  
  console.log('\n=== localStorage ===');
  const storage = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try { data[key] = JSON.parse(localStorage.getItem(key)).toString(); } catch(e) { data[key] = localStorage.getItem(key); }
    }
    return data;
  });
  Object.keys(storage).forEach(k => console.log('  ' + k + ' = ' + storage[k].substring(0, 100)));
  
  console.log('\n=== IndexedDB ===');
  const dbInfo = await page.evaluate(() => indexedDB.databases());
  console.log('  ' + JSON.stringify(dbInfo));
  
  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
