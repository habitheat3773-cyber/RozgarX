// ============================================================
// ROZGARX - routes/saved.js
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Save a job
router.post('/:jobId', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO saved_jobs (user_id, job_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.jobId]
    );
    res.json({ message: 'Job saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unsave a job
router.delete('/:jobId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2',
      [req.user.id, req.params.jobId]
    );
    res.json({ message: 'Job removed from saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all saved jobs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.title, j.department, j.organization, j.salary_text,
              j.last_date, j.category, j.state, s.saved_at
       FROM saved_jobs s
       JOIN jobs j ON j.id = s.job_id
       WHERE s.user_id=$1
       ORDER BY s.saved_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// ============================================================
// ROZGARX - routes/profile.js
// ============================================================
const profileRouter = express.Router();
profileRouter.use(authenticate);

profileRouter.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, phone, qualification, state, category,
            job_preference, subscription_status, subscription_end, created_at
     FROM users WHERE id=$1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
});

profileRouter.put('/', async (req, res) => {
  const { name, qualification, state, category, job_preference } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name=COALESCE($1,name), qualification=COALESCE($2,qualification),
       state=COALESCE($3,state), category=COALESCE($4,category),
       job_preference=COALESCE($5,job_preference), updated_at=NOW()
       WHERE id=$6 RETURNING id, name, email, qualification, state, category, job_preference`,
      [name, qualification, state, category, job_preference, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

profileRouter.put('/fcm-token', async (req, res) => {
  const { fcmToken } = req.body;
  await pool.query('UPDATE users SET fcm_token=$1 WHERE id=$2', [fcmToken, req.user.id]);
  res.json({ message: 'FCM token updated' });
});

profileRouter.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { savedRouter: router, profileRouter };
