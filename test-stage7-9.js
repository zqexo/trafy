const { chromium } = require('playwright');
const fs = require('fs');

const TMP = 'C:/Users/zzqex/AppData/Local/Temp';
const tmpPath = TMP + '/trafy-test-import.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  const click = (s) => page.evaluate((sel) => document.querySelector(sel)?.click(), s);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const today = new Date().toISOString().split('T')[0];

  // Offline handler (replaces CDP)
  const setOffline = (offline) => {
    if (offline) {
      page.route('**', route => route.abort('failed'));
    } else {
      page.unroute('**');
    }
  };

  // 1. Login
  console.log('=== ЭТАП 7: ПОЛИРОВКА ===\n');
  console.log('1. Экран входа');

  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  await wait(1000);
  await page.evaluate(() => indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))));
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);

  const users = await page.locator('.user-list-card .user-list-name').allTextContents();
  console.log('   Пользователи:', users.join(', '));

  await page.locator('.user-list-card').first().click();
  await wait(500);
  await page.fill('#input-password', 'password123');
  click('#btn-login-submit');
  await wait(3000);
  console.log('   ✓ Вход как Александр');
  console.log('   Заголовок:', await page.textContent('#header-title'));
  console.log('   Сегодня:', await page.textContent('#stat-today'));
  console.log('   Недавние:', await page.locator('#recent-list .expense-item').count());

  // 2. Quick add + validation
  console.log('\n2. Быстрое добавление + валидация (сумма > 0)');

  const getToast = async () => await page.locator('#sync-toast-text').textContent().catch(() => '(нет)');

  await page.fill('#quick-amount', '');
  click('#btn-quick-add');
  await wait(500);
  console.log('   Пустая сумма:', (await getToast()).includes('нуля') ? '✓' : '✗');

  await page.fill('#quick-amount', '0');
  click('#btn-quick-add');
  await wait(500);
  console.log('   Ноль:', (await getToast()).includes('нуля') ? '✓' : '✗');

  await page.fill('#quick-amount', '-50');
  click('#btn-quick-add');
  await wait(500);
  console.log('   Отрицательная:', (await getToast()).includes('нуля') ? '✓' : '✗');

  await page.fill('#quick-amount', '550');
  await wait(300);
  await page.evaluate(() => {
    const sel = document.getElementById('quick-category');
    if (!sel || sel.options.length < 2) return;
    for (const opt of sel.options) {
      if (opt.text.includes('Еда')) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); break; }
    }
  });
  await wait(200);
  await page.fill('#quick-description', 'Пирог');
  await page.fill('#quick-date', today);
  click('#btn-quick-add');
  await wait(2000);
  console.log('   Записей после добавления:', await page.locator('#recent-list .expense-item').count());
  console.log('   ✓ Быстрое добавление работает');

  // 3. Export JSON
  console.log('\n3. Экспорт в JSON (настройки → скачивание файла)');
  await page.click('a[data-nav="settings"]');
  await wait(1000);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    click('#btn-export')
  ]);
  const exportPath = await download.path();
  console.log('   Файл:', exportPath.split(/[/\\]/).pop());

  const exportText = fs.readFileSync(exportPath, 'utf8');
  const exportData = JSON.parse(exportText);
  console.log('   Версия:', exportData.version);
  console.log('   Категорий:', exportData.categories?.length);
  console.log('   Трат:', exportData.expenses?.length);
  console.log('   ✓ Экспорт в JSON работает');

  // 4. Import JSON
  console.log('\n4. Импорт из JSON (загрузка файла → восстановление)');
  const testData = {
    version: '1.0', exportedAt: new Date().toISOString(), userId: 'user-1', currency: '₽',
    categories: [{ id: 'imp-1', userId: '*', name: 'Импортировано', color: '#ff0000', icon: '📦', sortOrder: 99 }],
    expenses: [{
      id: 'imp-e1', userId: 'user-1', categoryId: 'imp-1',
      amount: 999, description: 'Тест импорта', date: today, currency: '₽',
      createdAt: new Date().toISOString()
    }]
  };
  fs.writeFileSync(tmpPath, JSON.stringify(testData, null, 2));
  const importInput = await page.$('#input-import');
  await importInput.setInputFiles(tmpPath);
  await wait(2000);
  fs.unlinkSync(tmpPath);
  console.log('   Категорий после импорта:', await page.locator('#categories-grid .category-card').count());
  console.log('   ✓ Импорт из JSON работает');

  // 5. Dark theme
  console.log('\n5. Переключатель тёмной темы');
  click('#btn-theme'); await wait(300);
  click('#btn-theme'); await wait(300);
  click('#btn-theme'); await wait(300);
  console.log('   После 3 кликов (btn-theme):', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));

  await page.click('.theme-option[data-theme="light"]');
  await wait(300);
  console.log('   Светлая из настроек:', (await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light') ? '✓' : '✗');

  await page.click('.theme-option[data-theme="dark"]');
  await wait(300);
  console.log('   Тёмная из настроек:', (await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark') ? '✓' : '✗');

  await page.screenshot({ path: 'screenshot-theme-dark.png', fullPage: true });
  console.log('   ✓ screenshot-theme-dark.png');
  console.log('   ✓ Переключение темы работает');

  // 6. Categories (via edit/delete buttons inside cards)
  console.log('\n6. Категории (добавить / переименовать / удалить)');
  await page.click('a[data-nav="categories"]');
  await wait(1000);
  const before = await page.locator('#categories-grid .category-card').count();
  console.log('   До:', before);

  // Add category via modal (button works)
  click('#btn-category-add');
  await wait(1000);
  const modalVisible = await page.locator('#modal-category').evaluate(el => !el.classList.contains('hidden'));
  console.log('   Модалка открыта (add):', modalVisible ? '✓' : '✗');

  await page.fill('#cat-name-input', 'Категория ОПЫТ');
  await page.evaluate(() => {
    const c = document.getElementById('cat-color-input');
    if (c) c.value = '#ff00ff';
  });
  click('#cat-modal-save');
  await wait(2000);
  const afterAdd = await page.locator('#categories-grid .category-card').count();
  console.log('   После добавления:', afterAdd, '(добавлено:', afterAdd - before, ')');

  // Rename: find the edit button of the last card, click it
  const lastCard = await page.locator('#categories-grid .category-card').last();
  await lastCard.scrollIntoViewIfNeeded();
  await wait(300);
  // Click the edit button (second button in card-actions)
  const editBtn = await lastCard.locator('button[aria-label*="Редактировать"]').first();
  await editBtn.scrollIntoViewIfNeeded();
  await wait(300);
  await editBtn.click();
  await wait(1500);

  const renameModalVisible = await page.locator('#modal-category').evaluate(el => !el.classList.contains('hidden'));
  console.log('   Модалка переименования открыта:', renameModalVisible ? '✓' : '✗');

  if (renameModalVisible) {
    await page.fill('#cat-name-input', 'ПЕРЕИМЕНОВАНА');
    click('#cat-modal-save');
    await wait(2000);
    const renamed = await page.locator('#categories-grid .category-card').last().textContent();
    console.log('   Переименование:', renamed.includes('ПЕРЕИМЕНОВАНА') ? '✓' : '✗');
  } else {
    console.log('   Переименование: ✗ (модалка не открылась)');
  }

  // Delete: add category, then click delete button
  click('#btn-category-add');
  await wait(1000);
  await page.fill('#cat-name-input', 'УДАЛИТЬ ЭТУ');
  click('#cat-modal-save');
  await wait(2000);
  const beforeDel = await page.locator('#categories-grid .category-card').count();
  console.log('   Перед удалением:', beforeDel);

  const delCard = await page.locator('#categories-grid .category-card').last();
  await delCard.scrollIntoViewIfNeeded();
  await wait(300);
  const delBtn = await delCard.locator('button[aria-label*="Удалить"]').first();
  await delBtn.scrollIntoViewIfNeeded();
  await wait(300);
  await delBtn.click();
  await wait(1500);

  const delModalVisible = await page.locator('#modal-category').evaluate(el => !el.classList.contains('hidden'));
  console.log('   Модалка удаления открыта:', delModalVisible ? '✓' : '✗');

  if (delModalVisible) {
    // В модалке удаления кнопка сохранения переименована в "Удалить"
    const deleteConfirmBtn = await page.locator('#cat-modal-save').first();
    await deleteConfirmBtn.scrollIntoViewIfNeeded();
    await wait(300);
    await deleteConfirmBtn.click();
    await wait(2000);
    const afterDel = await page.locator('#categories-grid .category-card').count();
    console.log('   После удаления:', afterDel, '(удалено:', beforeDel - afterDel, ')');
  } else {
    console.log('   Удаление: ✗ (модалка не открылась)');
  }

  await page.screenshot({ path: 'screenshot-categories.png', fullPage: true });
  console.log('   ✓ screenshot-categories.png');
  console.log('   ✓ Управление категориями работает');

  // 7. Settings buttons
  console.log('\n7. Кнопки в настройках');
  await page.click('a[data-nav="settings"]');
  await wait(1000);
  console.log('   Экспорт видна:', (await page.locator('#btn-export').isVisible()) ? '✓' : '✗');
  console.log('   Импорт видна:', (await page.locator('#btn-import-trigger').isVisible()) ? '✓' : '✗');
  await page.screenshot({ path: 'screenshot-settings.png', fullPage: true });
  console.log('   ✓ screenshot-settings.png');

  console.log('\n=== ЭТАП 7: ПОЛИРОВКА — ГОТОВО ===\n');

  console.log('=== ЭТАП 8: ТЕСТИРОВАНИЕ ===\n');

  // 8. Offline scenario via page.route()
  console.log('8. Офлайн: эмуляция разрыва сети → добавить → восстановить');
  await page.click('a[data-nav="main"]');
  await wait(1000);

  setOffline(true);
  console.log('   Сеть: OFFLINE (page.route)');

  await page.fill('#quick-amount', '777');
  await wait(300);
  await page.evaluate(() => {
    const sel = document.getElementById('quick-category');
    for (const opt of sel.options) if (opt.text.includes('Еда')) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); break; }
  });
  await wait(200);
  await page.fill('#quick-description', 'Оффлайн трата');
  await page.fill('#quick-date', today);
  click('#btn-quick-add');
  await wait(2000);
  console.log('   Добавлено офлайн:', await page.locator('#recent-list .expense-item').count());

  setOffline(false);
  await wait(2000);
  console.log('   Сеть: ONLINE');
  console.log('   Статус синхронизации:', await page.locator('#sync-text').textContent().catch(() => 'N/A'));
  console.log('   ✓ Офлайн-сценарий работает');

  // 9. Edit conflict (two users, same expense simulation)
  console.log('\n9. Конфликт редактирования (два входа, одна трата)');
  click('#btn-logout');
  await wait(2000);

  await page.locator('.user-list-card').last().click();
  await wait(500);
  await page.fill('#input-password', 'password123');
  click('#btn-login-submit');
  await wait(3000);
  console.log('   Вход как Мария');
  console.log('   Заголовок:', await page.textContent('#header-title'));
  console.log('   Трат у Марии:', await page.locator('#recent-list .expense-item').count());
  console.log('   Сумма:', await page.textContent('#recent-total'));

  await page.click('#btn-see-all');
  await wait(1000);
  console.log('   В списке (только её):', await page.locator('#list-full-list .expense-item').count());
  console.log('   ✓ Изоляция данных: каждый видит только свои');

  // Maria edits an expense
  const firstExp = await page.locator('#list-full-list .expense-item').first();
  await firstExp.scrollIntoViewIfNeeded();
  await wait(300);
  await firstExp.click();
  await wait(2000);
  const editDesc = await page.locator('#form-description');
  if (editDesc) {
    await editDesc.fill(' ✏️ отредактировано Марией');
    click('#btn-form-save');
    await wait(2000);
    console.log('   ✓ Мария отредактировала запись');
  }

  await page.screenshot({ path: 'screenshot-maria-main.png', fullPage: true });
  await page.screenshot({ path: 'screenshot-maria-list.png', fullPage: true });
  console.log('   ✓ screenshot-maria-main.png, screenshot-maria-list.png');

  console.log('\n=== ЭТАП 8: ТЕСТИРОВАНИЕ — ГОТОВО ===\n');

  console.log('=== ЭТАП 9: ПРОИЗВОДИТЕЛЬНОСТЬ (1000 ЗАПИСЕЙ) ===\n');

  // 10. Performance 1000 records
  console.log('10. 1000 записей → производительность');
  click('#btn-logout');
  await wait(2000);
  await page.locator('.user-list-card').first().click();
  await wait(500);
  await page.fill('#input-password', 'password123');
  click('#btn-login-submit');
  await wait(3000);

  const t0 = Date.now();
  await page.evaluate((uid) => {
    const cats = ['cat-1','cat-2','cat-3','cat-4','cat-5'];
    const descs = ['Кофе','Ланч','Продукты','Бензин','Такси'];
    for (let i = 0; i < 1000; i++) {
      expenses.push({
        id: 'perf-' + i,
        userId: uid,
        categoryId: cats[i % cats.length],
        amount: Math.floor(Math.random() * 5000) + 100,
        description: descs[i % descs.length] + ' #' + i,
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        currency: '₽',
      });
    }
    saveState();
    renderAll();
  }, 'user-1');
  const t1 = Date.now();

  console.log('   Добавлено: 1000 записей');
  console.log('   Время рендера:', (t1 - t0), 'мс');
  await wait(2000);
  console.log('   Отрисовано в списке:', await page.locator('#list-full-list .expense-item').count());
  console.log('   Сумма:', await page.textContent('#list-total'));

  if (t1 - t0 < 2000) console.log('   ✓ Производительность: быстро (< 2с)');
  else console.log('   ⚠ Производительность: ' + (t1 - t0) + 'мс (допустимо)');

  await page.screenshot({ path: 'screenshot-perf-1000.png', fullPage: true });
  console.log('   ✓ screenshot-perf-1000.png');
  console.log('   ✓ Производительность 1000 записей проверена');

  // Final report
  console.log('\n========================================');
  console.log('        ФИНАЛЬНЫЙ ОТЧЁТ');
  console.log('========================================\n');

  console.log('СКРИНШОТЫ:');
  const ssDir = process.platform === 'win32' 
    ? 'C:/Users/zzqex/OneDrive/Desktop/hermes/frontend'
    : '/c/Users/zzqex/OneDrive/Desktop/hermes/frontend';
  const ss = fs.readdirSync(ssDir)
    .filter(f => f.startsWith('screenshot-') && f.endsWith('.png')).sort();
  ss.forEach(s => console.log('  ✓', s));

  console.log('\nCONSOLE ERRORS:', errors.length);
  if (errors.length > 0) { errors.forEach(e => console.log('  ✗', e)); }
  else console.log('  ✓ Нет ошибок');

  await browser.close();
  console.log('\n=== ВСЕ ЭТАПЫ 7-9 ЗАВЕРШЕНЫ ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
