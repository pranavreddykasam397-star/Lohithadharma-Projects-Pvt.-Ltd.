# Lohithadharma Projects Outbound AI & Voice Analytics Pipeline

This repository contains the CRM and Outbound AI agent integration for Lohithadharma Projects Pvt. Ltd. The system enables automated calling of leads, call tracking, and AI-driven analysis of transcripts.

## Pipeline Architecture & Flow

```mermaid
flowchart TD
    %% Theme Styling
    classDef client fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC;
    classDef server fill:#0F172A,stroke:#34D399,stroke-width:2px,color:#F8FAFC;
    classDef external fill:#0F172A,stroke:#F59E0B,stroke-width:2px,color:#F8FAFC;
    classDef storage fill:#0F172A,stroke:#A78BFA,stroke-width:2px,color:#F8FAFC;

    subgraph Client [CRM Frontend]
        A([CRM Dashboard]):::client
    end

    subgraph Services [AI & Voice Services]
        B[Bland AI API]:::external
        C[Customer Mobile]:::external
        H[Gemini 2.5 Flash / Lohith AI]:::external
    end

    subgraph Database [Backend & Storage]
        D[Flask Server]:::server
        E[(SQLite leads.db)]:::storage
        F[(Cloud Firestore)]:::storage
    end

    %% Pipeline Operations
    A -->|1. Trigger Call| B
    B <-->|2. Voice Call| C
    B -->|3. Webhook Callback| D
    D -->|4. Store Lead| E
    E -->|5. Real-time Sync| F

    %% Secondary Actions
    A -.->|Poll Status| D
    A <-->|AI Details Extraction| H
    A -.->|Save Extracted Lead| F
```

### 1. Outbound Call Triggering
- Phone calls are triggered from the **CRM Dashboard** via the `POST /api/calls/trigger` endpoint.
- If a Bland AI API key is configured, the server initiates an outbound call utilizing Bland AI's voice agent network.
- The webhook base URL (e.g. ngrok public URL) is supplied to Bland AI so that the call data is posted back when the interaction ends.

### 2. Post-Call Webhook & Sync
- Once the call is hung up, Bland AI posts the details (concatenated transcript, call length, recording URL) to the `POST /api/calls/webhook` endpoint.
- The server parses the transcript, saves the call details to the SQLite database (`leads.db`), updates status fields, and synchronizes the lead information with Google Cloud Firestore in real time.

### 3. Direct Transcript Details Extraction
- Under **Call History**, the user can process any finished call transcript with Lohith AI (Gemini).
- Instead of downloading, proxying, and transcribing heavy audio files, the dashboard takes the saved transcript text and performs the extraction directly.
- **Redirection & Verification**: Clicking "Process with Lohith AI" redirects to the **Voice Capture** tab, auto-populates the transcript text area, and triggers Gemini details extraction.
- **Smart Retries**: If network or API limits cause a failure, the pipeline displays an error message and automatically retries the process after 5 seconds, up to 3 attempts.

## Environment Variables
Create a `.env` file in the root directory:
```env
BLAND_API_KEY=your_bland_api_key
WEBHOOK_BASE_URL=your_public_ngrok_or_tunnel_url
```
