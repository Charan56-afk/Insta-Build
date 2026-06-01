# ⚡ InstaBuild IDE

InstaBuild is a powerful, low-code agentic development environment that translates natural language ideas into full-stack web applications. It automates code generation, structures business plans, drafts pitch decks, and hosts deployments live, complete with a visual editor panel and an intelligent, self-healing AI Failover Routing Engine.

---

## 🚀 Key Features

* **AI Full-Stack Generator**: Enter a single prompt (e.g., *"fitness tracker for seniors"*) to instantly generate the **frontend (HTML)**, **backend (Node.js)**, **business plan**, **pitch deck**, and **landing page**.
* **Visual Editor & Style Controls**: Select any element in the live sandboxed preview and adjust styling attributes (padding, margins, gap, dimensions, and typography) with responsive pixel increment/decrement adjusters.
* **Failover AI Router Gateway**: Multiplexes and streams prompt completions across multiple API providers:
  1. **Cloud Gemini** (Primary Anchor)
  2. **Cloud Groq** (Secondary Failover)
  3. **Cloud Hugging Face / Anthropic** (Tertiary Tier)
  4. **Local Ollama** (Ultimate zero-cost local anchor running at `http://127.0.0.1:11434/api/generate`)
* **Real-time Deployment Engine**: Deploy generated sandboxes instantly to isolated runtime ports, complete with user session heartbeat tracking, active visitor counters, and request logs.
* **Hybrid Database Layer**: Seamless persistence for user profiles, templates, documents, and reviews. Connects automatically to **MongoDB Atlas** or dynamically switches to a local file-based database (`local_db.json`) if offline.
* **Integrated Review Board**: Standard sidebar workspace tab and mobile bottom-nav page to read and submit reviews directly to the database.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla JavaScript, CSS variables (responsive layout).
* **Backend Companion Runner**: Node.js, Express, Socket.IO, VM (In-process sandboxed sandbox runner), Mongoose (MongoDB).
* **Authentication**: Local email sign-up/login & Google OAuth integrations.
* **AI Engine**: Parallel race streams, failover interceptors, and local Ollama integrations.

---

## 📦 Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher recommended)
* Optional: **Ollama** running locally with coding models (e.g. `qwen2.5-coder`) for local offline fallback.

### Steps
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Charan56-afk/Insta-Build.git
   cd Insta-Build
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   # AI Provider API Keys
   GEMINI_API_KEY_1=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.0-flash
   
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=mixtral-8x7b-32768
   
   # Hugging Face Fallback Keys
   HF_TOKEN_1=your_hugging_face_token_here
   HF_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
   
   # Local Ollama Fallback
   OLLAMA_URL=http://127.0.0.1:11434/api/generate
   OLLAMA_MODEL=qwen2.5-coder:1.5b
   
   # Server Configuration
   RUNNER_PORT=3001
   AI_ROUTER_PORT=3002
   
   # MongoDB Connection
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/instabuild
   ```

4. **Start the Companion Runner & Server**:
   ```bash
   npm start
   ```
   *The builder IDE will be accessible at: **`http://localhost:3001`***

---

## 🧪 System Verification

To run a full diagnostics verification of all authentication routes, project management handlers, reviews persistence, and status APIs:
```bash
node scratch/verify_all.js
```

---

## 📄 License
This project is licensed under the MIT License.
