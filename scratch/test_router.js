async function testNonStreaming() {
  console.log("=== Testing Non-Streaming Route /api/chat ===");
  try {
    const res = await fetch('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Hello! Respond with exactly 'Router online!'"
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Non-streaming test failed:", err);
  }
}

async function testStreaming() {
  console.log("\n=== Testing Streaming Route /api/chat/stream ===");
  try {
    const res = await fetch('http://localhost:3002/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Hello! Respond with exactly 'Router streaming online!'"
      })
    });
    console.log("Status:", res.status);

    const reader = res.body.getReader();
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
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.text) {
              process.stdout.write(data.text);
            } else if (data.done) {
              console.log("\n[Done] Provider used:", data.provider);
            } else if (data.error) {
              console.log("\n[Error chunk]:", data.error);
            }
          } catch (e) {
            // Ignore parse errors for keep-alives or formatting
          }
        }
      }
    }
    console.log("Stream finished.");
  } catch (err) {
    console.error("Streaming test failed:", err);
  }
}

async function runTests() {
  await testNonStreaming();
  await testStreaming();
}

runTests().catch(console.error);
