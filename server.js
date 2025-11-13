// Minimal Express + Firebase Admin example (do NOT deploy serviceAccount to client)
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json'); // keep on server only
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const app = express();
app.use(bodyParser.json());

// Public endpoint to save enquiry (server validates)
app.post('/api/enquiries', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.studentName) return res.status(400).json({ message: 'Invalid payload' });
    data.submittedAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('enquiries').add(data);
    return res.json({ id: ref.id, token: data.tokenization || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected admin endpoints (use proper auth middleware in production)
app.get('/api/admin/submissions', async (req, res) => {
  try {
    const snaps = await db.collection('enquiries').orderBy('submittedAt', 'desc').limit(1000).get();
    const rows = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(3000, () => console.log('Server listening on :3000'));