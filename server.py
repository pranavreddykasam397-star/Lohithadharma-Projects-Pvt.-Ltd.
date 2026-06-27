import os
import sqlite3
import random
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import pybreaker

# Initialize Circuit Breakers for third-party services
bland_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)
firestore_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)
gemini_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

# Load .env file manually if exists
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    print("Loading environment variables from .env file...")
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

app = Flask(__name__)
# Enable CORS for communication with Vite React frontend
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads.db')

# ==========================================
# Secure Secret Manager Integration
# ==========================================
def get_secret(secret_name, default_value=None):
    # Try AWS Secrets Manager (fetches via IAM Role at runtime)
    aws_secret_id = os.environ.get("AWS_SECRETS_MANAGER_ID")
    if aws_secret_id:
        try:
            import boto3
            client = boto3.client('secretsmanager')
            response = client.get_secret_value(SecretId=aws_secret_id)
            secrets = json.loads(response['SecretString'])
            val = secrets.get(secret_name)
            if val is not None:
                return val
        except Exception as e:
            print(f"AWS Secrets Manager fetch failed for {secret_name}: {str(e)}", flush=True)

    # Try HashiCorp Vault (fetches at runtime via IAM or Token auth)
    vault_addr = os.environ.get("VAULT_ADDR")
    vault_token = os.environ.get("VAULT_TOKEN")
    if vault_addr and vault_token:
        try:
            import hvac
            client = hvac.Client(url=vault_addr, token=vault_token)
            secret_response = client.secrets.kv.v2.read_secret_version(path='lohitha-crm')
            val = secret_response['data']['data'].get(secret_name)
            if val is not None:
                return val
        except Exception as e:
            print(f"HashiCorp Vault fetch failed for {secret_name}: {str(e)}", flush=True)

    # Fallback to local environment secrets (allows transition and local dev testing)
    return os.environ.get(secret_name) or default_value

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
    
    # Create calls table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS calls (
            id TEXT PRIMARY KEY,
            lead_id TEXT,
            phone TEXT NOT NULL,
            status TEXT NOT NULL,
            transcript TEXT,
            recording_url TEXT,
            duration INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
        )
    ''')
    
    # Create OTPs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS otps (
            email TEXT PRIMARY KEY,
            otp TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Create user_credentials table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_credentials (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            totp_secret TEXT
        )
    ''')
    try:
        cursor.execute("ALTER TABLE user_credentials ADD COLUMN totp_secret TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass
    
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
    
    try:
        deduplicate_leads_db()
    except Exception as dedup_err:
        print(f"Deduplication startup failed: {str(dedup_err)}")
        
    conn.close()

@firestore_breaker
def execute_firestore_delete(req):
    import urllib.request
    with urllib.request.urlopen(req) as response:
        return response.read()

def delete_lead_from_firestore(lead_id):
    project_id = get_secret("FIREBASE_PROJECT_ID") or get_secret("VITE_FIREBASE_PROJECT_ID") or "lohitha-dharma-project"
    api_key = get_secret("FIREBASE_API_KEY") or get_secret("VITE_FIREBASE_API_KEY")
    if not api_key:
        print(f"Firestore Warning: api_key is missing. Cannot delete lead {lead_id}.")
        return False
    
    url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/default/documents/leads/{lead_id}?key={api_key}"
    import urllib.request
    try:
        req = urllib.request.Request(
            url,
            method="DELETE",
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        )
        execute_firestore_delete(req)
        print(f"Firestore Deduplication Delete: Deleted duplicate lead {lead_id} in Firestore.")
        return True
    except pybreaker.CircuitBreakerError:
        print(f"Firestore Circuit Breaker Tripped! Skipping deletion for lead {lead_id}.")
        return False
    except Exception as e:
        print(f"Firestore Deduplication Delete Failure for Lead {lead_id}: {str(e)}")
        return False

def deduplicate_leads_db():
    print("Deduplication: Running startup lead deduplication check...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM leads")
    leads = [dict(row) for row in cursor.fetchall()]
    
    if not leads:
        conn.close()
        return

    def normalize_phone(phone_str):
        if not phone_str:
            return ""
        digits = re.sub(r'\D', '', phone_str)
        return digits[-10:] if len(digits) >= 10 else digits

    grouped = {}
    for lead in leads:
        norm = normalize_phone(lead["phone"])
        if not norm:
            continue
        if norm not in grouped:
            grouped[norm] = []
        grouped[norm].append(lead)

    for norm, group in grouped.items():
        if len(group) <= 1:
            continue
            
        print(f"Deduplication: Found {len(group)} duplicate leads for normalized phone {norm}")
        group.sort(key=lambda x: (x["ai_score"], x["created_at"]), reverse=True)
        
        kept_lead = group[0]
        deleted_leads = group[1:]
        
        updated = False
        for del_lead in deleted_leads:
            if (not kept_lead.get("email") or kept_lead["email"] == "investor@lohithadharma.com") and del_lead.get("email") and del_lead["email"] != "investor@lohithadharma.com":
                kept_lead["email"] = del_lead["email"]
                updated = True
            
            cursor.execute("SELECT insight FROM ai_insights WHERE lead_id = ?", (del_lead["id"],))
            del_insights = [r["insight"] for r in cursor.fetchall()]
            for ins in del_insights:
                cursor.execute("SELECT COUNT(*) FROM ai_insights WHERE lead_id = ? AND insight = ?", (kept_lead["id"], ins))
                if cursor.fetchone()[0] == 0:
                    cursor.execute("INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)", (kept_lead["id"], ins))
        
        if updated:
            cursor.execute("UPDATE leads SET email = ? WHERE id = ?", (kept_lead["email"], kept_lead["id"]))
            
        for del_lead in deleted_leads:
            print(f"Deduplication: Merging & deleting duplicate lead {del_lead['id']} ({del_lead['name']})")
            cursor.execute("UPDATE calls SET lead_id = ? WHERE lead_id = ?", (kept_lead["id"], del_lead["id"]))
            cursor.execute("DELETE FROM leads WHERE id = ?", (del_lead["id"],))
            cursor.execute("DELETE FROM ai_insights WHERE lead_id = ?", (del_lead["id"],))
            
            try:
                delete_lead_from_firestore(del_lead["id"])
            except Exception as fs_err:
                print(f"Deduplication Firestore delete error: {str(fs_err)}")
                
        try:
            conn.commit()
            sync_lead_to_firestore(kept_lead["id"])
        except Exception as fs_err:
            print(f"Deduplication Firestore sync error: {str(fs_err)}")
            
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
    plot_type = None
    
    cleaned_text = clean_transcript_for_investor(text)
    text_lower = cleaned_text.lower()
    
    # 1. Email Extraction
    temp_email_text = cleaned_text.lower()
    temp_email_text = re.sub(r'\s+at\s+', '@', temp_email_text)
    temp_email_text = re.sub(r'\s+dot\s+', '.', temp_email_text)
    email_match = re.search(r'[\w\.-]+\s*@\s*[\w\.-]+\s*\.\s*\w+', temp_email_text)
    if email_match:
        email = email_match.group(0).replace(" ", "")
    else:
        temp_full_text = text.lower()
        temp_full_text = re.sub(r'\s+at\s+', '@', temp_full_text)
        temp_full_text = re.sub(r'\s+dot\s+', '.', temp_full_text)
        email_match = re.search(r'[\w\.-]+\s*@\s*[\w\.-]+\s*\.\s*\w+', temp_full_text)
        if email_match:
            email = email_match.group(0).replace(" ", "")
        
    # 2. Location matching (Lohitha Dharma projects)
    if "nellore" in text_lower or "nelor" in text_lower or "నెల్లూరు" in text_lower or "नेलोर" in text_lower or "नेल्लूर" in text_lower:
        location = "Nellore Greenlands"
    elif "kadapa" in text_lower or "కడప" in text_lower or "कडपा" in text_lower:
        location = "Kadapa Valley (Phase I & II)"
    elif "tirupati" in text_lower or "తిరుపతి" in text_lower or "तिरुपति" in text_lower:
        location = "Tirupati Foothills"
    elif "chittoor" in text_lower or "చిత్తూరు" in text_lower or "चित्तूर" in text_lower:
        location = "Chittoor Reserve"
    elif "rayalaseema" in text_lower or "రాయలసీమ" in text_lower or "रायलसीमा" in text_lower:
        location = "Rayalaseema Orchards"
    else:
        full_text_lower = text.lower()
        if "nellore" in full_text_lower or "nelor" in full_text_lower or "నెల్లూరు" in full_text_lower or "नेलोर" in full_text_lower or "नेल्लूर" in full_text_lower:
            location = "Nellore Greenlands"
        elif "kadapa" in full_text_lower or "కడప" in full_text_lower or "कडపా" in full_text_lower:
            location = "Kadapa Valley (Phase I & II)"
        elif "tirupati" in full_text_lower or "తిరుపతి" in full_text_lower or "तिरुपति" in full_text_lower:
            location = "Tirupati Foothills"
        elif "chittoor" in full_text_lower or "చిత్తూరు" in full_text_lower or "चित्तूर" in full_text_lower:
            location = "Chittoor Reserve"
        elif "rayalaseema" in full_text_lower or "రాయలసీమ" in full_text_lower or "रायलसीमा" in full_text_lower:
            location = "Rayalaseema Orchards"
        
    # 3. Budget extraction (INR)
    sentences = re.split(r'[\.\n]', text_lower)
    budget_target = text_lower
    currency_patterns = [
        r'\blakhs?\b', r'\blacs?\b', r'\bcrores?\b', r'\bcr\b', 
        r'\brupees?\b', r'\bbudget\b', r'\binr\b', r'\binvest(?:ment)?s?\b'
    ]
    for s in sentences:
        s = s.strip()
        if any(re.search(pat, s) for pat in currency_patterns):
            budget_target = s
            break
            
    num_matches = re.findall(r'\d+(?:\.\d+)?', budget_target)
    is_crore = any(x in budget_target for x in ["crore", "crores", "cr", "करोड़", "కోట్లు", "కోటి", "cr."])
    is_lakh = any(x in budget_target for x in ["lakh", "lakhs", "lac", "lacs", "l", "लाख", "లక్షలు", "లక్ష", "l."])
    
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
        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
            "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
            "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
            "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
            "ninety": 90, "hundred": 100, "thousand": 1000,
        }
        
        words = re.findall(r'[a-z]+', budget_target)
        filtered_words = []
        for i, w in enumerate(words):
            if i + 1 < len(words) and words[i+1] in ["month", "months", "year", "years", "week", "weeks", "day", "days"]:
                continue
            filtered_words.append(w)
            
        total = 0
        current = 0
        for w in filtered_words:
            if w in word_to_num:
                val = word_to_num[w]
                if val == 1000:
                    current = (current or 1) * 1000
                    total += current
                    current = 0
                elif val == 100:
                    current = (current or 1) * 100
                else:
                    current += val
            elif w in ["lakh", "lakhs", "lac", "lacs"]:
                current = (current or 1) * 100000
                total += current
                current = 0
            elif w in ["crore", "crores", "cr", "crs"]:
                current = (current or 1) * 10000000
                total += current
                current = 0
                
        total += current
        if total > 0:
            budget = total
        else:
            if "twenty five" in text_lower or "25" in text_lower or "పాతిక" in text_lower or "पच्चीस" in text_lower:
                budget = 2500000
            elif "forty" in text_lower or "40" in text_lower or "నలభై" in text_lower or "चालीस" in text_lower:
                budget = 4000000
            elif "seventy five" in text_lower or "75" in text_lower or "డెబ్బై ఐదు" in text_lower or "पचहत्तर" in text_lower:
                budget = 7500000
            elif "one point two" in text_lower or "1.2" in text_lower or "కోటి ఇరవై" in text_lower:
                budget = 12000000
            elif "sixty" in text_lower or "60" in text_lower or "అరవై" in text_lower or "साठ" in text_lower:
                budget = 6000000
            elif "twelve" in text_lower or "12" in text_lower or "పన్నెండు" in text_lower or "बारह" in text_lower:
                budget = 1200000
            else:
                num_matches_full = re.findall(r'\d+(?:\.\d+)?', text.lower())
                if num_matches_full:
                    try:
                        val_full = float(num_matches_full[0])
                        budget = int(val_full) if val_full > 10000 else int(val_full * 100000)
                    except:
                        budget = 2400000
                else:
                    budget = 2400000
            
    # 4. Name extraction
    name_patterns = [
        r"(?:my name is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"(?:मेरा नाम)\s+([^\s।]+(?:\s+[^\s।]+)?)(?:\s+है)?",
        r"(?:నా పేరు)\s+([^\s\.]+(?:\s+[^\s\.]+)?)"
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, cleaned_text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            break
            
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
    if any(x in text_lower for x in ["immediate", "next week", "this month", "వెంటనే", "ఈ నెల", "तुरंत", "अगले हफ्ते", "1 నెల"]):
        timeline = "Immediate (< 1 month)"
    elif any(x in text_lower for x in ["1-3 months", "2 months", "రెండు నెలలు", "दो महीने", "अगले महीने", "1-3 నెలలు"]):
        timeline = "1 - 3 months"
    elif any(x in text_lower for x in ["3-6 months", "3 months", "మూడు నెలలు", "तीन महीने", "अगले तीन महीने"]):
        timeline = "3 - 6 months"
    elif any(x in text_lower for x in ["6+ months", "7 months", "seven months", "eight months", "nine months", "ten months", "year", "years", "next year", "వచ్చే ఏడాది", "अगले साल"]):
        timeline = "6+ months"
    else:
        full_text_lower = text.lower()
        if any(x in full_text_lower for x in ["immediate", "next week", "this month", "వెంటనే", "ఈ నెల", "तुरंत", "अगले हफ्ते", "1 నెల"]):
            if not ("is it immediate" in full_text_lower or "one to three months" in full_text_lower):
                timeline = "Immediate (< 1 month)"
        elif "6+ months" in full_text_lower or "6 months or more" in full_text_lower or "seven months" in full_text_lower:
            timeline = "6+ months"
        
    # 6. Token Paid
    token_keywords = ["paid", "debit", "पे", "అడ్వాన్స్", "పే చేసాను", "ట్రాన్స్ఫర్", "दे दिया", "क्रेडिट"]
    has_token_word = any(x in text_lower for x in token_keywords)
    has_negation = any(x in text_lower for x in ["no", "not", "haven't", "don't", "didnot", "did not", "never"])
    
    if has_token_word and not has_negation:
        token_paid = True
    else:
        token_paid = False
        
    # 7. Plot Type Extraction
    if "600" in text_lower or "six hundred" in text_lower:
        plot_type = "600 Sq. Yards Plot (50 Trees)"
    elif "1200" in text_lower or "twelve hundred" in text_lower or "1200 sq" in text_lower:
        plot_type = "1200 Sq. Yards Plot (100 Trees)"
    elif "2400" in text_lower or "twenty four hundred" in text_lower or "2400 sq" in text_lower:
        plot_type = "2400 Sq. Yards Plot (200 Trees)"
    elif "0.25" in text_lower or "quarter" in text_lower or "point two five" in text_lower:
        plot_type = "0.25 Acre Farmland (100 Trees)"
    elif "0.5" in text_lower or "half" in text_lower or "point five" in text_lower:
        plot_type = "0.5 Acre Farmland (200 Trees)"
    elif "1.0" in text_lower or "one acre" in text_lower or "1 acre" in text_lower:
        plot_type = "1.0 Acre Farmland (400 Trees)"
    else:
        full_text_lower = text.lower()
        if "600" in full_text_lower or "six hundred" in full_text_lower:
            plot_type = "600 Sq. Yards Plot (50 Trees)"
        elif "1200" in full_text_lower or "twelve hundred" in full_text_lower:
            plot_type = "1200 Sq. Yards Plot (100 Trees)"
        elif "2400" in full_text_lower or "twenty four hundred" in full_text_lower:
            plot_type = "2400 Sq. Yards Plot (200 Trees)"
        elif "0.25" in full_text_lower or "quarter" in full_text_lower:
            plot_type = "0.25 Acre Farmland (100 Trees)"
        elif "0.5" in full_text_lower or "half" in full_text_lower:
            plot_type = "0.5 Acre Farmland (200 Trees)"
        elif "1.0" in full_text_lower or "one acre" in full_text_lower:
            plot_type = "1.0 Acre Farmland (400 Trees)"
        
    return {
        "name": name,
        "email": email,
        "budget": budget,
        "location": location or "Kadapa Valley (Phase I & II)",
        "timeline": timeline,
        "token_paid": token_paid,
        "plot_type": plot_type or "0.25 Acre Farmland (100 Trees)"
    }

# ==========================================
# Authentication & OTP Verification System
# ==========================================
import hmac
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def get_secure_password(email):
    secret_key = get_secret("AUTH_SECRET_KEY", "lohitha-dharma-auth-secret-key-2026")
    return hmac.new(secret_key.encode('utf-8'), email.lower().encode('utf-8'), hashlib.sha256).hexdigest()

def send_otp_email(to_email, otp):
    smtp_host = get_secret("SMTP_HOST")
    smtp_port = get_secret("SMTP_PORT")
    smtp_user = get_secret("SMTP_USER")
    smtp_pass = get_secret("SMTP_PASSWORD")
    sender_email = get_secret("SMTP_SENDER", smtp_user)
    
    subject = "Lohitha Dharma CRM - Verification Code"
    body = f"""
    Hello,
    
    Your verification code is: {otp}
    
    This code is valid for 5 minutes.
    
    If you did not request this code, please ignore this email.
    
    Best regards,
    Lohitha Dharma Projects Team
    """
    
    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        print(f"[SMTP SIMULATION] To: {to_email} | Subject: {subject} | OTP: {otp}", flush=True)
        return True
        
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email or "no-reply@lohithadharma.com"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email or smtp_user, to_email, msg.as_string())
        server.close()
        print(f"SMTP Success: OTP email sent to {to_email}", flush=True)
        return True
    except Exception as e:
        print(f"SMTP Error sending email: {str(e)}", flush=True)
        # Fallback to simulation print
        print(f"[SMTP FALLBACK SIMULATION] To: {to_email} | OTP: {otp}", flush=True)
        return True

# POST /api/auth/send-otp
@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data = request.json or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    email = email.strip().lower()
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    created_at = datetime.utcnow().isoformat() + "Z"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Upsert OTP
        cursor.execute("INSERT OR REPLACE INTO otps (email, otp, created_at) VALUES (?, ?, ?)", (email, otp, created_at))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    conn.close()
    
    # Send OTP
    send_otp_email(email, otp)
    
    return jsonify({"success": True, "message": "OTP sent successfully"}), 200

# POST /api/auth/verify-otp
@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    email = data.get("email")
    otp = data.get("otp")
    
    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400
        
    email = email.strip().lower()
    otp = otp.strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT otp, created_at FROM otps WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"error": "No OTP found or code expired."}), 400
        
    stored_otp = row["otp"]
    created_at_str = row["created_at"]
    
    # Check expiration (5 minutes)
    try:
        created_at = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        try:
            created_at = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            created_at = datetime.utcnow() # fallback
            
    elapsed = (datetime.utcnow() - created_at).total_seconds()
    if elapsed > 300: # 5 minutes
        return jsonify({"error": "OTP has expired."}), 400
        
    if stored_otp != otp:
        return jsonify({"error": "Invalid OTP code."}), 400
        
    # Check if user has credentials in DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM user_credentials WHERE email = ?", (email,))
    row = cursor.fetchone()
    if row:
        secure_credential = row["password"]
    else:
        secure_credential = get_secure_password(email)
        cursor.execute("INSERT INTO user_credentials (email, password) VALUES (?, ?)", (email, secure_credential))
        conn.commit()
    conn.close()
    
    return jsonify({
        "success": True, 
        "message": "OTP verified successfully",
        "credential": secure_credential
    }), 200

# POST /api/auth/reset-password
@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json or {}
    email = data.get("email")
    otp = data.get("otp")
    new_password = data.get("new_password")
    
    if not email or not otp or not new_password:
        return jsonify({"error": "Email, OTP and New Password are required"}), 400
        
    email = email.strip().lower()
    otp = otp.strip()
    new_password = new_password.strip()
    
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT otp, created_at FROM otps WHERE email = ?", (email,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({"error": "No OTP found or code expired."}), 400
        
    stored_otp = row["otp"]
    created_at_str = row["created_at"]
    
    # Check expiration (5 minutes)
    try:
        created_at = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        try:
            created_at = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            created_at = datetime.utcnow() # fallback
            
    elapsed = (datetime.utcnow() - created_at).total_seconds()
    if elapsed > 300: # 5 minutes
        conn.close()
        return jsonify({"error": "OTP has expired."}), 400
        
    if stored_otp != otp:
        conn.close()
        return jsonify({"error": "Invalid OTP code."}), 400
        
    # Get current stored password
    cursor.execute("SELECT password FROM user_credentials WHERE email = ?", (email,))
    cred_row = cursor.fetchone()
    if cred_row:
        current_password = cred_row["password"]
    else:
        current_password = get_secure_password(email)
        
    # Update SQLite database with new password
    cursor.execute("INSERT OR REPLACE INTO user_credentials (email, password) VALUES (?, ?)", (email, new_password))
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True, 
        "message": "Password reset in backend successfully",
        "credential": current_password
    }), 200

# POST /api/auth/totp-setup - Generate new TOTP secret
@app.route('/api/auth/totp-setup', methods=['POST'])
def totp_setup():
    import pyotp
    data = request.json or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400
    email = email.strip().lower()
    
    # Generate TOTP secret
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    # Provisioning URI
    uri = totp.provisioning_uri(name=email, issuer_name="Lohitha Dharma Projects")
    
    return jsonify({
        "secret": secret,
        "uri": uri
    }), 200

# POST /api/auth/totp-save - Verify initial token and save secret
@app.route('/api/auth/totp-save', methods=['POST'])
def totp_save():
    import pyotp
    data = request.json or {}
    email = data.get("email")
    secret = data.get("secret")
    token = data.get("token")
    
    if not email or not secret or not token:
        return jsonify({"error": "Email, secret and token code are required"}), 400
        
    email = email.strip().lower()
    secret = secret.strip()
    token = token.strip()
    
    totp = pyotp.TOTP(secret)
    if not totp.verify(token):
        return jsonify({"error": "Invalid verification code. Please check your app and try again."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if user exists in credentials
        cursor.execute("SELECT email FROM user_credentials WHERE email = ?", (email,))
        if not cursor.fetchone():
            default_pass = get_secure_password(email)
            cursor.execute("INSERT INTO user_credentials (email, password, totp_secret) VALUES (?, ?, ?)", (email, default_pass, secret))
        else:
            cursor.execute("UPDATE user_credentials SET totp_secret = ? WHERE email = ?", (secret, email))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    conn.close()
    
    return jsonify({
        "success": True,
        "message": "TOTP MFA registered successfully"
    }), 200

# POST /api/auth/totp-verify - Verify TOTP token during login
@app.route('/api/auth/totp-verify', methods=['POST'])
def totp_verify():
    import pyotp
    data = request.json or {}
    email = data.get("email")
    token = data.get("token")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    email = email.strip().lower()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT totp_secret FROM user_credentials WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    
    has_secret = bool(row and row["totp_secret"])
    
    # If checking setup status only
    if not token:
        return jsonify({
            "is_registered": has_secret
        }), 200
        
    if not has_secret:
        return jsonify({
            "is_registered": False,
            "error": "MFA is not set up for this account. Please verify via Email OTP to set up MFA."
        }), 400
        
    token = token.strip()
    secret = row["totp_secret"]
    totp = pyotp.TOTP(secret)
    if not totp.verify(token):
        return jsonify({"error": "Invalid MFA code. Please check your app and try again."}), 400
        
    return jsonify({
        "success": True,
        "message": "MFA verified successfully"
    }), 200

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
    
    # Sync to Firestore
    sync_lead_to_firestore(lead_id)
    
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
    
    # Sync to Firestore
    sync_lead_to_firestore(id)
    
    return jsonify({"success": True, "updatedId": id, "status": status})

@gemini_breaker
def execute_gemini_api(req):
    import urllib.request
    with urllib.request.urlopen(req) as response:
        return response.read()

# POST /api/leads/process-audio - Multilingual Audio call detail extractor
@app.route('/api/leads/process-audio', methods=['POST'])
def process_audio():
    data = request.json
    if not data or "transcript" not in data:
        return jsonify({"error": "Missing call transcript text"}), 400
        
    transcript = data["transcript"]
    
    # Check if user has specified Gemini API Key in the environment for live AI extraction
    gemini_key = get_secret("GEMINI_API_KEY") or get_secret("GEMINI_API")
    
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
            
            try:
                res_body = execute_gemini_api(req).decode('utf-8')
                res_json = json.loads(res_body)
                content = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                
                # Clean markdown backticks if returned
                if content.startswith("```"):
                    content = re.sub(r'^```(?:json)?\n', '', content)
                    content = re.sub(r'\n```$', '', content)
                    content = content.strip()
                    
                parsed_data = json.loads(content)
                return jsonify(parsed_data)
            except pybreaker.CircuitBreakerError:
                print("Gemini Circuit Breaker Tripped! Falling back to local NLP parser...")
        except Exception as e:
            print(f"Gemini API execution failed: {str(e)}. Falling back to local NLP parser...")
            
    # Run the multilingual Regex/NLP pattern parsing algorithm
    print("Processing transcript using local regex-NLP parser...")
    parsed_data = parse_multilingual_transcript(transcript)
    return jsonify(parsed_data)


# ==========================================
# Outbound AI Calling & Webhook System
# ==========================================
import threading
import time
from flask import Response

# In-memory store for active simulated call threads
active_simulations = {}

def format_phone_number(phone):
    if not phone:
        return ""
    # Remove any non-digit characters except possibly +
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    if cleaned.startswith('+'):
        return cleaned
        
    # Strip any leading zero (common in local Indian dialing)
    if cleaned.startswith('0'):
        cleaned = cleaned[1:]
        
    # If it is 10 digits, prepend +91
    if len(cleaned) == 10:
        return '+91' + cleaned
        
    # If it is 12 digits and starts with 91, prepend +
    if len(cleaned) == 12 and cleaned.startswith('91'):
        return '+' + cleaned
        
    # Default fallback: if it doesn't start with +91, format as India
    if not cleaned.startswith('91'):
        return '+91' + cleaned
    else:
        return '+' + cleaned

def extract_call_duration(payload):
    if not payload:
        return 0
    call_length = payload.get("call_length")
    duration = payload.get("duration")
    
    if call_length is not None:
        try:
            return int(float(call_length) * 60)
        except:
            pass
            
    if duration is not None:
        try:
            val = float(duration)
            if val < 10:  # Assume minutes if duration is less than 10
                return int(val * 60)
            return int(val)
        except:
            pass
            
    return 0

# ==========================================
# Cloud Firestore Real-time Synchronization
# ==========================================
def to_firestore_value(val):
    if isinstance(val, bool):
        return {"booleanValue": val}
    elif isinstance(val, int):
        return {"integerValue": str(val)}
    elif isinstance(val, float):
        return {"doubleValue": val}
    elif isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(x) for x in val]}}
    elif val is None:
        return {"nullValue": None}
    else:
        return {"stringValue": str(val)}

def to_firestore_fields(data_dict):
    return {
        "fields": {k: to_firestore_value(v) for k, v in data_dict.items()}
    }

@firestore_breaker
def execute_firestore_patch(req):
    import urllib.request
    with urllib.request.urlopen(req) as response:
        return response.read()

def sync_lead_to_firestore(lead_id):
    project_id = get_secret("FIREBASE_PROJECT_ID") or get_secret("VITE_FIREBASE_PROJECT_ID") or "lohitha-dharma-project"
    api_key = get_secret("FIREBASE_API_KEY") or get_secret("VITE_FIREBASE_API_KEY")
    if not api_key:
        print(f"Firestore Sync Warning: api_key is missing. Cannot sync lead {lead_id}.")
        return False
    
    print(f"Firestore Sync: Fetching lead {lead_id} from SQLite to sync with Firestore...")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    lead_row = cursor.fetchone()
    
    if not lead_row:
        conn.close()
        print(f"Firestore Sync Warning: Lead {lead_id} not found in SQLite.")
        return False
        
    lead_data = dict(lead_row)
    lead_data["token_paid"] = bool(lead_data["token_paid"])
    lead_data["budget"] = int(lead_data["budget"])
    lead_data["ai_score"] = int(lead_data["ai_score"])
    
    cursor.execute("SELECT insight FROM ai_insights WHERE lead_id = ?", (lead_id,))
    insights = [r["insight"] for r in cursor.fetchall()]
    lead_data["insights"] = insights
    conn.close()
    
    # Send PATCH request to Cloud Firestore REST API
    url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/default/documents/leads/{lead_id}?key={api_key}"
    payload = to_firestore_fields(lead_data)
    req_data = json.dumps(payload).encode('utf-8')
    
    import urllib.request
    try:
        req = urllib.request.Request(
            url,
            data=req_data,
            method="PATCH",
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        )
        execute_firestore_patch(req)
        print(f"Firestore Sync Success: Lead {lead_id} successfully synchronized in the cloud.")
        return True
    except pybreaker.CircuitBreakerError:
        print(f"Firestore Circuit Breaker Tripped! Skipping cloud sync for lead {lead_id}.")
        return False
    except Exception as e:
        print(f"Firestore Sync Failure for Lead {lead_id}: {str(e)}")
        return False

def save_and_sync_call_data(call_id, lead_id, phone, transcript_text, duration, recording_url, created_at=None):
    if not created_at:
        created_at = datetime.utcnow().isoformat() + "Z"
        
    phone = format_phone_number(phone)
    
    if not lead_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM leads WHERE phone = ? OR phone LIKE ?", (phone, f"%{phone[-10:]}"))
            row = cursor.fetchone()
            if row:
                lead_id = row["id"]
                print(f"Polling/Sync: Found matching lead {lead_id} for phone {phone}", flush=True)
            conn.close()
        except Exception as e:
            print(f"Error finding lead by phone number: {str(e)}", flush=True)

    conn = get_db_connection()
    cursor = conn.cursor()
    
    if call_id:
        cursor.execute("SELECT id FROM calls WHERE id = ?", (call_id,))
        call_exists = cursor.fetchone()
    else:
        call_exists = False
        
    if call_exists:
        cursor.execute('''
            UPDATE calls 
            SET status = 'completed', 
                transcript = ?, 
                recording_url = CASE WHEN recording_url IS NULL OR recording_url = '' THEN ? ELSE recording_url END, 
                duration = ?
            WHERE id = ?
        ''', (transcript_text, recording_url, duration, call_id))
    else:
        actual_call_id = call_id or f"CALL-{random.randint(10000, 99999)}"
        cursor.execute('''
            INSERT INTO calls (id, lead_id, phone, status, transcript, recording_url, duration, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (actual_call_id, lead_id, phone, "completed", transcript_text, recording_url, duration, created_at))
        call_id = actual_call_id
        
    conn.commit()
    
    parsed = parse_multilingual_transcript(transcript_text)
    score, lead_status = qualify_lead_score(parsed["timeline"], parsed["token_paid"], parsed["budget"])
    insights = generate_insights_list(parsed["name"], parsed["plot_type"], parsed["location"], parsed["timeline"], parsed["token_paid"], parsed["budget"], score)
    
    # Associate call record with resolved lead_id in the calls table
    if lead_id:
        cursor.execute("UPDATE calls SET lead_id = ? WHERE id = ?", (lead_id, call_id))
        
    if lead_id:
        cursor.execute('''
            UPDATE leads 
            SET name = ?, 
                email = COALESCE(?, email), 
                plot_type = COALESCE(?, plot_type), 
                location = ?, 
                budget = ?, 
                timeline = ?, 
                token_paid = ?, 
                ai_score = ?, 
                status = ?
            WHERE id = ?
        ''', (parsed["name"], parsed["email"], parsed["plot_type"], parsed["location"], parsed["budget"], parsed["timeline"], parsed["token_paid"], score, lead_status, lead_id))
        cursor.execute("DELETE FROM ai_insights WHERE lead_id = ?", (lead_id,))
        for ins in insights:
            cursor.execute("INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)", (lead_id, ins))
    else:
        new_lead_id = f"LD-{random.randint(1000, 9999)}"
        cursor.execute('''
            INSERT INTO leads (id, name, email, phone, plot_type, location, budget, ai_score, status, created_at, timeline, token_paid, agent_assigned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            new_lead_id, parsed["name"], parsed["email"] or "investor@lohithadharma.com", phone,
            parsed["plot_type"], parsed["location"], parsed["budget"],
            score, lead_status, created_at, parsed["timeline"], parsed["token_paid"], "Sarah Jenkins"
        ))
        for ins in insights:
            cursor.execute("INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)", (new_lead_id, ins))
            
        cursor.execute("UPDATE calls SET lead_id = ? WHERE id = ?", (new_lead_id, call_id))
        lead_id = new_lead_id
        
    conn.commit()
    conn.close()
    
    try:
        sync_lead_to_firestore(lead_id)
    except Exception as fs_err:
        print(f"Error syncing to Firestore: {str(fs_err)}", flush=True)
        
    return lead_id

@bland_breaker
def execute_bland_api(req):
    import urllib.request
    with urllib.request.urlopen(req) as response:
        return response.read()

def sync_active_calls_from_bland():
    bland_api_key = get_secret("BLAND_API_KEY")
    if not bland_api_key:
        return
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, lead_id, phone, created_at 
            FROM calls 
            WHERE (status IN ('in-progress', 'ringing') OR (status = 'completed' AND (recording_url IS NULL OR recording_url = '')))
              AND id NOT LIKE 'CALL-%' 
              AND datetime(created_at) > datetime('now', '-2 hours')
        """)
        active_calls = [dict(row) for row in cursor.fetchall()]
        conn.close()
    except Exception as e:
        print(f"Error fetching active calls from DB: {str(e)}", flush=True)
        return
        
    if not active_calls:
        return
        
    import urllib.request
    import urllib.error
    import json
    
    for row in active_calls:
        call_id = row["id"]
        lead_id = row["lead_id"]
        phone = row["phone"]
        created_at = row["created_at"]
        
        bland_url = f"https://api.bland.ai/v1/calls/{call_id}"
        req = urllib.request.Request(
            bland_url,
            headers={
                'authorization': bland_api_key,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/120.0.0.0'
            }
        )
        
        try:
            print(f"Polling status of call {call_id} from Bland AI...", flush=True)
            res_body = execute_bland_api(req).decode('utf-8')
            res_json = json.loads(res_body)
            
            bland_status = res_json.get("status")
            transcript = res_json.get("concatenated_transcript") or res_json.get("transcript")
            recording_url = res_json.get("recording_url") or res_json.get("recording") or ""
            duration = extract_call_duration(res_json)
            
            print(f"Call {call_id} Bland AI status: {bland_status}, transcript length: {len(transcript) if transcript else 0}", flush=True)
            
            if bland_status not in ["in-progress", "ringing"] or transcript:
                if not transcript:
                    transcript = f"[Call ended with status: {bland_status}]"
                
                save_and_sync_call_data(call_id, lead_id, phone, transcript, duration, recording_url, created_at)
                print(f"Successfully synced call {call_id} via API polling.", flush=True)
        except pybreaker.CircuitBreakerError:
            print(f"Bland Circuit Breaker Tripped! Skipping status poll for call {call_id}.", flush=True)
            break
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8')
            except:
                err_body = ""
            print(f"Error polling call {call_id} from Bland AI: {e.code} - {e.reason}. Body: {err_body}", flush=True)
            if e.code in [400, 404]:
                try:
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute("UPDATE calls SET status = 'failed', transcript = '[Call not found on Bland AI]' WHERE id = ?", (call_id,))
                    conn.commit()
                    conn.close()
                except Exception as db_err:
                    print(f"Error updating failed call status: {str(db_err)}", flush=True)
        except Exception as e:
            print(f"Failed to poll call {call_id}: {str(e)}", flush=True)

sync_lock = threading.Lock()
is_syncing = False

def sync_active_calls_from_bland_async():
    global is_syncing
    with sync_lock:
        if is_syncing:
            return
        is_syncing = True

    def run_sync():
        global is_syncing
        try:
            sync_active_calls_from_bland()
        except Exception as err:
            print(f"Error in background sync thread: {str(err)}", flush=True)
        finally:
            with sync_lock:
                is_syncing = False

    thread = threading.Thread(target=run_sync)
    thread.daemon = True
    thread.start()

@app.route('/api/calls', methods=['GET'])
def get_calls():
    # Sync active calls asynchronously in the background
    try:
        sync_active_calls_from_bland_async()
    except Exception as e:
        print(f"Error during active calls async sync trigger: {str(e)}", flush=True)
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM calls ORDER BY created_at DESC")
    rows = cursor.fetchall()
    calls = [dict(r) for r in rows]
    conn.close()
    return jsonify(calls)

@app.route('/api/calls/<call_id>', methods=['DELETE'])
def delete_call(call_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM calls WHERE id = ?", (call_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Call {call_id} deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/calls', methods=['DELETE'])
def clear_call_history():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM calls")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Call history cleared successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/calls/proxy-recording', methods=['GET'])
def proxy_recording():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "URL parameter is required"}), 400
        
    from urllib.parse import urlparse
    parsed_url = urlparse(url)
    if parsed_url.netloc not in ("api.bland.ai", "www.soundhelix.com"):
        print(f"SECURITY WARNING: Attempt to proxy non-whitelisted URL: {url}", flush=True)
        return jsonify({"error": "Unauthorized target domain. Only api.bland.ai and www.soundhelix.com are allowed."}), 403
        
    print(f"Proxying recording request from Bland AI: {url}", flush=True)
    
    import requests
    from flask import Response
    
    try:
        response = requests.get(
            url,
            stream=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout=15
        )
        
        if response.status_code in (404, 202):
            print(f"Recording not ready yet on Bland AI (HTTP {response.status_code}) for URL {url}", flush=True)
            return jsonify({"error": "Recording is not yet ready or available on Bland AI."}), response.status_code
            
        response.raise_for_status()
        
        mime_type = response.headers.get('Content-Type') or 'audio/mpeg'
        content_length = response.headers.get('Content-Length')
        
        res = Response(
            response.iter_content(chunk_size=8192),
            mimetype=mime_type,
            direct_passthrough=True
        )
        
        if content_length:
            res.headers['Content-Length'] = content_length
        res.headers['Access-Control-Allow-Origin'] = '*'
        return res
        
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else 500
        print(f"Proxy HTTP Error from Bland AI: {status_code} for URL {url}", flush=True)
        return jsonify({"error": f"Recording not ready or not found on Bland AI (HTTP {status_code})"}), status_code
    except requests.exceptions.Timeout as e:
        print(f"Proxy network timeout for URL {url}", flush=True)
        return jsonify({"error": "Network timeout connecting to Bland AI audio server."}), 504
    except Exception as e:
        print(f"Proxy Failed: {str(e)}", flush=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/calls/trigger', methods=['POST'])

def trigger_call():
    data = request.json or {}
    phone = data.get("phone")
    if phone:
        phone = format_phone_number(phone)
    lead_id = data.get("lead_id")
    bland_api_key = get_secret("BLAND_API_KEY") or data.get("bland_api_key")
    if bland_api_key and (bland_api_key.startswith("http://") or bland_api_key.startswith("https://")):
        bland_api_key = get_secret("BLAND_API_KEY")
    webhook_base = get_secret("WEBHOOK_BASE_URL") or data.get("webhook_base_url")
    
    print(f"DEBUG: Trigger payload={data}", flush=True)
    print(f"DEBUG: BLAND_API_KEY in env={bool(get_secret('BLAND_API_KEY'))}", flush=True)
    print(f"DEBUG: bland_api_key resolved={bool(bland_api_key)}", flush=True)
    
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
        
    call_id = f"CALL-{random.randint(10000, 99999)}"
    created_at = datetime.utcnow().isoformat() + "Z"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get lead details if available
    lead_name = "Interested Investor"
    if lead_id:
        cursor.execute("SELECT name FROM leads WHERE id = ?", (lead_id,))
        row = cursor.fetchone()
        if row:
            lead_name = row["name"]
            
    error_reason = None
    
    # Check if we have Bland AI credentials for a real call
    if bland_api_key:
        print(f"Triggering real call to {phone} via Bland AI...", flush=True)
        
        # Build prompt
        prompt = f"""You are a friendly, professional AI outbound calling agent for Lohitha Dharma Projects Pvt. Ltd., a premium managed Red Sandalwood farmland developer. 
Your goal is to connect with the lead, confirm their name, and qualify their purchase intent for farmland.
Converse naturally and dynamically.
Extract the following information during the call:
1. Confirm their full name (which is {lead_name}).
2. Ask for their email address.
3. Ask what plot type size they are looking for (must be one of: 600 Sq. Yards, 1200 Sq. Yards, 2400 Sq. Yards, 0.25 Acre, 0.5 Acre, 1.0 Acre).
4. Ask which farmland project/location they are interested in (must be one of: Kadapa Valley (Phase I & II), Tirupati Foothills, Chittoor Reserve, Nellore Greenlands, Rayalaseema Orchards).
5. Ask for their estimated investment budget in Indian Rupees (INR).
6. Ask what their timeline is for registering the plot (e.g., immediate, 1-3 months, 3-6 months, 6+ months).
7. Ask if they have paid the advance booking token to reserve their plot.

Start the call by asking for their name and greeting them. Once you have collected all info, thank them and end the call."""

        webhook_url = None
        if webhook_base:
            webhook_url = f"{webhook_base.rstrip('/')}/api/calls/webhook"

        import urllib.request
        import urllib.error
        bland_url = "https://api.bland.ai/v1/calls"
        bland_payload = {
            "phone_number": phone,
            "task": prompt,
            "first_sentence": "Hello, welcome to Lohitha Dharma Projects. May I know your name please?",
            "voice": "nat",
            "language": "en",
            "webhook": webhook_url,
            "record": True,
            "metadata": {
                "lead_id": lead_id,
                "call_id": call_id
            }
        }
        
        try:
            req_data = json.dumps(bland_payload).encode('utf-8')
            req = urllib.request.Request(
                bland_url,
                data=req_data,
                headers={
                    'Content-Type': 'application/json',
                    'authorization': bland_api_key,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            try:
                res_body = execute_bland_api(req).decode('utf-8')
                res_json = json.loads(res_body)
                bland_call_id = res_json.get("call_id") or res_json.get("id") or call_id
                
                # Save call log
                cursor.execute('''
                    INSERT INTO calls (id, lead_id, phone, status, transcript, recording_url, duration, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (bland_call_id, lead_id, phone, "in-progress", "", "", 0, created_at))
                conn.commit()
                conn.close()
                
                return jsonify({
                    "success": True,
                    "call_id": bland_call_id,
                    "status": "in-progress",
                    "phone": phone,
                    "lead_id": lead_id,
                    "lead_name": lead_name,
                    "mode": "real"
                })
            except pybreaker.CircuitBreakerError:
                print("Bland Circuit Breaker Tripped! Triggering local offline simulation call fallback...", flush=True)
                error_reason = "Bland AI API gateway offline (Circuit Breaker Tripped)"
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            print(f"Bland AI trigger HTTP error: {e.code} - {e.reason}. Body: {err_body}", flush=True)
            print("Falling back to simulation mode...", flush=True)
            try:
                err_json = json.loads(err_body)
                error_reason = err_json.get("message") or err_json.get("error") or f"HTTP {e.code}: {e.reason}"
            except:
                error_reason = f"Bland AI HTTP {e.code}: {e.reason}"
        except Exception as e:
            print(f"Bland AI trigger failed: {str(e)}. Falling back to simulation mode...", flush=True)
            error_reason = str(e)
            
    # Fallback to simulation mode if Bland AI call fails or key is missing
    if not bland_api_key:
        error_reason = "No Bland AI key configured."
        
    cursor.execute('''
        INSERT INTO calls (id, lead_id, phone, status, transcript, recording_url, duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (call_id, lead_id, phone, "ringing", "", "", 0, created_at))
    conn.commit()
    conn.close()
    
    # Start simulation thread
    sim_thread = threading.Thread(target=run_call_simulation, args=(call_id, lead_id, phone, lead_name))
    sim_thread.daemon = True
    sim_thread.start()
    
    return jsonify({
        "success": True,
        "call_id": call_id,
        "status": "ringing",
        "phone": phone,
        "lead_id": lead_id,
        "lead_name": lead_name,
        "mode": "simulated",
        "error": error_reason
    }), 201

def run_call_simulation(call_id, lead_id, phone, lead_name):
    # Simulated dialog turns
    dialog = [
        {"speaker": "Agent", "text": "Hello, welcome to Lohitha Dharma Projects. May I know your name please?"},
        {"speaker": "Customer", "text": f"Hello, my name is {lead_name}."},
        {"speaker": "Agent", "text": f"Thank you Mr. {lead_name.split()[0] if lead_name else 'Investor'}. Which of our premium Red Sandalwood projects are you interested in?"},
        {"speaker": "Customer", "text": "I am looking for a farmland plot in Rayalaseema Orchards."},
        {"speaker": "Agent", "text": "Rayalaseema Orchards is a wonderful choice for high-yield returns. What is your estimated investment budget?"},
        {"speaker": "Customer", "text": "My budget is around 35 Lakhs."},
        {"speaker": "Agent", "text": "Perfect. What is your registration timeline?"},
        {"speaker": "Customer", "text": "I'm ready to proceed immediately, within this month."},
        {"speaker": "Agent", "text": "Understood. Have you cleared the booking token advance?"},
        {"speaker": "Customer", "text": "Yes, I paid a token advance of 2 Lakhs yesterday."},
        {"speaker": "Agent", "text": f"Excellent, we have verified that. I have updated your profile. Our senior site advisor will contact you at {phone} to coordinate the registration map. Thank you for choosing Lohitha Dharma!"},
        {"speaker": "Customer", "text": "Thank you, goodbye."}
    ]
    
    active_simulations[call_id] = {
        "status": "ringing",
        "turns": [],
        "completed": False
    }
    
    # Ringing phase (3 seconds)
    time.sleep(3)
    active_simulations[call_id]["status"] = "in-progress"
    
    # Update call status in DB to in-progress
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE calls SET status = 'in-progress' WHERE id = ?", (call_id,))
    conn.commit()
    conn.close()
    
    full_transcript = []
    
    for turn in dialog:
        if active_simulations[call_id]["completed"]:
            break
        text_line = f"{turn['speaker']}: {turn['text']}"
        full_transcript.append(text_line)
        active_simulations[call_id]["turns"].append(turn)
        
        # Simulate typing/speaking delay
        time.sleep(2.5)
        
    # Finalize call
    final_text = "\n".join(full_transcript)
    duration = len(dialog) * 3
    recording_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"  # Dummy audio link for demo
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE calls 
        SET status = 'completed', transcript = ?, recording_url = ?, duration = ?
        WHERE id = ?
    ''', (final_text, recording_url, duration, call_id))
    conn.commit()
    
    # Run qualification on the transcript
    parsed = parse_multilingual_transcript(final_text)
    
    # Check if lead exists, otherwise create a new one
    if lead_id:
        cursor.execute("SELECT id FROM leads WHERE id = ?", (lead_id,))
        lead_exists = cursor.fetchone()
    else:
        lead_exists = False
        
    score, lead_status = qualify_lead_score(parsed["timeline"], parsed["token_paid"], parsed["budget"])
    insights = generate_insights_list(parsed["name"], "0.25 Acre Farmland (100 Trees)", parsed["location"], parsed["timeline"], parsed["token_paid"], parsed["budget"], score)
    
    if lead_exists:
        # Update existing lead
        cursor.execute('''
            UPDATE leads 
            SET name = ?, location = ?, budget = ?, timeline = ?, token_paid = ?, ai_score = ?, status = ?
            WHERE id = ?
        ''', (parsed["name"], parsed["location"], parsed["budget"], parsed["timeline"], parsed["token_paid"], score, lead_status, lead_id))
        
        # Clear old insights and insert new
        cursor.execute("DELETE FROM ai_insights WHERE lead_id = ?", (lead_id,))
        for ins in insights:
            cursor.execute("INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)", (lead_id, ins))
    else:
        # Create new lead from call
        new_lead_id = lead_id or f"LD-{random.randint(1000, 9999)}"
        created_at_lead = datetime.utcnow().isoformat() + "Z"
        cursor.execute('''
            INSERT INTO leads (id, name, email, phone, plot_type, location, budget, ai_score, status, created_at, timeline, token_paid, agent_assigned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            new_lead_id, parsed["name"], parsed["email"] or "investor@lohithadharma.com", phone,
            "0.25 Acre Farmland (100 Trees)", parsed["location"], parsed["budget"],
            score, lead_status, created_at_lead, parsed["timeline"], parsed["token_paid"], "Sarah Jenkins"
        ))
        
        for ins in insights:
            cursor.execute("INSERT INTO ai_insights (lead_id, insight) VALUES (?, ?)", (new_lead_id, ins))
            
        # Update call with new lead id if it was anonymous
        if not lead_id:
            cursor.execute("UPDATE calls SET lead_id = ? WHERE id = ?", (new_lead_id, call_id))
            
    conn.commit()
    conn.close()
    
    # Sync to Firestore
    sync_lead_to_firestore(lead_id or new_lead_id)
    
    active_simulations[call_id]["status"] = "completed"
    active_simulations[call_id]["completed"] = True


@app.route('/api/calls/sim-stream/<call_id>', methods=['GET'])
def sim_stream(call_id):
    def event_generator():
        last_turn_count = 0
        
        # Give initial handshake
        yield f"data: {json.dumps({'type': 'init', 'status': 'queued'})}\n\n"
        
        while True:
            if call_id not in active_simulations:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Call not found'})}\n\n"
                break
                
            state = active_simulations[call_id]
            current_status = state["status"]
            current_turns = state["turns"]
            
            # Send status update
            yield f"data: {json.dumps({'type': 'status', 'status': current_status})}\n\n"
            
            # Send any new turns
            if len(current_turns) > last_turn_count:
                for turn in current_turns[last_turn_count:]:
                    yield f"data: {json.dumps({'type': 'turn', 'speaker': turn['speaker'], 'text': turn['text']})}\n\n"
                last_turn_count = len(current_turns)
                
            if state["completed"]:
                yield f"data: {json.dumps({'type': 'completed'})}\n\n"
                break
                
            time.sleep(1.0)
            
    res = Response(event_generator(), mimetype='text/event-stream')
    res.headers['X-Accel-Buffering'] = 'no'
    res.headers['Cache-Control'] = 'no-cache'
    res.headers['Connection'] = 'keep-alive'
    res.headers['Access-Control-Allow-Origin'] = '*'
    return res

@app.route('/api/calls/webhook', methods=['POST'])
def calls_webhook():
    data = request.json or {}
    print(f"Received webhook callback payload: {json.dumps(data)}")
    
    # Bland AI webhook fields mapping (handles both Bland AI format and our simulation format)
    phone = data.get("phone_number") or data.get("phone")
    transcript_text = data.get("concatenated_transcript") or data.get("transcript")
    duration = extract_call_duration(data)
    recording_url = data.get("recording_url") or data.get("recording", "")
    
    metadata = data.get("metadata") or {}
    lead_id = metadata.get("lead_id") or data.get("lead_id")
    call_id = metadata.get("call_id") or data.get("call_id") or data.get("id")
    
    if not phone or not transcript_text:
        return jsonify({"error": "Phone and transcript are required"}), 400
        
    try:
        resolved_lead_id = save_and_sync_call_data(
            call_id=call_id,
            lead_id=lead_id,
            phone=phone,
            transcript_text=transcript_text,
            duration=duration,
            recording_url=recording_url
        )
        return jsonify({"success": True, "call_id": call_id, "lead_id": resolved_lead_id}), 200
    except Exception as e:
        print(f"Error processing webhook: {str(e)}", flush=True)
        return jsonify({"error": str(e)}), 500


# Start Flask server
if __name__ == '__main__':
    init_db()
    
    # Read environment variables for safe default configuration
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    host_ip = os.environ.get("FLASK_HOST", "127.0.0.1")
    
    print(f"SQLite database verified. Running Lohitha Dharma API on {host_ip}:5000 (debug={debug_mode})...")
    app.run(host=host_ip, port=5000, debug=debug_mode, use_evalex=False)
