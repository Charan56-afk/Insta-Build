async function testGeneration() {
  const idea = "TechMarketFinder";
  const prompt = `You are a principal frontend engineer. Generate a beautiful, production-ready, fully interactive, single-file HTML/CSS/JS web application for: "${idea}".

Follow these CRITICAL engineering rules to make it look and feel like a high-end, premium application (similar to v0 or Lovable):
1. MODERN TECH STACK & COMPONENTS:
   - Include Tailwind CSS CDN: \`<script src="https://cdn.tailwindcss.com"></script>\` in the \`<head>\` of your document for styling.
   - Include Lucide Icons CDN: \`<script src="https://unpkg.com/lucide@latest"></script>\` to render clean, modern icons. Initialize them using \`lucide.createIcons()\` whenever the DOM updates.
   - Use Google Fonts (e.g., "Plus Jakarta Sans", "Inter", or "Outfit") for premium typography.
2. BACKEND INTEGRATION: The backend server runs on "http://localhost:3000". Declare a constant \`const BACKEND_URL = window.location.pathname.startsWith('/deploy/') ? window.location.pathname.split('/').slice(0, 3).join('/') : 'http://localhost:3000';\` at the top of your script. You MUST prefix every fetch call with this URL (e.g., \`fetch(\`\${BACKEND_URL}/api/items\`)\`). Relative paths like \`fetch('/api/...')\` will fail.
3. CENTRAL STATE MANAGEMENT & REAL-TIME DOM SYNC:
   - Design the application architecture around a single, centralized \`state\` object (e.g., \`let state = { items: [], user: null, activeTab: 'dashboard', filters: {} }\`).
   - Implement rendering function(s) (e.g., \`render()\` or specific modular renderers like \`renderItems()\`) that update the HTML DOM elements directly based on the contents of the \`state\` object.
   - Any user action (button click, form submit, deletion, tab switch) MUST modify the state first, then trigger the render function to sync the UI in real-time.
4. ROBUST BACKEND-RESILIENT FALLBACK (OFFLINE MODE):
   - Wrap all network fetch calls to \`BACKEND_URL\` in try-catch interceptors.
   - If a fetch request fails (e.g., network error, backend offline, timeout, or non-ok status), catch the error, show a brief, elegant toast/alert notification (e.g. "Backend offline - using offline mode"), but CRITICALLY: **proceed with updating the local state and rendering the DOM changes anyway**.
   - This ensures all buttons (Add, Delete, Edit, Toggle) remain 100% workable and responsive in the preview sandbox even if the runner backend is offline.
5. NO PLACEHOLDERS OR incomplete JS:
   - Every single button, form submission, input field, and modal action must have a complete, fully implemented JavaScript handler.
   - Absolutely no comments like "// TODO: implement delete" or "// business logic goes here". Write all JS code completely.
6. LAND DIRECTLY ON DASHBOARD BY DEFAULT (MOCK SIGN-IN):
   - CRITICAL: Log the user in by default in your centralized \`state\` (e.g. \`state.user = { name: "John Smith", email: "john.smith@example.com", avatar: "" }\`) so they land directly on the fully-populated interactive dashboard.
   - Do NOT lock or hide the main application dashboard behind the authentication screen initially.
   - Include a functional "Sign out" button on the dashboard that clears \`state.user\` and shows a beautiful centered Authentication Card (with tabs to switch between "Sign in" and "Create account", Google/CineSocial login options, seed credentials helper text, and a "⚡ Quick Demo Login" button to log back in instantly).
   - This ensures the application is immediately open and fully workable in the sandbox preview.
7. PREMIUM VISUAL DESIGN, INTERACTIVE GRAPHICS & MEDIA:
   - Use a modern, cohesive dashboard layout (e.g., a sleek sidebar navigation panel on the left, a top header bar with search/profile details, and a spacious grid area for content).
   - If the dashboard displays metrics, analytics, or charts, represent them using fully custom, responsive SVGs (with hover states, grids, lines) or canvas elements that dynamically redraw/update when the underlying state updates, rather than static placeholders.
   - Apply a beautiful theme with balanced colors (deep slates/indigo accent, rich dark modes, or clean glassmorphic panels using Tailwind classes like \`backdrop-blur-md\`, \`bg-white/70\`, \`border-white/20\`).
   - Add hover transformations, scale micro-animations on interactive cards, and smooth CSS transitions on all active states.
   - Populate all views with detailed, context-specific example data. Use high-quality image URLs from Unsplash (e.g. https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=400&h=300).
8. CONCISE HTML & STATE-DRIVEN DATA POPULATION (CRITICAL TO PREVENT CODE TRUNCATION):
   - To prevent the generated code from exceeding output token limits and getting truncated (which causes missing \`</script>\` tags and syntax errors), do NOT write hundreds of lines of repetitive, hardcoded HTML elements (like listing multiple identical table rows, lists, or card grids in HTML).
   - Keep the initial HTML structure skeletal. Put all seed/example data records in your JavaScript \`state\` arrays, and dynamically generate and inject the HTML DOM elements (like lists, tables, grids) using JS loops/renders on page load.
   - This keeps the file compact and ensures that the entire code, including the final scripts and closing tags, is generated fully without truncation.
9. STRICT SIZE LIMIT: Keep the entire generated HTML file concise, under 300 lines of total code. Avoid verbose Tailwind structures or heavy inline SVGs. Focus on core interactivity first.
10. CODE QUALITY: Start directly with <!DOCTYPE html> and write clean, commented code.`;

  console.log("Requesting stream from runner on port 3001...");
  const res = await fetch('http://localhost:3001/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      maxTokens: 8192
    })
  });

  console.log("Status:", res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const parsed = JSON.parse(line.slice(5).trim());
          if (parsed.text) {
            fullText += parsed.text;
            process.stdout.write(parsed.text);
          } else {
            console.log("\n[Status Message]:", parsed);
          }
        } catch (e) {
          console.log("\n[Error parsing line]:", line);
        }
      }
    }
  }
  console.log("\nStream finished.");
  console.log("Generated text length:", fullText.length);
}

testGeneration().catch(console.error);
