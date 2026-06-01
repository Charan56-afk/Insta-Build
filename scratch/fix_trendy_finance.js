const fs = require('fs');
const dbFile = 'local_db.json';
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

let patched = false;
db.projects.forEach(p => {
  if (p.name === 'TrendyFinance' && p.frontend && p.frontend.includes("document.getElementById('items-list').innerHTML = '';")) {
    p.frontend = p.frontend.replace(
      "document.getElementById('items-list').innerHTML = '';",
      "const listEl = document.getElementById('items-list');\n            if (listEl) listEl.innerHTML = '';"
    );
    p.frontend = p.frontend.replace(
      "document.getElementById('items-list').innerHTML += itemElement;",
      "if (listEl) listEl.innerHTML += itemElement;"
    );
    patched = true;
    console.log(`Patched TrendyFinance frontend in DB.`);
  }
});

if (patched) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
} else {
  console.log('No patching needed or TrendyFinance name mismatch.');
}
