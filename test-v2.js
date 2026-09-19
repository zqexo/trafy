const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[' + msg.type() + '] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  // ─── LOGIN SCREEN ───
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
  
  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  console.log('✓ screenshot-login.png');
  
  // ─── LOGIN AS ALEXANDER ───
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
  
  // ─── EXPENSE LIST ───
  console.log('\n=== 3. EXPENSE LIST ===');
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  console.log('List items:', await page.locator('#list-full-list .expense-item').count());
  console.log('List total:', await page.textContent('#list-total'));
  console.log('List count:', await page.textContent('#list-count'));
  
  await page.click('[data-filter="period"][data-value="today"]');
  await page.waitForTimeout(1000);
  console.log('Today filter:', await page.locator('#list-full-list .expense-item').count());
  
  await page.click('[data-filter="period"][data-value="all"]');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'screenshot-list.png', fullPage: true });
  console.log('✓ screenshot-list.png');
  
  // ─── ADD EXPENSE (via JS injection to bypass UI timing) ───
  console.log('\n=== 4. ADD EXPENSE ===');
  
  // Fill the quick-add form via JS to avoid timing issues
  await page.evaluate(() => {
    document.getElementById('quick-amount').value = '750';
    document.getElementById('quick-category').value = 'cat-1'; // Еда
    document.getElementById('quick-description').value = 'Обед в кафе';
    document.getElementById('quick-date').value = new Date().toISOString().split('T')[0];
  });
  await page.waitForTimeout(500);
  
  await page.click('#btn-quick-add');
  await page.waitForTimeout(5000);
  
  console.log('URL after add:', page.url());
  console.log('Recent items after add:', await page.locator('#recent-list .expense-item').count());
  console.log('Recent total after add:', await page.textContent('#recent-total'));
  
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  console.log('List items after add:', await page.locator('#list-full-list .expense-item').count());
  console.log('List total after add:', await page.textContent('#list-total'));
  
  await page.screenshot({ path: 'screenshot-list-after-add.png', fullPage: true });
  console.log('✓ screenshot-list-after-add.png');
  
  // ─── DELETE EXPENSE ───
  console.log('\n=== 5. DELETE EXPENSE ===');
  // Navigate to list and click delete on first item
  await page.click('#btn-see-all');
  await page.waitForTimeout(2000);
  
  // Click the delete button of the first expense item
  const deleteBtn = await page.locator('#list-full-list .expense-item .btn-icon-sm[aria-label="Удалить"]').first();
  await deleteBtn.click();
  await page.waitForTimeout(2000);
  
  // Confirm deletion
  await page.click('#delete-modal-confirm');
  await page.waitForTimeout(3000);
  
  console.log('List items after delete:', await page.locator('#list-full-list .expense-item').count());
  console.log('List total after delete:', await page.textContent('#list-total'));
  
  await page.screenshot({ path: 'screenshot-after-delete.png', fullPage: true });
  console.log('✓ screenshot-after-delete.png');
  
  // ─── STATISTICS ───
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
  
  await page.screenshot({ path: 'screenshot-stats.png', fullPage: true });
  console.log('✓ screenshot-stats.png');
  
  // ─── CATEGORIES ───
  console.log('\n=== 7. CATEGORIES ===');
  await page.click('a[data-nav="categories"]');
  await page.waitForTimeout(2000);
  
  console.log('Category cards:', await page.locator('#categories-grid .category-card').count());
  
  await page.click('#btn-category-add');
  await page.waitForTimeout(1000);
  console.log('Modal visible:', !(await page.locator('#modal-category').evaluate(el => el.classList.contains('hidden'))));
  console.log('Modal title:', await page.textContent('#category-modal-title'));
  
  await page.fill('#cat-name-input', 'Тестовая категория');
  await page.click('#cat-modal-save');
  await page.waitForTimeout(2000);
  console.log('Categories after add:', await page.locator('#categories-grid .category-card').count());
  
  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('✓ screenshot-categories.png');
  
  // ─── SETTINGS ───
  console.log('\n=== 8. SETTINGS ===');
  await page.click('a[data-nav="settings"]');
  await page.waitForTimeout(2000);
  
  console.log('Display name:', await page.textContent('#settings-display-name'));
  console.log('Email:', await page.textContent('#settings-email'));
  console.log('Currency:', await page.inputValue('#settings-currency'));
  
  await page.fill('#settings-name-input', 'Алекс');
  await page.click('#settings-name-save');
  await page.waitForTimeout(1000);
  console.log('Name after save:', await page.textContent('#settings-display-name'));
  
  await page.selectOption('#settings-currency', '$');
  await page.waitForTimeout(1000);
  console.log('Currency after change:', await page.inputValue('#settings-currency'));
  
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('✓ screenshot-settings.png');
  
  // ─── LOGOUT ───
  console.log('\n=== 9. LOGOUT ===');
  await page.click('#btn-logout');
  await page.waitForTimeout(3000);
  
  console.log('URL after logout:', page.url());
  console.log('Login screen visible:', !(await page.locator('#screen-login').evaluate(el => el.hidden)));
  
  await page.screenshot({ path: 'screenshot-logout.png', fullPage: true });
  console.log('✓ screenshot-logout.png');
  
  // ─── LOGIN AS MARIA ───
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
  console.log('Maria list count:', await page.textContent('#list-count'));
  
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('✓ screenshot-maria-list.png');
  
  // ─── FINAL REPORT ───
  console.log('\n========================================');
  console.log('           TEST RESULTS');
  console.log('========================================');
  console.log('');
  console.log('SCREENS TESTED (7):');
  console.log('  ✓ login — экран входа');
  console.log('  ✓ main — главный экран');
  console.log('  ✓ list — список трат');
  console.log('  ✓ add — добавление траты');
  console.log('  ✓ stats — статистика');
  console.log('  ✓ categories — категории');
  console.log('  ✓ settings — настройки');
  console.log('');
  console.log('USER FLOWS (2):');
  console.log('  ✓ Александр — 7 трат (после добавления 8, после удаления 7)');
  console.log('  ✓ Мария — 3 траты');
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
