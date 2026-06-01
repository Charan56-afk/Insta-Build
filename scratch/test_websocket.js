const http = require('http');

const req = http.request({
    port: 3001,
    host: 'localhost',
    headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13'
    },
    path: '/deploy/cooler/socket.io/?EIO=4&transport=websocket'
});

req.on('response', (res) => {
    console.log('HTTP Response Status:', res.statusCode);
    res.on('data', (chunk) => console.log('Response Body:', chunk.toString()));
    res.on('end', () => process.exit(0));
});

req.on('upgrade', (res, socket, upgradeHead) => {
    console.log('Successfully upgraded to WebSocket! Connection verified.');
    socket.destroy();
    process.exit(0);
});

req.on('error', (err) => {
    console.error('Upgrade request failed:', err.message);
    process.exit(1);
});

req.end();
