const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/saved ───────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await pool.query(
      `SELECT j.id, j.title, j.department, j.organization, j.job_type, 
              j.vacancies, j.salary_text, j.last_date, j.last_date_text,
              j.qualification, j.state, j.tags, j.created_at, sj.saved_at
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       WHERE sj.user_id = $1 AND j.is_active = true
       ORDER BY sj.saved_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );
    
    const count = await pool.query(
      'SELECT COUNT(*) FROM saved_jobs WHERE user_id = $1', [req.user.id]
    );
    
    res.json({
      saved_jobs: result.rows,
      total: parseInt(count.rows[0].count)
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
});

// ─── POST /api/saved/:jobId ───────────────────────────────────
router.post('/:jobId', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check job exists
    const job = await pool.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    
    // Check subscription limit for free users
    const user = await pool.query('SELECT subscription_status FROM users WHERE id = $1', [req.user.id]);
    if (user.rows[0].subscription_status === 'free') {
      const savedCount = await pool.query('SELECT COUNT(*) FROM saved_jobs WHERE user_id = $1', [req.user.id]);
      if (parseInt(savedCount.rows[0].count) >= 10) {
        return res.status(403).json({ 
          error: 'Free plan limit reached. Upgrade to Premium for unlimited saves.',
          upgrade_required: true
        });
      }
    }
    
    await pool.query(
      'INSERT INTO saved_jobs (user_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, jobId]
    );
    
    res.json({ message: 'Job saved successfully' });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to save job' });
  }
});

// ─── DELETE /api/saved/:jobId ─────────────────────────────────
router.delete('/:jobId', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    await pool.query(
      'DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2',
      [req.user.id, jobId]
    );
    
    res.json({ message: 'Job removed from saved' });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove saved job' });
  }
});

module.exports = router;
