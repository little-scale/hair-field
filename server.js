/**
 * Hair Field OSC Bridge Server
 * 
 * Bridges WebSocket messages from the browser to OSC output.
 * 
 * Usage:
 *   node server.js [--osc-host 127.0.0.1] [--osc-port 9000] [--http-port 8080]
 * 
 * The browser connects via WebSocket and sends JSON messages.
 * These are converted to OSC and sent to the specified host/port.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const dgram = require('dgram');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
    oscHost: '127.0.0.1',
    oscPort: 9000,
    httpPort: 8080
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--osc-host':
            config.oscHost = args[++i];
            break;
        case '--osc-port':
            config.oscPort = parseInt(args[++i]);
            break;
        case '--http-port':
            config.httpPort = parseInt(args[++i]);
            break;
        case '--help':
            console.log(`
Hair Field OSC Bridge Server

Usage: node server.js [options]

Options:
  --osc-host <host>    OSC destination host (default: 127.0.0.1)
  --osc-port <port>    OSC destination port (default: 9000)
  --http-port <port>   HTTP/WebSocket server port (default: 8080)
  --help               Show this help message

Example:
  node server.js --osc-port 8000 --http-port 3000
`);
            process.exit(0);
    }
}

// MIME types for serving static files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Create UDP socket for OSC output
const oscSocket = dgram.createSocket('udp4');

// OSC message encoding
function encodeOSCString(str) {
    const buf = Buffer.from(str + '\0');
    const padding = 4 - (buf.length % 4);
    return padding < 4 ? Buffer.concat([buf, Buffer.alloc(padding)]) : buf;
}

function encodeOSCFloat(val) {
    const buf = Buffer.alloc(4);
    buf.writeFloatBE(val, 0);
    return buf;
}

function encodeOSCInt(val) {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(val, 0);
    return buf;
}

function createOSCMessage(address, ...args) {
    // Build type tag string
    let typeTag = ',';
    for (const arg of args) {
        if (typeof arg === 'number') {
            typeTag += Number.isInteger(arg) ? 'i' : 'f';
        } else if (typeof arg === 'string') {
            typeTag += 's';
        }
    }
    
    // Encode address and type tag
    const parts = [
        encodeOSCString(address),
        encodeOSCString(typeTag)
    ];
    
    // Encode arguments
    for (const arg of args) {
        if (typeof arg === 'number') {
            if (Number.isInteger(arg)) {
                parts.push(encodeOSCInt(arg));
            } else {
                parts.push(encodeOSCFloat(arg));
            }
        } else if (typeof arg === 'string') {
            parts.push(encodeOSCString(arg));
        }
    }
    
    return Buffer.concat(parts);
}

function sendOSC(address, ...args) {
    try {
        const msg = createOSCMessage(address, ...args);
        oscSocket.send(msg, config.oscPort, config.oscHost);
    } catch (e) {
        console.error('OSC send error:', e.message);
    }
}

// Create HTTP server for static files
const httpServer = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`Client connected: ${clientIP}`);
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            
            // Get base address from message or use default
            const baseAddr = msg.address || '/hairfield';
            
            // Convert to OSC based on message type
            if (msg.type) {
                // Typed message format from hair-field
                switch (msg.type) {
                    case 'summary':
                        sendOSC(baseAddr + '/summary', 
                            msg.avgAmplitude, 
                            msg.maxAmplitude, 
                            msg.activity, 
                            msg.activeCount
                        );
                        break;
                    
                    case 'param':
                        sendOSC(baseAddr + '/param/' + msg.name, msg.value);
                        break;
                    
                    case 'gridAmplitude':
                        sendOSC(baseAddr + '/grid/amplitude', msg.resX, msg.resY, ...msg.values);
                        break;
                    
                    case 'gridPhase':
                        sendOSC(baseAddr + '/grid/phase', msg.resX, msg.resY, ...msg.values);
                        break;
                    
                    case 'gridAngle':
                        sendOSC(baseAddr + '/grid/angle', msg.resX, msg.resY, ...msg.values);
                        break;
                    
                    case 'gridCount':
                        sendOSC(baseAddr + '/grid/count', msg.resX, msg.resY, ...msg.values);
                        break;
                    
                    case 'amplitudes':
                        // Split into chunks if needed (OSC packets have size limits)
                        const ampChunkSize = 128;
                        for (let i = 0; i < msg.values.length; i += ampChunkSize) {
                            const chunk = msg.values.slice(i, i + ampChunkSize);
                            sendOSC(baseAddr + '/amplitudes', i, ...chunk);
                        }
                        break;
                    
                    case 'phases':
                        const phaseChunkSize = 128;
                        for (let i = 0; i < msg.values.length; i += phaseChunkSize) {
                            const chunk = msg.values.slice(i, i + phaseChunkSize);
                            sendOSC(baseAddr + '/phases', i, ...chunk);
                        }
                        break;
                    
                    case 'angles':
                        const angleChunkSize = 128;
                        for (let i = 0; i < msg.values.length; i += angleChunkSize) {
                            const chunk = msg.values.slice(i, i + angleChunkSize);
                            sendOSC(baseAddr + '/angles', i, ...chunk);
                        }
                        break;
                    
                    case 'impulse':
                        sendOSC(baseAddr + '/impulse', msg.strength);
                        break;
                    
                    case 'regenerated':
                        sendOSC(baseAddr + '/regenerated', msg.count);
                        break;
                    
                    case 'reset':
                        sendOSC(baseAddr + '/reset');
                        break;
                    
                    default:
                        // Generic fallback
                        sendOSC(baseAddr + '/' + msg.type, ...Object.values(msg).filter((v, k) => k !== 'type' && k !== 'address'));
                }
            } else if (msg.address && msg.args !== undefined) {
                // Direct OSC message format: { address: "/path", args: [1, 2, 3] }
                const args = Array.isArray(msg.args) ? msg.args : [msg.args];
                sendOSC(msg.address, ...args);
            }
        } catch (e) {
            console.error('Message parse error:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`Client disconnected: ${clientIP}`);
    });
    
    ws.on('error', (err) => {
        console.error(`WebSocket error: ${err.message}`);
    });
});

// Start server
httpServer.listen(config.httpPort, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║             Hair Field OSC Bridge Server                   ║
╠════════════════════════════════════════════════════════════╣
║  HTTP/WebSocket: http://localhost:${String(config.httpPort).padEnd(24)}║
║  OSC Output:     ${config.oscHost}:${String(config.oscPort).padEnd(27)}║
╚════════════════════════════════════════════════════════════╝

Open the URL above in your browser (or on iPad via local IP).
OSC messages will be forwarded to ${config.oscHost}:${config.oscPort}
`);
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    oscSocket.close();
    httpServer.close();
    process.exit(0);
});
