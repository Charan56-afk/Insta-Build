const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));

const idx = db.projects.findIndex(p => p.name === 'CineStream');
if (idx !== -1) {
  let frontend = db.projects[idx].frontend;
  const target = `  // Initial render
  if (state.user) {
    renderDashboard();
  } else {
    renderAuthScreen();
  }`;

  const replacement = `  // Initial render wrapped in DOMContentLoaded listener to ensure elements are parsed
  window.addEventListener('DOMContentLoaded', () => {
    if (state.user) {
      renderDashboard();
    } else {
      renderAuthScreen();
    }
  });`;

  if (frontend.includes(target)) {
    frontend = frontend.replace(target, replacement);
    db.projects[idx].frontend = frontend;
    fs.writeFileSync('local_db.json', JSON.stringify(db, null, 2), 'utf8');
    console.log('Successfully patched CineStream project in local_db.json!');
  } else {
    console.error('Target initialization block not found in CineStream frontend code!');
  }
} else {
  console.error('CineStream project not found in database!');
}
