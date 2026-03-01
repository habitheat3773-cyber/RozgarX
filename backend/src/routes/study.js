const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

// GET /api/study
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, exam_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const conditions = ['is_active = true'];
    const params = [];
    let paramIndex = 1;
    
    // Check if user is premium
    let isPremium = false;
    if (req.user) {
      const user = await pool.query(
        'SELECT subscription_status FROM users WHERE id = $1', [req.user.id]
      );
      isPremium = user.rows[0]?.subscription_status === 'premium';
    }
    
    if (!isPremium) {
      conditions.push('is_premium = false');
    }
    
    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    
    if (exam_type) {
      conditions.push(`exam_type ILIKE $${paramIndex++}`);
      params.push(`%${exam_type}%`);
    }
    
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT id, title, description, type, exam_type, file_url, thumbnail_url,
              is_premium, download_count, created_at
       FROM study_material
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );
    
    const count = await pool.query(
      `SELECT COUNT(*) FROM study_material ${whereClause}`,
      params.slice(0, -2)
    );
    
    res.json({
      materials: result.rows,
      total: parseInt(count.rows[0].count),
      is_premium: isPremium
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch study materials' });
  }
});

module.exports = router;
