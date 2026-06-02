const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('vv.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)(?<!\\)<\/script>/gi;
let match;
let concatenatedJs = '';
while ((match = scriptRegex.exec(html)) !== null) {
  concatenatedJs += match[1] + '\n';
}

const addEventListenerMock = (event, cb) => {
  console.log(`[EventListener] registered: ${event}`);
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
      return createMockElement();
    },
    querySelectorAll(selector) {
      return [createMockElement()];
    },
    querySelector(selector) {
      return createMockElement();
    },
    createElement(tag) {
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
    origin: 'http://localhost:3001'
  }
};
sandbox.window = sandbox; // Circular ref as in browser

try {
  console.log("Evaluating concatenated JavaScript...");
  vm.createContext(sandbox);
  vm.runInContext(concatenatedJs, sandbox);
  console.log("Success! No runtime initialization errors detected.");
} catch (e) {
  console.error("Runtime Initialization Error detected:");
  console.error(e);
}
