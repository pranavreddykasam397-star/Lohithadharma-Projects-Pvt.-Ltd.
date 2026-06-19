import os
import sqlite3
import random
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for communication with Vite React frontend
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads.db')

# ==========================================
# Database Initialization & Schema Definition
# ==========================================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create leads table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            plot_type TEXT NOT NULL,
            location TEXT NOT NULL,
            budget INTEGER NOT NULL,
            ai_score INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            timeline TEXT NOT NULL,
            token_paid BOOLEAN NOT NULL,
            agent_assigned TEXT NOT NULL
        )
    ''')
    
    # Create AI insights table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id TEXT NOT NULL,
            insight TEXT NOT NULL,
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    ''')
    
    # Check if database is empty to insert seeds
    cursor.execute("SELECT COUNT(*) FROM leads")
    if cursor.fetchone()[0] == 0:
        print("Pre-populating SQLite database with Red Sandalwood farmlands seed data...")
        seeds = [
            {
                "id": "LD-1001",
                "name": "Karthik Reddy",
                "email": "karthik.reddy@gmail.com",
                "phone": "+91 98765 43210",
                "plot_type": "1200 Sq. Yards Plot (100 Trees)",
                "location": "Kadapa Valley (Phase I & II)",
                "budget": 2400000,
                "ai_score": 94,
                "status": "Qualified",
                "created_at": "2026-06-12T09:12:00Z",
                "timeline": "Immediate (< 1 month)",
                "token_paid": True,
                "agent_assigned": "Sarah Jenkins",
                "insights": [
                    "Booking token advance of ₹2.4 Lakhs cleared successfully.",
                    "High interest in East-facing boundary plots in Kadapa Valley.",
                    "Customer requested soil health analysis and layout registration map.",
                    "Drip irrigation maintenance agreement signed."
                ]
            },
            {
                "id": "LD-1002",
                "name": "Dr. Amit Sharma",
                "email": "amit.sharma@outlook.com",
                "phone": "+91 99112 30044",
                "plot_type": "0.5 Acre Farmland (200 Trees)",
                "location": "Tirupati Foothills",
                "budget": 6000000,
                "ai_score": 88,
                "status": "Qualified",
                "created_at": "2026-06-14T14:35:00Z",
                "timeline": "1 - 3 months",
                "token_paid": True,
                "agent_assigned": "Michael Thorne",
                "insights": [
                    "Planning long-term retirement plantation holding.",
                    "Verified Down Payment (25%) is ready for stamp registration.",
                    "Highly responsive to call updates. Prefers Tirupati Foothills project.",
                    "Wants organic plantation monitoring access."
                ]
            },
            {
                "id": "LD-1003",
                "name": "Srinivas Naidu",
                "email": "srinivas.naidu@techcorp.in",
                "phone": "+91 98450 89041",
                "plot_type": "600 Sq. Yards Plot (50 Trees)",
                "location": "Chittoor Reserve",
                "budget": 1200000,
                "ai_score": 75,
                "status": "Warm",
                "created_at": "2026-06-15T11:20:00Z",
                "timeline": "1 - 3 months",
                "token_paid": False,
                "agent_assigned": "Emma Watson",
                "insights": [
                    "Interested in long-term tax benefits of agricultural forestry in AP.",
                    "Comparing Chittoor Reserve pricing structures against Kadapa Valley.",
                    "Registration intent is strong, but Down Payment is pending bank clearance."
                ]
            },
            {
                "id": "LD-1004",
                "name": "Ananya Sen",
                "email": "ananya.sen@retailgroup.co.in",
                "phone": "+91 98123 45678",
                "plot_type": "0.25 Acre Farmland (100 Trees)",
                "location": "Rayalaseema Orchards",
                "budget": 3000000,
                "ai_score": 68,
                "status": "Warm",
                "created_at": "2026-06-16T16:45:00Z",
                "timeline": "3 - 6 months",
                "token_paid": False,
                "agent_assigned": "Sarah Jenkins",
                "insights": [
                    "First-time agricultural land buyer researching managed agroforestry.",
                    "Requested a physical weekend site tour next month.",
                    "Interest indicated in Rayalaseema project. Needs support on passbook document."
                ]
            },
            {
                "id": "LD-1005",
                "name": "Venkat Prasad",
                "email": "venkat.prasad@yahoo.co.in",
                "phone": "+91 98300 55501",
                "plot_type": "1.0 Acre Farmland (400 Trees)",
                "location": "Nellore Greenlands",
                "budget": 12000000,
                "ai_score": 42,
                "status": "Cold",
                "created_at": "2026-06-10T10:05:00Z",
                "timeline": "6+ months",
                "token_paid": False,
                "agent_assigned": "Michael Thorne",
                "insights": [
                    "Inquired about wholesale red sandalwood export permissions.",
                    "Low response rate to follow-up call logs.",
                    "General investment study only; no immediate purchasing budget committed."
                ]
            }
        ]
        
        for lead in seeds:
            cursor.execute('''
                INSERT INTO leads (id, name, email, phone, plot_type, location, budget, ai_score, status, created_at, timeline, token_paid, agent_assigned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                lead["id"], lead["name"], lead["email"], lead["phone"],
                lead["plot_type"], lead["location"], lead["budget"],
                lead["ai_score"], lead["status"], lead["created_at"],
                lead["timeline"], lead["token_paid"], lead["agent_assigned"]
            ))
            for insight in lead["insights"]:
                cursor.execute('INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)', (lead["id"], insight))
                
        conn.commit()
    conn.close()

# ==========================================
# Core AI Business Logic: Lead Qualification
# ==========================================
def qualify_lead_score(timeline, token_paid, budget):
    score = 40  # Base Score
    
    # Timeline influence
    if "Immediate" in timeline or "< 1 month" in timeline:
        score += 30
    elif "1 - 3" in timeline:
        score += 20
    elif "3 - 6" in timeline:
        score += 10
    elif "6+" in timeline:
        score += 2
        
    # Down payment / Token advance contribution
    if token_paid:
        score += 25
    else:
        score += 5
        
    # Budget contribution (INR)
    if budget >= 10000000:    # >= 1 Crore
        score += 5
    elif budget >= 5000000:   # >= 50 Lakhs
        score += 3
        
    # Conversational variance
    offset = random.randint(-2, 5)
    score = min(100, max(10, score + offset))
    
    # Determine status stage
    status = "Cold"
    if score >= 80:
        status = "Qualified"
    elif score >= 60:
        status = "Warm"
        
    return score, status

def generate_insights_list(name, plot_type, location, timeline, token_paid, budget, score):
    insights = []
    
    if token_paid:
        insights.push("Verified booking token / registration down payment cleared.") if hasattr(insights, 'push') else insights.append("Verified booking token / registration down payment cleared.")
    else:
        insights.push("Down payment status is pending. Direct registration action required.") if hasattr(insights, 'push') else insights.append("Down payment status is pending. Direct registration action required.")
        
    if "Immediate" in timeline:
        insights.append("High urgency buyer planning immediate physical deed registration.")
    elif "6+" in timeline:
        insights.append("Long-term research profile currently assessing plantation returns.")
    else:
        insights.append("Urgency profile: planning land acquisition within this quarter.")
        
    insights.append(f"Targeting {plot_type} in the premium cluster of {location}.")
    
    if score >= 80:
        insights.append(f"Highly qualified investor profile (Score: {score}%). High intent detected.")
    elif score >= 60:
        insights.append(f"Moderate match (Score: {score}%). Needs call nurturing on maintenance options.")
    else:
        insights.append(f"Low match criteria (Score: {score}%). Require validation of budget capability.")
        
    return insights

# ==========================================
# Multilingual Audio Parsing (NLP & Regex Engine)
# ==========================================
def clean_transcript_for_investor(text):
    if not text:
        return ''
    lines = text.split('\n')
    investor_lines = []
    has_speaker_prefixes = False
    
    # Check if there are lines starting with Investor/Customer/Client/Caller/Ans/Buyer/A:
    for line in lines:
        if re.match(r'^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:', line, re.IGNORECASE):
            has_speaker_prefixes = True
            break
            
    if has_speaker_prefixes:
        for line in lines:
            if re.match(r'^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:', line, re.IGNORECASE):
                cleaned_line = re.sub(r'^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:\s*', '', line, flags=re.IGNORECASE)
                investor_lines.append(cleaned_line)
        return '\n'.join(investor_lines)
        
    # If no investor prefix but agent lines exist, filter out agent lines
    filtered_lines = []
    has_agent_prefixes = False
    for line in lines:
        if re.match(r'^\s*(?:agent|q|representative|sales|staff|host|employee)\s*:', line, re.IGNORECASE):
            has_agent_prefixes = True
            continue
        filtered_lines.append(line)
    if has_agent_prefixes:
        return '\n'.join(filtered_lines)
        
    return text

def parse_multilingual_transcript(text):
    # Setup default values
    name = None
    email = None
    budget = None
    location = None
    timeline = "1 - 3 months"
    token_paid = False
    
    cleaned_text = clean_transcript_for_investor(text)
    text_lower = cleaned_text.lower()
    full_text_lower = text.lower()
    
    # 1. Email Extraction
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    if email_match:
        email = email_match.group(0)
        
    # 2. Location matching (Lohitha Dharma projects)
    if "kadapa" in full_text_lower or "కడప" in full_text_lower or "कडपा" in full_text_lower:
        location = "Kadapa Valley (Phase I & II)"
    elif "tirupati" in full_text_lower or "తిరుపతి" in full_text_lower or "तिरुपति" in full_text_lower:
        location = "Tirupati Foothills"
    elif "chittoor" in full_text_lower or "చిత్తూరు" in full_text_lower or "चित्तूर" in full_text_lower:
        location = "Chittoor Reserve"
    elif "nellore" in full_text_lower or "నెల్లూరు" in full_text_lower or "नेलोर" in full_text_lower or "नेल्लूर" in full_text_lower:
        location = "Nellore Greenlands"
    elif "rayalaseema" in full_text_lower or "రాయలసీమ" in full_text_lower or "रायलसीमा" in full_text_lower:
        location = "Rayalaseema Orchards"
        
    # 3. Budget extraction (INR)
    num_matches = re.findall(r'\d+(?:\.\d+)?', full_text_lower)
    is_crore = any(x in full_text_lower for x in ["crore", "crores", "cr", "करोड़", "కోట్లు", "కోటి", "cr."])
    is_lakh = any(x in full_text_lower for x in ["lakh", "lakhs", "l", "लाख", "లక్షలు", "లక్ష", "l."])
    
    extracted_num = None
    if num_matches:
        for num_str in num_matches:
            val = float(num_str)
            if val < 500:
                extracted_num = val
                break
                
    if extracted_num is not None:
        if is_crore:
            budget = int(extracted_num * 10000000)
        elif is_lakh:
            budget = int(extracted_num * 100000)
        else:
            budget = int(extracted_num) if extracted_num > 10000 else int(extracted_num * 100000)
    else:
        # Check text words for numbers
        if "twenty five" in full_text_lower or "25" in full_text_lower or "పాతిక" in full_text_lower or "पच्चीस" in full_text_lower:
            budget = 2500000
        elif "forty" in full_text_lower or "40" in full_text_lower or "నలభై" in full_text_lower or "चालीस" in full_text_lower:
            budget = 4000000
        elif "seventy five" in full_text_lower or "75" in full_text_lower or "డెబ్బై ఐదు" in full_text_lower or "पचहत्तर" in full_text_lower:
            budget = 7500000
        elif "one point two" in full_text_lower or "1.2" in full_text_lower or "కోటి ఇరవై" in full_text_lower:
            budget = 12000000
        elif "sixty" in full_text_lower or "60" in full_text_lower or "అరవై" in full_text_lower or "साठ" in full_text_lower:
            budget = 6000000
        elif "twelve" in full_text_lower or "12" in full_text_lower or "పన్నెండు" in full_text_lower or "बारह" in full_text_lower:
            budget = 1200000
        else:
            budget = 2400000
            
    # 4. Name extraction
    name_patterns = [
        r"(?:my name is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"(?:मेरा नाम)\s+([^\s।]+(?:\s+[^\s।]+)?)(?:\s+है)?",
        r"(?:నా పేరు)\s+([^\s\.]+(?:\s+[^\s\.]+)?)"
    ]
    
    # Try cleaned text first
    for pattern in name_patterns:
        match = re.search(pattern, cleaned_text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            break
            
    # Fallback to full text
    if not name:
        for pattern in name_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                break
                
    if name:
        name = name.replace("అండి", "").replace("రెడ్డి", "Reddy").replace("గారు", "").replace("जी", "").strip()
    else:
        if email:
            name_part = email.split('@')[0]
            name = name_part.replace('.', ' ').title()
        else:
            name = "Interested Investor"
            
    # 5. Timeline extraction
    if any(x in full_text_lower for x in ["immediate", "next week", "this month", "వెంటనే", "ఈ నెల", "तुरंत", "अगले हफ्ते", "1 నెల"]):
        timeline = "Immediate (< 1 month)"
    elif any(x in full_text_lower for x in ["1-3 months", "2 months", "రెండు నెలలు", "दो महीने", "अगले महीने", "1-3 నెలలు"]):
        timeline = "1 - 3 months"
    elif any(x in full_text_lower for x in ["3-6 months", "3 months", "మూడు నెలలు", "तीन महीने", "अगले तीन महीने"]):
        timeline = "3 - 6 months"
    elif any(x in full_text_lower for x in ["6+ months", "next year", "వచ్చే ఏడాది", "अगले साल"]):
        timeline = "6+ months"
        
    # 6. Token Paid
    if any(x in full_text_lower for x in ["token", "paid", "advance", "debit", "पे", "డబ్బులు", "అడ్వాన్స్", "పే చేసాను", "ట్రాన్స్ఫర్", "दे दिया", "क्रेडिट"]):
        token_paid = True
        
    return {
        "name": name,
        "email": email,
        "budget": budget,
        "location": location or "Kadapa Valley (Phase I & II)",
        "timeline": timeline,
        "token_paid": token_paid
    }

# ==========================================
# REST API Endpoints
# ==========================================

# GET /api/leads - Fetch all qualified leads
@app.route('/api/leads', methods=['GET'])
def get_leads():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query all leads
    cursor.execute("SELECT * FROM leads ORDER BY ai_score DESC")
    leads_rows = cursor.fetchall()
    
    leads_list = []
    for row in leads_rows:
        lead = dict(row)
        # Convert sqlite boolean back
        lead["token_paid"] = bool(lead["token_paid"])
        
        # Query matching insights
        cursor.execute("SELECT insight FROM ai_insights WHERE lead_id = ?", (lead["id"],))
        insights = [r["insight"] for r in cursor.fetchall()]
        lead["insights"] = insights
        
        leads_list.append(lead)
        
    conn.close()
    return jsonify(leads_list)

# GET /api/leads/<id> - Fetch single lead details
@app.route('/api/leads/<id>', methods=['GET'])
def get_lead(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM leads WHERE id = ?", (id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({"error": f"Lead {id} not found"}), 404
        
    lead = dict(row)
    lead["token_paid"] = bool(lead["token_paid"])
    
    # Query insights
    cursor.execute("SELECT insight FROM ai_insights WHERE lead_id = ?", (id,))
    insights = [r["insight"] for r in cursor.fetchall()]
    lead["insights"] = insights
    
    conn.close()
    return jsonify(lead)

# POST /api/leads - Create new lead manually
@app.route('/api/leads', methods=['POST'])
def create_lead():
    data = request.json
    if not data or not all(k in data for k in ["name", "email", "phone", "plot_type", "location", "budget", "timeline"]):
        return jsonify({"error": "Missing required fields"}), 400
        
    lead_id = f"LD-{random.randint(1000, 9999)}"
    name = data["name"]
    email = data["email"]
    phone = data["phone"]
    plot_type = data["plot_type"]
    location = data["location"]
    budget = int(data["budget"])
    timeline = data["timeline"]
    token_paid = bool(data.get("token_paid", False))
    agent_assigned = data.get("agent_assigned", random.choice(["Sarah Jenkins", "Michael Thorne", "Emma Watson"]))
    
    # Run qualification score
    score, status = qualify_lead_score(timeline, token_paid, budget)
    insights = generate_insights_list(name, plot_type, location, timeline, token_paid, budget, score)
    
    created_at = datetime.utcnow().isoformat() + "Z"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO leads (id, name, email, phone, plot_type, location, budget, ai_score, status, created_at, timeline, token_paid, agent_assigned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            lead_id, name, email, phone, plot_type, location, budget,
            score, status, created_at, timeline, token_paid, agent_assigned
        ))
        
        for insight in insights:
            cursor.execute('INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)', (lead_id, insight))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Failed to insert lead: {str(e)}"}), 500
        
    # Construct return object
    new_lead = {
        "id": lead_id,
        "name": name,
        "email": email,
        "phone": phone,
        "plot_type": plot_type,
        "location": location,
        "budget": budget,
        "ai_score": score,
        "status": status,
        "created_at": created_at,
        "timeline": timeline,
        "token_paid": token_paid,
        "agent_assigned": agent_assigned,
        "insights": insights
    }
    
    conn.close()
    return jsonify(new_lead), 201

# PATCH /api/leads/<id>/status - Update lead stage
@app.route('/api/leads/<id>/status', methods=['PATCH'])
def update_lead_status(id):
    data = request.json
    if not data or "status" not in data:
        return jsonify({"error": "Missing status value"}), 400
        
    status = data["status"]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM leads WHERE id = ?", (id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": f"Lead {id} not found"}), 404
        
    cursor.execute("UPDATE leads SET status = ? WHERE id = ?", (status, id))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "updatedId": id, "status": status})

# POST /api/leads/process-audio - Multilingual Audio call detail extractor
@app.route('/api/leads/process-audio', methods=['POST'])
def process_audio():
    data = request.json
    if not data or "transcript" not in data:
        return jsonify({"error": "Missing call transcript text"}), 400
        
    transcript = data["transcript"]
    
    # Check if user has specified Gemini API Key in the environment for live AI extraction
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")
    
    if gemini_key:
        print("Processing transcript using Gemini 2.5 Flash API...")
        try:
            import urllib.request
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            prompt = f"""
            You are a helpful AI assistant for Lohitha Dharma Projects. Analyze this customer call transcript:
            "{transcript}"
            
            Extract the following fields and return ONLY a valid JSON object matching this schema. If a field is not present, use null or default timeline:
            {{
              "name": string (Full name, capitalize, e.g. "Harish Reddy". Parse Indian names and Telugu/Hindi contexts correctly),
              "email": string (Email address, or null if not found),
              "budget": number (Approximate budget in INR, e.g., 2500000. Convert lakh/crores properly. e.g. 25 lakhs = 2500000, 1.2 Crores = 12000000),
              "location": string (Match exactly one of: "Kadapa Valley (Phase I & II)", "Tirupati Foothills", "Chittoor Reserve", "Nellore Greenlands", "Rayalaseema Orchards". Fallback to Kadapa Valley if unmentioned),
              "timeline": string (Must be one of: "Immediate (< 1 month)", "1 - 3 months", "3 - 6 months", "6+ months"),
              "token_paid": boolean (True if they paid/will pay a token advance, booking fee, or money transfer, else False)
            }}
            
            Return ONLY the raw JSON string. Do not wrap it in markdown code blocks.
            """
            
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            }
            
            req_data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url, 
                data=req_data, 
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode('utf-8')
                res_json = json.loads(res_body)
                content = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                
                # Clean markdown backticks if returned
                if content.startswith("```"):
                    content = re.sub(r'^```(?:json)?\n', '', content)
                    content = re.sub(r'\n```$', '', content)
                    content = content.strip()
                    
                parsed_data = json.loads(content)
                return jsonify(parsed_data)
        except Exception as e:
            print(f"Gemini API execution failed: {str(e)}. Falling back to local NLP parser...")
            
    # Run the multilingual Regex/NLP pattern parsing algorithm
    print("Processing transcript using local regex-NLP parser...")
    parsed_data = parse_multilingual_transcript(transcript)
    return jsonify(parsed_data)


# Start Flask server
if __name__ == '__main__':
    init_db()
    print("SQLite database verified. Running Lohitha Dharma API on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
