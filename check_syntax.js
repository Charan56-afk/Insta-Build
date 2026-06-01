const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.argv[2] || 'vv.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)(?<!\\)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  count++;
  const js = match[1];
  try {
    new vm.Script(js);
    console.log(`Script tag ${count} parsed successfully.`);
  } catch (err) {
    console.error(`Syntax error in script tag ${count}:`);
    if (err.stack) {
      const matchLine = err.stack.match(/evalmachine\.<anonymous>:(\d+)/);
      if (matchLine) {
        const lineNum = parseInt(matchLine[1], 10);
        const lines = js.split('\n');
        const start = Math.max(0, lineNum - 5);
        const end = Math.min(lines.length, lineNum + 5);
        console.error(`Context (lines ${start + 1} to ${end}):`);
        for (let i = start; i < end; i++) {
          console.error(`${i + 1}: ${lines[i]}`);
        }
      }
    }
    console.error(err);
  }
}
