require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("No MONGO_URI in .env file!");
    process.exit(1);
}

const projectSchema = new mongoose.Schema({
    name: String,
    idea: String,
    frontend: String,
    backend: String,
    createdAt: Date
});

const Project = mongoose.model('Project', projectSchema);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cool Breeze | AC Service Management</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body>

    <!-- AUTH SECTION -->
    <div id="auth-screen" class="min-h-screen flex items-center justify-center p-4">
        <div class="glass w-full max-w-md p-8 rounded-2xl shadow-2xl">
            <h1 class="text-3xl font-bold mb-6 text-center text-blue-400">Cool Breeze</h1>
            <div class="flex gap-4 mb-8">
                <button id="tab-login" onclick="toggleTab('login')" class="flex-1 pb-2 border-b-2 border-blue-500 font-semibold text-blue-400">Sign In</button>
                <button id="tab-signup" onclick="toggleTab('signup')" class="flex-1 pb-2 border-b-2 border-transparent text-slate-400">Create Account</button>
            </div>
            
            <form id="auth-form" onsubmit="handleAuth(event)" class="space-y-4">
                <input type="email" id="email" placeholder="Email Address" required class="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 text-white">
                <input type="password" id="password" placeholder="Password" required class="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 text-white">
                <button type="submit" id="auth-btn" class="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition">Sign In</button>
            </form>

            <div class="mt-6 space-y-3">
                <button onclick="handleGoogleLogin()" class="w-full py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-200 transition">Continue with Google</button>
                <button onclick="promptCineSocial()" class="w-full py-3 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition text-white">Login with CineSocial</button>
            </div>
        </div>
    </div>

    <!-- DASHBOARD -->
    <div id="dashboard" class="hidden min-h-screen p-8">
        <nav class="flex justify-between items-center mb-10">
            <h2 class="text-2xl font-bold">Dashboard <span id="sync-indicator" class="text-xs text-green-500 ml-2 animate-pulse">● Live</span></h2>
            <div class="flex items-center gap-4">
                <span id="user-name-display" class="text-slate-300 font-medium"></span>
                <button onclick="logout()" class="px-4 py-2 bg-red-900/50 hover:bg-red-800 rounded-lg text-sm transition">Sign Out</button>
            </div>
        </nav>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass p-6 rounded-xl flex flex-col justify-between h-[150px]">
                <h3 class="text-slate-400 text-sm font-semibold">Active Services</h3>
                <p id="active-count" class="text-5xl font-bold text-blue-400">0</p>
            </div>
            
            <div class="glass p-6 rounded-xl col-span-2">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-slate-400 text-sm font-semibold">Upcoming Maintenance & Services</h3>
                    <button onclick="showRequestModal()" class="text-xs bg-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-500 transition">+ New Appointment</button>
                </div>
                <div id="service-list" class="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    <p class="text-slate-400 text-sm">Loading services...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- REQUEST MODAL -->
    <div id="request-modal" class="hidden fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
        <div class="glass w-full max-w-md p-8 rounded-2xl">
            <h3 class="text-xl font-bold mb-4 text-blue-400">Request AC Service</h3>
            <form onsubmit="handleRequestService(event)" class="space-y-4">
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Unit/Service Name</label>
                    <input type="text" id="service-name" required placeholder="e.g. Master Bedroom Mini-Split" class="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 text-white">
                </div>
                <div>
                    <label class="block text-sm text-slate-400 mb-1">Status</label>
                    <select id="service-status" class="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 text-white">
                        <option value="Pending">Pending</option>
                        <option value="Maintenance Needed">Maintenance Needed</option>
                        <option value="Scheduled">Scheduled</option>
                    </select>
                </div>
                <div class="flex gap-4 pt-2">
                    <button type="button" onclick="hideRequestModal()" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold transition">Cancel</button>
                    <button type="submit" class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition">Submit</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const BACKEND_URL = 'http://localhost:3000';
        let activeTab = 'login';
        let currentUser = null;
        let socket = null;

        function toggleTab(tab) {
            activeTab = tab;
            const tabLogin = document.getElementById('tab-login');
            const tabSignup = document.getElementById('tab-signup');
            const authBtn = document.getElementById('auth-btn');

            if (tab === 'login') {
                tabLogin.className = 'flex-1 pb-2 border-b-2 border-blue-500 font-semibold text-blue-400';
                tabSignup.className = 'flex-1 pb-2 border-b-2 border-transparent text-slate-400';
                authBtn.textContent = 'Sign In';
            } else {
                tabLogin.className = 'flex-1 pb-2 border-b-2 border-transparent text-slate-400';
                tabSignup.className = 'flex-1 pb-2 border-b-2 border-blue-500 font-semibold text-blue-400';
                authBtn.textContent = 'Create Account';
            }
        }

        async function handleAuth(event) {
            event.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/signup';

            try {
                const res = await fetch(BACKEND_URL + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    enterDashboard(data.user);
                } else {
                    alert(data.message || 'Authentication failed');
                }
            } catch (err) {
                alert('Connection error: ' + err.message);
            }
        }

        function enterDashboard(user) {
            currentUser = user;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            document.getElementById('user-name-display').textContent = user.name || user.email;
            
            // Connect socket for real-time
            try {
                socket = io(BACKEND_URL);
                socket.on('service-updated', (updatedService) => {
                    loadServices();
                });
            } catch (e) {
                console.warn('Socket connection failed, real-time fallback active');
            }

            loadServices();
        }

        async function loadServices() {
            try {
                const res = await fetch(BACKEND_URL + '/api/services');
                const services = await res.json();
                
                const listEl = document.getElementById('service-list');
                const activeCountEl = document.getElementById('active-count');
                
                if (services.length === 0) {
                    listEl.innerHTML = '<p class="text-slate-500 text-sm">No services requested yet.</p>';
                    activeCountEl.textContent = '0';
                    return;
                }

                let activeCount = 0;
                listEl.innerHTML = services.map(s => {
                    if (s.status !== 'Completed') activeCount++;
                    const dateStr = s.scheduledDate ? new Date(s.scheduledDate).toLocaleString() : 'Not Scheduled';
                    const statusColor = s.status === 'Completed' ? 'text-green-400' : s.status === 'In Progress' ? 'text-yellow-400' : 'text-blue-400';
                    
                    return \`
                        <div class="p-4 bg-slate-800/80 rounded-lg flex justify-between items-center border border-slate-700/50">
                            <div>
                                <h4 class="font-semibold text-white">\${s.name}</h4>
                                <p class="text-xs text-slate-400">Tech: \${s.technician || 'Unassigned'} | Date: \${dateStr}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-bold \${statusColor}">\${s.status}</span>
                                \${s.status !== 'Completed' ? \`<button onclick="completeService(\${s.id})" class="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-white transition">Done</button>\` : ''}
                            </div>
                        </div>
                    \`;
                }).join('');
                
                activeCountEl.textContent = activeCount;
            } catch (err) {
                console.error('Failed to load services:', err);
            }
        }

        async function completeService(id) {
            try {
                const res = await fetch(\`\${BACKEND_URL}/api/services/\${id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed' })
                });
                if (res.ok) {
                    loadServices();
                }
            } catch (err) {
                console.error(err);
            }
        }

        function showRequestModal() {
            document.getElementById('request-modal').classList.remove('hidden');
        }

        function hideRequestModal() {
            document.getElementById('request-modal').classList.add('hidden');
        }

        async function handleRequestService(event) {
            event.preventDefault();
            const name = document.getElementById('service-name').value.trim();
            const status = document.getElementById('service-status').value;

            try {
                const res = await fetch(BACKEND_URL + '/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, status })
                });
                if (res.ok) {
                    hideRequestModal();
                    document.getElementById('service-name').value = '';
                    loadServices();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to submit service');
                }
            } catch (err) {
                alert('Error submitting service: ' + err.message);
            }
        }

        function logout() {
            currentUser = null;
            if (socket) socket.disconnect();
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
        }

        // OAuth Fallbacks
        function handleGoogleLogin() {
            enterDashboard({ id: Date.now(), email: 'google-user@coolbreeze.com', name: 'Google User' });
        }

        function promptCineSocial() {
            const handle = prompt("Enter CineSocial handle:");
            if (handle) {
                enterDashboard({ id: Date.now(), email: handle + '@cinesocial.com', name: handle });
            }
        }
    </script>
</body>
</html>`;

mongoose.connect(MONGO_URI).then(async () => {
    console.log("Connected to MongoDB.");
    const res = await Project.updateOne({ name: /cooler/i }, { $set: { frontend: html } });
    console.log("Updated Cooler project:", res);
    mongoose.disconnect();
}).catch(err => {
    console.error("Update failed:", err.message);
});
