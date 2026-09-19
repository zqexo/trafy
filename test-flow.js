const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  // СбросIndexedDB
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => indexedDB.deleteDatabase(db.name));
    });
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  console.log('=== 1. LOGIN SCREEN ===');
  const brandTitle = await page.textContent('.login-brand-title');
  console.log('Brand:', brandTitle);
  
  const userNames = await page.locator('.user-list-name').allTextContents();
  console.log('Users:', userNames);
  
  const loginFormVisible = await page.isVisible('#login-form');
  console.log('Login form visible (should be false):', loginFormVisible);
  
  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  console.log('Screenshot: screenshot-login.png');
  
  // --- ЛОГИН АЛЕКСАНДРА ---
  console.log('\n=== 2. LOGIN AS ALEXANDER ===');
  const alexCard = await page.locator('.user-list-card').first();
  await alexCard.click();
  await page.waitForTimeout(1000);
  
  const formAfterSelect = await page.isVisible('#login-form');
  console.log('Login form visible after select:', formAfterSelect);
  
  const emailVal = await page.inputValue('#input-email');
  console.log('Email field:', emailVal);
  
  await page.click('#btn-login-submit');
  await page.waitForTimeout(4000);
  
  const urlAfterLogin = page.url();
  console.log('URL after login:', urlAfterLogin);
  
  const mainVisible = await page.isVisible('#screen-main');
  console.log('Main screen visible:', mainVisible);
  
  const headerTitle = await page.textContent('#header-title');
  console.log('Header title:', headerTitle);
  
  const todayStat = await page.textContent('#stat-today');
  const weekStat = await page.textContent('#stat-week');
  const monthStat = await page.textContent('#stat-month');
  console.log('Stats - today:', todayStat, 'week:', weekStat, 'month:', monthStat);
  
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });
  console.log('Screenshot: screenshot-main.png');
  
  const recentItems = await page.locator('#recent-list .expense-item').count();
  console.log('Recent items:', recentItems);
  const recentEmpty = await page.isVisible('#recent-empty');
  console.log('Recent empty state visible:', recentEmpty);
  
  const recentTotal = await page.textContent('#recent-total');
  console.log('Recent total:', recentTotal);
  
  // --- СПИСОК ТРАТ ---
  console.log('\n=== 3. EXPENSE LIST ===');
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  const listVisible = await page.isVisible('#screen-list');
  console.log('List screen visible:', listVisible);
  
  const listItems = await page.locator('#list-full-list .expense-item').count();
  console.log('List items count:', listItems);
  
  const listTotal = await page.textContent('#list-total');
  const listCount = await page.textContent('#list-count');
  console.log('List total:', listTotal, ', count:', listCount);
  
  const listEmpty = await page.isVisible('#list-empty');
  console.log('List empty visible:', listEmpty);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  console.log('Screenshot: screenshot-list.png');
  
  // Проверка фильтров
  const filterUserOptions = await page.locator('#filter-user option').count();
  console.log('Filter user options:', filterUserOptions);
  
  // Проверка фильтра "Сегодня"
  await page.click('[data-filter="period"][data-value="today"]');
  await page.waitForTimeout(1000);
  const todayItems = await page.locator('#list-full-list .expense-item').count();
  console.log('Items with "Today" filter:', todayItems);
  
  // Сброс фильтра
  await page.click('[data-filter="period"][data-value="all"]');
  await page.waitForTimeout(1000);
  
  // --- ДОБАВЛЕНИЕ ТРАТЫ ---
  console.log('\n=== 4. ADD EXPENSE ===');
  await page.click('#btn-quick-add');
  await page.waitForTimeout(1500);
  
  const formScreenVisible = await page.isVisible('#screen-form');
  console.log('Form screen visible:', formScreenVisible);
  
  const formTitle = await page.textContent('#form-title');
  console.log('Form title:', formTitle);
  
  // Заполнить форму
  await page.fill('#quick-amount', '750');
  await page.selectOption('#quick-category', 'Еда');
  await page.fill('#quick-description', 'Обед в кафе');
  await page.waitForTimeout(500);
  
  const quickAmountVal = await page.inputValue('#quick-amount');
  const quickCatVal = await page.inputValue('#quick-category');
  console.log('Amount:', quickAmountVal, 'Category:', quickCatVal);
  
  await page.click('#btn-quick-add');
  await page.waitForTimeout(4000);
  
  const afterAddUrl = page.url();
  console.log('URL after add:', afterAddUrl);
  
  const mainAfterAdd = await page.isVisible('#screen-main');
  console.log('Main screen after add:', mainAfterAdd);
  
  // Проверка что трата появилась
  const newRecentItems = await page.locator('#recent-list .expense-item').count();
  console.log('Recent items after add:', newRecentItems);
  
  // Проверка что трата в списке
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  const listItemsAfterAdd = await page.locator('#list-full-list .expense-item').count();
  console.log('List items after add:', listItemsAfterAdd);
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  console.log('Screenshot: screenshot-list-after-add.png');
  
  // --- СТАТИСТИКА ---
  console.log('\n=== 5. STATS ===');
  await page.click('a[data-nav="stats"]');
  await page.waitForTimeout(3000);
  
  const statsVisible = await page.isVisible('#screen-stats');
  console.log('Stats visible:', statsVisible);
  
  const statsTodayVal = await page.textContent('#stats-today');
  const statsWeekVal = await page.textContent('#stats-week');
  const statsMonthVal = await page.textContent('#stats-month');
  const statsAllVal = await page.textContent('#stats-all');
  console.log('Stats - today:', statsTodayVal, 'week:', statsWeekVal, 'month:', statsMonthVal, 'all:', statsAllVal);
  
  const catBars = await page.locator('#category-bars .cat-bar-row').count();
  console.log('Category bars:', catBars);
  
  const trendBars = await page.locator('#trend-chart .trend-bar-col').count();
  console.log('Trend bars:', trendBars);
  
  const topItems = await page.locator('#top-expenses .top-exp-item').count();
  console.log('Top expenses:', topItems);
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  console.log('Screenshot: screenshot-stats.png');
  
  // --- КАТЕГОРИИ ---
  console.log('\n=== 6. CATEGORIES ===');
  await page.click('a[data-nav="categories"]');
  await page.waitForTimeout(2000);
  
  const catsVisible = await page.isVisible('#screen-categories');
  console.log('Categories visible:', catsVisible);
  
  const catCards = await page.locator('#categories-grid .category-card').count();
  console.log('Category cards count:', catCards);
  
  // Проверка модалки категории
  await page.click('#btn-category-add');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.isVisible('#modal-category');
  console.log('Category modal visible:', modalVisible);
  
  const modalTitle = await page.textContent('#category-modal-title');
  console.log('Modal title:', modalTitle);
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.click('#cat-modal-save');
  await page.waitForTimeout(2000);
  
  const updatedCatCount = await page.locator('#categories-grid .category-card').count();
  console.log('Categories after add:', updatedCatCount);
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('Screenshot: screenshot-categories.png');
  
  // --- НАСТРОЙКИ ---
  console.log('\n=== 7. SETTINGS ===');
  await page.click('a[data-nav="settings"]');
  await page.waitForTimeout(2000);
  
  const settingsVisible = await page.isVisible('#screen-settings');
  console.log('Settings visible:', settingsVisible);
  
  const settingsName = await page.textContent('#settings-display-name');
  const settingsEmail = await page.textContent('#settings-email');
  console.log('Settings - name:', settingsName, 'email:', settingsEmail);
  
  // Смена валюты
  await page.selectOption('#settings-currency', '$');
  await page.waitForTimeout(1000);
  
  const currencyAfter = await page.inputValue('#settings-currency');
  console.log('Currency after change:', currencyAfter);
  
  // Тема
  const themeOptions = await page.locator('.theme-option').count();
  console.log('Theme options:', themeOptions);
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('Screenshot: screenshot-settings.png');
  
  // --- ВЫХОД ---
  console.log('\n=== 8. LOGOUT ===');
  await page.click('#btn-logout');
  await page.waitForTimeout(3000);
  
  const logoutVisible = await page.isVisible('#screen-login');
  console.log('Login screen after logout:', logoutVisible);
  
  const logoutHeader = await page.textContent('#header-title');
  console.log('Header after logout:', logoutHeader);
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  console.log('Screenshot: screenshot-logout.png');
  
  // --- ЛОГИН МАРИИ ---
  console.log('\n=== 9. LOGIN AS MARIA ===');
  const mariaCard = await page.locator('.user-list-card').last();
  await mariaCard.click();
  await page.waitForTimeout(1000);
  
  await page.click('#btn-login-submit');
  await page.waitForTimeout(4000);
  
  const mariaUrl = page.url();
  console.log('Maria URL:', mariaUrl);
  
  const mariaMain = await page.isVisible('#screen-main');
  console.log('Maria main screen:', mariaMain);
  
  // У Марии должны быть свои траты
  const mariaRecentItems = await page.locator('#recent-list .expense-item').count();
  console.log('Maria recent items:', mariaRecentItems);
  
  const mariaRecentTotal = await page.textContent('#recent-total');
  console.log('Maria recent total:', mariaRecentTotal);
  
  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  console.log('Screenshot: screenshot-maria-main.png');
  
  // Список трат Марии
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  const mariaListItems = await page.locator('#list-full-list .expense-item').count();
  console.log('Maria list items:', mariaListItems);
  
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('Screenshot: screenshot-maria-list.png');
  
  // --- ИТОГОВАЯ ПРОВЕРКА КОНСОЛИ ---
  console.log('\n=== FINAL CONSOLE CHECK ===');
  console.log('Total console errors:', errors.length);
  errors.forEach(e => console.log(' ERROR:', e));
  
  const storage = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try { data[key] = JSON.parse(localStorage.getItem(key)).toString(); } catch(e) { data[key] = localStorage.getItem(key); }
    }
    return data;
  });
  
  console.log('\n=== localStorage ===');
  Object.keys(storage).forEach(k => {
    const val = storage[k];
    console.log(' ', k, '=', val.substring(0, 150));
  });
  
  // Проверка IndexedDB
  const dbInfo = await page.evaluate(() => {
    return indexedDB.databases();
  });
  console.log('\n=== IndexedDB ===');
  console.log('Databases:', JSON.stringify(dbInfo));
  
  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
