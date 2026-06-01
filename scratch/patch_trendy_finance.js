const fs = require('fs');
const db = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));

const idx = db.projects.findIndex(p => p.name === 'TrendyFinance');
if (idx !== -1) {
  let frontend = db.projects[idx].frontend;
  const target = '<body class="bg-gray-100 font-sans">';
  const replacement = `<body class="bg-gray-100 font-sans p-6">
    <div id="alert"></div>
    <div class="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-6 border-b pb-4">
            <h1 class="text-2xl font-bold text-gray-800">TrendyFinance Stock Tracker</h1>
            <div>
                <button id="login-modal-toggle" class="bg-blue-500 text-white px-4 py-2 rounded mr-2">Login Modal</button>
                <button id="create-account-modal-toggle" class="bg-green-500 text-white px-4 py-2 rounded mr-2">Sign Up Modal</button>
                <button id="quick-demo-login-modal-toggle" class="bg-yellow-500 text-white px-4 py-2 rounded">Quick Login Modal</button>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="dashboard">
                <!-- Dashboard rendered here -->
            </div>
            
            <div class="space-y-4">
                <div id="login-modal" class="hidden"></div>
                <div id="create-account-modal" class="hidden"></div>
                <div id="quick-demo-login-modal" class="hidden"></div>
            </div>
        </div>
        
        <div class="mt-6 border-t pt-4 flex justify-end space-x-2">
            <button id="login-btn" class="bg-blue-600 text-white px-4 py-2 rounded">Sign In (Mock)</button>
            <button id="logout-btn" class="bg-red-600 text-white px-4 py-2 rounded">Sign Out</button>
        </div>
    </div>`;

  if (frontend.includes(target)) {
    frontend = frontend.replace(target, replacement);
    db.projects[idx].frontend = frontend;
    fs.writeFileSync('local_db.json', JSON.stringify(db, null, 2), 'utf8');
    console.log('Successfully patched TrendyFinance project in local_db.json!');
  } else {
    console.error('Target template body not found in TrendyFinance frontend code!');
  }
} else {
  console.error('TrendyFinance project not found in database!');
}
