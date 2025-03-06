const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '../')));

// Google Maps API key endpoint
app.get('/api/google-maps-key', (req, res) => {
    res.json({ key: 'AIzaSyB7vyFC4HeuwqWXYcX804sq8QP-g4kXDdE' });
});

// EV Chargers endpoint using OpenChargeMap
app.get('/api/chargers', async (req, res) => {
    const location = req.query.location || 'Shelby Township, MI';
    const openChargeMapKey = 'b5ae75a9-c0c2-414c-9311-5c204f5672c5'; // Your key
    try {
        // Geocode location to lat/lng
        const geoResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=AIzaSyB7vyFC4HeuwqWXYcX804sq8QP-g4kXDdE`);
        const geoData = await geoResponse.json();
        if (geoData.status !== 'OK') throw new Error(`Geocoding failed: ${geoData.status}`);
        const { lat, lng } = geoData.results[0].geometry.location;

        // Fetch chargers from OpenChargeMap
        const response = await fetch(`https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lng}&maxresults=50&key=${openChargeMapKey}`);
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

// Start server
app.listen(10000, () => console.log('Server running on port 10000'));