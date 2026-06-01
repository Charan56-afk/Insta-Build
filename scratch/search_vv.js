const fs = require('fs');
const filePath = process.argv[2] || 'vv.html';
const query = process.argv[3] || 'fetch';
console.log(`Searching for "${query}" in ${filePath}...`);
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${idx + 1}: ${line.trim().slice(0, 120)}`);
  }
});
