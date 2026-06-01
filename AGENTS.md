# AI Failover Router Engine Project Rules

## Core System Architecture
We are building a resilient, backend web-app routing engine that safely multiplexes prompt requests across multiple cloud APIs, using local Ollama as a zero-cost fallback anchor.

## Multi-AI Rotator Rules
- **Sequential Priority List:** Cloud Gemini (Primary) ➔ Cloud Groq (Secondary) ➔ Local Ollama (Ultimate Safe Fallback).
- **Graceful Failover Execution:** If a cloud provider returns an error state, a connection breakdown, or an HTTP `429 Too Many Requests` (Rate Limit) exception, the routing block must catch it immediately with a standard try-catch interceptor.
- **Silent Multi-Threading:** The fallback execution must cycle smoothly to the next active provider indexing slot. The frontend application user must not face terminal crashes or broken hanging connections during the failover event.
- **Local Fallback Target:** The final failover tier connects to Ollama running locally at `http://127.0.0.1:11434/api/generate` utilizing a lightweight coding model execution.

## Code Standards
- Built using JavaScript/Node.js or Python/Flask backends.
- Use environment variables (`.env`) to store cloud provider authorization headers and keys securely.
- Ensure CORS middleware is enabled so our web interface components can call the gateway route flawlessly.
