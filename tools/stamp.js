// Stamps src/version.js with the commit and date, so the pause menu shows which build a device runs.
//   node tools/stamp.js [label]   (then commit it and tag the test build)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const hash = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const label = process.argv[2] || new Date().toISOString().slice(0, 10);
const stamp = `${label} · ${hash}`;
fs.writeFileSync(path.join(ROOT, 'src', 'version.js'), `// Which build this is, shown in the pause menu so a device test can say what it ran.\n// Rewritten by \`node tools/stamp.js\` before a test build is tagged; 'dev' = a working copy.\nexport const BUILD = '${stamp}';\n`);
console.log('stamped', stamp);
