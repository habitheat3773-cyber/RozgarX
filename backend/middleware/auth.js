// ============================================================
// ROZGARX - middleware/auth.js
// JWT Authentication Middleware
// ============================================================

const jwt = require('jsonwebtoken');
const pool = require('../db');

// ─── USER AUTH ────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, name, email, phone, subscription_status, subscription_end, is_blocked FROM users WHERE id=$1',
      [decoded.userId]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    if (result.rows[0].is_blocked) return res.status(403).json({ error: 'Account suspended' });

    req.user = result.rows[0];
    // Check subscription validity
    if (req.user.subscription_status === 'premium') {
      if (req.user.subscription_end && new Date(req.user.subscription_end) < new Date()) {
        await pool.query("UPDATE users SET subscription_status='free' WHERE id=$1", [req.user.id]);
        req.user.subscription_status = 'free';
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── ADMIN AUTH ───────────────────────────────────────────────
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    const result = await pool.query(
      'SELECT id, username FROM admin_users WHERE id=$1',
      [decoded.adminId]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Admin not found' });

    // IP restriction for admin
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
    if (allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!allowedIPs.includes(clientIP)) {
        return res.status(403).json({ error: 'Access denied from this IP' });
      }
    }

    req.admin = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
};

// ─── PREMIUM GUARD ────────────────────────────────────────────
const requirePremium = (req, res, next) => {
  if (req.user.subscription_status !== 'premium') {
    return res.status(403).json({
      error: 'Premium subscription required',
      upgrade_url: '/api/subscription/plans'
    });
  }
  next();
};

module.exports = { authenticate, authenticateAdmin, requirePremium };
