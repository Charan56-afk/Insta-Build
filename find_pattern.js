const fs = require('fs');
const html = fs.readFileSync('vv.html', 'utf8');
const lines = html.split('\n');
const query = process.argv[2] || 'auth-screen';
console.log('Searching for:', query);
lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
