function extractCode(text, language = 'html') {
    if (!text) return '';

    let cleaned = '';
    // Try to match a markdown code block for the language or js/javascript/html/css
    const regex = new RegExp('```(?:' + language + '|xml|javascript|js|css|html)?\\s*([\\s\\S]*?)\\s*```', 'i');
    const match = text.match(regex);
    if (match && match[1]) {
        cleaned = match[1].trim();
    } else if (language === 'html') {
        // If it is HTML, try to extract starting from <!DOCTYPE html or <html down to </html>
        const docIdx = text.toLowerCase().indexOf('<!doctype html');
        const htmlIdx = text.toLowerCase().indexOf('<html');
        const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
        if (startIdx !== -1) {
            const endIdx = text.toLowerCase().lastIndexOf('</html>');
            if (endIdx !== -1) {
                cleaned = text.slice(startIdx, endIdx + 7).trim();
            } else {
                cleaned = text.slice(startIdx).trim();
            }
        } else {
            // Fallback: strip leading/trailing code fences if they exist
            cleaned = text.trim();
            cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/i, '');
            cleaned = cleaned.replace(/```$/, '');
            cleaned = cleaned.trim();
        }
    } else {
        // Fallback: strip leading/trailing code fences if they exist
        cleaned = text.trim();
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/i, '');
        cleaned = cleaned.replace(/```$/, '');
        cleaned = cleaned.trim();
    }

    // Auto-sanitize incomplete/truncated HTML (unclosed script tags)
    if (language === 'html' && cleaned) {
        const lastScriptOpen = cleaned.lastIndexOf('<' + 'script');
        if (lastScriptOpen !== -1) {
            const lastScriptClose = cleaned.indexOf('</' + 'script>', lastScriptOpen);
            if (lastScriptClose === -1) {
                cleaned += '\n</' + 'script></body></html>';
            }
        }
    }

    return cleaned;
}

// Test cases
const tc1 = `Here is the app:
\`\`\`html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>
\`\`\``;

const tc2 = `\`\`\`html
<!DOCTYPE html>
<html>
<head><title>Truncated</title></head>
<body>
<script>
  console.log("hello");
`;

const tc3 = `<!DOCTYPE html>
<html>
<head><title>Raw HTML No Code Blocks</title></head>
<body><h1>Raw</h1></body>
</html>`;

const tc4 = ``;

console.log('TC1 length:', extractCode(tc1).length);
console.log('TC2 output:\n', extractCode(tc2));
console.log('TC3 length:', extractCode(tc3).length);
console.log('TC4 length:', extractCode(tc4).length);
