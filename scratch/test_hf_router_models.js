const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const token = process.env.HF_TOKEN_1;

async function testModel(model) {
    try {
        console.log(`Testing model: ${model}`);
        const url = `https://router.huggingface.co/hf-inference/v1/chat/completions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 50
            })
        });
        const data = await res.json().catch(() => null);
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, JSON.stringify(data).slice(0, 300));
    } catch (e) {
        console.error(`Failed:`, e);
    }
}

async function run() {
    const models = [
        'Qwen/Qwen2.5-Coder-32B-Instruct',
        'Qwen/Qwen2.5-Coder-7B-Instruct',
        'Qwen/Qwen2.5-14B-Instruct',
        'meta-llama/Llama-3.2-3B-Instruct',
        'meta-llama/Meta-Llama-3-8B-Instruct',
        'mistralai/Mistral-7B-Instruct-v0.3',
        'microsoft/Phi-3-mini-4k-instruct'
    ];
    for (const m of models) {
        await testModel(m);
        console.log('-----------------------------------');
    }
}

run();
