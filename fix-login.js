#!/usr/bin/env node
const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');

// Find renderLoginScreen function bounds
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function renderLoginScreen()')) {
    start = i;
  }
  if (start >= 0 && lines[i].trim() === '}' && i > start + 5) {
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length || lines[j].includes('function ')) {
      end = i;
      break;
    }
  }
}

console.log('start:', start, 'end:', end);

const newFunc = [
  'function renderLoginScreen() {',
  '  const userList = $(\"#user-list\");',
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
  '  $("button#btn-register")?.addEventListener("click", handleRegister);',
  '  $("button#btn-login-submit")?.addEventListener("click", handleLoginSubmit);',
  '  $("button#btn-forgot")?.addEventListener("click", () => {',
  '    showToast("Восстановление пароля через Email — в продакшене 🔐");',
  '  });',
  '}',
  '',
].join('\n');

const patched = lines.slice(0, start).join('\n') + '\n' + newFunc + '\n' + lines.slice(end + 1).join('\n');
fs.writeFileSync('app.js', patched);
console.log('Fixed! Lines:', patched.split('\n').length);
