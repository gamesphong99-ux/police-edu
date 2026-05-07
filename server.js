const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;
const PARENT_FOLDER_ID = '1TGIQwMeSO1Jv-_74cBS5h818jmHWr5EL';
const CACHE_TTL = 5 * 60 * 1000;

const cache = {};   // { key: { data, ts } }

function getCache(key) {
  const c = cache[key];
  return c && Date.now() - c.ts < CACHE_TTL ? c.data : null;
}
function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

function getDrive() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// ── Month maps ───────────────────────────────────────────
const MONTHS_FULL = {
  'มกราคม':'ม.ค.','กุมภาพันธ์':'ก.พ.','มีนาคม':'มี.ค.','เมษายน':'เม.ย.',
  'พฤษภาคม':'พ.ค.','มิถุนายน':'มิ.ย.','กรกฎาคม':'ก.ค.','สิงหาคม':'ส.ค.',
  'กันยายน':'ก.ย.','ตุลาคม':'ต.ค.','พฤศจิกายน':'พ.ย.','ธันวาคม':'ธ.ค.',
};
const MONTH_NUM = {
  'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,
  'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12,
};

function parseFilename(filename) {
  // normalize double sara-e  เเ → เ
  const name = filename.replace(/\.png$/i, '').trim().replace(/เเ/g, 'เ');

  const sessionMatch = name.match(/\((เช้า(?:-บ่าย)?|ภาคเช้า|ภาคบ่าย|บ่าย)\)/);
  const subjectMatch = name.match(/วิชา\s*(.+)$/);
  const session = sessionMatch ? sessionMatch[1] : '';
  const subject = subjectMatch ? subjectMatch[1].trim() : name;

  let day = '', date = '', monthAbbr = '', sortKey = 0;

  // Pattern 1 — full Thai month: "(วันที่ )DD FullMonth YYYY"
  const m1 = name.match(/(?:วันที่\s+)?(\d+)\s+([฀-๿]+)\s+(\d{4})/);
  if (m1) {
    day = m1[1];
    const mFull = m1[2];
    monthAbbr = MONTHS_FULL[mFull] || mFull;
    date = `${day} ${mFull} ${m1[3]}`;
    const yr = parseInt(m1[3]);
    const mo = MONTH_NUM[monthAbbr] || 0;
    sortKey = yr * 10000 + mo * 100 + parseInt(day);
  } else {
    // Pattern 2 — abbreviated month: "(วันที่ )DD Abbr. (YY|YYYY)"
    // handles: มี.ค.69  /  มี.ค. 69  /  มี.ค. 2569
    const m2 = name.match(/(?:วันที่\s+)?(\d+)\s+([฀-๿]+\.[฀-๿]*\.?)\s*(\d{2,4})/);
    if (m2) {
      day = m2[1];
      monthAbbr = m2[2].endsWith('.') ? m2[2] : m2[2] + '.';
      const yearRaw = m2[3];
      const year = yearRaw.length <= 2 ? `25${yearRaw}` : yearRaw;
      date = `${day} ${monthAbbr} ${year}`;
      const yr = parseInt(year);
      const mo = MONTH_NUM[monthAbbr] || 0;
      sortKey = yr * 10000 + mo * 100 + parseInt(day);
    }
  }

  return { date, day, monthAbbr, sortKey, session, subject };
}

// ── Static files ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/courses ─────────────────────────────────────
app.get('/api/courses', async (req, res) => {
  const cacheKey = 'courses';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const drive = getDrive();
    const result = await drive.files.list({
      q: `'${PARENT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      pageSize: 50,
    });
    const courses = result.data.files.map(f => ({ id: f.id, name: f.name }));
    setCache(cacheKey, courses);
    res.json(courses);
  } catch (err) {
    console.error('courses error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/lessons?courseId=xxx ────────────────────────
app.get('/api/lessons', async (req, res) => {
  const folderId = req.query.courseId;
  if (!folderId) return res.status(400).json({ error: 'courseId required' });

  const cacheKey = `lessons_${folderId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const drive = getDrive();
    const result = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'name',
      pageSize: 200,
    });
    const lessons = result.data.files
      .map(f => ({ id: f.id, ...parseFilename(f.name) }))
      .filter(l => l.day);
    setCache(cacheKey, lessons);
    res.json(lessons);
  } catch (err) {
    console.error('lessons error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/image/:fileId ───────────────────────────────
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
    console.error('image error:', err.message);
    res.status(404).send('Not found');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
