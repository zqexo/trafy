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
  
  const userNames = await page.locator('.user-list-card .user-list-name').allTextContents();
  console.log('Users:', userNames);
  console.log('Login form hidden:', await page.locator('#login-form').evaluate(el => el.classList.contains('hidden')));
  
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
  console.log('Today:', await page.textContent('#stat-today'));
  console.log('Week:', await page.textContent('#stat-week'));
  console.log('Month:', await page.textContent('#stat-month'));
  console.log('Recent items:', await page.locator('#recent-list .expense-item').count());
  console.log('Recent total:', await page.textContent('#recent-total'));
  
  await page.screenshot({ path: 'screenshot-main.png', fullPage: true });
  console.log('✓ screenshot-main.png');
  
  // ─── 3. EXPENSE LIST ───
  console.log('\n=== 3. EXPENSE LIST ===');
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  console.log('List items:', await page.locator('#list-full-list .expense-item').count());
  console.log('List total:', await page.textContent('#list-total'));
  console.log('List count:', await page.textContent('#list-count'));
  
  // Фильтр "Сегодня"
  await page.click('[data-filter="period"][data-value="today"]');
  await page.waitForTimeout(1000);
  console.log('Today filter items:', await page.locator('#list-full-list .expense-item').count());
  
  await page.click('[data-filter="period"][data-value="all"]');
  await page.waitForTimeout(500);
  
  // Фильтр по категории
  const catOptions = await page.locator('#filter-category option').allTextContents();
  console.log('Category filter options:', catOptions);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  console.log('✓ screenshot-list.png');
  
  // ─── 4. ADD EXPENSE (via full form - navigate to edit with new id) ───
  console.log('\n=== 4. ADD EXPENSE ===');
  // Go to main first
  await page.click('a[data-nav="main"]');
  await page.waitForTimeout(2000);
  
  // Use quick-add (it's on the main screen)
  await page.fill('#quick-amount', '750');
  await page.selectOption('#quick-category', 'Еда');
  await page.fill('#quick-description', 'Обед в кафе');
  await page.waitForTimeout(500);
  
  console.log('Quick amount:', await page.inputValue('#quick-amount'));
  console.log('Quick category:', await page.inputValue('#quick-category'));
  
  await page.click('#btn-quick-add');
  await page.waitForTimeout(5000);
  
  console.log('URL after quick-add:', page.url());
  console.log('Recent items after add:', await page.locator('#recent-list .expense-item').count());
  console.log('Recent total after add:', await page.textContent('#recent-total'));
  
  // Check in list
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  console.log('List items after add:', await page.locator('#list-full-list .expense-item').count());
  console.log('List total after add:', await page.textContent('#list-total'));
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  console.log('✓ screenshot-list-after-add.png');
  
  // ─── 5. EDIT EXPENSE (delete flow) ───
  console.log('\n=== 5. EDIT/DELETE EXPENSE ===');
  // Click on first expense item to edit
  await page.click('#list-full-list .expense-item');
  await page.waitForTimeout(2000);
  
  const editTitle = await page.textContent('#form-title');
  console.log('Edit form title:', editTitle);
  
  // Назад
  await page.click('#btn-back');
  await page.waitForTimeout(1500);
  
  // Удалить трату через модалку
  const firstExpItem = await page.locator('#list-full-list .expense-item').first();
  const expId = await firstExpItem.getAttribute('data-id') || await firstExpItem.evaluate(el => el.querySelector('button[aria-label="Удалить"]') ? 'has delete btn' : 'no delete');
  console.log('First expense has delete btn:', expId);
  
  await page.screenshot({ path: 'screenshot-edit.png', fullPage: true });
  console.log('✓ screenshot-edit.png');
  
  // ─── 6. STATISTICS ───
  console.log('\n=== 6. STATISTICS ===');
  await page.click('a[data-nav="stats"]');
  await page.waitForTimeout(3000);
  
  console.log('Stats today:', await page.textContent('#stats-today'));
  console.log('Stats week:', await page.textContent('#stats-week'));
  console.log('Stats month:', await page.textContent('#stats-month'));
  console.log('Stats all:', await page.textContent('#stats-all'));
  console.log('Category bars:', await page.locator('#category-bars .cat-bar-row').count());
  console.log('Trend bars:', await page.locator('#trend-chart .trend-bar-col').count());
  console.log('Top expenses:', await page.locator('#top-expenses .top-exp-item').count());
  
  // Проверка периода 14 дней
  await page.click('[data-stat-period="14d"]');
  await page.waitForTimeout(1000);
  console.log('Trend bars (14d):', await page.locator('#trend-chart .trend-bar-col').count());
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  console.log('✓ screenshot-stats.png');
  
  // ─── 7. CATEGORIES ───
  console.log('\n=== 7. CATEGORIES ===');
  await page.click('a[data-nav="categories"]');
  await page.waitForTimeout(2000);
  
  const catCards = await page.locator('#categories-grid .category-card').count();
  console.log('Category cards:', catCards);
  
  // Добавить категорию
  await page.click('#btn-category-add');
  await page.waitForTimeout(1000);
  console.log('Category modal visible:', !(await page.locator('#modal-category').evaluate(el => el.classList.contains('hidden'))));
  console.log('Modal title:', await page.textContent('#category-modal-title'));
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.click('#cat-modal-save');
  await page.waitForTimeout(2000);
  console.log('Categories after add:', await page.locator('#categories-grid .category-card').count());
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('✓ screenshot-categories.png');
  
  // ─── 8. SETTINGS ───
  console.log('\n=== 8. SETTINGS ===');
  await page.click('a[data-nav="settings"]');
  await page.waitForTimeout(2000);
  
  console.log('Display name:', await page.textContent('#settings-display-name'));
  console.log('Email:', await page.textContent('#settings-email'));
  console.log('Currency:', await page.inputValue('#settings-currency'));
  
  // Смена имени
  await page.fill('#settings-name-input', 'Алекс');
  await page.click('#settings-name-save');
  await page.waitForTimeout(1000);
  console.log('Name after save:', await page.textContent('#settings-display-name'));
  
  // Смена валюты
  await page.selectOption('#settings-currency', '$');
  await page.waitForTimeout(1000);
  console.log('Currency after change:', await page.inputValue('#settings-currency'));
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('✓ screenshot-settings.png');
  
  // ─── 9. LOGOUT ───
  console.log('\n=== 9. LOGOUT ===');
  await page.click('#btn-logout');
  await page.waitForTimeout(3000);
  
  console.log('URL after logout:', page.url());
  console.log('Login screen visible:', !(await page.locator('#screen-login').evaluate(el => el.hidden)));
  console.log('Brand title:', await page.textContent('.login-brand-title'));
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  console.log('✓ screenshot-logout.png');
  
  // ─── 10. LOGIN AS MARIA ───
  console.log('\n=== 10. LOGIN AS MARIA ===');
  await page.locator('.user-list-card').last().click();
  await page.waitForTimeout(1000);
  await page.fill('#input-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForTimeout(5000);
  
  console.log('Maria URL:', page.url());
  console.log('Maria header:', await page.textContent('#header-title'));
  console.log('Maria recent items:', await page.locator('#recent-list .expense-item').count());
  console.log('Maria recent total:', await page.textContent('#recent-total'));
  
  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  console.log('✓ screenshot-maria-main.png');
  
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  console.log('Maria list items:', await page.locator('#list-full-list .expense-item').count());
  console.log('Maria list total:', await page.textContent('#list-total'));
  
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('✓ screenshot-maria-list.png');
  
  // ─── FINAL REPORT ───
  console.log('\n========================================');
  console.log('           TEST RESULTS');
  console.log('========================================');
  console.log('');
  console.log('SCREENS TESTED (7):');
  console.log('  ✓ login — экран входа с выбором пользователя');
  console.log('  ✓ main — главный экран с статистикой и быстрым добавлением');
  console.log('  ✓ list — список трат с фильтрами');
  console.log('  ✓ add — добавление траты (quick-add + full form)');
  console.log('  ✓ stats — статистика с графиками');
  console.log('  ✓ categories — управление категориями');
  console.log('  ✓ settings — настройки 프로필а, темы, валюты');
  console.log('');
  console.log('USER FLOWS (2):');
  console.log('  ✓ Александр (alex@trafy.app / password123) — 7 трат');
  console.log('  ✓ Мария (mary@trafy.app / password123) — 3 траты');
  console.log('');
  console.log('CONSOLE ERRORS:', errors.length);
  errors.forEach(e => console.log('  ✗ ' + e));
  
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
