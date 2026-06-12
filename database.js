import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'leads.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Helper functions to wrap sqlite3 methods in Promises
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Initial Mock Data (SAMPLE_LEADS) from app.js
const SEED_LEADS = [
  {
    id: "LD-9082",
    name: "Anand Mehta",
    email: "anand.mehta@mehtadevelopers.in",
    phone: "+91 98198 23456",
    propertyType: "4 BHK Luxury Penthouse",
    location: "Worli, Mumbai",
    budget: 24500000,
    aiScore: 94,
    status: "Qualified",
    createdAt: "2026-06-05T09:12:00Z",
    aiInsights: [
      "SBI pre-approval letter verified (₹2.5 Cr cap)",
      "Actively searching for a sea-facing high-rise with Sea Link views",
      "Ready to move in within 30 days",
      "95% match with property inventory in Worli Heights"
    ],
    details: {
      timeline: "Immediate (< 1 month)",
      mortgageApproved: true,
      agentAssigned: "Sarah Jenkins"
    }
  },
  {
    id: "LD-8924",
    name: "Deepa Krishnan",
    email: "deepa.krishnan@techventures.co.in",
    phone: "+91 98450 89041",
    propertyType: "Independent Villa",
    location: "Koramangala, Bangalore",
    budget: 120000000,
    aiScore: 88,
    status: "Qualified",
    createdAt: "2026-06-04T14:35:00Z",
    aiInsights: [
      "Highly interested in top-tier international school zones",
      "Requires minimum 4 BHK with a private lawn/garden",
      "Down payment of 25% secured in active savings account",
      "Responsive to WhatsApp chat updates within 10 minutes"
    ],
    details: {
      timeline: "1 - 3 months",
      mortgageApproved: true,
      agentAssigned: "Michael Thorne"
    }
  },
  {
    id: "LD-8711",
    name: "Rajesh Sharma",
    email: "rsharma@sharmaholdings.in",
    phone: "+91 98100 76234",
    propertyType: "3 BHK Builder Floor",
    location: "Vastu-compliant layout",
    budget: 8500000,
    aiScore: 72,
    status: "Warm",
    createdAt: "2026-06-03T11:20:00Z",
    aiInsights: [
      "Currently comparing independent builder floors vs. gated societies",
      "Flexible timeline: willing to wait for a Vastu-compliant layout",
      "Interested in solar power backup systems and 2 reserved car parkings"
    ],
    details: {
      timeline: "3 - 6 months",
      mortgageApproved: false,
      agentAssigned: "Sarah Jenkins"
    }
  },
  {
    id: "LD-8650",
    name: "Dr. Aditi Sen",
    email: "aditi.sen@apollohealth.org.in",
    phone: "+91 99309 12840",
    propertyType: "Spacious Farmhouse",
    location: "Rajpur Road, Dehradun",
    budget: 18500000,
    aiScore: 65,
    status: "Contacted",
    createdAt: "2026-06-02T16:45:00Z",
    aiInsights: [
      "Needs a home clinic/consulting chamber and private library room",
      "Requested broker walkthrough for the 1.5-acre plot on Rajpur Rd",
      "Pre-qualification is in progress with HDFC Bank home loans"
    ],
    details: {
      timeline: "1 - 3 months",
      mortgageApproved: false,
      agentAssigned: "Emma Watson"
    }
  },
  {
    id: "LD-8512",
    name: "Vikram Malhotra",
    email: "vikram.malhotra@retailgroup.co.in",
    phone: "+91 98721 48901",
    propertyType: "Duplex Apartment",
    location: "Gachibowli, Hyderabad",
    budget: 9800000,
    aiScore: 45,
    status: "Warm",
    createdAt: "2026-06-01T10:05:00Z",
    aiInsights: [
      "Has an existing property in Secunderabad to sell before buying",
      "Prefers high-ceilings and community club amenities",
      "High price sensitivity: looking for negotiate-friendly listings"
    ],
    details: {
      timeline: "6+ months",
      mortgageApproved: false,
      agentAssigned: "Michael Thorne"
    }
  },
  {
    id: "LD-8422",
    name: "Aarav Goel",
    email: "aarav.goel@goelcapital.in",
    phone: "+91 99112 30044",
    propertyType: "Luxury Row House",
    location: "Koregaon Park, Pune",
    budget: 45000000,
    aiScore: 98,
    status: "New",
    createdAt: "2026-06-05T11:00:00Z",
    aiInsights: [
      "High-value HNWI investor profile detected",
      "Interested in private splash pool and 24/7 gated security detail",
      "Funds certified by Kotak Mahindra Wealth Management",
      "Prefers immediate off-market developer disclosures"
    ],
    details: {
      timeline: "Immediate (< 1 month)",
      mortgageApproved: true,
      agentAssigned: "Sarah Jenkins"
    }
  },
  {
    id: "LD-8302",
    name: "Amit Singhal",
    email: "amit.singhal@singhalassociates.in",
    phone: "+91 98300 55501",
    propertyType: "Commercial Office Space",
    location: "Sector 62, Noida",
    budget: 15000000,
    aiScore: 32,
    status: "Cold",
    createdAt: "2026-05-28T08:30:00Z",
    aiInsights: [
      "Looking for general commercial lease market research reports only",
      "Low response rate to agent follow-up cold calls",
      "Unclear purchasing authority representing family-run business"
    ],
    details: {
      timeline: "Indefinite",
      mortgageApproved: false,
      agentAssigned: "Emma Watson"
    }
  }
];

// Initialize table and seed data
async function initializeDatabase() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        propertyType TEXT NOT NULL,
        location TEXT NOT NULL,
        budget INTEGER NOT NULL,
        aiScore INTEGER NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        timeline TEXT NOT NULL,
        mortgageApproved INTEGER NOT NULL,
        agentAssigned TEXT NOT NULL,
        aiInsights TEXT NOT NULL
      )
    `);
    console.log('Leads database table verified/created.');

    const countRow = await dbGet('SELECT COUNT(*) as count FROM leads');
    if (countRow.count === 0) {
      console.log('Database table is empty. Seeding initial mock data...');
      for (const lead of SEED_LEADS) {
        await insertLeadRaw(lead);
      }
      console.log('Database successfully seeded with', SEED_LEADS.length, 'leads.');
    }
  } catch (err) {
    console.error('Failed to initialize or seed database:', err);
  }
}

// Insert raw lead structure helper (used by seed)
async function insertLeadRaw(lead) {
  const query = `
    INSERT INTO leads (
      id, name, email, phone, propertyType, location, budget, 
      aiScore, status, createdAt, timeline, mortgageApproved, agentAssigned, aiInsights
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    lead.id,
    lead.name,
    lead.email,
    lead.phone,
    lead.propertyType,
    lead.location,
    lead.budget,
    lead.aiScore,
    lead.status,
    lead.createdAt,
    lead.details.timeline,
    lead.details.mortgageApproved ? 1 : 0,
    lead.details.agentAssigned,
    JSON.stringify(lead.aiInsights)
  ];
  await dbRun(query, params);
}

// Convert row to standard lead object format expected by UI
function mapRowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    propertyType: row.propertyType,
    location: row.location,
    budget: row.budget,
    aiScore: row.aiScore,
    status: row.status,
    createdAt: row.createdAt,
    aiInsights: JSON.parse(row.aiInsights),
    details: {
      timeline: row.timeline,
      mortgageApproved: row.mortgageApproved === 1,
      agentAssigned: row.agentAssigned
    }
  };
}

// EXPORTED API DATABASE INTERACTION METHODS

export async function getAllLeads() {
  const rows = await dbAll('SELECT * FROM leads ORDER BY aiScore DESC');
  return rows.map(mapRowToLead);
}

export async function getLeadById(id) {
  const row = await dbGet('SELECT * FROM leads WHERE id = ?', [id]);
  return mapRowToLead(row);
}

export async function createLead(lead) {
  await insertLeadRaw(lead);
  return lead;
}

export async function updateLeadStatus(id, status) {
  await dbRun('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
  return { success: true, updatedId: id, status };
}
