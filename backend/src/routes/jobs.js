const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

// ─── GET /api/jobs ────────────────────────────────────────────
// List jobs with filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,          // government | private
      qualification, // 10th | 12th | graduate | iti | diploma
      state,
      category,      // SC | ST | OBC | GEN | all
      salary_min,
      salary_max,
      search,
      sort = 'newest' // newest | deadline | featured
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['j.is_active = true'];
    const params = [];
    let paramIndex = 1;
    
    if (type) {
      conditions.push(`j.job_type = $${paramIndex++}`);
      params.push(type);
    }
    
    if (qualification) {
      conditions.push(`j.qualification ILIKE $${paramIndex++}`);
      params.push(`%${qualification}%`);
    }
    
    if (state) {
      conditions.push(`(j.state ILIKE $${paramIndex++} OR j.state = 'All India')`);
      params.push(`%${state}%`);
    }
    
    if (category) {
      conditions.push(`(j.category ILIKE $${paramIndex++} OR j.category = 'all')`);
      params.push(`%${category}%`);
    }
    
    if (salary_min) {
      conditions.push(`j.salary_min >= $${paramIndex++}`);
      params.push(parseInt(salary_min));
    }
    
    if (salary_max) {
      conditions.push(`j.salary_max <= $${paramIndex++}`);
      params.push(parseInt(salary_max));
    }
    
    if (search) {
      conditions.push(`(to_tsvector('english', j.title || ' ' || COALESCE(j.department, '') || ' ' || COALESCE(j.organization, '')) @@ plainto_tsquery('english', $${paramIndex++}))`);
      params.push(search);
    }
    
    const orderBy = {
      newest: 'j.created_at DESC',
      deadline: 'j.last_date ASC NULLS LAST',
      featured: 'j.is_featured DESC, j.is_pinned DESC, j.created_at DESC'
    }[sort] || 'j.created_at DESC';
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      params
    );
    
    // Data query
    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT j.id, j.title, j.department, j.organization, j.job_type, j.category,
              j.state, j.vacancies, j.salary_min, j.salary_max, j.salary_text,
              j.qualification, j.last_date, j.last_date_text, j.ai_summary,
              j.apply_url, j.pdf_url, j.is_featured, j.is_pinned, j.view_count,
              j.tags, j.created_at
       FROM jobs j
       ${whereClause}
       ORDER BY j.is_pinned DESC, ${orderBy}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      jobs: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (err) {
    console.error('Jobs list error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ─── GET /api/jobs/trending ───────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, department, organization, job_type, vacancies, 
              salary_text, last_date, last_date_text, view_count, tags, created_at
       FROM jobs 
       WHERE is_active = true AND last_date >= CURRENT_DATE
       ORDER BY view_count DESC, created_at DESC
       LIMIT 10`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending jobs' });
  }
});

// ─── GET /api/jobs/featured ───────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, department, organization, job_type, vacancies,
              salary_text, last_date, last_date_text, tags, created_at
       FROM jobs 
       WHERE is_active = true AND is_featured = true
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT 5`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured jobs' });
  }
});

// ─── GET /api/jobs/deadline-soon ─────────────────────────────
router.get('/deadline-soon', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, department, organization, job_type, vacancies,
              salary_text, last_date, last_date_text, tags, created_at
       FROM jobs 
       WHERE is_active = true 
         AND last_date >= CURRENT_DATE 
         AND last_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY last_date ASC
       LIMIT 10`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deadline-soon jobs' });
  }
});

// ─── GET /api/jobs/:id ────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Increment view count
    await pool.query('UPDATE jobs SET view_count = view_count + 1 WHERE id = $1', [id]);
    
    const result = await pool.query(
      `SELECT j.*,
              CASE WHEN sj.id IS NOT NULL THEN true ELSE false END as is_saved
       FROM jobs j
       LEFT JOIN saved_jobs sj ON j.id = sj.job_id AND sj.user_id = $2
       WHERE j.id = $1 AND j.is_active = true`,
      [id, req.user?.id || null]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({ job: result.rows[0] });
    
  } catch (err) {
    console.error('Job detail error:', err);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// ─── GET /api/jobs/stats/overview ────────────────────────────
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true) as total_active,
        COUNT(*) FILTER (WHERE job_type = 'government' AND is_active = true) as govt_jobs,
        COUNT(*) FILTER (WHERE job_type = 'private' AND is_active = true) as private_jobs,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_today,
        COUNT(*) FILTER (WHERE last_date >= CURRENT_DATE AND last_date <= CURRENT_DATE + INTERVAL '7 days') as closing_soon
      FROM jobs
    `);
    
    res.json({ stats: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
