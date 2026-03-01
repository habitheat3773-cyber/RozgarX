// ============================================================
// ROZGARX - routes/jobs.js
// Full Jobs API: List, Filter, Search, Trending, Details
// ============================================================

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// ─── GET ALL JOBS (with filters & pagination) ─────────────────
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      state,
      qualification,
      salary_min,
      salary_max,
      job_type, // sc/st/obc/gen
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = ['j.is_fake_flagged = false', 'j.is_verified = true'];
    let params = [];
    let paramIdx = 1;

    if (category) {
      conditions.push(`j.category = $${paramIdx++}`);
      params.push(category);
    }
    if (state && state !== 'All India') {
      conditions.push(`(j.state = $${paramIdx++} OR j.state = 'All India')`);
      params.push(state);
    }
    if (qualification) {
      conditions.push(`j.qualification ILIKE $${paramIdx++}`);
      params.push(`%${qualification}%`);
    }
    if (salary_min) {
      conditions.push(`j.salary_min >= $${paramIdx++}`);
      params.push(parseInt(salary_min));
    }
    if (salary_max) {
      conditions.push(`j.salary_max <= $${paramIdx++}`);
      params.push(parseInt(salary_max));
    }
    if (search) {
      conditions.push(`(j.title ILIKE $${paramIdx} OR j.department ILIKE $${paramIdx} OR j.organization ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Deadline filter: only show active jobs
    conditions.push(`(j.last_date IS NULL OR j.last_date >= CURRENT_DATE - INTERVAL '3 days')`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSortCols = ['created_at', 'last_date', 'salary_max', 'view_count'];
    const sortCol = validSortCols.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT j.id, j.title, j.department, j.organization, j.category,
             j.state, j.vacancies, j.salary_min, j.salary_max, j.salary_text,
             j.qualification, j.age_min, j.age_max, j.last_date,
             j.short_description, j.apply_url, j.pdf_url, j.is_featured,
             j.view_count, j.created_at
      FROM jobs j
      ${whereClause}
      ORDER BY j.is_featured DESC, j.${sortCol} ${sortOrder}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(parseInt(limit), offset);

    const countQuery = `SELECT COUNT(*) FROM jobs j ${whereClause}`;
    const [jobsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      jobs: jobsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET TRENDING JOBS ────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, department, organization, category, state,
             vacancies, salary_text, last_date, view_count, is_featured
      FROM jobs
      WHERE is_verified=true AND is_fake_flagged=false
        AND (last_date IS NULL OR last_date >= CURRENT_DATE)
      ORDER BY view_count DESC, created_at DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET LATEST JOBS ──────────────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, department, organization, category, state,
             vacancies, salary_text, last_date, created_at
      FROM jobs
      WHERE is_verified=true AND is_fake_flagged=false
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET AI SUGGESTED JOBS (for logged in users) ──────────────
router.get('/suggested', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const result = await pool.query(`
      SELECT id, title, department, organization, category, state,
             vacancies, salary_text, last_date, qualification
      FROM jobs
      WHERE is_verified=true AND is_fake_flagged=false
        AND (last_date IS NULL OR last_date >= CURRENT_DATE)
        AND qualification ILIKE $1
        AND (state = $2 OR state = 'All India')
      ORDER BY is_featured DESC, created_at DESC
      LIMIT 15
    `, [`%${user.qualification || 'graduate'}%`, user.state || 'All India']);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEARCH JOBS ──────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query too short' });
  try {
    const result = await pool.query(`
      SELECT id, title, department, organization, category, state,
             salary_text, last_date, created_at
      FROM jobs
      WHERE is_verified=true AND is_fake_flagged=false
        AND (
          title ILIKE $1 OR 
          department ILIKE $1 OR 
          organization ILIKE $1 OR
          short_description ILIKE $1
        )
      ORDER BY is_featured DESC, created_at DESC
      LIMIT 30
    `, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET SINGLE JOB DETAIL ───────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jobs WHERE id=$1 AND is_fake_flagged=false`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    // Increment view count
    pool.query('UPDATE jobs SET view_count=view_count+1 WHERE id=$1', [req.params.id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPCOMING DEADLINES (jobs expiring in 3–7 days) ──────────
router.get('/alerts/deadlines', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, department, last_date,
             last_date - CURRENT_DATE AS days_left
      FROM jobs
      WHERE is_verified=true AND is_fake_flagged=false
        AND last_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY last_date ASC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
