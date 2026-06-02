const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('scratch/project_CraftCart_frontend.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)(?<!\\)<\/script>/gi;
let match;
let concatenatedJs = '';
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  count++;
  // Skip external scripts or errorScript (Script 1) if desired, but let's parse all inline ones
  const content = match[1].trim();
  if (content) {
    concatenatedJs += `// --- SCRIPT ${count} ---\n` + content + '\n';
  }
}

const addEventListenerMock = (event, cb) => {
  console.log(`[FE-EventListener] registered: ${event}`);
  if (event === 'load' || event === 'DOMContentLoaded') {
    setTimeout(cb, 0); // Trigger it immediately
  }
};

const createMockElement = (tag = 'div') => {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: '',
    value: '',
    style: {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() {}
    },
    addEventListener: addEventListenerMock,
    removeEventListener: () => {},
    appendChild(child) { return child; },
    removeChild(child) { return child; },
    setAttribute(k, v) { this[k] = v; },
    removeAttribute(k) {},
    getAttribute(k) { return this[k] || null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100 }; },
    querySelectorAll() { return [createMockElement()]; },
    querySelector() { return createMockElement(); },
    focus() {},
    click() {}
  };
  el.firstChild = el;
  el.childNodes = [el];
  el.children = [];
  return el;
};

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  addEventListener: addEventListenerMock,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  document: {
    getElementById(id) {
      console.log(`[DOM] getElementById: ${id}`);
      return createMockElement();
    },
    querySelectorAll(selector) {
      console.log(`[DOM] querySelectorAll: ${selector}`);
      return [createMockElement()];
    },
    querySelector(selector) {
      console.log(`[DOM] querySelector: ${selector}`);
      return createMockElement();
    },
    createElement(tag) {
      console.log(`[DOM] createElement: ${tag}`);
      return createMockElement(tag);
    },
    body: createMockElement('body'),
    addEventListener: addEventListenerMock
  },
  localStorage: {
    getItem(key) { return null; },
    setItem(key, val) {},
    removeItem(key) {}
  },
  navigator: {},
  location: {
    port: '3001',
    hostname: 'localhost',
    origin: 'http://localhost:3001',
    pathname: '/preview'
  },
  lucide: {
    createIcons() {
      console.log('[lucide] createIcons called');
    }
  }
};
sandbox.window = sandbox;

try {
  console.log("Evaluating concatenated Frontend JavaScript...");
  vm.createContext(sandbox);
  vm.runInContext(concatenatedJs, sandbox);
  console.log("Success! No frontend runtime initialization errors detected.");
} catch (e) {
  console.error("Frontend Runtime Initialization Error detected:");
  console.error(e);
}
