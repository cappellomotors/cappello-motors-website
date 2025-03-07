const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '../')));

// Google Maps API key endpoint
app.get('/api/google-maps-key', (req, res) => {
    res.json({ key: 'AIzaSyB7vyFC4HeuwqWXYcX804sq8QP-g4kXDdE' });
});

// EV Chargers endpoint using OpenChargeMap
app.get('/api/chargers', async (req, res) => {
    const location = req.query.location || 'Michigan';
    const openChargeMapKey = 'b5ae75a9-c0c2-414c-9311-5c204f5672c5';
    try {
        let url;
        if (location.toLowerCase() === 'michigan') {
            url = `https://api.openchargemap.io/v3/poi?output=json&countrycode=US&state=Michigan&maxresults=500&key=${openChargeMapKey}`;
        } else {
            const geoResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)},%20Michigan&key=AIzaSyB7vyFC4HeuwqWXYcX804sq8QP-g4kXDdE`);
            const geoData = await geoResponse.json();
            if (geoData.status !== 'OK') throw new Error(`Geocoding failed: ${geoData.status}`);
            const { lat, lng } = geoData.results[0].geometry.location;
            url = `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lng}&maxresults=500&distance=50&key=${openChargeMapKey}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('OpenChargeMap request failed');
        const data = await response.json();
        const chargers = data.map(charger => ({
            name: charger.AddressInfo.Title,
            lat: charger.AddressInfo.Latitude,
            lng: charger.AddressInfo.Longitude,
            address: charger.AddressInfo.AddressLine1,
            status: charger.StatusType?.IsOperational ? 'Available' : 'Unavailable'
        }));
        res.json(chargers);
    } catch (error) {
        console.error('Charger API error:', error.message);
        res.json([]);
    }
});

// Health check endpoint to ensure Render detects the service
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server with dynamic port
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});