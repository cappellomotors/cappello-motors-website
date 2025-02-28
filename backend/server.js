const express = require('express');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
    console.log('Attempting to serve dealer-auction.html');
    res.sendFile(path.join(__dirname, '../dealer-auction.html'), (err) => {
        if (err) {
            console.error('Failed to serve file:', err);
            res.status(500).send('Server error: Unable to load auction page');
        }
    });
});

app.options('/signin', (req, res) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});

app.options('/place-bid', (req, res) => {
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
    console.log('Sign-in attempt:', req.body);
    const { email, password } = req.body || {};
    if (!email || !password) {
        console.log('Missing credentials');
        return res.status(400).json({ success: false, message: 'Missing email or password' });
    }
    const dealer = dealers.find(d => d.email === email);
    if (dealer && await bcrypt.compare(password, dealer.password)) {
        console.log('Sign-in successful:', email);
        res.json({ success: true });
    } else {
        console.log('Sign-in failed:', email);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/place-bid', (req, res) => {
    console.log('Bid received:', req.body);
    const { carId, bid } = req.body || {};
    if (!carId || !bid) {
        console.log('Missing bid data');
        return res.status(400).json({ success: false, message: 'Missing carId or bid' });
    }
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
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'init', auctions }));
    ws.on('message', (message) => console.log('WebSocket message:', message));
});

function broadcast(data) {
    console.log('Broadcasting:', data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

setInterval(() => {
    broadcast({ type: 'update', auctions });
}, 1000);