// ============================================================
// ROZGARX - routes/admin.js
// Full Admin Panel API
// ============================================================
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { broadcastNotification } = require('./notifications');

// ─── ADMIN LOGIN ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password, totp } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE username=$1', [username]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const admin = result.rows[0];
    const validPass = await bcrypt.compare(password, admin.password_hash);
    if (!validPass) return res.status(401).json({ error: 'Invalid credentials' });

    // 2FA verification
    if (admin.totp_secret) {
      if (!totp) return res.status(400).json({ error: '2FA code required', requires_2fa: true });
      const valid2fa = speakeasy.totp.verify({
        secret: admin.totp_secret,
        encoding: 'base32',
        token: totp,
        window: 1
      });
      if (!valid2fa) return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    const token = jwt.sign(
      { adminId: admin.id },
      process.env.JWT_ADMIN_SECRET,
      { expiresIn: '8h' }
    );
    await pool.query('UPDATE admin_users SET last_login=NOW() WHERE id=$1', [admin.id]);
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ALL ROUTES BELOW REQUIRE ADMIN AUTH ─────────────────────
router.use(authenticateAdmin);

// ─── DASHBOARD ANALYTICS ─────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [users, activeUsers, premiumUsers, jobs, todayJobs, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COUNT(*) FROM users WHERE subscription_status='premium'"),
      pool.query('SELECT COUNT(*) FROM jobs WHERE is_verified=true'),
      pool.query("SELECT COUNT(*) FROM jobs WHERE created_at > CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE status='active'")
    ]);

    res.json({
      total_users: parseInt(users.rows[0].count),
      active_users_30d: parseInt(activeUsers.rows[0].count),
      premium_users: parseInt(premiumUsers.rows[0].count),
      total_jobs: parseInt(jobs.rows[0].count),
      today_jobs: parseInt(todayJobs.rows[0].count),
      total_revenue_paise: parseInt(revenue.rows[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── JOB MANAGEMENT ──────────────────────────────────────────
// List all jobs (including unverified)
router.get('/jobs', async (req, res) => {
  const { page = 1, limit = 30, verified, featured } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let conditions = [];
  let params = [];

  if (verified !== undefined) {
    conditions.push(`is_verified=$${params.length + 1}`);
    params.push(verified === 'true');
  }
  if (featured !== undefined) {
    conditions.push(`is_featured=$${params.length + 1}`);
    params.push(featured === 'true');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT id, title, department, category, state, last_date,
              is_verified, is_featured, is_fake_flagged, source_name, created_at
       FROM jobs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add job manually
router.post('/jobs', async (req, res) => {
  const {
    title, department, organization, category, state, vacancies,
    salary_min, salary_max, salary_text, qualification, age_min, age_max,
    application_fee, last_date, apply_url, pdf_url, short_description,
    full_description, selection_process, exam_pattern, syllabus_url
  } = req.body;

  if (!title || !apply_url) return res.status(400).json({ error: 'Title and apply_url required' });
  try {
    const result = await pool.query(
      `INSERT INTO jobs (title, department, organization, category, state, vacancies,
       salary_min, salary_max, salary_text, qualification, age_min, age_max,
       application_fee, last_date, apply_url, pdf_url, short_description,
       full_description, selection_process, exam_pattern, syllabus_url, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true)
       RETURNING id`,
      [title, department, organization, category || 'government', state || 'All India',
       vacancies, salary_min, salary_max, salary_text, qualification, age_min, age_max,
       application_fee, last_date, apply_url, pdf_url, short_description,
       full_description, selection_process, exam_pattern, syllabus_url]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Job created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit job
router.put('/jobs/:id', async (req, res) => {
  const fields = Object.keys(req.body).filter(k =>
    ['title','department','organization','category','state','vacancies','salary_min',
     'salary_max','salary_text','qualification','age_min','age_max','application_fee',
     'last_date','apply_url','pdf_url','short_description','full_description',
     'selection_process','is_featured','is_verified','is_fake_flagged'].includes(k)
  );
  if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });

  const setClause = fields.map((f, i) => `${f}=$${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);
  try {
    await pool.query(
      `UPDATE jobs SET ${setClause}, updated_at=NOW() WHERE id=$${values.length + 1}`,
      [...values, req.params.id]
    );
    res.json({ message: 'Job updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete job
router.delete('/jobs/:id', async (req, res) => {
  await pool.query('DELETE FROM jobs WHERE id=$1', [req.params.id]);
  res.json({ message: 'Job deleted' });
});

// Approve scraped job
router.put('/jobs/:id/approve', async (req, res) => {
  await pool.query('UPDATE jobs SET is_verified=true WHERE id=$1', [req.params.id]);
  res.json({ message: 'Job approved' });
});

// Feature/Pin job
router.put('/jobs/:id/feature', async (req, res) => {
  const { featured } = req.body;
  await pool.query('UPDATE jobs SET is_featured=$1 WHERE id=$2', [featured, req.params.id]);
  res.json({ message: featured ? 'Job featured' : 'Job unfeatured' });
});

// ─── USER MANAGEMENT ─────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { page = 1, limit = 30, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = '';
  let params = [];

  if (search) {
    where = `WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
    params.push(`%${search}%`);
  }
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, subscription_status, is_blocked, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/block', async (req, res) => {
  const { blocked } = req.body;
  await pool.query('UPDATE users SET is_blocked=$1 WHERE id=$2', [blocked, req.params.id]);
  res.json({ message: blocked ? 'User blocked' : 'User unblocked' });
});

router.delete('/users/:id', async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ message: 'User deleted' });
});

// ─── BROADCAST NOTIFICATIONS ──────────────────────────────────
router.post('/notifications/broadcast', async (req, res) => {
  const { title, body, filter } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
  try {
    const count = await broadcastNotification(title, body, filter || {});
    res.json({ message: `Sent to ${count} users` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDY MATERIAL MANAGEMENT ───────────────────────────────
router.post('/study', async (req, res) => {
  const { title, type, exam_type, file_url, thumbnail_url, is_premium } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO study_material (title, type, exam_type, file_url, thumbnail_url, is_premium)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, type, exam_type, file_url, thumbnail_url, is_premium || false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/study/:id', async (req, res) => {
  await pool.query('DELETE FROM study_material WHERE id=$1', [req.params.id]);
  res.json({ message: 'Material deleted' });
});

// ─── REVENUE ANALYTICS ───────────────────────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        plan,
        COUNT(*) as count,
        SUM(amount) as total_paise
      FROM subscriptions
      WHERE status='active'
      GROUP BY month, plan
      ORDER BY month DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
