import os
import shutil
import sqlite3
import json

# SQLite and PostgreSQL connection details
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads.db')
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads_readonly.db')

def get_secret(secret_name, default_value=None):
    return os.environ.get(secret_name) or default_value

def migrate():
    database_url = get_secret("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable is missing. Cannot migrate to PostgreSQL.", flush=True)
        return

    print("Step 1: Creating a Read-Only backup copy of SQLite database...", flush=True)
    if not os.path.exists(DB_PATH):
        print("Warning: Source SQLite database file 'leads.db' not found. Creating table schemas only in PostgreSQL.", flush=True)
        sqlite_conn = None
    else:
        shutil.copyfile(DB_PATH, BACKUP_PATH)
        sqlite_conn = sqlite3.connect(BACKUP_PATH)
        sqlite_conn.row_factory = sqlite3.Row
        print(f"Backup created at: {BACKUP_PATH}", flush=True)

    print("Step 2: Connecting to PostgreSQL database...", flush=True)
    try:
        import psycopg2
        import psycopg2.extras
        pg_conn = psycopg2.connect(database_url)
        pg_cursor = pg_conn.cursor()
    except Exception as e:
        print(f"Error: Failed to connect to PostgreSQL: {str(e)}", flush=True)
        if sqlite_conn:
            sqlite_conn.close()
        return

    print("Step 3: Creating table schemas in PostgreSQL...", flush=True)
    
    # Create leads table
    pg_cursor.execute('''
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
    pg_cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_insights (
            id SERIAL PRIMARY KEY,
            lead_id TEXT NOT NULL,
            insight TEXT NOT NULL,
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    ''')

    # Create calls table
    pg_cursor.execute('''
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
    pg_cursor.execute('''
        CREATE TABLE IF NOT EXISTS otps (
            email TEXT PRIMARY KEY,
            otp TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    # Create user_credentials table
    pg_cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_credentials (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            totp_secret TEXT
        )
    ''')

    # Create audit_trail table
    pg_cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_trail (
            id SERIAL PRIMARY KEY,
            lead_id TEXT,
            action TEXT NOT NULL,
            changed_by TEXT NOT NULL,
            old_state TEXT,
            new_state TEXT,
            timestamp TEXT NOT NULL
        )
    ''')

    # Create PL/pgSQL deduplication function
    print("Step 4: Registering PostgreSQL PL/pgSQL deduplicate_lead function...", flush=True)
    pg_cursor.execute('''
        CREATE OR REPLACE FUNCTION deduplicate_lead(target_lead_id TEXT)
        RETURNS VOID AS $$
        DECLARE
            dup_id TEXT;
            target_phone TEXT;
        BEGIN
            SELECT phone INTO target_phone FROM leads WHERE id = target_lead_id;
            IF target_phone IS NULL THEN
                RETURN;
            END IF;
            
            -- Find duplicate lead by last 10 digits
            SELECT id INTO dup_id 
            FROM leads 
            WHERE id <> target_lead_id
              AND substring(regexp_replace(phone, '[^\\d]', '', 'g') from '\\d{10}$') = substring(regexp_replace(target_phone, '[^\\d]', '', 'g') from '\\d{10}$')
            ORDER BY ai_score DESC, created_at DESC 
            LIMIT 1;

            IF dup_id IS NOT NULL THEN
                -- Merge insights
                INSERT INTO ai_insights (lead_id, insight)
                SELECT dup_id, insight 
                FROM ai_insights 
                WHERE lead_id = target_lead_id
                ON CONFLICT DO NOTHING;

                -- Re-route active calls
                UPDATE calls SET lead_id = dup_id WHERE lead_id = target_lead_id;

                -- Delete target duplicate lead record
                DELETE FROM leads WHERE id = target_lead_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    ''')
    pg_conn.commit()

    if not sqlite_conn:
        print("Migration Complete (Schemas & Stored Procedures only).", flush=True)
        pg_cursor.close()
        pg_conn.close()
        return

    print("Step 5: Migrating existing rows from SQLite...", flush=True)
    sqlite_cursor = sqlite_conn.cursor()

    # Migrate user_credentials
    sqlite_cursor.execute("SELECT * FROM user_credentials")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO user_credentials (email, password, totp_secret) VALUES (%s, %s, %s) ON CONFLICT (email) DO NOTHING",
            (r["email"], r["password"], r["totp_secret"])
        )

    # Migrate otps
    sqlite_cursor.execute("SELECT * FROM otps")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO otps (email, otp, created_at) VALUES (%s, %s, %s) ON CONFLICT (email) DO NOTHING",
            (r["email"], r["otp"], r["created_at"])
        )

    # Migrate leads
    sqlite_cursor.execute("SELECT * FROM leads")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO leads (id, name, email, phone, plot_type, location, budget, ai_score, status, created_at, timeline, token_paid, agent_assigned) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (r["id"], r["name"], r["email"], r["phone"], r["plot_type"], r["location"], r["budget"], r["ai_score"], r["status"], r["created_at"], r["timeline"], bool(r["token_paid"]), r["agent_assigned"])
        )

    # Migrate ai_insights
    sqlite_cursor.execute("SELECT * FROM ai_insights")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO ai_insights (lead_id, insight) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (r["lead_id"], r["insight"])
        )

    # Migrate calls
    sqlite_cursor.execute("SELECT * FROM calls")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO calls (id, lead_id, phone, status, transcript, recording_url, duration, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (r["id"], r["lead_id"], r["phone"], r["status"], r["transcript"], r["recording_url"], r["duration"], r["created_at"])
        )

    # Migrate audit_trail
    sqlite_cursor.execute("SELECT * FROM audit_trail")
    for r in sqlite_cursor.fetchall():
        pg_cursor.execute(
            "INSERT INTO audit_trail (lead_id, action, changed_by, old_state, new_state, timestamp) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            (r["lead_id"], r["action"], r["changed_by"], r["old_state"], r["new_state"], r["timestamp"])
        )

    pg_conn.commit()
    print("Migration Complete. All SQLite records migrated successfully.", flush=True)

    sqlite_conn.close()
    pg_cursor.close()
    pg_conn.close()
    
    # Remove read-only copy
    if os.path.exists(BACKUP_PATH):
        os.remove(BACKUP_PATH)

if __name__ == '__main__':
    migrate()
