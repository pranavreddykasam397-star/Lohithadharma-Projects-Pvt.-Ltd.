const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

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
      // Save OTP to Firestore
      await db.collection('otps').doc(emailClean).set({
        otp,
        created_at: createdAt
      });

      // Send Email
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

      // Check 5-minute expiration
      const now = admin.firestore.Timestamp.now().seconds;
      const elapsed = now - createdAt.seconds;
      if (elapsed > 300) {
        return res.status(400).json({ error: 'OTP has expired.' });
      }

      if (storedOtp !== otpClean) {
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }

      // Check user credentials
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

      // Delete the verified OTP
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

      // Check 5-minute expiration
      const now = admin.firestore.Timestamp.now().seconds;
      const elapsed = now - createdAt.seconds;
      if (elapsed > 300) {
        return res.status(400).json({ error: 'OTP has expired.' });
      }

      if (storedOtp !== otpClean) {
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }

      // Get current stored password
      const credDoc = await db.collection('user_credentials').doc(emailClean).get();
      let currentPassword;
      if (credDoc.exists) {
        currentPassword = credDoc.data().password;
      } else {
        currentPassword = getSecurePassword(emailClean);
      }

      // Save new password to database
      await db.collection('user_credentials').doc(emailClean).set({
        password: newPasswordClean
      });

      // Delete verified OTP
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
