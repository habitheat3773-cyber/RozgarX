// ============================================================
// ROZGARX - routes/profile.js
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, qualification, state, category,
              job_preference, subscription_status, subscription_end, created_at
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
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

router.put('/fcm-token', async (req, res) => {
  const { fcmToken } = req.body;
  try {
    await pool.query('UPDATE users SET fcm_token=$1 WHERE id=$2', [fcmToken, req.user.id]);
    res.json({ message: 'FCM token updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
