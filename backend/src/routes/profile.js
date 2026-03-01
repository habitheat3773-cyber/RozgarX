const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/profile ─────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.qualification, u.preferred_job_type,
              u.preferred_states, u.preferred_categories, u.subscription_status,
              u.subscription_end_date, u.created_at,
              np.govt_jobs, np.private_jobs, np.admit_cards, np.results,
              np.deadline_alerts, np.specific_departments,
              (SELECT COUNT(*) FROM saved_jobs WHERE user_id = u.id) as saved_count
       FROM users u
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── PUT /api/profile ─────────────────────────────────────────
router.put('/', authenticate, async (req, res) => {
  try {
    const { name, qualification, preferred_job_type, preferred_states, preferred_categories } = req.body;
    
    const result = await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        qualification = COALESCE($2, qualification),
        preferred_job_type = COALESCE($3, preferred_job_type),
        preferred_states = COALESCE($4, preferred_states),
        preferred_categories = COALESCE($5, preferred_categories),
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, email, phone, qualification, preferred_job_type, preferred_states, preferred_categories`,
      [name, qualification, preferred_job_type, preferred_states, preferred_categories, req.user.id]
    );
    
    res.json({ message: 'Profile updated', profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
