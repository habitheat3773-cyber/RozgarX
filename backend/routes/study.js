// ============================================================
// ROZGARX - routes/study.js
// Study Material: Papers, Syllabus, Mock Tests, GK
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requirePremium } = require('../middleware/auth');

// Get all study material (free items for everyone, premium for subscribers)
router.get('/', authenticate, async (req, res) => {
  try {
    const isPremium = req.user.subscription_status === 'premium';
    const result = await pool.query(
      `SELECT id, title, type, exam_type, thumbnail_url,
              is_premium, download_count, created_at,
              CASE WHEN is_premium AND $1=false THEN NULL ELSE file_url END as file_url
       FROM study_material
       ORDER BY created_at DESC`,
      [isPremium]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by type (previous_papers, syllabus, mock_test, gk, current_affairs)
router.get('/type/:type', authenticate, async (req, res) => {
  try {
    const isPremium = req.user.subscription_status === 'premium';
    const result = await pool.query(
      `SELECT id, title, type, exam_type, thumbnail_url, is_premium, download_count,
              CASE WHEN is_premium AND $1=false THEN NULL ELSE file_url END as file_url
       FROM study_material WHERE type=$2
       ORDER BY created_at DESC`,
      [isPremium, req.params.type]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download (increment counter + return URL)
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_material WHERE id=$1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const material = result.rows[0];
    if (material.is_premium && req.user.subscription_status !== 'premium') {
      return res.status(403).json({ error: 'Premium required for this material' });
    }

    pool.query('UPDATE study_material SET download_count=download_count+1 WHERE id=$1', [req.params.id]);
    res.json({ file_url: material.file_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
