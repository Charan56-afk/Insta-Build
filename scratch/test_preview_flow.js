const http = require('http');

const testHtml = '<html><body><h1>Test Preview ' + Date.now() + '</h1></body></html>';

const postData = JSON.stringify({ html: testHtml });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/preview',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('POST /api/preview Response Status:', res.statusCode);
    console.log('POST /api/preview Response Body:', body);
    
    // Now verify the GET /preview
    http.get('http://localhost:3001/preview', (getRes) => {
      let getBody = '';
      getRes.on('data', chunk => getBody += chunk);
      getRes.on('end', () => {
        console.log('GET /preview Response Status:', getRes.statusCode);
        console.log('GET /preview Content Type:', getRes.headers['content-type']);
        if (getBody === testHtml) {
          console.log('SUCCESS! Preview content matched perfectly.');
        } else {
          console.error('FAIL! Content mismatch.');
          console.error('Expected:', testHtml);
          console.error('Got:', getBody);
        }
      });
    }).on('error', (err) => {
      console.error('GET /preview failed:', err.message);
    });
  });
});

req.on('error', (err) => {
  console.error('POST /api/preview failed:', err.message);
});

req.write(postData);
req.end();
