import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, updateDoc, query, orderBy, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lohitha-dharma-project",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:926787117945:web:05b27f4dd948838fd205a8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lohitha-dharma-project.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCu63Ej-ViFR71ifFjDJWES0ylWjp1iZLQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lohitha-dharma-project.firebaseapp.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "926787117945",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0WVZ9T3HJ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "default");

// Helper to pre-populate Firebase database with seeds if empty
export async function initFirebaseSeeds() {
  try {
    const leadsRef = collection(db, "leads");
    const q = await getDocs(leadsRef);
    if (q.empty) {
      console.log("Pre-populating Firestore with seed data...");
      const seeds = [
        {
          id: "LD-1001",
          name: "Karthik Reddy",
          email: "karthik.reddy@gmail.com",
          phone: "+91 98765 43210",
          plot_type: "1200 Sq. Yards Plot (100 Trees)",
          location: "Kadapa Valley (Phase I & II)",
          budget: 2400000,
          ai_score: 94,
          status: "Qualified",
          created_at: "2026-06-12T09:12:00Z",
          timeline: "Immediate (< 1 month)",
          token_paid: true,
          agent_assigned: "Sarah Jenkins",
          insights: [
            "Booking token advance of ₹2.4 Lakhs cleared successfully.",
            "High interest in East-facing boundary plots in Kadapa Valley.",
            "Customer requested soil health analysis and layout registration map.",
            "Drip irrigation maintenance agreement signed."
          ]
        },
        {
          id: "LD-1002",
          name: "Dr. Amit Sharma",
          email: "amit.sharma@outlook.com",
          phone: "+91 99112 30044",
          plot_type: "0.5 Acre Farmland (200 Trees)",
          location: "Tirupati Foothills",
          budget: 6000000,
          ai_score: 88,
          status: "Qualified",
          created_at: "2026-06-14T14:35:00Z",
          timeline: "1 - 3 months",
          token_paid: true,
          agent_assigned: "Michael Thorne",
          insights: [
            "Planning long-term retirement plantation holding.",
            "Verified Down Payment (25%) is ready for stamp registration.",
            "Highly responsive to call updates. Prefers Tirupati Foothills project.",
            "Wants organic status monitoring."
          ]
        },
        {
          id: "LD-1003",
          name: "Srinivas Naidu",
          email: "srinivas.naidu@techcorp.in",
          phone: "+91 98450 89041",
          plot_type: "600 Sq. Yards Plot (50 Trees)",
          location: "Chittoor Reserve",
          budget: 1200000,
          ai_score: 75,
          status: "Warm",
          created_at: "2026-06-15T11:20:00Z",
          timeline: "1 - 3 months",
          token_paid: false,
          agent_assigned: "Emma Watson",
          insights: [
            "Interested in long term tax benefits.",
            "Comparing pricing structures with local developer offerings.",
            "Down Payment pending final bank clearance."
          ]
        }
      ];
      for (const s of seeds) {
        await setDoc(doc(db, "leads", s.id), s);
      }
    }
  } catch (err) {
    console.error("Error seeding Firebase:", err);
  }
}
