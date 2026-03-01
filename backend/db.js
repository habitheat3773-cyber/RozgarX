// ============================================================
// ROZGARX - db.js  (PostgreSQL via Supabase)
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('✅ DB connected'));
pool.on('error', (err) => console.error('❌ DB error:', err));

module.exports = pool;

// ============================================================
// DATABASE SCHEMA  (Run this in Supabase SQL editor)
// ============================================================
/*

-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(15) UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  qualification VARCHAR(50) DEFAULT 'graduate',
  state VARCHAR(50),
  category VARCHAR(10) DEFAULT 'GEN',
  job_preference VARCHAR(20) DEFAULT 'both',
  subscription_status VARCHAR(20) DEFAULT 'free',
  subscription_end TIMESTAMP,
  fcm_token TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- JOBS TABLE
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  department VARCHAR(300),
  organization VARCHAR(300),
  category VARCHAR(20) DEFAULT 'government',
  state VARCHAR(100) DEFAULT 'All India',
  vacancies INTEGER,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_text VARCHAR(200),
  qualification TEXT,
  age_min INTEGER,
  age_max INTEGER,
  application_fee VARCHAR(200),
  last_date DATE,
  notification_date DATE,
  selection_process TEXT,
  exam_pattern TEXT,
  syllabus_url TEXT,
  pdf_url TEXT,
  apply_url TEXT NOT NULL,
  source_url TEXT,
  source_name VARCHAR(100),
  short_description TEXT,
  full_description TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_fake_flagged BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SAVED JOBS
CREATE TABLE saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'job',
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- SUBSCRIPTIONS TABLE
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) DEFAULT 'free',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  payment_id VARCHAR(255),
  razorpay_order_id VARCHAR(255),
  amount INTEGER,
  currency VARCHAR(5) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- STUDY MATERIAL TABLE
CREATE TABLE study_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  type VARCHAR(50),
  exam_type VARCHAR(100),
  file_url TEXT,
  thumbnail_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OTP TABLE
CREATE TABLE otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(15),
  email VARCHAR(255),
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ADMIN USERS
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(255),
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_jobs_category ON jobs(category);
CREATE INDEX idx_jobs_state ON jobs(state);
CREATE INDEX idx_jobs_last_date ON jobs(last_date);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_is_featured ON jobs(is_featured);
CREATE INDEX idx_saved_jobs_user ON saved_jobs(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

*/
