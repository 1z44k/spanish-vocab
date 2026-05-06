const express = require('express');
const cors = require('cors');
const https = require('https');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const API_KEY = process.env.ANTHROPIC_API_KEY;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      es TEXT NOT NULL,
      en TEXT NOT NULL,
      added BIGINT NOT NULL
    )
  `);
  console.log('Database ready');
}

app.get('/words', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM words ORDER BY added ASC');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/words', async (req, res) => {
  try {
    const { es, en, added } = req.body;
    await pool.query('INSERT INTO words (es, en, added) VALUES ($1, $2, $3)', [es, en, added]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/words/:es', async (req, res) => {
  try {
    await pool.query('DELETE FROM words WHERE es = $1', [req.params.es]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/translate', (req, res) => {
  const { word } = req.body;

  const prompt = `The user typed a Spanish word or conjugation: "${word}". If it is a verb conjugation, convert to the infinitive. Give a concise English translation, use "/" to separate multiple meanings. If slang, note it briefly. Return ONLY a JSON object with keys "es" and "en", both lowercase. No markdown, no extra text. Example: {"es":"correr","en":"to run"}`;

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      console.log('Anthropic response:', data);
      try {
        const json = JSON.parse(data);
        const text = json.content[0].text.trim();
        const parsed = JSON.parse(text);
        res.json(parsed);
      } catch(e) {
        console.log('Parse error:', e.message);
        res.status(500).json({ error: 'Failed to parse response' });
      }
    });
  });

  request.on('error', (e) => {
    console.log('Request error:', e.message);
    res.status(500).json({ error: e.message });
  });
  request.write(body);
  request.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initDB();
  console.log(`Server running on port ${PORT}`);
});