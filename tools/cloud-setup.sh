#!/usr/bin/env bash
# One-time setup for a Claude Code cloud session (Linux): the screenshot/perf harness needs Playwright +
# Chromium (headless, SwiftShader WebGL) and Pillow for the sheet/blind/crop scripts.
#   bash tools/cloud-setup.sh
# Then smoke-test: node tools/shots/shoot.js flying --label smoke --port 8871 --only fly3d_cruise
# Needs network access to the npm registry, PyPI and Playwright's browser CDN (cdn.playwright.dev).
set -euo pipefail
cd "$(dirname "$0")/.."
npm i --no-save --no-audit --no-fund playwright@1
npx playwright install --with-deps chromium || npx playwright install chromium
python3 -m pip install --quiet --user pillow 2>/dev/null || python3 -m pip install --quiet --break-system-packages pillow
node -e "require('playwright'); console.log('playwright ok')"
python3 -c "import PIL; print('pillow ok')"
