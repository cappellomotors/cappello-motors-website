const express = require('express');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('../')); // Serve files from parent directory

// Mock dealer database
const dealers = [
    { email: 'dealer1@cappellomotors.com', password: bcrypt.hashSync('password123', 10) }
];

// Auction data
let auctions = [
    { id: 1, name: '2021 BMW M5', currentBid: 55000, endTime: Date.now() + 3 * 24 * 60 * 60 * 1000 },
    { id: 2, name: '2020 Mercedes-Benz S-Class', currentBid: 65000, endTime: Date.now() + 4 * 24 * 60 * 60 * 1000 },
    { id: 3, name: '2019 Porsche 911 Turbo', currentBid: 95000, endTime: Date.now() + 5 * 24 * 60 * 60 * 1000 },
    { id: 4, name: '2022 Ford Mustang GT', currentBid: 40000, endTime: Date.now() + 3.5 * 24 * 60 * 60 * 1000 },
    { id: 5, name: '2023 Tesla Model X', currentBid: 85000, endTime: Date.now() + 4.5 * 24 * 60 * 60 * 1000 }
];

// Sign-in endpoint
app.post('/signin', async (req, res) => {
    console.log('Sign-in attempt:', req.body);
    const { email, password } = req.body;
    const dealer = dealers.find(d => d.email === email);
    if (dealer && await bcrypt.compare(password, dealer.password)) {
        console.log('Sign-in successful:', email);
        res.json({ success: true });
    } else {
        console.log('Sign-in failed:', email);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Bid endpoint
app.post('/place-bid', (req, res) => {
    console.log('Bid received:', req.body);
    const { carId, bid } = req.body;
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
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ type: 'init', auctions }));
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