// ============================================================
// ROZGARX - routes/auth.js
// Authentication: Email, OTP, Google, JWT
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── HELPERS ─────────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendSMS = async (phone, otp) => {
  // MSG91 integration (free tier available)
  const url = `https://api.msg91.com/api/v5/otp`;
  await axios.post(url, {
    authkey: process.env.MSG91_AUTH_KEY,
    mobile: `91${phone}`,
    message: `Your RozgarX OTP is ${otp}. Valid for 5 minutes.`,
    otp: otp,
    sender: 'ROZGAX',
    template_id: process.env.MSG91_TEMPLATE_ID
  });
};

// ─── REGISTER WITH EMAIL ─────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, qualification, state } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, qualification, state)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, subscription_status`,
      [name, email.toLowerCase(), hash, qualification || 'graduate', state || 'All India']
    );
    const user = result.rows[0];
    const tokens = generateTokens(user.id);
    res.status(201).json({ user, ...tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LOGIN WITH EMAIL ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email=$1 AND is_blocked=false',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tokens = generateTokens(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEND OTP ─────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) return res.status(400).json({ error: 'Valid 10-digit phone required' });
  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      'INSERT INTO otps (phone, otp, expires_at) VALUES ($1,$2,$3)',
      [phone, otp, expiresAt]
    );
    await sendSMS(phone, otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// ─── VERIFY OTP ───────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });
  try {
    const result = await pool.query(
      `SELECT * FROM otps WHERE phone=$1 AND otp=$2 
       AND expires_at > NOW() AND is_used=false
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await pool.query('UPDATE otps SET is_used=true WHERE id=$1', [result.rows[0].id]);

    // Upsert user
    let userResult = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    let user;
    if (userResult.rows.length === 0) {
      const inserted = await pool.query(
        'INSERT INTO users (name, phone) VALUES ($1,$2) RETURNING *',
        [name || 'RozgarX User', phone]
      );
      user = inserted.rows[0];
    } else {
      user = userResult.rows[0];
    }
    const tokens = generateTokens(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GOOGLE LOGIN ─────────────────────────────────────────────
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'ID token required' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let userResult = await pool.query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2',
      [googleId, email]
    );
    let user;
    if (userResult.rows.length === 0) {
      const inserted = await pool.query(
        'INSERT INTO users (name, email, google_id) VALUES ($1,$2,$3) RETURNING *',
        [name, email, googleId]
      );
      user = inserted.rows[0];
    } else {
      user = userResult.rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, user.id]);
      }
    }
    const tokens = generateTokens(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// ─── REFRESH TOKEN ────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens(decoded.userId);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.json({ message: 'If email exists, reset link sent' });

    const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
    // Send via email service (nodemailer/SendGrid)
    console.log('Reset link:', resetLink); // Replace with actual email sending
    res.json({ message: 'Password reset link sent to email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, decoded.userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
