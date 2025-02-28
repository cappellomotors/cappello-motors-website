const express = require('express');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
const port = 3000;

// Initial server check
console.log('Starting server with Node.js:', process.version);
console.log('Checking dependencies:');
console.log('express:', require('express').version || 'loaded');
console.log('ws:', require('ws').version || 'loaded');
console.log('bcrypt:', require('bcrypt').version || 'loaded');

// Middleware
app.use(express.json());
app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.url, 'Origin:', req.headers.origin);
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); // Explicit local origin
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
    console.log('Attempting to serve dealer-login.html from:', path.join(__dirname, '../dealer-login.html'));
    res.sendFile(path.join(__dirname, '../dealer-login.html'), (err) => {
        if (err) {
            console.error('Failed to serve dealer-login.html:', err.message, err.stack);
            res.status(500).send('Server error: Unable to load login page. Check terminal logs.');
        }
    });
});

app.get('/dealer-auction.html', (req, res) => {
    console.log('Attempting to serve dealer-auction.html from:', path.join(__dirname, '../dealer-auction.html'));
    res.sendFile(path.join(__dirname, '../dealer-auction.html'), (err) => {
        if (err) {
            console.error('Failed to serve dealer-auction.html:', err.message, err.stack);
            res.status(500).send('Server error: Unable to load auction page. Check terminal logs.');
        }
    });
});

app.options('/signin', (req, res) => {
    console.log('Handling OPTIONS preflight for /signin');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});

app.options('/place-bid', (req, res) => {
    console.log('Handling OPTIONS preflight for /place-bid');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});

const dealers = [
    { email: 'dealer1@cappellomotors.com', password: bcrypt.hashSync('password123', 10) }
];

let auctions = [
    { id: 1, name: '2021 BMW M5', currentBid: 55000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 2, name: '2020 Mercedes-Benz S-Class', currentBid: 65000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 3, name: '2019 Porsche 911 Turbo', currentBid: 95000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 4, name: '2022 Ford Mustang GT', currentBid: 40000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 5, name: '2023 Tesla Model X', currentBid: 85000, endTime: Date.now() + 24 * 60 * 60 * 1000 }
];

app.post('/signin', async (req, res) => {
    console.log('Sign-in POST received, body:', JSON.stringify(req.body));
    const { email, password } = req.body || {};
    if (!email || !password) {
        console.log('Sign-in failed: Missing credentials');
        return res.status(400).json({ success: false, message: 'Missing email or password' });
    }
    try {
        console.log('Validating credentials for:', email);
        const dealer = dealers.find(d => d.email === email);
        if (dealer) {
            const match = await bcrypt.compare(password, dealer.password);
            console.log('Password comparison result:', match);
            if (match) {
                console.log('Sign-in successful for:', email);
                res.json({ success: true, redirect: '/dealer-auction.html' });
            } else {
                console.log('Sign-in failed: Password mismatch for', email);
                res.status(401).json({ success: false, message: 'Invalid email or password' });
            }
        } else {
            console.log('Sign-in failed: Dealer not found', email);
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Sign-in error:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

app.post('/place-bid', (req, res) => {
    console.log('Bid POST received, body:', JSON.stringify(req.body));
    const { carId, bid } = req.body || {};
    if (!carId || !bid) {
        console.log('Bid failed: Missing data');
        return res.status(400).json({ success: false, message: 'Missing carId or bid' });
    }
    try {
        console.log('Processing bid for carId:', carId);
        const auction = auctions.find(a => a.id === carId);
        if (!auction) {
            console.log('Bid failed: Car not found', carId);
            return res.status(404).json({ success: false, message: 'Car not found' });
        }
        if (bid > auction.currentBid && auction.endTime > Date.now()) {
            auction.currentBid = bid;
            console.log('Bid successful:', { carId, bid });
            broadcast({ type: 'bid', carId, bid });
            res.json({ success: true, newBid: bid });
        } else {
            console.log('Bid failed:', { carId, bid });
            res.status(400).json({ success: false, message: 'Bid too low or auction ended' });
        }
    } catch (error) {
        console.error('Bid error:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected from:', ws._socket.remoteAddress);
    ws.send(JSON.stringify({ type: 'init', auctions }));
    ws.on('message', (message) => console.log('WebSocket message received:', message.toString()));
});

function broadcast(data) {
    console.log('Broadcasting data:', data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            console.log('Sent to client:', client._socket.remoteAddress);
        }
    });
}

setInterval(() => {
    broadcast({ type: 'update', auctions });
}, 1000);