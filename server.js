const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const API_KEY = process.env.ANTHROPIC_API_KEY;

app.post('/translate', (req, res) => {
  console.log('Request received:', req.body);
  const { word } = req.body;
  console.log('Word:', word);

  if (!word) {
    res.status(400).json({ error: 'No word provided' });
    return;
  }

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

app.listen(3000, () => console.log('Server running at http://localhost:3000'));