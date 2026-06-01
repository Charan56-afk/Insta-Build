const fs = require('fs');
const lines = fs.readFileSync('vv.html', 'utf8').split('\n');
const line = lines[2776 - 1]; // line numbers are 1-indexed
console.log('Line 2776 content:', JSON.stringify(line));
console.log('Line 2776 char codes:', [...line].map(c => c.charCodeAt(0)));
