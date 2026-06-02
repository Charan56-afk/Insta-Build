require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.AI_ROUTER_PORT || process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const activeStreams = new Set();

// ===== GEMINI KEY ROTATION =====
let geminiKeyIndex = 0;
const geminiKeys = [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2].filter(Boolean);

function getGeminiKey() {
  if (geminiKeys.length === 0) return '';
  const key = geminiKeys[geminiKeyIndex % geminiKeys.length];
  geminiKeyIndex++;
  return key;
}

// ===== HUGGING FACE KEY ROTATION =====
let hfKeyIndex = 0;
const hfKeys = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2].filter(Boolean);

function getHfKey() {
  if (hfKeys.length === 0) return '';
  const key = hfKeys[hfKeyIndex % hfKeys.length];
  hfKeyIndex++;
  return key;
}

// ===== NVIDIA KEY ROTATION =====
let nvidiaKeyIndex = 0;
const nvidiaKeys = [process.env.NVIDIA_API_KEY_1, process.env.NVIDIA_API_KEY_2].filter(Boolean);

function getNvidiaKey() {
  if (nvidiaKeys.length === 0) return '';
  const key = nvidiaKeys[nvidiaKeyIndex % nvidiaKeys.length];
  nvidiaKeyIndex++;
  return key;
}

// ===== PROVIDER CONFIG =====
const PROVIDERS = [
  {
    name: 'gemini',
    label: 'Cloud Gemini (Primary)',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    buildUrl: () => `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${getGeminiKey()}`,
    buildBody: (prompt) => ({ contents: [{ parts: [{ text: prompt }] }] }),
    parseResponse: async (res) => {
      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) return data.candidates[0].content.parts[0].text;
      throw new Error(data.error?.message || 'Gemini returned an empty response');
    },
    isRateLimit: (res) => res.status === 429,
    isError: (res) => !res.ok
  },
  {
    name: 'nvidia',
    label: 'Cloud NVIDIA (Secondary)',
    model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-pro',
    buildUrl: () => 'https://integrate.api.nvidia.com/v1/chat/completions',
    buildHeaders: () => ({ 'Authorization': `Bearer ${getNvidiaKey()}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt) => ({ model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-pro', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 4096 }),
    parseResponse: async (res) => {
      const data = await res.json();
      if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
      throw new Error(data.error?.message || data.error || 'NVIDIA returned an empty response');
    },
    isRateLimit: (res) => res.status === 429,
    isError: (res) => !res.ok
  },
  {
    name: 'groq',
    label: 'Cloud Groq (Tertiary)',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    buildUrl: () => 'https://api.groq.com/openai/v1/chat/completions',
    buildHeaders: () => ({ 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt) => ({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    parseResponse: async (res) => {
      const data = await res.json();
      if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
      throw new Error(data.error?.message || 'Groq returned an empty response');
    },
    isRateLimit: (res) => res.status === 429,
    isError: (res) => !res.ok
  },
  {
    name: 'huggingface',
    label: 'Cloud Hugging Face (Tertiary)',
    model: process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct',
    buildUrl: () => `https://router.huggingface.co/v1/chat/completions`,
    buildHeaders: () => ({ 'Authorization': `Bearer ${getHfKey()}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt) => ({ model: process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 2048 }),
    parseResponse: async (res) => {
      const data = await res.json();
      if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
      throw new Error(data.error?.message || data.error || 'Hugging Face returned an empty response');
    },
    isRateLimit: (res) => res.status === 429 || res.status === 403,
    isError: (res) => !res.ok
  },
  {
    name: 'ollama',
    label: 'Local Ollama (Safe Fallback)',
    model: process.env.OLLAMA_MODEL || 'codellama',
    buildUrl: () => process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate',
    buildBody: (prompt) => ({ model: process.env.OLLAMA_MODEL || 'codellama', prompt, stream: false }),
    parseResponse: async (res) => {
      const data = await res.json();
      if (data.response) return data.response;
      throw new Error(data.error || 'Ollama returned an empty response');
    },
    isRateLimit: () => false,
    isError: (res) => !res.ok
  }
];

async function tryProvider(provider, prompt) {
  const url = provider.buildUrl();
  const body = provider.buildBody(prompt);
  const headers = provider.buildHeaders ? provider.buildHeaders() : { 'Content-Type': 'application/json' };

  const controller = new AbortController();
  const timeoutVal = provider.name === 'ollama' ? 300000 : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutVal);

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    clearTimeout(timeout);

    if (provider.isRateLimit(res)) return { success: false, error: 'rate_limited', provider: provider.name };
    if (provider.isError(res)) {
      const errBody = await res.text();
      return { success: false, error: `http_${res.status}`, detail: errBody, provider: provider.name };
    }

    const text = await provider.parseResponse(res);
    return { success: true, data: text, provider: provider.name };

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return { success: false, error: 'timeout', provider: provider.name };
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') return { success: false, error: 'connection_failed', provider: provider.name };
    return { success: false, error: err.message, provider: provider.name };
  }
}

// ===== NON-STREAMING CHAT =====
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required' });

  let lastError = null;

  for (const provider of PROVIDERS) {
    let maxAttempts = 1;
    if (provider.name === 'gemini') maxAttempts = Math.max(1, geminiKeys.length);
    else if (provider.name === 'nvidia') maxAttempts = Math.max(1, nvidiaKeys.length);
    else if (provider.name === 'huggingface') maxAttempts = Math.max(1, hfKeys.length);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Router] Trying ${provider.label} (Attempt ${attempt}/${maxAttempts})...`);
      const result = await tryProvider(provider, prompt);
      if (result.success) return res.json({ success: true, provider: result.provider, response: result.data });
      lastError = result;
      if (attempt < maxAttempts) {
        console.log(`[Router] ${provider.label} attempt ${attempt} failed with ${result.error}. Retrying with next key...`);
        continue;
      }
      console.log(`[Router] ${provider.label} failed: ${result.error}${result.detail ? ' — ' + result.detail.slice(0, 200) : ''} — cycling to next provider...`);
    }
  }

  return res.status(503).json({ success: false, error: 'All providers exhausted', lastError: lastError?.error, message: 'All AI providers are currently unavailable. Please try again later.' });
});

// ===== STREAMING CHAT (SSE) =====
app.post('/api/chat/stream', async (req, res) => {
  const { prompt, provider: preferredProvider } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  activeStreams.add(res);
  req.on('close', () => { activeStreams.delete(res); });

  const writeChunk = (chunk) => { try { res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`); } catch (e) {} };
  const writeError = (err) => {
    try {
      res.write(`data: ${JSON.stringify({ error: err.message || String(err) })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (e) {}
  };

  let lastError = null;
  const providersToTry = preferredProvider
    ? [PROVIDERS.find(p => p.name === preferredProvider), ...PROVIDERS.filter(p => p.name !== preferredProvider)].filter(Boolean)
    : PROVIDERS;

  for (const provider of providersToTry) {
    let maxAttempts = 1;
    if (provider.name === 'gemini') maxAttempts = Math.max(1, geminiKeys.length);
    else if (provider.name === 'nvidia') maxAttempts = Math.max(1, nvidiaKeys.length);
    else if (provider.name === 'huggingface') maxAttempts = Math.max(1, hfKeys.length);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Router] Streaming via ${provider.label} (Attempt ${attempt}/${maxAttempts})...`);

      try {
        const url = provider.buildUrl();
        const body = provider.buildBody(prompt);
        const headers = provider.buildHeaders ? provider.buildHeaders() : { 'Content-Type': 'application/json' };

        const controller = new AbortController();
        const timeoutVal = provider.name === 'ollama' ? 300000 : 60000;
        const timeout = setTimeout(() => controller.abort(), timeoutVal);

        let fetchUrl = url;
        if (provider.name === 'gemini') fetchUrl = url.replace(':generateContent', ':streamGenerateContent') + '&alt=sse';

        const response = await fetch(fetchUrl, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
        clearTimeout(timeout);

        if (provider.isRateLimit(response)) {
          lastError = { error: 'rate_limited', provider: provider.name };
          console.log(`[Router] ${provider.label} rate limited, trying next...`);
          continue;
        }
        if (provider.isError(response)) {
          const errBody = await response.text().catch(() => '');
          lastError = { error: `http_${response.status}`, detail: errBody, provider: provider.name };
          console.log(`[Router] ${provider.label} error ${response.status}, trying next...`);
          continue;
        }

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
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              try {
                let chunk = '';
                if (provider.name === 'gemini') { const parsed = JSON.parse(dataStr); chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''; }
                else { const parsed = JSON.parse(dataStr); chunk = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''; }
                if (chunk) writeChunk(chunk);
              } catch (e) {}
            }
          }
        }

        writeChunk('[DONE]');
        try { res.write(`data: ${JSON.stringify({ done: true, provider: provider.name })}\n\n`); res.end(); } catch (e) {}
        return;

      } catch (err) {
        if (err.name === 'AbortError') lastError = { error: 'timeout', provider: provider.name };
        else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') lastError = { error: 'connection_failed', provider: provider.name };
        else lastError = { error: err.message, provider: provider.name };
        console.log(`[Router] ${provider.label} attempt ${attempt} failed: ${lastError.error}`);
      }
    }
  }

  writeError(lastError?.error || 'All providers exhausted');
});

process.on('SIGTERM', () => { for (const stream of activeStreams) { try { stream.end(); } catch (e) {} } activeStreams.clear(); });

app.get('/api/status', (req, res) => {
  const config = PROVIDERS.map(p => ({
    name: p.name,
    label: p.label,
    model: p.model,
    configured: p.name === 'ollama' ? true : !!(
      p.name === 'gemini' ? (process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2) :
      p.name === 'nvidia' ? (process.env.NVIDIA_API_KEY_1 || process.env.NVIDIA_API_KEY_2) :
      p.name === 'huggingface' ? (process.env.HF_TOKEN_1 || process.env.HF_TOKEN_2) :
      process.env.GROQ_API_KEY
    )
  }));
  res.json({ status: 'online', providers: config });
});

app.listen(PORT, () => {
  console.log(`[AI Router] Engine running on port ${PORT}`);
  console.log(`[AI Router] Providers: ${PROVIDERS.map(p => p.label).join(' → ')}`);
});
