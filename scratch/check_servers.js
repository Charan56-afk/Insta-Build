const http = require('http');

function checkPort(port, path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ port, online: true, status: res.statusCode, body: body.slice(0, 200) });
      });
    }).on('error', (err) => {
      resolve({ port, online: false, error: err.message });
    });
  });
}

async function main() {
  console.log('Checking local servers...');
  const runnerStatus = await checkPort(3001, '/status');
  const routerStatus = await checkPort(3002, '/api/status');
  console.log('Runner on 3001:', runnerStatus);
  console.log('Router on 3002:', routerStatus);
}

main();
