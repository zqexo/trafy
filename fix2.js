const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

// Fix broken escaping patterns in $() calls
// The file has literal backslashes like \$(\"#user-list\") instead of $("user-list")
let result = content;

// Replace all occurrences of \$(" with $("
result = result.replace(/\$\\\(\"/g, '$("');

// Also fix standalone \" that are inside $() calls
// Pattern: $(\"#something\") should be $("something")
result = result.replace(/\$\\\(\"(.*?)\\\"\)/g, '$("$1")');

fs.writeFileSync('app.js', result);

// Verify
const lines = result.split('\n');
console.log('Line 1329:', lines[1328]);
console.log('Line 1359:', lines[1358]);
console.log('Line 1367:', lines[1366]);
console.log('Line 1375:', lines[1374]);
