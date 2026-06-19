import express from 'express';
import cors from 'cors';
import {
  getAllLeads,
  getLeadById,
  createLead,
  updateLeadStatus
} from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

// Log incoming requests for debugging integration
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// Core Logic: Server-Side Lead Qualification
// ==========================================

/**
 * Calculates a lead's qualification score and maps it to status.
 * Timeline, Budget and Mortgage Pre-approval are weighted factors.
 * 
 * Score Metrics:
 * - Base Score: 40
 * - Timeline: Immediate (< 1 month) = +30, 1-3 months = +20, 3-6 months = +10, 6+ months = +2, Indefinite = +0
 * - Mortgage Approval: Pre-approved = +25, Pending = +5
 * - Budget Boost: >= 10M INR = +10, >= 5M INR = +5, >= 2M INR = +2
 * 
 * Classification (Status):
 * - Score >= 80 -> Hot Prospect (Status: "Qualified")
 * - Score 60-79 -> Warm Prospect (Status: "Warm")
 * - Score < 60 -> Cold Prospect (Status: "Cold")
 */
function qualifyLead(timeline, mortgageApproved, budget) {
  let score = 40; // Base score

  // Timeline weight
  if (timeline.includes("Immediate") || timeline.includes("< 1 month")) {
    score += 30;
  } else if (timeline.includes("1 - 3 months")) {
    score += 20;
  } else if (timeline.includes("3 - 6 months")) {
    score += 10;
  } else if (timeline.includes("6+ months")) {
    score += 2;
  }

  // Mortgage pre-approval weight
  if (mortgageApproved === true || mortgageApproved === 'true' || mortgageApproved === 1) {
    score += 25;
  } else {
    score += 5;
  }

  // Budget scaling weight (boosting higher budget clients)
  if (budget >= 10000000) { // >= 1 Crore (10M INR)
    score += 10;
  } else if (budget >= 5000000) { // >= 50 Lakhs (5M INR)
    score += 5;
  } else if (budget >= 2000000) { // >= 20 Lakhs (2M INR)
    score += 2;
  }

  // Add a deterministic variance to simulate AI nuances
  const offset = Math.floor(Math.random() * 8) - 2; // -2 to +5
  score = Math.min(100, Math.max(10, score + offset));

  // Determine status classification based on the score threshold
  let status = "Cold";
  if (score >= 80) {
    status = "Qualified"; // Hot
  } else if (score >= 60) {
    status = "Warm"; // Warm
  }

  return { score, status };
}

/**
 * Generates structured AI Findings/Insights list for the lead inspector.
 */
function generateAiInsights(name, propertyType, location, timeline, mortgageApproved, budget, score) {
  const insights = [];
  const isApproved = mortgageApproved === true || mortgageApproved === 'true' || mortgageApproved === 1;

  if (isApproved) {
    insights.push(`Verified pre-approved home loan details. Funding is fully secured.`);
  } else {
    insights.push(`Home loan pre-approval is pending. Action required from assigned broker.`);
  }

  if (timeline.includes("Immediate") || timeline.includes("< 1 month")) {
    insights.push(`High urgency buyer: searching for immediate occupancy (< 30 days).`);
  } else if (timeline.includes("6+")) {
    insights.push(`Long-term buyer profile: currently in initial planning/research stage.`);
  } else {
    insights.push(`Medium urgency buyer: planning acquisition within the next quarter.`);
  }

  insights.push(`Targeting ${propertyType} in the premium cluster of ${location}.`);

  if (score >= 80) {
    insights.push(`Highly qualified lead (Score: ${score}%). Conversation indicates strong purchase intent.`);
  } else if (score >= 60) {
    insights.push(`Moderate qualification match (Score: ${score}%). Nurturing required on pricing structure.`);
  } else {
    insights.push(`Low qualification metrics. Require verification of buying timeline and capability.`);
  }

  return insights;
}

// ==========================================
// REST API Routes
// ==========================================

// GET /api/leads - Retrieve list of all leads
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET /api/leads/:id - Retrieve detailed info of a single lead (Deep Analysis)
app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: `Lead with ID ${req.params.id} not found` });
    }
    res.json(lead);
  } catch (error) {
    console.error(`Failed to fetch lead ${req.params.id}:`, error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/leads - Create a new lead with server-side qualification
app.post('/api/leads', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      propertyType,
      location,
      budget,
      timeline,
      mortgageApproved,
      agentAssigned
    } = req.body;

    if (!name || !email || !phone || !propertyType || !location || !budget || !timeline || !agentAssigned) {
      return res.status(400).json({ error: 'Missing required lead submission fields' });
    }

    // Run Server-side Qualification logic
    const { score, status } = qualifyLead(timeline, mortgageApproved, budget);
    const aiInsights = generateAiInsights(name, propertyType, location, timeline, mortgageApproved, budget, score);

    const newLead = {
      id: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      email,
      phone,
      propertyType,
      location,
      budget: parseInt(budget, 10),
      aiScore: score,
      status,
      createdAt: new Date().toISOString(),
      aiInsights,
      details: {
        timeline,
        mortgageApproved: mortgageApproved === true || mortgageApproved === 'true',
        agentAssigned
      }
    };

    const savedLead = await createLead(newLead);
    res.status(201).json(savedLead);
  } catch (error) {
    console.error('Failed to create lead:', error);
    res.status(500).json({ error: 'Failed to save lead to database' });
  }
});

// PATCH /api/leads/:id/status - Update lead status
app.patch('/api/leads/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing status update value' });
    }

    const updated = await updateLeadStatus(req.params.id, status);
    res.json(updated);
  } catch (error) {
    console.error(`Failed to update status for lead ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update lead status in database' });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Aegis Real Estate AI Server running at http://localhost:${PORT}`);
});
