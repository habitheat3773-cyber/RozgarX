const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Helper: generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, qualification, preferred_job_type } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    
    // Check existing user
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email || null, phone || null]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists with this email or phone' });
    }
    
    const password_hash = await bcrypt.hash(password, 12);
    
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, qualification, preferred_job_type) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, phone, qualification, preferred_job_type, subscription_status, created_at`,
      [name, email || null, phone || null, password_hash, qualification || 'graduate', preferred_job_type || 'both']
    );
    
    // Create default notification preferences
    await pool.query(
      'INSERT INTO notification_preferences (user_id) VALUES ($1)',
      [result.rows[0].id]
    );
    
    const user = result.rows[0];
    const token = generateToken(user);
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { ...user, password_hash: undefined }
    });
    
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        qualification: user.qualification,
        preferred_job_type: user.preferred_job_type,
        subscription_status: user.subscription_status,
        subscription_end_date: user.subscription_end_date
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/send-otp ──────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // In production: Send via MSG91 API
    // For now, we store OTP in a temp table or Redis
    // Demo: return OTP in response (NEVER in production!)
    
    // Store OTP (you'd use Redis in production, here using a simple in-memory approach)
    global.otpStore = global.otpStore || {};
    global.otpStore[phone] = { otp, expiresAt };
    
    console.log(`OTP for ${phone}: ${otp}`); // Remove in production!
    
    res.json({ 
      message: 'OTP sent successfully',
      // Remove this line in production:
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
    
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp, name, qualification } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }
    
    const storedOtp = global.otpStore?.[phone];
    
    if (!storedOtp || storedOtp.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    if (new Date() > storedOtp.expiresAt) {
      return res.status(400).json({ error: 'OTP expired' });
    }
    
    // Clear OTP
    delete global.otpStore[phone];
    
    // Find or create user
    let user = (await pool.query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
    
    if (!user) {
      const result = await pool.query(
        `INSERT INTO users (name, phone, qualification) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [name || 'User', phone, qualification || 'graduate']
      );
      user = result.rows[0];
      
      await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [user.id]);
    }
    
    const token = generateToken(user);
    
    res.json({
      message: 'OTP verified successfully',
      token,
      user: {
        id: user.id, name: user.name, phone: user.phone,
        email: user.email, qualification: user.qualification,
        subscription_status: user.subscription_status
      }
    });
    
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, qualification, preferred_job_type,
              preferred_states, preferred_categories, subscription_status, 
              subscription_end_date, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── POST /api/auth/update-fcm ───────────────────────────────
router.post('/update-fcm', authenticate, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    await pool.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [fcm_token, req.user.id]);
    res.json({ message: 'FCM token updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
});

module.exports = router;
