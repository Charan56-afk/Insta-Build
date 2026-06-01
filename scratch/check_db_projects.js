const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));

console.log('Project Count:', db.projects.length);
db.projects.forEach((p, i) => {
  console.log(`\n--- Project ${i}: ${p.name} (_id: ${p._id}) ---`);
  console.log(`Idea: ${p.idea}`);
  console.log(`Frontend code length: ${p.frontend ? p.frontend.length : 0}`);
  if (p.frontend) {
    // Check if it has <html> and </html> or is just fragment
    const hasHtml = p.frontend.toLowerCase().includes('<html');
    const hasClosingHtml = p.frontend.toLowerCase().includes('</html>');
    const hasDoctype = p.frontend.toLowerCase().includes('<!doctype html');
    console.log(`Structure: hasHtml=${hasHtml}, hasClosingHtml=${hasClosingHtml}, hasDoctype=${hasDoctype}`);
    if (p.frontend.length > 0 && p.frontend.length < 200) {
      console.log(`Preview snippet:\n${p.frontend}`);
    }
  } else {
    console.log('Frontend code is empty/missing!');
  }
});
