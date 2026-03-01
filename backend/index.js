// ============================================================
// ROZGARX BACKEND - index.js
// Node.js + Express API Server
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts.' }
});
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ─── ROUTES ─────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/jobs',         require('./routes/jobs'));
app.use('/api/saved',        require('./routes/saved'));
app.use('/api/profile',      require('./routes/profile'));
app.use('/api/study',        require('./routes/study'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/admin',        require('./routes/admin'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ─── CRON JOBS ───────────────────────────────────────────────
const scraper = require('./scrapers/jobScraper');

// Run scraper every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Starting job scrape at', new Date().toISOString());
  try {
    await scraper.runAllScrapers();
    console.log('[CRON] Scrape complete');
  } catch (err) {
    console.error('[CRON] Scrape error:', err.message);
  }
});

// ─── ERROR HANDLER ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 RozgarX API running on port ${PORT}`));

module.exports = app;
