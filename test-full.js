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
  
  // Сброс IndexedDB перед тестом
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
  
  const loginFormHidden = await page.locator('#login-form').evaluate(el => el.classList.contains('hidden'));
  console.log('Login form hidden (should be true before select):', loginFormHidden);
  
  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  console.log('✓ screenshot-login.png');
  
  // ─── 2. LOGIN AS ALEXANDER ───
  console.log('\n=== 2. LOGIN AS ALEXANDER ===');
  await page.locator('.user-list-card').first().click();
  await page.waitForTimeout(1500);
  
  const formShown = await page.locator('#login-form').evaluate(el => !el.classList.contains('hidden'));
  console.log('Login form shown after select:', formShown);
  
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  const afterLoginUrl = page.url();
  console.log('URL after login:', afterLoginUrl);
  
  const headerTitle = await page.textContent('#header-title');
  console.log('Header:', headerTitle);
  
  const todayStat = await page.textContent('#stat-today');
  const weekStat = await page.textContent('#stat-week');
  const monthStat = await page.textContent('#stat-month');
  console.log('Stats: today=' + todayStat + ' week=' + weekStat + ' month=' + monthStat);
  
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });
  console.log('✓ screenshot-main.png');
  
  // Последние траты
  const recentItems = await page.locator('#recent-list .expense-item').count();
  console.log('Recent items:', recentItems);
  const recentTotal = await page.textContent('#recent-total');
  console.log('Recent total:', recentTotal);
  
  // ─── 3. EXPENSE LIST ───
  console.log('\n=== 3. EXPENSE LIST ===');
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  const listItems = await page.locator('#list-full-list .expense-item').count();
  console.log('List items:', listItems);
  
  const listTotal = await page.textContent('#list-total');
  const listCount = await page.textContent('#list-count');
  console.log('List: total=' + listTotal + ' count=' + listCount);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  console.log('✓ screenshot-list.png');
  
  // Фильтр "Сегодня"
  await page.click('[data-filter="period"][data-value="today"]');
  await page.waitForTimeout(1000);
  const todayFiltered = await page.locator('#list-full-list .expense-item').count();
  console.log('Items with "Today" filter:', todayFiltered);
  
  // Сброс фильтра
  await page.click('[data-filter="period"][data-value="all"]');
  await page.waitForTimeout(500);
  
  // ─── 4. ADD EXPENSE ───
  console.log('\n=== 4. ADD EXPENSE (QUICK ADD) ===');
  await page.fill('#quick-amount', '750');
  await page.selectOption('#quick-category', 'Еда');
  await page.fill('#quick-description', 'Обед в кафе');
  await page.waitForTimeout(500);
  
  const amountBefore = await page.inputValue('#quick-amount');
  const catBefore = await page.inputValue('#quick-category');
  console.log('Amount:', amountBefore, 'Category:', catBefore);
  
  await page.click('#btn-quick-add');
  await page.waitForTimeout(5000);
  
  const urlAfterAdd = page.url();
  console.log('URL after add:', urlAfterAdd);
  
  const recentItemsAfter = await page.locator('#recent-list .expense-item').count();
  console.log('Recent items after add:', recentItemsAfter);
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  console.log('✓ screenshot-list-after-add.png');
  
  // Проверка в списке
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  const listItemsAfterAdd = await page.locator('#list-full-list .expense-item').count();
  console.log('List items after add:', listItemsAfterAdd);
  
  // ─── 5. STATISTICS ───
  console.log('\n=== 5. STATISTICS ===');
  await page.click('a[data-nav="stats"]');
  await page.waitForTimeout(3000);
  
  const statsToday = await page.textContent('#stats-today');
  const statsWeek = await page.textContent('#stats-week');
  const statsMonth = await page.textContent('#stats-month');
  const statsAll = await page.textContent('#stats-all');
  console.log('Stats: today=' + statsToday + ' week=' + statsWeek + ' month=' + statsMonth + ' all=' + statsAll);
  
  const catBars = await page.locator('#category-bars .cat-bar-row').count();
  console.log('Category bars:', catBars);
  
  const trendBars = await page.locator('#trend-chart .trend-bar-col').count();
  console.log('Trend bars:', trendBars);
  
  const topItems = await page.locator('#top-expenses .top-exp-item').count();
  console.log('Top expenses:', topItems);
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  console.log('✓ screenshot-stats.png');
  
  // ─── 6. CATEGORIES ───
  console.log('\n=== 6. CATEGORIES ===');
  await page.click('a[data-nav="categories"]');
  await page.waitForTimeout(2000);
  
  const catCards = await page.locator('#categories-grid .category-card').count();
  console.log('Category cards:', catCards);
  
  // Добавить категорию
  await page.click('#btn-category-add');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#modal-category').evaluate(el => !el.classList.contains('hidden'));
  console.log('Category modal visible:', modalVisible);
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.click('#cat-modal-save');
  await page.waitForTimeout(2000);
  
  const catCardsAfter = await page.locator('#categories-grid .category-card').count();
  console.log('Categories after add:', catCardsAfter);
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('✓ screenshot-categories.png');
  
  // ─── 7. SETTINGS ───
  console.log('\n=== 7. SETTINGS ===');
  await page.click('a[data-nav="settings"]');
  await page.waitForTimeout(2000);
  
  const settingsName = await page.textContent('#settings-display-name');
  const settingsEmail = await page.textContent('#settings-email');
  console.log('Settings: name=' + settingsName + ' email=' + settingsEmail);
  
  // Смена валюты
  await page.selectOption('#settings-currency', '$');
  await page.waitForTimeout(1000);
  const currencyAfter = await page.inputValue('#settings-currency');
  console.log('Currency after change:', currencyAfter);
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('✓ screenshot-settings.png');
  
  // ─── 8. LOGOUT ───
  console.log('\n=== 8. LOGOUT ===');
  await page.click('#btn-logout');
  await page.waitForTimeout(3000);
  
  const logoutUrl = page.url();
  console.log('URL after logout:', logoutUrl);
  
  const loginVisibleAfter = await page.locator('#screen-login').evaluate(el => !el.hidden);
  console.log('Login screen visible:', loginVisibleAfter);
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  console.log('✓ screenshot-logout.png');
  
  // ─── 9. LOGIN AS MARIA ───
  console.log('\n=== 9. LOGIN AS MARIA ===');
  await page.locator('.user-list-card').last().click();
  await page.waitForTimeout(1000);
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  const mariaUrl = page.url();
  console.log('Maria URL:', mariaUrl);
  
  const mariaRecent = await page.locator('#recent-list .expense-item').count();
  console.log('Maria recent items:', mariaRecent);
  
  const mariaTotal = await page.textContent('#recent-total');
  console.log('Maria recent total:', mariaTotal);
  
  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  console.log('✓ screenshot-maria-main.png');
  
  // Список трат Марии
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  const mariaListItems = await page.locator('#list-full-list .expense-item').count();
  console.log('Maria list items:', mariaListItems);
  
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('✓ screenshot-maria-list.png');
  
  // ─── FINAL REPORT ───
  console.log('\n========================================');
  console.log('           TEST RESULTS');
  console.log('========================================');
  console.log('Total screens tested: 7 (login, main, list, add, stats, categories, settings)');
  console.log('User flows tested: 2 (Alexander, Maria)');
  console.log('Console errors:', errors.length);
  errors.forEach(e => console.log('  - ' + e));
  
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
