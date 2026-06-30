const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors')({ origin: true });
const express = require('express');
const corsExpress = require('cors');
const { authenticator } = require('otplib');

admin.initializeApp();
const db = admin.firestore();

// ─── UTILITY FUNCTIONS ───

function getSecurePassword(email) {
  const secretKey = process.env.AUTH_SECRET_KEY || "lohitha-dharma-auth-secret-key-2026";
  return crypto.createHmac('sha256', secretKey)
    .update(email.toLowerCase())
    .digest('hex');
}

async function sendOtpEmail(toEmail, otp) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || smtpUser;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.log(`[SMTP SIMULATION] To: ${toEmail} | Subject: Lohitha Dharma CRM - Verification Code | OTP: ${otp}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: senderEmail || "no-reply@lohithadharma.com",
      to: toEmail,
      subject: "Lohitha Dharma CRM - Verification Code",
      text: `Hello,\n\nYour verification code is: ${otp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nLohitha Dharma Projects Team`
    };

    await transporter.sendMail(mailOptions);
    console.log(`SMTP Success: OTP email sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`SMTP Error sending email: ${err.message}. Falling back to simulation logs.`);
    console.log(`[SMTP FALLBACK SIMULATION] To: ${toEmail} | OTP: ${otp}`);
    return true;
  }
}

function qualifyLeadScore(timeline, tokenPaid, budget) {
  let score = 40; // Base Score
  if (!timeline) timeline = "";
  
  if (timeline.includes("Immediate") || timeline.includes("< 1")) {
    score += 30;
  } else if (timeline.includes("1 - 3")) {
    score += 20;
  } else if (timeline.includes("3 - 6")) {
    score += 10;
  } else if (timeline.includes("6+")) {
    score += 2;
  }
  
  if (tokenPaid) {
    score += 25;
  } else {
    score += 5;
  }
  
  if (budget >= 10000000) {
    score += 5;
  } else if (budget >= 5000000) {
    score += 3;
  }
  
  // Conversational variance (-2 to +5)
  const offset = Math.floor(Math.random() * 8) - 2;
  score = Math.min(100, Math.max(10, score + offset));
  
  let status = "Cold";
  if (score >= 80) {
    status = "Qualified";
  } else if (score >= 60) {
    status = "Warm";
  }
  
  return { score, status };
}

function generateInsightsList(name, plotType, location, timeline, tokenPaid, budget, score) {
  const insights = [];
  
  if (tokenPaid) {
    insights.push("Verified booking token / registration down payment cleared.");
  } else {
    insights.push("Down payment status is pending. Direct registration action required.");
  }
  
  if (timeline && timeline.includes("Immediate")) {
    insights.push("High urgency buyer planning immediate physical deed registration.");
  } else if (timeline && timeline.includes("6+")) {
    insights.push("Long-term research profile currently assessing plantation returns.");
  } else {
    insights.push("Urgency profile: planning land acquisition within this quarter.");
  }
  
  insights.push(`Targeting ${plotType} in the premium cluster of ${location}.`);
  
  if (score >= 80) {
    insights.push(`Highly qualified investor profile (Score: ${score}%). High intent detected.`);
  } else if (score >= 60) {
    insights.push(`Moderate match (Score: ${score}%). Needs call nurturing on maintenance options.`);
  } else {
    insights.push(`Low match criteria (Score: ${score}%). Require validation of budget capability.`);
  }
  
  return insights;
}

function cleanTranscriptForInvestor(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const investorLines = [];
  let hasSpeakerPrefixes = false;
  
  for (const line of lines) {
    if (/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:/i.test(line)) {
      hasSpeakerPrefixes = true;
      break;
    }
  }
  
  if (hasSpeakerPrefixes) {
    for (const line of lines) {
      if (/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:/i.test(line)) {
        const cleanedLine = line.replace(/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:\s*/i, '');
        investorLines.push(cleanedLine);
      }
    }
    return investorLines.join('\n');
  }
  
  const filteredLines = [];
  let hasAgentPrefixes = false;
  for (const line of lines) {
    if (/^\s*(?:agent|q|representative|sales|staff|host|employee)\s*:/i.test(line)) {
      hasAgentPrefixes = true;
      continue;
    }
    filteredLines.push(line);
  }
  if (hasAgentPrefixes) {
    return filteredLines.join('\n');
  }
  
  return text;
}

function parseMultilingualTranscript(text) {
  let name = null;
  let email = null;
  let budget = 2400000;
  let location = "Kadapa Valley (Phase I & II)";
  let timeline = "1 - 3 months";
  let tokenPaid = false;
  let plotType = "0.25 Acre Farmland (100 Trees)";
  
  const cleanedText = cleanTranscriptForInvestor(text);
  const textLower = cleanedText.toLowerCase();
  const fullTextLower = text.toLowerCase();
  
  // 1. Email Extraction
  let tempEmailText = cleanedText.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.');
  const emailMatch = tempEmailText.match(/[\w\.-]+\s*@\s*[\w\.-]+\s*\.\s*\w+/);
  if (emailMatch) {
    email = emailMatch[0].replace(/\s+/g, '');
  } else {
    let tempFullText = text.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.');
    const fullEmailMatch = tempFullText.match(/[\w\.-]+\s*@\s*[\w\.-]+\s*\.\s*\w+/);
    if (fullEmailMatch) {
      email = fullEmailMatch[0].replace(/\s+/g, '');
    }
  }
  
  // 2. Location matching
  if (textLower.includes("nellore") || textLower.includes("nelor") || textLower.includes("నెల్లూరు") || textLower.includes("नेलोर") || textLower.includes("नेल्लूर")) {
    location = "Nellore Greenlands";
  } else if (textLower.includes("kadapa") || textLower.includes("కడప") || textLower.includes("कडపా")) {
    location = "Kadapa Valley (Phase I & II)";
  } else if (textLower.includes("tirupati") || textLower.includes("తిరుపతి") || textLower.includes("तिरुपति")) {
    location = "Tirupati Foothills";
  } else if (textLower.includes("chittoor") || textLower.includes("చిత్తూరు") || textLower.includes("चित्तूर")) {
    location = "Chittoor Reserve";
  } else if (textLower.includes("rayalaseema") || textLower.includes("రాయలసీమ") || textLower.includes("रायलसीमा")) {
    location = "Rayalaseema Orchards";
  } else {
    if (fullTextLower.includes("nellore") || fullTextLower.includes("nelor") || fullTextLower.includes("నెల్లూరు") || fullTextLower.includes("नेलोर")) {
      location = "Nellore Greenlands";
    } else if (fullTextLower.includes("kadapa") || fullTextLower.includes("కడప") || fullTextLower.includes("कడ్పా")) {
      location = "Kadapa Valley (Phase I & II)";
    } else if (fullTextLower.includes("tirupati") || fullTextLower.includes("తిరుపతి") || fullTextLower.includes("तिरुपति")) {
      location = "Tirupati Foothills";
    } else if (fullTextLower.includes("chittoor") || fullTextLower.includes("చిత్తూరు") || fullTextLower.includes("चित्तूर")) {
      location = "Chittoor Reserve";
    } else if (fullTextLower.includes("rayalaseema") || fullTextLower.includes("రాయలసీమ") || fullTextLower.includes("रायलसीमा")) {
      location = "Rayalaseema Orchards";
    }
  }
  
  // 3. Budget extraction (INR)
  const sentences = textLower.split(/[\.\n]/);
  let budgetTarget = textLower;
  const currencyPatterns = [/lakhs?/i, /lacs?/i, /crores?/i, /cr/i, /rupees?/i, /budget/i, /inr/i, /invest(ment)?s?/i];
  for (const s of sentences) {
    if (currencyPatterns.some(pat => pat.test(s))) {
      budgetTarget = s;
      break;
    }
  }
  
  const numMatches = budgetTarget.match(/\d+(?:\.\d+)?/g);
  const isCrore = /crore|crores|cr|करोड़|కోట్లు|కోటి/i.test(budgetTarget);
  const isLakh = /lakh|lakhs|lac|lacs|l\b|लाख|లక్షలు|లక్ష/i.test(budgetTarget);
  
  let extractedNum = null;
  if (numMatches) {
    for (const numStr of numMatches) {
      const val = parseFloat(numStr);
      if (val < 500) {
        extractedNum = val;
        break;
      }
    }
  }
  
  if (extractedNum !== null) {
    if (isCrore) budget = Math.floor(extractedNum * 10000000);
    else if (isLakh) budget = Math.floor(extractedNum * 100000);
    else budget = extractedNum > 10000 ? Math.floor(extractedNum) : Math.floor(extractedNum * 100000);
  } else {
    if (textLower.includes("twenty five") || textLower.includes("25") || textLower.includes("పాతిక") || textLower.includes("पच्चीस")) {
      budget = 2500000;
    } else if (textLower.includes("forty") || textLower.includes("40") || textLower.includes("నలభై") || textLower.includes("चालीस")) {
      budget = 4000000;
    } else if (textLower.includes("seventy five") || textLower.includes("75") || textLower.includes("డెబ్బై ఐదు") || textLower.includes("पचहत्तर")) {
      budget = 7500000;
    } else if (textLower.includes("one point two") || textLower.includes("1.2") || textLower.includes("కోటి ఇరవై")) {
      budget = 12000000;
    } else if (textLower.includes("sixty") || textLower.includes("60") || textLower.includes("అరవై") || textLower.includes("साठ")) {
      budget = 6000000;
    } else if (textLower.includes("twelve") || textLower.includes("12") || textLower.includes("పన్నెండు") || textLower.includes("बारह")) {
      budget = 1200000;
    }
  }
  
  // 4. Name extraction
  const namePatterns = [
    /(?:my name is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:मेरा नाम)\s+([^\s।]+(?:\s+[^\s।]+)?)(?:\s+है)?/i,
    /(?:నా పేరు)\s+([^\s\.]+(?:\s+[^\s\.]+)?)/i
  ];
  for (const pattern of namePatterns) {
    const match = cleanedText.match(pattern) || text.match(pattern);
    if (match) {
      name = match[1].trim();
      break;
    }
  }
  
  if (name) {
    name = name.replace("అండి", "").replace("రెడ్డి", "Reddy").replace("గారు", "").replace("जी", "").trim();
  } else {
    if (email) {
      name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } else {
      name = "Interested Investor";
    }
  }
  
  // 5. Timeline extraction
  if (/(immediate|next week|this month|వెంటనే|ఈ నెల|तुरंत|अगले हफ्ते|1 నెల)/i.test(textLower)) {
    timeline = "Immediate (< 1 month)";
  } else if (/(1-3 months|2 months|రెండు నెలలు|दो महीने|अगले महीने|1-3 నెలలు)/i.test(textLower)) {
    timeline = "1 - 3 months";
  } else if (/(3-6 months|3 months|మూడు నెలలు|तीन महीने|अगले तीन महीने)/i.test(textLower)) {
    timeline = "3 - 6 months";
  } else if (/(6\+ months|7 months|seven months|eight months|nine months|ten months|year|years|next year|వచ్చే ఏడాది|अगले साल)/i.test(textLower)) {
    timeline = "6+ months";
  } else {
    if (/(immediate|next week|this month|వెంటనే|ఈ నెల|तुरंत|अगले हफ्ते)/i.test(fullTextLower)) {
      if (!textLower.includes("is it immediate") && !textLower.includes("one to three months")) {
        timeline = "Immediate (< 1 month)";
      }
    } else if (fullTextLower.includes("6+ months") || fullTextLower.includes("6 months or more") || fullTextLower.includes("seven months")) {
      timeline = "6+ months";
    }
  }
  
  // 6. Token Paid
  const tokenKeywords = ["paid", "debit", "पे", "అడ్వాన్స్", "పే చేసాను", "ట్రాన్స్ఫర్", "दे दिया", "क्रेडिट"];
  const hasTokenWord = tokenKeywords.some(kw => textLower.includes(kw));
  const hasNegation = /(no|not|haven't|don't|didnot|did not|never)/i.test(textLower);
  tokenPaid = hasTokenWord && !hasNegation;
  
  // 7. Plot Type Extraction
  if (textLower.includes("600") || textLower.includes("six hundred")) {
    plotType = "600 Sq. Yards Plot (50 Trees)";
  } else if (textLower.includes("1200") || textLower.includes("twelve hundred")) {
    plotType = "1200 Sq. Yards Plot (100 Trees)";
  } else if (textLower.includes("2400") || textLower.includes("twenty four hundred")) {
    plotType = "2400 Sq. Yards Plot (200 Trees)";
  } else if (textLower.includes("0.25") || textLower.includes("quarter") || textLower.includes("point two five")) {
    plotType = "0.25 Acre Farmland (100 Trees)";
  } else if (textLower.includes("0.5") || textLower.includes("half") || textLower.includes("point five")) {
    plotType = "0.5 Acre Farmland (200 Trees)";
  } else if (textLower.includes("1.0") || textLower.includes("one acre") || textLower.includes("1 acre")) {
    plotType = "1.0 Acre Farmland (400 Trees)";
  } else {
    if (fullTextLower.includes("600") || fullTextLower.includes("six hundred")) {
      plotType = "600 Sq. Yards Plot (50 Trees)";
    } else if (fullTextLower.includes("1200") || fullTextLower.includes("twelve hundred")) {
      plotType = "1200 Sq. Yards Plot (100 Trees)";
    } else if (fullTextLower.includes("2400") || fullTextLower.includes("twenty four hundred")) {
      plotType = "2400 Sq. Yards Plot (200 Trees)";
    } else if (fullTextLower.includes("0.25") || fullTextLower.includes("quarter")) {
      plotType = "0.25 Acre Farmland (100 Trees)";
    } else if (fullTextLower.includes("0.5") || fullTextLower.includes("half")) {
      plotType = "0.5 Acre Farmland (200 Trees)";
    } else if (fullTextLower.includes("1.0") || fullTextLower.includes("one acre")) {
      plotType = "1.0 Acre Farmland (400 Trees)";
    }
  }
  
  return {
    name,
    email,
    budget,
    location,
    timeline,
    token_paid: tokenPaid,
    plot_type: plotType
  };
}

function formatPhoneNumber(phone) {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

function scrubPii(text, leadEmail, leadPhone) {
  if (!text) return "";
  let scrubbed = text;
  
  const ccPattern = /\b(?:\d[ -]*?){13,16}\b/g;
  scrubbed = scrubbed.replace(ccPattern, "[CREDIT_CARD_MASKED]");
  
  const aadhaarPattern = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g;
  scrubbed = scrubbed.replace(aadhaarPattern, "[AADHAAR_MASKED]");
  
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  scrubbed = scrubbed.replace(ssnPattern, "[SSN_MASKED]");
  
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  if (leadEmail) {
    const emails = scrubbed.match(emailPattern) || [];
    for (const email of emails) {
      if (email.toLowerCase() !== leadEmail.toLowerCase()) {
        scrubbed = scrubbed.replace(email, "[EMAIL_MASKED]");
      }
    }
  } else {
    scrubbed = scrubbed.replace(emailPattern, "[EMAIL_MASKED]");
  }
  
  const phonePattern = /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g;
  if (leadPhone) {
    const normLeadPhone = leadPhone.replace(/[^\d]/g, '');
    const phones = scrubbed.match(phonePattern) || [];
    for (const ph of phones) {
      const normPh = ph.replace(/[^\d]/g, '');
      if (normPh.length >= 7 && normPh !== normLeadPhone) {
        scrubbed = scrubbed.replace(ph, "[PHONE_MASKED]");
      }
    }
  } else {
    scrubbed = scrubbed.replace(phonePattern, "[PHONE_MASKED]");
  }
  
  return scrubbed;
}


// ─── EXPRESS APP BACKEND INTEGRATION ───

const app = express();
app.use(corsExpress({ origin: true }));
app.use(express.json());

// --- Authentication & OTP Routes ---

app.post(['/api/auth/send-otp', '/auth/send-otp'], async (req, res) => {
  const { email } = req.body || {};
  let { otp } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailClean = email.trim().toLowerCase();
  if (!otp) {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  }

  try {
    await db.collection('otps').doc(emailClean).set({
      otp,
      created_at: admin.firestore.Timestamp.now()
    });

    await sendOtpEmail(emailClean, otp);
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error in sendOtp:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

app.post(['/api/auth/verify-otp', '/auth/verify-otp'], async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const emailClean = email.trim().toLowerCase();
  const otpClean = otp.trim();

  try {
    const otpDoc = await db.collection('otps').doc(emailClean).get();
    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'No OTP found or code expired.' });
    }

    const { otp: storedOtp, created_at: createdAt } = otpDoc.data();
    const now = admin.firestore.Timestamp.now().seconds;
    const elapsed = now - createdAt.seconds;
    if (elapsed > 300) {
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (storedOtp !== otpClean) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    const credDoc = await db.collection('user_credentials').doc(emailClean).get();
    let secureCredential;
    if (credDoc.exists) {
      secureCredential = credDoc.data().password;
    } else {
      secureCredential = getSecurePassword(emailClean);
      await db.collection('user_credentials').doc(emailClean).set({
        password: secureCredential
      });
    }

    await db.collection('otps').doc(emailClean).delete();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      credential: secureCredential
    });
  } catch (err) {
    console.error('Error in verifyOtp:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

app.post(['/api/auth/reset-password', '/auth/reset-password'], async (req, res) => {
  const { email, otp, new_password } = req.body || {};
  if (!email || !otp || !new_password) {
    return res.status(400).json({ error: 'Email, OTP and New Password are required' });
  }

  const emailClean = email.trim().toLowerCase();
  const otpClean = otp.trim();
  const newPasswordClean = new_password.trim();

  if (newPasswordClean.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const otpDoc = await db.collection('otps').doc(emailClean).get();
    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'No OTP found or code expired.' });
    }

    const { otp: storedOtp, created_at: createdAt } = otpDoc.data();
    const now = admin.firestore.Timestamp.now().seconds;
    const elapsed = now - createdAt.seconds;
    if (elapsed > 300) {
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (storedOtp !== otpClean) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    const credDoc = await db.collection('user_credentials').doc(emailClean).get();
    let currentPassword;
    if (credDoc.exists) {
      currentPassword = credDoc.data().password;
    } else {
      currentPassword = getSecurePassword(emailClean);
    }

    await db.collection('user_credentials').doc(emailClean).set({
      password: newPasswordClean
    });

    await db.collection('otps').doc(emailClean).delete();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      credential: currentPassword
    });
  } catch (err) {
    console.error('Error in resetPassword:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// --- TOTP MFA Setup & Verification Routes ---

app.post(['/api/auth/totp-setup', '/auth/totp-setup'], async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const emailClean = email.trim().toLowerCase();
  
  try {
    const secret = authenticator.generateSecret();
    const uri = authenticator.keyuri(emailClean, 'Lohitha Dharma Projects', secret);
    
    return res.status(200).json({ secret, uri });
  } catch (err) {
    console.error("TOTP Setup error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post(['/api/auth/totp-save', '/auth/totp-save'], async (req, res) => {
  const { email, secret, token } = req.body || {};
  if (!email || !secret || !token) {
    return res.status(400).json({ error: 'Email, secret and token code are required' });
  }
  const emailClean = email.trim().toLowerCase();
  const secretClean = secret.trim();
  const tokenClean = token.trim();
  
  try {
    const isValid = authenticator.verify({ token: tokenClean, secret: secretClean });
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your app and try again.' });
    }
    
    const credDoc = await db.collection('user_credentials').doc(emailClean).get();
    if (!credDoc.exists) {
      const defaultPass = getSecurePassword(emailClean);
      await db.collection('user_credentials').doc(emailClean).set({
        password: defaultPass,
        totp_secret: secretClean
      });
    } else {
      await db.collection('user_credentials').doc(emailClean).update({
        totp_secret: secretClean
      });
    }
    
    return res.status(200).json({ success: true, message: 'TOTP MFA registered successfully' });
  } catch (err) {
    console.error("TOTP Save error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post(['/api/auth/totp-verify', '/auth/totp-verify'], async (req, res) => {
  const { email, token } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const emailClean = email.trim().toLowerCase();
  
  try {
    const credDoc = await db.collection('user_credentials').doc(emailClean).get();
    const totpSecret = (credDoc.exists && credDoc.data().totp_secret) ? credDoc.data().totp_secret : null;
    const hasSecret = !!totpSecret;
    
    if (!token) {
      return res.status(200).json({ is_registered: hasSecret });
    }
    
    if (!hasSecret) {
      return res.status(400).json({
        is_registered: false,
        error: 'MFA is not set up for this account. Please verify via Email OTP to set up MFA.'
      });
    }
    
    const tokenClean = token.trim();
    const isValid = authenticator.verify({ token: tokenClean, secret: totpSecret });
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid MFA code. Please check your app and try again.' });
    }
    
    return res.status(200).json({ success: true, message: 'MFA verified successfully' });
  } catch (err) {
    console.error("TOTP Verify error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Calls Management Routes ---

app.get(['/api/calls', '/calls'], async (req, res) => {
  try {
    const snapshot = await db.collection('calls').orderBy('created_at', 'desc').get();
    const calls = [];
    snapshot.forEach(doc => {
      calls.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json(calls);
  } catch (err) {
    console.error("Error fetching calls:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/calls/:callId', '/calls/:callId'], async (req, res) => {
  const { callId } = req.params;
  try {
    await db.collection('calls').doc(callId).delete();
    return res.status(200).json({ success: true, message: `Call ${callId} deleted successfully` });
  } catch (err) {
    console.error("Error deleting call:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/calls', '/calls'], async (req, res) => {
  try {
    const snapshot = await db.collection('calls').get();
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return res.status(200).json({ success: true, message: "All calls cleared successfully" });
  } catch (err) {
    console.error("Error clearing calls:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Proxy Recording Endpoint ---

app.get(['/api/calls/proxy-recording', '/calls/proxy-recording'], async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bland AI HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(Buffer.from(buffer));
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Trigger Call Endpoint ---

app.post(['/api/calls/trigger', '/calls/trigger'], async (req, res) => {
  const { phone, lead_id, bland_api_key, webhook_base_url } = req.body || {};
  
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  
  const formattedPhone = formatPhoneNumber(phone);
  const callId = `CALL-${Math.floor(10000 + Math.random() * 90000)}`;
  const createdAt = new Date().toISOString();
  
  const resolvedBlandKey = process.env.BLAND_API_KEY || bland_api_key;
  const resolvedWebhookBase = process.env.WEBHOOK_BASE_URL || webhook_base_url;
  
  let leadName = "Interested Investor";
  if (lead_id) {
    const leadSnap = await db.collection('leads').doc(lead_id).get();
    if (leadSnap.exists) {
      leadName = leadSnap.data().name || "Interested Investor";
    }
  }
  
  let errorReason = null;
  
  if (resolvedBlandKey && !resolvedBlandKey.startsWith("http")) {
    console.log(`Triggering real call to ${formattedPhone} via Bland AI...`);
    const prompt = `You are a friendly, professional AI outbound calling agent for Lohitha Dharma Projects Pvt. Ltd., a premium managed Red Sandalwood farmland developer. 
Your goal is to connect with the lead, confirm their name, and qualify their purchase intent for farmland.
Converse naturally and dynamically.
Extract the following information during the call:
1. Confirm their full name (which is ${leadName}).
2. Ask for their email address.
3. Ask what plot type size they are looking for (must be one of: 600 Sq. Yards, 1200 Sq. Yards, 2400 Sq. Yards, 0.25 Acre, 0.5 Acre, 1.0 Acre).
4. Ask which farmland project/location they are interested in (must be one of: Kadapa Valley (Phase I & II), Tirupati Foothills, Chittoor Reserve, Nellore Greenlands, Rayalaseema Orchards).
5. Ask for their estimated investment budget in Indian Rupees (INR).
6. Ask what their timeline is for registering the plot (e.g., immediate, 1-3 months, 3-6 months, 6+ months).
7. Ask if they have paid the advance booking token to reserve their plot.

Start the call by asking for their name and greeting them. Once you have collected all info, thank them and end the call.`;

    let webhookUrl = null;
    if (resolvedWebhookBase) {
      webhookUrl = `${resolvedWebhookBase.replace(/\/$/, '')}/api/calls/webhook`;
    }
    
    try {
      const blandPayload = {
        phone_number: formattedPhone,
        task: prompt,
        first_sentence: "Hello, welcome to Lohitha Dharma Projects. May I know your name please?",
        voice: "nat",
        language: "en",
        webhook: webhookUrl,
        record: true,
        metadata: {
          lead_id: lead_id,
          call_id: callId
        }
      };
      
      const response = await fetch("https://api.bland.ai/v1/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authorization": resolvedBlandKey,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify(blandPayload)
      });
      
      const resJson = await response.json();
      if (response.ok) {
        const blandCallId = resJson.call_id || resJson.id || callId;
        
        await db.collection('calls').doc(blandCallId).set({
          lead_id: lead_id || null,
          phone: formattedPhone,
          status: "in-progress",
          transcript: "",
          recording_url: "",
          duration: 0,
          created_at: createdAt
        });
        
        return res.status(200).json({
          success: true,
          call_id: blandCallId,
          status: "in-progress",
          phone: formattedPhone,
          lead_id: lead_id || null,
          lead_name: leadName,
          mode: "real"
        });
      } else {
        errorReason = resJson.message || resJson.error || `HTTP ${response.status}`;
        console.error(`Bland AI API Error: ${errorReason}`);
      }
    } catch (err) {
      errorReason = err.message || err;
      console.error(`Bland AI Trigger failed:`, err);
    }
  }
  
  if (!resolvedBlandKey) {
    errorReason = "No Bland AI key configured.";
  }
  
  // Simulated Call Fallback
  await db.collection('calls').doc(callId).set({
    lead_id: lead_id || null,
    phone: formattedPhone,
    status: "ringing",
    transcript: "",
    recording_url: "",
    duration: 0,
    created_at: createdAt
  });
  
  return res.status(201).json({
    success: true,
    call_id: callId,
    status: "ringing",
    phone: formattedPhone,
    lead_id: lead_id || null,
    lead_name: leadName,
    mode: "simulated",
    error: errorReason
  });
});

// --- Bland AI Webhook Endpoint ---

app.post(['/api/calls/webhook', '/calls/webhook'], async (req, res) => {
  const data = req.body || {};
  console.log("Received webhook callback payload:", JSON.stringify(data));
  
  const phone = data.phone_number || data.phone;
  const transcriptText = data.concatenated_transcript || data.transcript;
  const duration = data.duration || (data.concatenated_transcript ? data.concatenated_transcript.split('\n').length * 3 : 0);
  const recordingUrl = data.recording_url || data.recording || "";
  
  const metadata = data.metadata || {};
  let leadId = metadata.lead_id || data.lead_id;
  const callId = metadata.call_id || data.call_id || data.id;
  
  if (!phone || !transcriptText) {
    return res.status(400).json({ error: "Phone and transcript are required" });
  }
  
  try {
    const formattedPhone = formatPhoneNumber(phone);
    
    let leadEmail = null;
    let leadPhone = formattedPhone;
    if (leadId) {
      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (leadSnap.exists) {
        leadEmail = leadSnap.data().email;
        leadPhone = leadSnap.data().phone || formattedPhone;
      }
    }
    
    const scrubbedTranscript = scrubPii(transcriptText, leadEmail, leadPhone);
    
    if (!leadId) {
      const leadsSnap = await db.collection('leads').get();
      leadsSnap.forEach(doc => {
        const lp = doc.data().phone || "";
        const normLp = lp.replace(/[^\d]/g, '');
        const normPhone = formattedPhone.replace(/[^\d]/g, '');
        if (normLp.endsWith(normPhone.slice(-10))) {
          leadId = doc.id;
        }
      });
    }
    
    const finalCallId = callId || `CALL-${Math.floor(10000 + Math.random() * 90000)}`;
    const callRef = db.collection('calls').doc(finalCallId);
    const callSnap = await callRef.get();
    
    if (callSnap.exists) {
      await callRef.update({
        status: 'completed',
        transcript: scrubbedTranscript,
        recording_url: callSnap.data().recording_url || recordingUrl,
        duration: duration
      });
    } else {
      await callRef.set({
        lead_id: leadId || null,
        phone: formattedPhone,
        status: "completed",
        transcript: scrubbedTranscript,
        recording_url: recordingUrl,
        duration: duration,
        created_at: new Date().toISOString()
      });
    }
    
    const parsed = parseMultilingualTranscript(scrubbedTranscript);
    const { score, status: leadStatus } = qualifyLeadScore(parsed.timeline, parsed.token_paid, parsed.budget);
    const insights = generateInsightsList(parsed.name, parsed.plot_type || "0.25 Acre Farmland (100 Trees)", parsed.location, parsed.timeline, parsed.token_paid, parsed.budget, score);
    
    if (leadId) {
      await db.collection('calls').doc(finalCallId).update({ lead_id: leadId });
      
      const leadRef = db.collection('leads').doc(leadId);
      const leadSnap = await leadRef.get();
      if (leadSnap.exists) {
        await leadRef.update({
          name: parsed.name,
          email: parsed.email || leadSnap.data().email || null,
          plot_type: parsed.plot_type || leadSnap.data().plot_type || "0.25 Acre Farmland (100 Trees)",
          location: parsed.location,
          budget: parsed.budget,
          timeline: parsed.timeline,
          token_paid: parsed.token_paid,
          ai_score: score,
          status: leadStatus,
          insights: insights
        });
      }
    } else {
      const newLeadId = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.collection('leads').doc(newLeadId).set({
        id: newLeadId,
        name: parsed.name,
        email: parsed.email || "investor@lohithadharma.com",
        phone: formattedPhone,
        plot_type: parsed.plot_type || "0.25 Acre Farmland (100 Trees)",
        location: parsed.location,
        budget: parsed.budget,
        ai_score: score,
        status: leadStatus,
        created_at: new Date().toISOString(),
        timeline: parsed.timeline,
        token_paid: parsed.token_paid,
        agent_assigned: "Sarah Jenkins",
        insights: insights
      });
      await db.collection('calls').doc(finalCallId).update({ lead_id: newLeadId });
      leadId = newLeadId;
    }
    
    return res.status(200).json({ success: true, call_id: finalCallId, lead_id: leadId });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Simulated SSE Stream Route ---

app.get(['/api/calls/sim-stream/:callId', '/calls/sim-stream/:callId'], async (req, res) => {
  const callId = req.params.callId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'init', status: 'queued' })}\n\n`);

  try {
    const callRef = db.collection('calls').doc(callId);
    const callSnap = await callRef.get();
    if (!callSnap.exists) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Call not found' })}\n\n`);
      res.end();
      return;
    }

    const callData = callSnap.data();
    const leadId = callData.lead_id;
    const phone = callData.phone;

    let leadName = "Interested Investor";
    if (leadId) {
      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (leadSnap.exists) {
        leadName = leadSnap.data().name || "Interested Investor";
      }
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Ringing phase (3 seconds)
    await sleep(3000);
    
    await callRef.update({ status: 'in-progress' });
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'in-progress' })}\n\n`);

    const dialog = [
      { speaker: "Agent", text: "Hello, welcome to Lohitha Dharma Projects. May I know your name please?" },
      { speaker: "Customer", text: `Hello, my name is ${leadName}.` },
      { speaker: "Agent", text: `Thank you Mr. ${leadName.split(' ')[0] || 'Investor'}. Which of our premium Red Sandalwood projects are you interested in?` },
      { speaker: "Customer", text: "I am looking for a farmland plot in Rayalaseema Orchards." },
      { speaker: "Agent", text: "Rayalaseema Orchards is a wonderful choice for high-yield returns. What is your estimated investment budget?" },
      { speaker: "Customer", text: "My budget is around 35 Lakhs." },
      { speaker: "Agent", text: "Perfect. What is your registration timeline?" },
      { speaker: "Customer", text: "I'm ready to proceed immediately, within this month." },
      { speaker: "Agent", text: "Understood. Have you cleared the booking token advance?" },
      { speaker: "Customer", text: "Yes, I paid a token advance of 2 Lakhs yesterday." },
      { speaker: "Agent", text: `Excellent, we have verified that. I have updated your profile. Our senior site advisor will contact you at ${phone} to coordinate the registration map. Thank you for choosing Lohitha Dharma!` },
      { speaker: "Customer", text: "Thank you, goodbye." }
    ];

    const fullTranscript = [];

    for (const turn of dialog) {
      const textLine = `${turn.speaker}: ${turn.text}`;
      fullTranscript.push(textLine);
      
      res.write(`data: ${JSON.stringify({ type: 'turn', speaker: turn.speaker, text: turn.text })}\n\n`);
      await sleep(2500);
    }

    const finalText = fullTranscript.join('\n');
    const duration = dialog.length * 3;
    const recordingUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    const parsed = parseMultilingualTranscript(finalText);
    const { score, status: leadStatus } = qualifyLeadScore(parsed.timeline, parsed.token_paid, parsed.budget);
    const insights = generateInsightsList(parsed.name, "0.25 Acre Farmland (100 Trees)", parsed.location, parsed.timeline, parsed.token_paid, parsed.budget, score);

    await callRef.update({
      status: 'completed',
      transcript: finalText,
      recording_url: recordingUrl,
      duration: duration
    });

    let finalLeadId = leadId;
    if (finalLeadId) {
      const leadSnap = await db.collection('leads').doc(finalLeadId).get();
      if (leadSnap.exists) {
        await db.collection('leads').doc(finalLeadId).update({
          name: parsed.name,
          location: parsed.location,
          budget: parsed.budget,
          timeline: parsed.timeline,
          token_paid: parsed.token_paid,
          ai_score: score,
          status: leadStatus,
          insights: insights
        });
      } else {
        await db.collection('leads').doc(finalLeadId).set({
          id: finalLeadId,
          name: parsed.name,
          email: parsed.email || "investor@lohithadharma.com",
          phone: phone,
          plot_type: "0.25 Acre Farmland (100 Trees)",
          location: parsed.location,
          budget: parsed.budget,
          ai_score: score,
          status: leadStatus,
          created_at: new Date().toISOString(),
          timeline: parsed.timeline,
          token_paid: parsed.token_paid,
          agent_assigned: "Sarah Jenkins",
          insights: insights
        });
      }
    } else {
      finalLeadId = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.collection('leads').doc(finalLeadId).set({
        id: finalLeadId,
        name: parsed.name,
        email: parsed.email || "investor@lohithadharma.com",
        phone: phone,
        plot_type: "0.25 Acre Farmland (100 Trees)",
        location: parsed.location,
        budget: parsed.budget,
        ai_score: score,
        status: leadStatus,
        created_at: new Date().toISOString(),
        timeline: parsed.timeline,
        token_paid: parsed.token_paid,
        agent_assigned: "Sarah Jenkins",
        insights: insights
      });
      await callRef.update({ lead_id: finalLeadId });
    }

    res.write(`data: ${JSON.stringify({ type: 'status', status: 'completed' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'completed' })}\n\n`);
    res.end();

  } catch (err) {
    console.error("Error in sim-stream:", err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// --- Process Audio Endpoint ---

app.post(['/api/leads/process-audio', '/leads/process-audio'], async (req, res) => {
  const { transcript } = req.body || {};
  if (!transcript) {
    return res.status(400).json({ error: "Missing call transcript text" });
  }
  
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API;
  
  if (geminiKey) {
    console.log("Processing transcript using Gemini 2.5 Flash API...");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const prompt = `
You are a helpful AI assistant for Lohitha Dharma Projects. Analyze this customer call transcript:
"${transcript}"

Extract the following fields and return ONLY a valid JSON object matching this schema. If a field is not present, use null or default timeline:
{
  "name": string (Full name, capitalize, e.g. "Harish Reddy". Parse Indian names and Telugu/Hindi contexts correctly),
  "email": string (Email address, or null if not found),
  "budget": number (Approximate budget in INR, e.g., 2500000. Convert lakh/crores properly. e.g. 25 lakhs = 2500000, 1.2 Crores = 12000000),
  "location": string (Match exactly one of: "Kadapa Valley (Phase I & II)", "Tirupati Foothills", "Chittoor Reserve", "Nellore Greenlands", "Rayalaseema Orchards". Fallback to Kadapa Valley if unmentioned),
  "timeline": string (Must be one of: "Immediate (< 1 month)", "1 - 3 months", "3 - 6 months", "6+ months"),
  "token_paid": boolean (True if they paid/will pay a token advance, booking fee, or money transfer, else False)
}

Return ONLY the raw JSON string. Do not wrap it in markdown code blocks.
`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });
      
      const resJson = await response.json();
      if (response.ok) {
        let content = resJson.candidates[0].content.parts[0].text.strip();
        if (content.startsWith("```")) {
          content = content.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
        }
        const parsedData = JSON.parse(content);
        return res.status(200).json(parsedData);
      }
    } catch (err) {
      console.error("Gemini API execution failed:", err);
    }
  }
  
  console.log("Processing transcript using local regex-NLP parser...");
  const parsedData = parseMultilingualTranscript(transcript);
  return res.status(200).json(parsedData);
});

// Export Express App as the 'api' Firebase Cloud Function
exports.api = functions.https.onRequest(app);


// ─── BACKWARD COMPATIBLE INDIVIDUAL HTTPS CLOUD FUNCTIONS ───

// HTTP endpoint for sendOtp
exports.sendOtp = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { email } = req.body || {};
    let { otp } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailClean = email.trim().toLowerCase();
    if (!otp) {
      otp = Math.floor(100000 + Math.random() * 900000).toString();
    }
    const createdAt = admin.firestore.Timestamp.now();

    try {
      await db.collection('otps').doc(emailClean).set({
        otp,
        created_at: createdAt
      });

      await sendOtpEmail(emailClean, otp);
      return res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
      console.error('Error in sendOtp:', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });
});

// HTTP endpoint for verifyOtp
exports.verifyOtp = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const emailClean = email.trim().toLowerCase();
    const otpClean = otp.trim();

    try {
      const otpDoc = await db.collection('otps').doc(emailClean).get();
      if (!otpDoc.exists) {
        return res.status(400).json({ error: 'No OTP found or code expired.' });
      }

      const { otp: storedOtp, created_at: createdAt } = otpDoc.data();
      const now = admin.firestore.Timestamp.now().seconds;
      const elapsed = now - createdAt.seconds;
      if (elapsed > 300) {
        return res.status(400).json({ error: 'OTP has expired.' });
      }

      if (storedOtp !== otpClean) {
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }

      const credDoc = await db.collection('user_credentials').doc(emailClean).get();
      let secureCredential;
      if (credDoc.exists) {
        secureCredential = credDoc.data().password;
      } else {
        secureCredential = getSecurePassword(emailClean);
        await db.collection('user_credentials').doc(emailClean).set({
          password: secureCredential
        });
      }

      await db.collection('otps').doc(emailClean).delete();

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        credential: secureCredential
      });
    } catch (err) {
      console.error('Error in verifyOtp:', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });
});

// HTTP endpoint for resetPassword
exports.resetPassword = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { email, otp, new_password } = req.body || {};
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP and New Password are required' });
    }

    const emailClean = email.trim().toLowerCase();
    const otpClean = otp.trim();
    const newPasswordClean = new_password.trim();

    if (newPasswordClean.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    try {
      const otpDoc = await db.collection('otps').doc(emailClean).get();
      if (!otpDoc.exists) {
        return res.status(400).json({ error: 'No OTP found or code expired.' });
      }

      const { otp: storedOtp, created_at: createdAt } = otpDoc.data();
      const now = admin.firestore.Timestamp.now().seconds;
      const elapsed = now - createdAt.seconds;
      if (elapsed > 300) {
        return res.status(400).json({ error: 'OTP has expired.' });
      }

      if (storedOtp !== otpClean) {
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }

      const credDoc = await db.collection('user_credentials').doc(emailClean).get();
      let currentPassword;
      if (credDoc.exists) {
        currentPassword = credDoc.data().password;
      } else {
        currentPassword = getSecurePassword(emailClean);
      }

      await db.collection('user_credentials').doc(emailClean).set({
        password: newPasswordClean
      });

      await db.collection('otps').doc(emailClean).delete();

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        credential: currentPassword
      });
    } catch (err) {
      console.error('Error in resetPassword:', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });
});
