// ============================================================
// ROZGARX - scrapers/jobScraper.js
// RSS + AI-Powered Job Scraper (Legal: RSS feeds only)
// ============================================================

const Parser = require('rss-parser');
const axios = require('axios');
const pool = require('../db');
const { broadcastNotification } = require('../routes/notifications');

const parser = new Parser({
  customFields: { item: ['description', 'content:encoded'] }
});

// ─── RSS FEED SOURCES ─────────────────────────────────────────
const FEED_SOURCES = [
  {
    url: 'https://www.freejobalert.com/feed/',
    name: 'FreeJobAlert',
    category: 'government'
  },
  {
    url: 'https://www.sarkariresult.com/rss.xml',
    name: 'SarkariResult',
    category: 'government'
  },
  {
    url: 'https://www.employmentnews.gov.in/RSS/en-US/EmploymentNews.xml',
    name: 'Employment News',
    category: 'government'
  },
  {
    url: 'https://www.ncs.gov.in/Pages/JobSearch.aspx',  // NCS public jobs
    name: 'NCS Portal',
    category: 'private'
  }
];

// ─── AI SUMMARIZER via Google Gemini (free tier) ─────────────
const summarizeJob = async (text) => {
  if (!process.env.GEMINI_API_KEY || !text) return text?.substring(0, 300) || '';
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Summarize this job notification in 2-3 sentences, extracting: title, department, vacancies, last date, salary. Keep it simple and clear for job seekers in India. Text: ${text.substring(0, 2000)}`
          }]
        }]
      },
      { timeout: 10000 }
    );
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || text.substring(0, 300);
  } catch {
    return text.substring(0, 300);
  }
};

// ─── EXTRACT JOB DATA FROM RSS ITEM ──────────────────────────
const extractJobData = (item, sourceName, category) => {
  const text = item.content || item.contentSnippet || item.description || '';

  // Extract last date using regex
  const dateMatch = text.match(/last\s*date[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i) ||
                    text.match(/(\d{1,2}\s+\w+\s+\d{4})/i);

  // Extract vacancies
  const vacancyMatch = text.match(/(\d+)\s*(posts?|vacancies|seats)/i);

  // Extract salary
  const salaryMatch = text.match(/(?:rs\.?|₹)\s*([\d,]+)\s*(?:to|–|-)\s*(?:rs\.?|₹)?\s*([\d,]+)/i) ||
                      text.match(/salary[:\s]*([\d,]+)/i);

  // Extract qualification
  const qualMatch = text.match(/(10th|12th|graduate|diploma|iti|mba|btech|degree|post graduate)/i);

  // Extract state
  const stateMatch = text.match(/(andhra|assam|bihar|delhi|gujarat|haryana|karnataka|kerala|madhya pradesh|maharashtra|odisha|punjab|rajasthan|tamil|telangana|uttar pradesh|west bengal)/i);

  const lastDateStr = dateMatch ? dateMatch[1] : null;
  let lastDate = null;
  if (lastDateStr) {
    try {
      lastDate = new Date(lastDateStr.replace(/[-\/]/g, ' '));
      if (isNaN(lastDate.getTime())) lastDate = null;
    } catch { lastDate = null; }
  }

  return {
    title: item.title?.substring(0, 500) || 'Job Opening',
    department: item.creator || sourceName,
    organization: sourceName,
    category: category,
    state: stateMatch ? stateMatch[1] : 'All India',
    vacancies: vacancyMatch ? parseInt(vacancyMatch[1]) : null,
    salary_min: salaryMatch ? parseInt(salaryMatch[1]?.replace(/,/g, '')) : null,
    salary_max: salaryMatch && salaryMatch[2] ? parseInt(salaryMatch[2]?.replace(/,/g, '')) : null,
    qualification: qualMatch ? qualMatch[1] : null,
    last_date: lastDate ? lastDate.toISOString().split('T')[0] : null,
    apply_url: item.link || item.guid || '#',
    source_url: item.link,
    source_name: sourceName,
    raw_text: text,
    is_verified: false  // Admin must approve scraped jobs
  };
};

// ─── FAKE JOB DETECTOR ────────────────────────────────────────
const isFakeJob = (title, text) => {
  const fakeKeywords = [
    'without interview', 'guaranteed job', 'work from home daily earn',
    'no experience no qualification', 'earn lakhs', 'lottery',
    'diamond company', 'part time earn unlimited'
  ];
  const combined = (title + ' ' + text).toLowerCase();
  return fakeKeywords.some(kw => combined.includes(kw));
};

// ─── DEDUPLICATE CHECKER ──────────────────────────────────────
const isDuplicate = async (title, sourceUrl) => {
  const result = await pool.query(
    'SELECT id FROM jobs WHERE source_url=$1 OR (title ILIKE $2 AND created_at > NOW() - INTERVAL \'7 days\')',
    [sourceUrl, title]
  );
  return result.rows.length > 0;
};

// ─── MAIN SCRAPER FUNCTION ────────────────────────────────────
const scrapeSource = async (source) => {
  let newJobsCount = 0;
  try {
    console.log(`[SCRAPER] Fetching: ${source.name}`);
    const feed = await parser.parseURL(source.url);

    for (const item of feed.items.slice(0, 30)) { // Max 30 per source
      try {
        // Check duplicate
        if (await isDuplicate(item.title, item.link)) continue;

        const jobData = extractJobData(item, source.name, source.category);

        // Flag fake jobs
        if (isFakeJob(jobData.title, jobData.raw_text)) {
          jobData.is_fake_flagged = true;
        }

        // AI summarize
        jobData.short_description = await summarizeJob(jobData.raw_text);

        // Insert into DB
        await pool.query(
          `INSERT INTO jobs (title, department, organization, category, state, vacancies,
           salary_min, salary_max, qualification, last_date, apply_url, source_url,
           source_name, short_description, is_verified, is_fake_flagged)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            jobData.title, jobData.department, jobData.organization, jobData.category,
            jobData.state, jobData.vacancies, jobData.salary_min, jobData.salary_max,
            jobData.qualification, jobData.last_date, jobData.apply_url, jobData.source_url,
            jobData.source_name, jobData.short_description,
            jobData.is_verified, jobData.is_fake_flagged || false
          ]
        );
        newJobsCount++;

        // Delay between requests (be respectful)
        await new Promise(r => setTimeout(r, 2000));
      } catch (itemErr) {
        console.error(`[SCRAPER] Item error: ${itemErr.message}`);
      }
    }
    console.log(`[SCRAPER] ${source.name}: ${newJobsCount} new jobs`);
  } catch (err) {
    console.error(`[SCRAPER] Source ${source.name} failed: ${err.message}`);
  }
  return newJobsCount;
};

// ─── RUN ALL SCRAPERS ─────────────────────────────────────────
const runAllScrapers = async () => {
  let totalNew = 0;
  for (const source of FEED_SOURCES) {
    totalNew += await scrapeSource(source);
    await new Promise(r => setTimeout(r, 5000)); // 5 sec between sources
  }

  // Notify users if new jobs found
  if (totalNew > 0) {
    await broadcastNotification(
      '🆕 New Job Alerts!',
      `${totalNew} new job notifications added. Check RozgarX now!`,
      { type: 'new_jobs' }
    ).catch(err => console.error('Notification error:', err.message));
  }

  console.log(`[SCRAPER] Total new jobs this run: ${totalNew}`);
  return totalNew;
};

// ─── DEADLINE ALERT CRON (runs daily at 8 AM) ─────────────────
const sendDeadlineAlerts = async () => {
  try {
    const result = await pool.query(`
      SELECT title, last_date, last_date - CURRENT_DATE as days_left
      FROM jobs
      WHERE last_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3
        AND is_verified=true AND is_fake_flagged=false
    `);

    if (result.rows.length > 0) {
      const titles = result.rows.map(j => j.title.substring(0, 50)).slice(0, 3).join(', ');
      await broadcastNotification(
        '⚠️ Last Date Approaching!',
        `Applications closing soon: ${titles}... Don't miss out!`,
        { type: 'deadline' }
      );
    }
  } catch (err) {
    console.error('[DEADLINE] Alert error:', err.message);
  }
};

module.exports = { runAllScrapers, sendDeadlineAlerts, scrapeSource };
