const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory data stores with enriched seed data
const users = [
    { id: '1', email: 'alice@example.com', name: 'Alice Senior', provider: 'google', sub: '123456789', age: 72 },
    { id: '2', handle: 'fit_senior_88', name: 'Bob Fitness', provider: 'cinesocial', accountType: 'premium', age: 68 },
    { id: '3', email: 'charlie@silver.com', name: 'Charlie Health', provider: 'google', sub: '987654321', age: 75 },
    { id: '4', email: 'diana@wellness.com', name: 'Diana Active', provider: 'google', sub: '555666777', age: 65 },
    { id: '5', handle: 'yoga_master_jen', name: 'Jennifer Joy', provider: 'cinesocial', accountType: 'premium', age: 80 },
    { id: '6', email: 'frank@retired.com', name: 'Frank Runner', provider: 'google', sub: '111222333', age: 71 },
    { id: '7', handle: 'speedy_sam', name: 'Sam Silver', provider: 'cinesocial', accountType: 'standard', age: 69 }
];

const fitnessData = [
    { userId: '1', steps: 4230, heartRate: 72, waterIntake: 1.2, bloodPressure: '120/80', mobilityScore: 85 },
    { userId: '2', steps: 8500, heartRate: 68, waterIntake: 2.1, bloodPressure: '118/78', mobilityScore: 92 },
    { userId: '3', steps: 3100, heartRate: 75, waterIntake: 0.8, bloodPressure: '130/85', mobilityScore: 70 },
    { userId: '4', steps: 6000, heartRate: 70, waterIntake: 1.8, bloodPressure: '122/80', mobilityScore: 88 },
    { userId: '5', steps: 2500, heartRate: 65, waterIntake: 1.5, bloodPressure: '115/75', mobilityScore: 95 },
    { userId: '6', steps: 9200, heartRate: 64, waterIntake: 2.5, bloodPressure: '110/70', mobilityScore: 98 },
    { userId: '7', steps: 5100, heartRate: 74, waterIntake: 1.0, bloodPressure: '125/82', mobilityScore: 78 }
];

// Auth Endpoints
app.post('/api/auth/google', (req, res) => {
    const { sub, email, name } = req.body;
    let user = users.find(u => u.sub === sub || u.email === email);
    
    if (!user) {
        user = { id: Date.now().toString(), email, name, provider: 'google', sub, age: 65 };
        users.push(user);
    }
    res.status(200).json(user);
});

app.post('/api/auth/cinesocial', (req, res) => {
    const { handle, name, accountType } = req.body;
    let user = users.find(u => u.handle === handle);
    
    if (!user) {
        user = { id: Date.now().toString(), handle, name, provider: 'cinesocial', accountType, age: 65 };
        users.push(user);
    }
    res.status(200).json(user);
});

app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) res.status(200).json(user);
    else res.status(401).json({ error: 'User not found' });
});

app.post('/api/auth/signup', (req, res) => {
    const newUser = { id: Date.now().toString(), ...req.body };
    users.push(newUser);
    res.status(201).json(newUser);
});

// Dashboard Data Endpoint
app.get('/api/dashboard/:userId', (req, res) => {
    const data = fitnessData.find(f => f.userId === req.params.userId);
    if (data) {
        res.status(200).json(data);
    } else {
        res.status(404).json({ error: 'Data not found' });
    }
});

// New Endpoint: Update daily vital signs
app.post('/api/dashboard/:userId/update', (req, res) => {
    const { steps, heartRate, waterIntake, bloodPressure, mobilityScore } = req.body;
    let data = fitnessData.find(f => f.userId === req.params.userId);
    
    if (data) {
        if (steps) data.steps = steps;
        if (heartRate) data.heartRate = heartRate;
        if (waterIntake) data.waterIntake = waterIntake;
        if (bloodPressure) data.bloodPressure = bloodPressure;
        if (mobilityScore) data.mobilityScore = mobilityScore;
        res.status(200).json(data);
    } else {
        res.status(404).json({ error: 'User data profile not found' });
    }
});

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, () => {
    console.log(`SilverStride Backend running on port ${PORT}`);
    console.log(`Initialized with ${users.length} users and ${fitnessData.length} fitness records.`);
});