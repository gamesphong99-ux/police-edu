const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;
const FOLDER_ID = '1HpjSU9TZbNMGottB94BUkVSLJ9sDHoJx';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let lessonsCache = null;
let cacheTime = 0;

function getDrive() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

function parseFilename(filename) {
  const name = filename.replace(/\.png$/i, '').trim();
  const dateMatch = name.match(/วันที่\s+(\d+)\s+([^\(]+)/);
  const sessionMatch = name.match(/\((เช้า|บ่าย)\)/);
  const subjectMatch = name.match(/วิชา\s+(.+)$/);
  const day = dateMatch ? dateMatch[1].trim() : '';
  const date = dateMatch ? `${dateMatch[1].trim()} ${dateMatch[2].trim()}` : name;
  const session = sessionMatch ? sessionMatch[1] : '';
  const subject = subjectMatch ? subjectMatch[1].trim() : name;
  return { date, day, session, subject };
}

app.use(express.static(path.join(__dirname, 'public')));

// List all lessons from Drive folder
app.get('/api/lessons', async (req, res) => {
  try {
    const now = Date.now();
    if (lessonsCache && now - cacheTime < CACHE_TTL) {
      return res.json(lessonsCache);
    }
    const drive = getDrive();
    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'name',
      pageSize: 200,
    });
    const lessons = result.data.files.map(f => ({
      id: f.id,
      ...parseFilename(f.name),
    })).filter(l => l.day);

    lessonsCache = lessons;
    cacheTime = now;
    res.json(lessons);
  } catch (err) {
    console.error('Drive API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy image from Drive (with 1-day cache)
app.get('/api/image/:fileId', async (req, res) => {
  try {
    const drive = getDrive();
    const file = await drive.files.get(
      { fileId: req.params.fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    file.data.pipe(res);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(404).send('Not found');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
