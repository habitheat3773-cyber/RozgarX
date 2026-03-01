require('dotenv').config({ path: '../../.env' });
const pool = require('./database');

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(15) UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  qualification VARCHAR(50) DEFAULT 'graduate',
  preferred_job_type VARCHAR(20) DEFAULT 'both',
  preferred_states TEXT[] DEFAULT '{}',
  preferred_categories TEXT[] DEFAULT '{}',
  fcm_token VARCHAR(500),
  subscription_status VARCHAR(20) DEFAULT 'free',
  subscription_end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  department VARCHAR(300),
  organization VARCHAR(300),
  job_type VARCHAR(20) DEFAULT 'government',
  category VARCHAR(50),
  state VARCHAR(100),
  vacancies INTEGER DEFAULT 0,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_text VARCHAR(200),
  qualification VARCHAR(100),
  age_limit VARCHAR(100),
  application_fee VARCHAR(200),
  last_date DATE,
  last_date_text VARCHAR(100),
  description TEXT,
  selection_process TEXT,
  exam_pattern TEXT,
  syllabus_url VARCHAR(1000),
  pdf_url VARCHAR(1000),
  apply_url VARCHAR(1000),
  official_website VARCHAR(500),
  source_url VARCHAR(1000),
  source_name VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  apply_count INTEGER DEFAULT 0,
  ai_summary TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Saved jobs table
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'job_alert',
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  govt_jobs BOOLEAN DEFAULT true,
  private_jobs BOOLEAN DEFAULT true,
  admit_cards BOOLEAN DEFAULT true,
  results BOOLEAN DEFAULT true,
  deadline_alerts BOOLEAN DEFAULT true,
  specific_departments TEXT[] DEFAULT '{}'
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(5) DEFAULT 'INR',
  payment_id VARCHAR(200),
  razorpay_order_id VARCHAR(200),
  status VARCHAR(20) DEFAULT 'pending',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Study material table
CREATE TABLE IF NOT EXISTS study_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50),
  exam_type VARCHAR(100),
  file_url VARCHAR(1000),
  thumbnail_url VARCHAR(1000),
  is_premium BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scraper logs table
CREATE TABLE IF NOT EXISTS scraper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(100),
  jobs_found INTEGER DEFAULT 0,
  jobs_added INTEGER DEFAULT 0,
  jobs_duplicate INTEGER DEFAULT 0,
  status VARCHAR(20),
  error_message TEXT,
  ran_at TIMESTAMP DEFAULT NOW()
);

-- Broadcast notifications table
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  target_audience VARCHAR(50) DEFAULT 'all',
  sent_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES admin_users(id),
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_qualification ON jobs(qualification);
CREATE INDEX IF NOT EXISTS idx_jobs_last_date ON jobs(last_date);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING gin(to_tsvector('english', title || ' ' || COALESCE(department, '') || ' ' || COALESCE(organization, '')));
`;

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running database migrations...');
    await client.query(migrations);
    console.log('✅ All migrations completed successfully!');
    
    // Create default admin user if not exists
    const bcrypt = require('bcryptjs');
    const adminPassword = 'Admin@123'; // Change this immediately!
    const hash = await bcrypt.hash(adminPassword, 12);
    
    await client.query(`
      INSERT INTO admin_users (username, email, password_hash)
      VALUES ('admin', 'admin@rozgarx.in', $1)
      ON CONFLICT (username) DO NOTHING
    `, [hash]);
    
    console.log('👤 Default admin created: admin / Admin@123');
    console.log('⚠️  CHANGE THE ADMIN PASSWORD IMMEDIATELY!');
    
  } catch (err) {
    console.error('❌ Migration error:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
