const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

// Fix the broken escaping: replace \$(" with $(" and \") with ")
// The file has literal backslashes before quotes in $() calls
let fixed = content.replace(/\$\\\(\"/g, '$("');
fixed = fixed.replace(/\\(\"/g, '("');  // Fix any remaining \"
fixed = fixed.replace(/\\(\"/g, '("');  // Fix \(" patterns

// More targeted: fix the specific broken patterns
const lines = fixed.split('\n');
const fixedLines = lines.map(line => {
  // Fix $(\" -> $("
  return line.replace(/\$\\\(\"/g, '$("');
}).join('\n');

fs.writeFileSync('app.js', fixedLines);
console.log('Fixed escaping. Testing...');

// Verify
const testContent = fs.readFileSync('app.js', 'utf8');
const lines2 = testContent.split('\n');
console.log('Line 1329:', lines2[1328]);
console.log('Line 1359:', lines2[1358]);
console.log('Line 1367:', lines2[1366]);
console.log('Line 1375:', lines2[1374]);
