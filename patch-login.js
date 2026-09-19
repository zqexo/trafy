const fs = require('fs');

const original = fs.readFileSync('app.js', 'utf8');

// Найти и заменить функцию renderLoginScreen целиком
const lines = original.split('\n');
const startIdx = lines.findIndex(l => l.includes('function renderLoginScreen()'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('renderLoginScreen() {') === false && l.trim() === '}' && lines[i-1].trim().startsWith('// Регистрация'));

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find function boundaries');
  process.exit(1);
}

const newFunc = [
  'function renderLoginScreen() {',
  '  const userList = $("#user-list");',
  '  if (!userList) return;',
  '  userList.innerHTML = "";',
  '',
  '  MOCK_USERS.forEach(user => {',
  '    const card = el("div", {',
  '      className: "user-list-card",',
  '      role: "option",',
  '      "aria-selected": false,',
  '      "data-userId": user.id,',
  '      onClick: () => selectUser(user.id),',
  '      onKeydown: (e) => { if (e.key === "Enter") selectUser(user.id); },',
  '    });',
  '',
  '    const avatar = el("div", {',
  '      className: "user-list-avatar",',
  '      style: { background: user.color },',
  '    }, [user.displayName.charAt(0).toUpperCase()]);',
  '',
  '    const info = el("div", { className: "user-list-info" });',
  '    info.appendChild(el("div", { className: "user-list-name" }, [user.displayName]));',
  '    info.appendChild(el("div", { className: "user-list-email" }, [user.email]));',
  '',
  '    const check = el("div", { className: "user-list-check" });',
  '    check.appendChild(el("i", { className: "ph ph-check" }));',
  '',
  '    card.append(avatar, info, check);',
  '    userList.appendChild(card);',
  '  });',
  '',
  '  // Показать форму входа если пользователь выбран (из localStorage)',
  '  const loginForm = $("#login-form");',
  '  const registerEl = $("#login-register");',
  '  if (loginForm) {',
  '    const savedUserId = loginForm.dataset.userId;',
  '    if (savedUserId) {',
  '      const savedUser = MOCK_USERS.find(u => u.id === savedUserId);',
  '      if (savedUser) {',
  '        loginForm.classList.remove("hidden");',
  '        $("#input-email").value = savedUser.email;',
  '      }',
  '    } else {',
  '      loginForm.classList.add("hidden");',
  '    }',
  '  }',
  '  if (registerEl) registerEl.classList.add("hidden");',
  '',
  '  // Регистрация',
  '  $("button#btn-register")?.addEventListener("click", handleRegister);',
  '  $("button#btn-login-submit")?.addEventListener("click", handleLoginSubmit);',
  '  $("button#btn-forgot")?.addEventListener("click", () => {',
  '    showToast("Восстановление пароля через Email — в продакшене 🔐");',
  '  });',
  '}',
  '',
].join('\n');

const before = lines.slice(0, startIdx).join('\n');
const after = lines.slice(endIdx + 1).join('\n');
const patched = before + '\n' + newFunc + '\n' + after;

fs.writeFileSync('app.js', patched);
console.log('Patched successfully. Lines:', patched.split('\n').length);
