require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const net = require('net');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const RUNNER_PORT = process.env.RUNNER_PORT || process.env.PORT || 3001;

// ===== FIXED PORT ALLOCATION (no scanning) =====
const FIXED_BACKEND_PORT = 3100;
const FIXED_DEPLOY_START = 4000;

let liveBackendPort = FIXED_BACKEND_PORT;
let nextDeployPort = FIXED_DEPLOY_START;

// ===== IN-PROCESS BACKEND (no child_process) =====
let backendApp = null;
const backendLogs = [];
const MAX_LOG_LINES = 500;

function addLog(msg) {
  backendLogs.push(msg);
  if (backendLogs.length > MAX_LOG_LINES) backendLogs.splice(0, backendLogs.length - MAX_LOG_LINES);
}

let sseClients = new Set();

function stopBackend() {
  if (backendApp) {
    try { backendApp.close(); } catch (e) {}
    backendApp = null;
    addLog('[Runner] Backend stopped.');
  }
}

function loadBackendInProcess(code) {
  try {
    stopBackend();
    backendLogs.length = 0;
    addLog('[Runner] Loading backend in-process...');

    const sandbox = { require, __dirname: __dirname, __filename: path.join(__dirname, 'app_backend.js'), console, process, Buffer, setTimeout, setInterval, clearTimeout, clearInterval, module: { exports: {} } };
    const vm = require('vm');
    const script = new vm.Script(code, { filename: 'app_backend.js' });
    script.runInNewContext(sandbox, { timeout: 10000 });
    const modExports = sandbox.module.exports;

    let loadedApp = null;
    if (modExports && typeof modExports === 'function') {
      loadedApp = modExports;
    } else if (modExports && modExports.app) {
      loadedApp = modExports.app;
    } else if (sandbox.app) {
      loadedApp = sandbox.app;
    }

    if (loadedApp && loadedApp.listen) {
      backendApp = loadedApp;
      addLog(`[Runner] Backend loaded in-process on port ${liveBackendPort}`);
      return loadedApp;
    }
    addLog('[Runner] No listenable app found in code, using proxy mode');
    return null;
  } catch (err) {
    addLog(`[Runner] Load error: ${err.message}`);
    return null;
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// ===== INSTANT BUILD: reload backend code in-process =====
app.post('/run', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  loadBackendInProcess(code);
  res.json({ status: 'started', message: 'Backend loaded in-process', port: liveBackendPort });
});

app.post('/stop', (req, res) => {
  stopBackend();
  res.json({ status: 'stopped' });
});

app.post('/hot-update', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  loadBackendInProcess(code);
  broadcastLog('[Runner] Hot-update complete');
  res.json({ status: 'hot-updated', message: 'Backend reloaded with new code', port: liveBackendPort });
});

// ===== SSE LOG STREAM =====
app.get('/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  backendLogs.forEach(log => res.write(`data: ${JSON.stringify({ log })}\n\n`));
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastLog(msg) {
  sseClients.forEach(c => {
    try { c.write(`data: ${JSON.stringify({ log: msg })}\n\n`); } catch (e) {}
  });
}

app.get('/status', (req, res) => {
  res.json({ running: !!backendApp, logs: backendLogs, port: liveBackendPort });
});

app.post('/log-error', (req, res) => {
  console.error('[Client Error]', req.body);
  res.sendStatus(200);
});

app.post('/save-client-id', (req, res) => {
  const { clientId } = req.body;
  if (!clientId || !clientId.includes('.apps.googleusercontent.com')) {
    return res.status(400).json({ error: 'Invalid Client ID format' });
  }
  const configPath = path.join(__dirname, 'google_config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ clientId }, null, 2));
    console.log('[InstaBuild] Google Client ID saved:', clientId);
    res.json({ success: true, clientId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/get-client-id', (req, res) => {
  const configPath = path.join(__dirname, 'google_config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return res.json({ clientId: config.clientId || '' });
    }
    res.json({ clientId: '' });
  } catch (e) {
    res.json({ clientId: '' });
  }
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'setup.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'vv.html'));
});

app.get('/vv.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'vv.html'));
});

app.get('/ide', (req, res) => {
  res.sendFile(path.join(__dirname, 'ide.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== IDE API =====
const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

app.get('/api/ide/files/:projectId', (req, res) => {
  const { projectId } = req.params;
  const projectPath = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });
  try {
    const filesFile = path.join(projectPath, 'files.json');
    if (fs.existsSync(filesFile)) {
      res.json({ files: JSON.parse(fs.readFileSync(filesFile, 'utf8')) });
    } else {
      res.json({ files: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ide/files/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'Path and content required' });
  try {
    const projectPath = path.join(PROJECTS_DIR, projectId);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    const filesFile = path.join(projectPath, 'files.json');
    let files = fs.existsSync(filesFile) ? JSON.parse(fs.readFileSync(filesFile, 'utf8')) : [];
    const fileIdx = files.findIndex(f => f.path === filePath);
    const now = new Date().toISOString();
    if (fileIdx !== -1) {
      files[fileIdx].content = content;
      files[fileIdx].modified_at = now;
    } else {
      files.push({ path: filePath, content, created_at: now, modified_at: now });
    }
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true, file: files[fileIdx >= 0 ? fileIdx : files.length - 1] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ide/files/:projectId/:fileName', (req, res) => {
  const { projectId, fileName } = req.params;
  try {
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const filesFile = path.join(projectPath, 'files.json');
    if (!fs.existsSync(filesFile)) return res.status(404).json({ error: 'File not found' });
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    files = files.filter(f => f.path !== decodeURIComponent(fileName));
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ide/preview/:projectId', (req, res) => {
  const { projectId } = req.params;
  try {
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const filesFile = path.join(projectPath, 'files.json');
    if (!fs.existsSync(filesFile)) return res.send('<html><body><h1>Project not found</h1></body></html>');
    const files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const htmlFile = files.find(f => f.path.endsWith('.html'));
    if (htmlFile) {
      res.type('text/html').send(htmlFile.content);
    } else {
      res.send('<html><body><h1>No HTML file found. Create index.html to see preview.</h1></body></html>');
    }
  } catch (err) {
    res.status(500).send('<html><body><h1>Error loading preview</h1></body></html>');
  }
});

// ===== LAZY MONGODB (no startup delay) =====
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'instabuild_jwt_secret_2024';

let isMongoConnected = false;
let mongoConnecting = false;
let mongoFailed = false;

mongoose.connection.on('connected', () => { isMongoConnected = true; console.log('[MongoDB] Connected'); });
mongoose.connection.on('disconnected', () => { if (isMongoConnected) { isMongoConnected = false; console.log('[MongoDB] Disconnected — switched to local DB'); } });
mongoose.connection.on('error', (err) => { if (isMongoConnected) { isMongoConnected = false; console.error('[MongoDB] Error — switched to local DB:', err.message); } });

async function ensureMongo() {
  if (isMongoConnected || mongoFailed) return;
  if (mongoConnecting) return;
  if (!MONGO_URI) { mongoFailed = true; return; }
  mongoConnecting = true;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000, bufferCommands: false });
    isMongoConnected = true;
  } catch (err) {
    mongoFailed = true;
    console.error('[MongoDB] Connection failed:', err.message, '— using local DB');
  } finally {
    mongoConnecting = false;
  }
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  avatar: { type: String, default: '' },
  googleId: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const MongoUser = mongoose.model('User', userSchema);

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  idea: { type: String, default: '' },
  frontend: { type: String, default: '' },
  backend: { type: String, default: '' },
  business: { type: String, default: '' },
  pitch: { type: String, default: '' },
  landing: { type: String, default: '' },
  timestamp: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const MongoProject = mongoose.model('Project', projectSchema);

const dataSchema = new mongoose.Schema({
  appId: { type: String, required: true, index: true },
  docCollection: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
dataSchema.index({ appId: 1, docCollection: 1 });
const MongoDataDoc = mongoose.model('DataDoc', dataSchema);

const reviewSchema = new mongoose.Schema({
  appId: { type: String, required: true, index: true },
  rating: { type: Number, required: true },
  text: { type: String, required: true },
  userEmail: { type: String },
  userName: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const MongoReview = mongoose.model('Review', reviewSchema);



async function withMongo(fn, fallback) {
  await ensureMongo();
  if (!isMongoConnected) return fallback();
  try {
    return await fn();
  } catch (err) {
    if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoTimeoutError'].includes(err.name)) {
      console.error('[MongoDB] Query failed — switched to local DB:', err.message);
      isMongoConnected = false;
      return fallback();
    }
    throw err;
  }
}

// ===== JWT HELPERS =====
function generateToken(user) {
  return jwt.sign(
    { id: user._id ? user._id.toString() : user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ===== LOCAL FALLBACK DATABASE =====
const DB_FILE = path.join(__dirname, 'local_db.json');

function readLocalDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], projects: [], datadocs: [], reviews: [] }), 'utf8');
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.users) data.users = [];
    if (!data.projects) data.projects = [];
    if (!data.datadocs) data.datadocs = [];
    if (!data.reviews) data.reviews = [];
    return data;
  } catch (e) {
    console.error('Error reading local DB:', e.message);
    return { users: [], projects: [], datadocs: [], reviews: [] };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local DB:', e.message);
  }
}

function makeDocument(collection, data) {
  if (!data) return null;
  const doc = JSON.parse(JSON.stringify(data));
  Object.defineProperty(doc, 'save', {
    value: async function () {
      const db = readLocalDB();
      const idx = db[collection].findIndex(item => String(item._id) === String(doc._id));
      const payload = JSON.parse(JSON.stringify(doc));
      if (idx !== -1) {
        db[collection][idx] = { ...db[collection][idx], ...payload, updatedAt: new Date() };
      } else {
        payload.updatedAt = new Date();
        db[collection].push(payload);
      }
      writeLocalDB(db);
      return doc;
    },
    enumerable: false
  });
  return doc;
}

const DB = {
  User: {
    findOne: (query) => withMongo(() => MongoUser.findOne(query), () => {
      const db = readLocalDB();
      const email = query.email ? query.email.toLowerCase() : null;
      const user = email ? db.users.find(u => u.email === email) : db.users.find(u => String(u._id) === String(query._id));
      return user ? makeDocument('users', user) : null;
    }),
    findById: async (id) => {
      await ensureMongo();
      if (isMongoConnected) {
        try { const user = await MongoUser.findById(id); if (user) return user; } catch (err) { if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoTimeoutError'].includes(err.name)) isMongoConnected = false; else throw err; }
      }
      const db = readLocalDB();
      const user = db.users.find(u => String(u._id) === String(id));
      return user ? makeDocument('users', user) : null;
    },
    create: (data) => withMongo(() => MongoUser.create(data), () => {
      const db = readLocalDB();
      const newDoc = { _id: new mongoose.Types.ObjectId().toString(), createdAt: new Date(), ...data };
      db.users.push(newDoc);
      writeLocalDB(db);
      return makeDocument('users', newDoc);
    })
  },
  Project: {
    find: (query) => withMongo(() => MongoProject.find(query).sort({ createdAt: -1 }).lean(), () => {
      const db = readLocalDB();
      return db.projects.filter(p => String(p.userId) === String(query.userId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }),
    findOne: (query) => withMongo(() => MongoProject.findOne(query), () => {
      const db = readLocalDB();
      const proj = db.projects.find(p => String(p._id) === String(query._id) && String(p.userId) === String(query.userId));
      return proj ? makeDocument('projects', proj) : null;
    }),
    create: (data) => withMongo(() => MongoProject.create(data), () => {
      const db = readLocalDB();
      const newDoc = { _id: new mongoose.Types.ObjectId().toString(), createdAt: new Date(), ...data };
      db.projects.push(newDoc);
      writeLocalDB(db);
      return makeDocument('projects', newDoc);
    }),
    findOneAndDelete: (query) => withMongo(() => MongoProject.findOneAndDelete(query), () => {
      const db = readLocalDB();
      const idx = db.projects.findIndex(p => String(p._id) === String(query._id) && String(p.userId) === String(query.userId));
      if (idx === -1) return null;
      const [removed] = db.projects.splice(idx, 1);
      writeLocalDB(db);
      return removed;
    })
  },
  DataDoc: {
    findOneAndUpdate: (query, update, options) => withMongo(() => MongoDataDoc.findOneAndUpdate(query, update, options), () => {
      const db = readLocalDB();
      const idx = db.datadocs.findIndex(d => d.appId === query.appId && d.docCollection === query.docCollection);
      const data = (update && update.data) || {};
      if (idx !== -1) {
        db.datadocs[idx].data = data;
        db.datadocs[idx].updatedAt = new Date();
        writeLocalDB(db);
        return makeDocument('datadocs', db.datadocs[idx]);
      }
      const newDoc = { _id: new mongoose.Types.ObjectId().toString(), appId: query.appId, docCollection: query.docCollection, data, createdAt: new Date(), updatedAt: new Date() };
      db.datadocs.push(newDoc);
      writeLocalDB(db);
      return makeDocument('datadocs', newDoc);
    }),
    findOne: (query) => withMongo(() => MongoDataDoc.findOne(query), () => {
      const db = readLocalDB();
      const doc = db.datadocs.find(d => d.appId === query.appId && d.docCollection === query.docCollection);
      return doc ? makeDocument('datadocs', doc) : null;
    }),
    findOneAndDelete: (query) => withMongo(() => MongoDataDoc.findOneAndDelete(query), () => {
      const db = readLocalDB();
      const idx = db.datadocs.findIndex(d => d.appId === query.appId && d.docCollection === query.docCollection);
      if (idx === -1) return null;
      const [removed] = db.datadocs.splice(idx, 1);
      writeLocalDB(db);
      return removed;
    })
  },
  Review: {
    find: (query) => withMongo(() => MongoReview.find(query).sort({ createdAt: -1 }).lean(), () => {
      const db = readLocalDB();
      const appId = query.appId;
      let result = db.reviews || [];
      if (appId) result = result.filter(r => r.appId === appId);
      return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }),
    create: (data) => withMongo(() => MongoReview.create(data), () => {
      const db = readLocalDB();
      if (!db.reviews) db.reviews = [];
      const newDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        createdAt: new Date().toISOString(),
        ...data
      };
      db.reviews.push(newDoc);
      writeLocalDB(db);
      return makeDocument('reviews', newDoc);
    })
  }
};

const User = DB.User;
const Project = DB.Project;
const DataDoc = DB.DataDoc;
const Review = DB.Review;


// ===== AUTH ROUTES =====
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashedPassword });
    const token = generateToken(user);
    res.status(201).json({ success: true, token, user: { name: user.name, email: user.email, avatar: user.avatar || '' } });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) return res.status(401).json({ message: 'No account found with this email. Please sign up.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    const token = generateToken(user);
    res.json({ success: true, token, user: { name: user.name, email: user.email, avatar: user.avatar || '' } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, accessToken } = req.body;
    if (!credential && !accessToken) return res.status(400).json({ message: 'credential or accessToken required' });
    let email = '', name = '', avatar = '', googleSub = '';
    if (credential) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      if (!tokenRes.ok) return res.status(401).json({ message: 'Invalid Google ID token' });
      const payload = await tokenRes.json();
      const configPath = path.join(__dirname, 'google_config.json');
      let expectedAudience = '';
      try { if (fs.existsSync(configPath)) expectedAudience = JSON.parse(fs.readFileSync(configPath, 'utf8')).clientId || ''; } catch (e) {}
      if (payload.aud && expectedAudience && payload.aud !== expectedAudience) return res.status(401).json({ message: 'Token audience mismatch' });
      email = payload.email || '';
      name = payload.name || '';
      avatar = payload.picture || '';
      googleSub = payload.sub || '';
    } else {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
      if (!userRes.ok) return res.status(401).json({ message: 'Invalid Google access token' });
      const payload = await userRes.json();
      email = payload.email || '';
      name = payload.name || '';
      avatar = payload.picture || '';
      googleSub = payload.sub || '';
    }
    if (!email) return res.status(400).json({ message: 'Could not retrieve email from Google' });
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({ name: name || email.split('@')[0], email: email.toLowerCase(), avatar, googleId: googleSub });
    } else {
      if (name) user.name = name;
      if (avatar) user.avatar = avatar;
      if (googleSub) user.googleId = googleSub;
      await user.save();
    }
    const token = generateToken(user);
    res.json({ success: true, token, user: { name: user.name, email: user.email, avatar: user.avatar || '' } });
  } catch (err) {
    console.error('[Auth] Google auth error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/cinesocial', async (req, res) => {
  try {
    const { name, email, avatar } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) user = await User.create({ name: name || email.split('@')[0], email: email.toLowerCase(), avatar: avatar || '' });
    const token = generateToken(user);
    res.json({ success: true, token, user: { name: user.name, email: user.email, avatar: user.avatar || '' } });
  } catch (err) {
    console.error('[Auth] CineSocial auth error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user || !user.password) return res.status(400).json({ message: 'Password-based accounts only' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('[Auth] Change password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/update-profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();
    res.json({ success: true, user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== PROJECT ROUTES =====
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    res.json({ projects });
  } catch (err) {
    console.error('[Projects] List error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { id: clientId, name, idea, frontend, backend, business, pitch, landing, timestamp } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required' });
    if (clientId) {
      const existing = await Project.findOne({ _id: clientId, userId: req.user.id });
      if (existing) {
        Object.assign(existing, { name, idea, frontend, backend, business, pitch, landing, timestamp });
        await existing.save();
        return res.json({ success: true, project: existing });
      }
    }
    const project = await Project.create({ userId: req.user.id, name, idea, frontend, backend, business, pitch, landing, timestamp });
    res.status(201).json({ success: true, project });
  } catch (err) {
    console.error('[Projects] Save error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Projects] Delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== DATA DOCS ROUTES =====
app.post('/api/data/:collection', async (req, res) => {
  try {
    const docCollection = req.params.collection;
    const { appId, data } = req.body;
    if (!appId || !docCollection) return res.status(400).json({ error: 'appId and collection required' });
    const doc = await DataDoc.findOneAndUpdate({ appId, docCollection }, { data, updatedAt: new Date() }, { upsert: true, new: true });
    res.json({ success: true, doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:collection', async (req, res) => {
  try {
    const docCollection = req.params.collection;
    const { appId } = req.query;
    if (!appId) return res.status(400).json({ error: 'appId query param required' });
    const doc = await DataDoc.findOne({ appId, docCollection });
    res.json({ data: doc ? doc.data : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data/:collection', async (req, res) => {
  try {
    const docCollection = req.params.collection;
    const { appId } = req.query;
    if (!appId) return res.status(400).json({ error: 'appId query param required' });
    await DataDoc.findOneAndDelete({ appId, docCollection });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DEPLOYMENT API =====
const DEPLOY_DIR = path.join(__dirname, 'deploy');
if (!fs.existsSync(DEPLOY_DIR)) fs.mkdirSync(DEPLOY_DIR, { recursive: true });

const deployments = new Map();

function getDeployPort() {
  const used = Array.from(deployments.values()).map(d => d.port).filter(Boolean);
  let port = nextDeployPort;
  while (used.includes(port)) port++;
  nextDeployPort = port + 1;
  return port;
}

function startDeployServer(appId, deployPath, backendCode) {
  const port = getDeployPort();
  const depApp = express();
  depApp.use(cors());
  depApp.use(express.json());

  if (backendCode && backendCode.trim().length > 50) {
    try {
      const vm = require('vm');
      const sandbox = {
        require, __dirname: deployPath, __filename: path.join(deployPath, 'server.js'),
        console, process, Buffer, setTimeout, setInterval, clearTimeout, clearInterval,
        module: { exports: {} }, app: depApp, express
      };
      const script = new vm.Script(backendCode, { filename: 'server.js' });
      script.runInNewContext(sandbox, { timeout: 10000 });
      console.log(`[Deploy] ${appId} backend loaded`);
    } catch (err) {
      console.error(`[Deploy] ${appId} backend load error:`, err.message);
    }
  }

  depApp.use(express.static(deployPath));

  depApp.get('*', (req, res) => {
    res.sendFile(path.join(deployPath, 'index.html'));
  });

  const server = depApp.listen(port, () => {
    console.log(`[Deploy] ${appId} running on http://localhost:${port}`);
  });

  return { server, port };
}

async function restoreDeployments() {
  if (!fs.existsSync(DEPLOY_DIR)) return;
  try {
    const dirs = fs.readdirSync(DEPLOY_DIR);
    for (const appId of dirs) {
      const deployPath = path.join(DEPLOY_DIR, appId);
      if (!fs.statSync(deployPath).isDirectory()) continue;
      const indexHtmlPath = path.join(deployPath, 'index.html');
      const serverJsPath = path.join(deployPath, 'server.js');
      if (!fs.existsSync(indexHtmlPath)) continue;
      let frontend = ''; try { frontend = fs.readFileSync(indexHtmlPath, 'utf8'); } catch (e) {}
      let backend = ''; if (fs.existsSync(serverJsPath)) { try { backend = fs.readFileSync(serverJsPath, 'utf8'); } catch (e) {} }
      deployments.set(appId, { frontend, backend, domain: null, port: null, server: null, deployedAt: new Date().toISOString(), startedAt: null, status: 'stopped', users: new Map(), totalSessions: 0 });
    }
  } catch (err) {
    console.error('[Runner] Failed to restore deployments:', err.message);
  }
}

app.post('/api/deploy', async (req, res) => {
  try {
    const { appId, frontend, backend } = req.body;
    if (!appId || !frontend) return res.status(400).json({ error: 'appId and frontend required' });
    const deployPath = path.join(DEPLOY_DIR, appId);
    if (!fs.existsSync(deployPath)) fs.mkdirSync(deployPath, { recursive: true });

    let modifiedFrontend = frontend;
    modifiedFrontend = modifiedFrontend.replace(/https?:\/\/localhost:3000/gi, '');
    modifiedFrontend = modifiedFrontend.replace(/https?:\/\/127.0.0.1:3000/gi, '');

    const deployTrackerScript = `<script>(function(){var a=${JSON.stringify(appId)};var r=${JSON.stringify(`http://localhost:${RUNNER_PORT}`)};var f=window.fetch;window.fetch=function(u,o){o=o||{};o.headers=o.headers||{};if(typeof o.headers==='object'&&!Array.isArray(o.headers)){o.headers['X-Deploy-App-Id']=a}return f.call(this,u,o)};var X=XMLHttpRequest.prototype,O=X.open;X.open=function(m,u){this._u=u;return O.apply(this,arguments)};var S=X.send;X.send=function(b){if(this._u&&this._u.indexOf('/api/')>=0){this.setRequestHeader('X-Deploy-App-Id',a)}return S.apply(this,arguments)};var sid=(function(){try{var s=localStorage.getItem('_d_sid');if(!s){s=Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem('_d_sid',s)}return s}catch(e){return Date.now()+'-'+Math.random().toString(36).slice(2)}})();var hb=function(){try{navigator.sendBeacon(r+'/api/deploy/'+a+'/heartbeat',JSON.stringify({sessionId:sid,url:location.href}))}catch(e){}};window.addEventListener('load',function(){hb();setInterval(hb,30000)});window.addEventListener('beforeunload',function(){try{navigator.sendBeacon(r+'/api/deploy/'+a+'/leave',JSON.stringify({sessionId:sid,time:Date.now()}))}catch(e){}});})();<\/script>`;
    modifiedFrontend = modifiedFrontend.replace('</head>', deployTrackerScript + '</head>');
    fs.writeFileSync(path.join(deployPath, 'index.html'), modifiedFrontend, 'utf8');

    if (backend && backend.trim().length > 0) {
      fs.writeFileSync(path.join(deployPath, 'server.js'), backend, 'utf8');
    }

    const existing = deployments.get(appId);
    if (existing && existing.server) {
      try { existing.server.close(); } catch (e) {}
    }

    const { server, port } = startDeployServer(appId, deployPath, backend);

    const now = new Date().toISOString();
    deployments.set(appId, {
      frontend, backend, domain: null,
      port, server,
      deployedAt: existing?.deployedAt || now,
      startedAt: now,
      status: 'running',
      users: new Map(),
      totalSessions: existing?.totalSessions || 0
    });

    res.json({ success: true, deployUrl: `http://localhost:${port}`, frontendUrl: `http://localhost:${port}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deploy/:appId/heartbeat', (req, res) => {
  const dep = deployments.get(req.params.appId);
  if (!dep) return res.json({ ok: false });
  const { sessionId, url } = req.body;
  if (sessionId) {
    const user = dep.users.get(sessionId) || {};
    user.lastPing = Date.now();
    if (!user.connectedAt) user.connectedAt = Date.now();
    user.url = url || user.url || 'unknown';
    dep.users.set(sessionId, user);
  }
  res.json({ ok: true });
});

app.post('/api/deploy/:appId/leave', (req, res) => {
  const dep = deployments.get(req.params.appId);
  if (!dep) return res.json({ ok: false });
  const { sessionId } = req.body;
  if (sessionId && dep.users.has(sessionId)) {
    const user = dep.users.get(sessionId);
    user.leftAt = Date.now();
    user.duration = (user.duration || 0) + (Date.now() - (user.lastPing || Date.now()));
    dep.totalSessions = (dep.totalSessions || 0) + 1;
  }
  res.json({ ok: true });
});

app.get('/api/deploy/:appId/status', (req, res) => {
  const dep = deployments.get(req.params.appId);
  if (!dep) return res.json({ deployed: false });
  const activeUsers = Array.from(dep.users.entries())
    .filter(([_, u]) => Date.now() - u.lastPing < 60000)
    .length;
  const uptime = dep.startedAt ? Math.floor((Date.now() - new Date(dep.startedAt).getTime()) / 1000) : 0;
  res.json({
    deployed: true,
    status: dep.status,
    deployUrl: `http://localhost:${dep.port}`,
    port: dep.port,
    startedAt: dep.startedAt,
    deployedAt: dep.deployedAt,
    uptime,
    activeUsers,
    totalSessions: dep.totalSessions || 0,
    hasBackend: !!(dep.backend && dep.backend.trim().length > 50)
  });
});

app.post('/api/deploy/:appId/stop', (req, res) => {
  const dep = deployments.get(req.params.appId);
  if (dep && dep.server) {
    try { dep.server.close(); } catch (e) {}
    dep.server = null;
    dep.port = null;
    dep.status = 'stopped';
    dep.startedAt = null;
  }
  res.json({ success: true });
});

// ===== REVIEWS API =====
app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const { appId, rating, text } = req.body;
    if (!appId || !rating || !text) return res.status(400).json({ error: 'appId, rating, and text required' });
    const user = await User.findById(req.user.id);
    const userEmail = req.user.email;
    const userName = user ? user.name : 'Anonymous';
    const review = await Review.create({
      appId,
      rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
      text: text.trim().slice(0, 2000),
      userEmail,
      userName
    });
    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const { appId } = req.query;
    const query = appId ? { appId } : {};
    const result = await Review.find(query);
    res.json({ reviews: result.slice(0, 200) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===== AI PROVIDER PROXY (parallel race with shorter timeouts) =====
let geminiKeyIndex = 0;
const geminiKeys = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2].filter(Boolean);

function getGeminiKey() {
  if (geminiKeys.length === 0) return process.env.GEMINI_API_KEY || '';
  const key = geminiKeys[geminiKeyIndex % geminiKeys.length];
  geminiKeyIndex++;
  return key;
}

const AI_PROVIDERS = [
  {
    name: 'gemini', label: 'Gemini',
    buildUrl: (model) => {
      const m = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      return `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${getGeminiKey()}`;
    },
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildBody: (prompt, opts) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: opts?.maxTokens || 8192, temperature: opts?.temperature || 0.7 }
    }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); return parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''; } catch (e) { return ''; }
    },
    isOverloaded: (status, errMsg) => status === 429 || status === 503 || /demand|quota|limit|exhausted/i.test(errMsg || '')
  },
  {
    name: 'groq', label: 'Groq',
    buildUrl: () => 'https://api.groq.com/openai/v1/chat/completions',
    buildHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}` }),
    buildBody: (prompt, opts) => ({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: opts?.maxTokens || 8192, stream: true }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); return parsed.choices?.[0]?.delta?.content || ''; } catch (e) { return ''; }
    },
    isOverloaded: (status) => status === 429
  },
  {
    name: 'anthropic', label: 'Anthropic',
    buildUrl: () => 'https://api.anthropic.com/v1/messages',
    buildHeaders: () => ({ 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' }),
    buildBody: (prompt, opts) => ({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest', max_tokens: opts?.maxTokens || 8192, stream: true, messages: [{ role: 'user', content: prompt }] }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); if (parsed.type === 'content_block_delta' && parsed.delta?.text) return parsed.delta.text; return ''; } catch (e) { return ''; }
    },
    isOverloaded: (status) => status === 429
  },
  {
    name: 'huggingface', label: 'Hugging Face',
    buildUrl: () => 'https://router.huggingface.co/v1/chat/completions',
    buildHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.HF_TOKEN || process.env.HF_TOKEN_1 || ''}` }),
    buildBody: (prompt, opts) => ({ model: process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct', messages: [{ role: 'user', content: prompt }], max_tokens: opts?.maxTokens || 8192, stream: true }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); return parsed.choices?.[0]?.delta?.content || ''; } catch (e) { return ''; }
    },
    isOverloaded: (status) => status === 429 || status === 403
  },
  {
    name: 'nvidia', label: 'NVIDIA',
    buildUrl: () => 'https://integrate.api.nvidia.com/v1/chat/completions',
    buildHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY_1 || ''}` }),
    buildBody: (prompt, opts) => ({ model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-pro', messages: [{ role: 'user', content: prompt }], max_tokens: opts?.maxTokens || 16384, temperature: opts?.temperature || 1, top_p: 0.95, stream: true, extra_body: { chat_template_kwargs: { thinking: false } } }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); return parsed.choices?.[0]?.delta?.content || ''; } catch (e) { return ''; }
    },
    isOverloaded: (status) => status === 429 || status === 402
  },
  {
    name: 'ollama', label: 'Local Ollama',
    buildUrl: () => process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate',
    buildBody: (prompt, opts) => ({ model: process.env.OLLAMA_MODEL || 'codellama', prompt, stream: true, options: { num_predict: opts?.maxTokens || 8192 } }),
    parseStream: (line) => {
      try { const parsed = JSON.parse(line); return parsed.response || ''; } catch (e) { return ''; }
    },
    isOverloaded: () => false
  }
];

// Parallel AI race — tries all providers simultaneously, uses first to respond
app.post('/api/ai/stream', async (req, res) => {
  const { prompt, provider: preferredProvider, model, maxTokens, temperature } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) {} };

  const providers = preferredProvider
    ? [...AI_PROVIDERS.filter(p => p.name === preferredProvider), ...AI_PROVIDERS.filter(p => p.name !== preferredProvider)]
    : AI_PROVIDERS;

  let lastError = null;

  for (const provider of providers) {
    if (provider.name === 'anthropic' && !process.env.ANTHROPIC_API_KEY) continue;
    if (provider.name === 'groq' && !process.env.GROQ_API_KEY) continue;
    if (provider.name === 'gemini' && !process.env.GEMINI_API_KEY && geminiKeys.length === 0) continue;
    if (provider.name === 'huggingface' && !process.env.HF_TOKEN && !process.env.HF_TOKEN_1) continue;
    if (provider.name === 'nvidia' && !process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY_1) continue;

    const maxAttempts = provider.name === 'gemini' ? Math.max(1, geminiKeys.length) : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        write({ status: 'trying', provider: provider.name, label: provider.label, attempt });

        const url = provider.buildUrl(model);
        const headers = provider.buildHeaders ? provider.buildHeaders() : { 'Content-Type': 'application/json' };
        const body = provider.buildBody(prompt, { maxTokens, temperature });

        const controller = new AbortController();
        const timeoutVal = provider.name === 'ollama' ? 300000 : 180000;
        const timeout = setTimeout(() => controller.abort(), timeoutVal);

        let response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok && provider.name === 'ollama') {
          try {
            const tagsRes = await fetch(url.replace('/api/generate', '/api/tags'));
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              const models = tagsData.models?.map(m => m.name) || [];
              const failedModel = body.model;
              // prefer smaller models first, then any model
              const nextModel = models.find(m => m !== failedModel && !m.includes(':7b') && !m.includes(':8b'));
              const finalModel = nextModel || models.find(m => m !== failedModel) || models[0];
              if (finalModel && finalModel !== failedModel) {
                console.log(`[Runner] Streaming: Ollama model fallback from ${failedModel} to ${finalModel}`);
                body.model = finalModel;
                const newResponse = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(body),
                  signal: controller.signal
                });
                if (newResponse.ok) {
                  response = newResponse;
                }
              }
            }
          } catch (e) {
            console.error('[Runner] Ollama tags fetch / fallback failed:', e.message);
          }
        }

        if (!response.ok) {
          let errMsg = '';
          try { const e = await response.json(); errMsg = e.error?.message || JSON.stringify(e); } catch (e) {}
          if (provider.isOverloaded(response.status, errMsg)) {
            lastError = { provider: provider.name, error: `rate_limited (${response.status})` };
            write({ status: 'rate_limited', provider: provider.name, message: errMsg });
            continue;
          }
          lastError = { provider: provider.name, error: `http_${response.status}`, message: errMsg };
          write({ status: 'error', provider: provider.name, error: errMsg });
          continue;
        }

        write({ status: 'streaming_started', provider: provider.name });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              const chunk = provider.parseStream(dataStr);
              if (chunk) write({ text: chunk });
            } else if (provider.name === 'ollama') {
              const chunk = provider.parseStream(trimmed);
              if (chunk) write({ text: chunk });
            }
          }
        }

        write({ done: true, provider: provider.name });
        try { res.end(); } catch (e) {}
        return;

      } catch (err) {
        if (err.name === 'AbortError') {
          lastError = { provider: provider.name, error: 'timeout' };
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
          lastError = { provider: provider.name, error: 'connection_failed' };
        } else {
          lastError = { provider: provider.name, error: err.message };
        }
        write({ status: 'error', provider: provider.name, error: lastError.error, attempt });
      }
    }
  }

  write({ error: 'All providers exhausted', lastError: lastError?.error || 'unknown' });
  write({ done: true });
  try { res.end(); } catch (e) {}
});

app.post('/api/ai/generate', async (req, res) => {
  const { prompt, provider: preferredProvider, model, maxTokens } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  let fullText = '';
  let timedOut = false;
  const providers = preferredProvider
    ? [...AI_PROVIDERS.filter(p => p.name === preferredProvider), ...AI_PROVIDERS.filter(p => p.name !== preferredProvider)]
    : AI_PROVIDERS;
  const mainTimeoutVal = providers.some(p => p.name === 'ollama') ? 360000 : 90000;
  const timeout = setTimeout(() => { timedOut = true; }, mainTimeoutVal);

  try {

    let lastErr = null;
    for (const provider of providers) {
      if (timedOut) break;
      if (provider.name === 'anthropic' && !process.env.ANTHROPIC_API_KEY) continue;
      if (provider.name === 'groq' && !process.env.GROQ_API_KEY) continue;
      if (provider.name === 'gemini' && !process.env.GEMINI_API_KEY && geminiKeys.length === 0) continue;
      if (provider.name === 'huggingface' && !process.env.HF_TOKEN && !process.env.HF_TOKEN_1) continue;
      if (provider.name === 'nvidia' && !process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY_1) continue;

      try {
        const url = provider.buildUrl(model);
        const headers = provider.buildHeaders ? provider.buildHeaders() : { 'Content-Type': 'application/json' };
        const body = provider.buildBody(prompt, { maxTokens, temperature: 0.5 });

        const controller = new AbortController();
        const timeoutVal = provider.name === 'ollama' ? 300000 : 180000;
        const t = setTimeout(() => controller.abort(), timeoutVal);

        let response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(t);

        if (!response.ok && provider.name === 'ollama') {
          try {
            const tagsRes = await fetch(url.replace('/api/generate', '/api/tags'));
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              const models = tagsData.models?.map(m => m.name) || [];
              const failedModel = body.model;
              const nextModel = models.find(m => m !== failedModel && !m.includes(':7b') && !m.includes(':8b'));
              const finalModel = nextModel || models.find(m => m !== failedModel) || models[0];
              if (finalModel && finalModel !== failedModel) {
                console.log(`[Runner] Non-streaming: Ollama model fallback from ${failedModel} to ${finalModel}`);
                body.model = finalModel;
                const newResponse = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(body),
                  signal: controller.signal
                });
                if (newResponse.ok) response = newResponse;
              }
            }
          } catch (e) {}
        }

        if (!response.ok) continue;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const chunk = provider.parseStream(trimmed.slice(5).trim());
              if (chunk) fullText += chunk;
            } else if (provider.name === 'ollama') {
              const chunk = provider.parseStream(trimmed);
              if (chunk) fullText += chunk;
            }
          }
        }

        if (fullText) break;
      } catch (err) {
        lastErr = err;
      }
    }

    clearTimeout(timeout);
    if (timedOut) return res.status(504).json({ error: 'AI generation timed out', response: fullText.trim() });
    if (fullText) return res.json({ success: true, response: fullText.trim() });
    return res.status(503).json({ error: 'AI generation failed', detail: lastErr?.message });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/ai/status', (req, res) => {
  res.json({
    providers: AI_PROVIDERS.map(p => ({
      name: p.name,
      label: p.label,
      configured: p.name === 'ollama' ? true : !!(
        p.name === 'gemini' ? (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1) :
        p.name === 'groq' ? process.env.GROQ_API_KEY :
        p.name === 'anthropic' ? process.env.ANTHROPIC_API_KEY :
        p.name === 'huggingface' ? (process.env.HF_TOKEN || process.env.HF_TOKEN_1) :
        p.name === 'nvidia' ? (process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY_1) :
        false
      )
    }))
  });
});

// ===== INSTANT PREVIEW =====
let lastPreviewHtml = '';
app.post('/api/preview', (req, res) => {
  lastPreviewHtml = req.body.html || '';
  res.json({ success: true });
});

app.get('/preview', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(lastPreviewHtml || '<html><body><h3>No preview generated yet.</h3></body></html>');
});

// ===== PROXY FOR LIVE BACKEND =====
app.all('/api/live-backend/*', async (req, res) => {
  if (!backendApp) return res.status(503).json({ error: 'Live backend not loaded.' });
  try {
    const reqUrl = req.url.replace('/api/live-backend', '');
    const mockReq = { method: req.method, headers: req.headers, url: reqUrl, body: req.body };
    const mockRes = { statusCode: 200, headers: {}, body: '', status(s) { this.statusCode = s; return this; }, json(d) { this.body = JSON.stringify(d); this._done = true; }, send(d) { this.body = d; this._done = true; }, setHeader(k, v) { this.headers[k] = v; }, end(d) { if (d) this.body = d; this._done = true; } };
    const next = () => {};
    const routes = backendApp._router ? backendApp._router.stack : [];
    let handled = false;
    for (const layer of routes) {
      if (layer.route) {
        const routeMethods = layer.route.methods;
        const routePath = layer.route.path;
        const matchUrl = reqUrl.replace('/api/', '');
        if (routeMethods[req.method.toLowerCase()] && matchUrl.startsWith(routePath)) {
          layer.route.stack[0].handle(mockReq, mockRes, next);
          handled = true;
          break;
        }
      }
    }
    if (!handled) mockRes.status(404).json({ error: 'Route not found in loaded backend' });
    res.status(mockRes.statusCode).set(mockRes.headers).send(mockRes.body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ===== STATIC FILES =====
app.use('/deploy/:appId', (req, res, next) => {
  const deployPath = path.join(DEPLOY_DIR, req.params.appId);
  if (fs.existsSync(deployPath)) {
    res.sendFile(path.join(deployPath, req.path === '/' ? 'index.html' : req.path));
  } else {
    res.status(404).json({ error: 'Deployment not found' });
  }
});

app.use((err, req, res, next) => {
  console.error('[Runner] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== START =====
server.listen(RUNNER_PORT, () => {
  console.log(`[InstaBuild Runner] Listening on port ${RUNNER_PORT}`);
  restoreDeployments();
});

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('[IDE] socket connected', socket.id);
  socket.on('join', (projectId) => { socket.join(projectId); console.log(`[IDE] ${socket.id} joined ${projectId}`); });
  socket.on('file-edit', async (data) => {
    if (!data || !data.projectId || !data.path) return;
    socket.to(data.projectId).emit('file-update', data);
    try {
      const projectPath = path.join(PROJECTS_DIR, data.projectId);
      if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
      const filesFile = path.join(projectPath, 'files.json');
      let files = fs.existsSync(filesFile) ? JSON.parse(fs.readFileSync(filesFile, 'utf8')) : [];
      const idx = files.findIndex(f => f.path === data.path);
      const now = new Date().toISOString();
      if (idx !== -1) { files[idx].content = data.content; files[idx].modified_at = now; }
      else { files.push({ path: data.path, content: data.content, created_at: now, modified_at: now }); }
      fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    } catch (e) { console.error('[IDE] Failed to persist file edit:', e.message); }
  });
  socket.on('disconnect', () => { console.log('[IDE] socket disconnected', socket.id); });
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  if (err.code === 'EADDRINUSE') { console.error(`[FATAL] Port ${RUNNER_PORT} is already in use.`); process.exit(1); }
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});
