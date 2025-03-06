const express = require('express');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const path = require('path');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));
app.use((req, res, next) => {
    console.log('Request:', req.method, req.url);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/api/google-maps-key', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(500).json({ error: 'Missing Google Maps API key' });
    res.json({ key });
});

app.get('/api/chargers', async (req, res) => {
    const { location } = req.query;
    try {
        const apiKey = process.env.OPENCHARGEMAP_KEY;
        if (!apiKey) throw new Error('Missing OpenChargeMap API key');
        const url = `https://api.openchargemap.io/v3/poi/?output=json&key=${apiKey}&location=${encodeURIComponent(location || 'Shelby Township, MI')}&maxresults=50`;
        const response = await axios.get(url);
        const chargers = response.data.map(charger => ({
            name: charger.AddressInfo.Title,
            lat: charger.AddressInfo.Latitude,
            lng: charger.AddressInfo.Longitude,
            address: charger.AddressInfo.AddressLine1,
            status: charger.StatusType?.IsOperational ? 'Available' : 'Unavailable'
        }));
        res.json(chargers);
    } catch (error) {
        console.error('Charger fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch chargers: ' + error.message });
    }
});

const dealers = [{ email: 'dealer1@cappellomotors.com', password: bcrypt.hashSync('password123', 10) }];
let auctions = [
    { id: 1, name: '2021 BMW M5', currentBid: 55000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 2, name: '2020 Mercedes-Benz S-Class', currentBid: 65000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 3, name: '2019 Porsche 911 Turbo', currentBid: 95000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 4, name: '2022 Ford Mustang GT', currentBid: 40000, endTime: Date.now() + 24 * 60 * 60 * 1000 },
    { id: 5, name: '2023 Tesla Model X', currentBid: 85000, endTime: Date.now() + 24 * 60 * 60 * 1000 }
];

app.post('/signin', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Missing email or password' });
    try {
        const dealer = dealers.find(d => d.email === email);
        if (dealer && await bcrypt.compare(password, dealer.password)) {
            res.json({ success: true, redirect: '/dealer-auction.html' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/place-bid', (req, res) => {
    const { carId, bid } = req.body || {};
    if (!carId || !bid || isNaN(bid)) return res.status(400).json({ success: false, message: 'Invalid carId or bid' });
    try {
        const auction = auctions.find(a => a.id === carId);
        if (!auction) return res.status(404).json({ success: false, message: 'Car not found' });
        if (bid > auction.currentBid && auction.endTime > Date.now()) {
            auction.currentBid = bid;
            broadcast({ type: 'bid', carId, bid });
            res.json({ success: true, newBid: bid });
        } else {
            res.status(400).json({ success: false, message: 'Bid too low or auction ended' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'init', auctions }));
    ws.on('message', (message) => console.log('WebSocket message:', message.toString()));
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

setInterval(() => broadcast({ type: 'update', auctions }), 1000);