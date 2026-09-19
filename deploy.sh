#!/bin/bash
# Деплой на GitHub Pages
# Использование: ./deploy.sh [message]

set -e

REMOTE_URL="${REMOTE_GITHUB_URL:-https://github.com/USERNAME/trafy.git}"
BRANCH="gh-pages"
DIST_DIR="dist"

echo "=== Деплой Траты на GitHub Pages ==="
echo "Remote: $REMOTE_URL"
echo ""

# 1. Проверка remote
if ! git remote get-url origin > /dev/null 2>&1; then
  echo "Добавляем remote..."
  git remote add origin "$REMOTE_URL"
fi

# 2. Создаём gh-pages бранч из dist/
echo "Создаём бранч $BRANCH из $DIST_DIR..."
git checkout --orphan "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
git reset --hard
git clean -fdx

# Копируем файлы из dist
cp -r "$DIST_DIR"/* . 2>/dev/null || true
cp "$DIST_DIR"/.??* . 2>/dev/null || true

# Удаляем dev-файлы
rm -rf node_modules test-* *.test.js *.md .gitignore 2>/dev/null || true

# 3. Коммит
git add -A
git commit -m "Деплой: Траты v1.0 — $(date +%Y.%m.%d)" || echo "Нет изменений для коммита"

# 4. Push
echo "Push в $BRANCH..."
git push -f origin "$BRANCH"

# 5. Возврат на main
git checkout main 2>/dev/null || git checkout master

echo ""
echo "=== Деплой завершён ==="
echo "GitHub Pages: https://USERNAME.github.io/trafy/"
echo ""
echo "Настройки в репозитории:"
echo "  Settings → Pages → Source: gh-pages branch"
