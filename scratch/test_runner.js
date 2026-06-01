async function testStream() {
  console.log("Calling /api/ai/stream on local runner server...");
  const res = await fetch('http://localhost:3001/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Respond with exactly: 'Runner Ollama fallback works!'",
      provider: "ollama",
      model: "qwen2.5-coder:1.5b",
      maxTokens: 50
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
          const parsed = JSON.parse(line.slice(5).trim());
          if (parsed.text) {
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
}

testStream().catch(console.error);
