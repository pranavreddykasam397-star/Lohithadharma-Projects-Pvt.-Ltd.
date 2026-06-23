import React, { useState, useEffect, useRef } from 'react';
import { db, initFirebaseSeeds } from './firebase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { saveRecording, getRecordings, deleteRecording } from './audioStorage';

const DEFAULT_API = 'http://localhost:5000';

export default function App() {
  // ─── Theme ───
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('app-theme') || 'light';
    document.documentElement.classList.toggle('dark', s === 'dark');
    return s;
  });
  const toggleTheme = () => setTheme(p => {
    const n = p === 'light' ? 'dark' : 'light';
    localStorage.setItem('app-theme', n);
    document.documentElement.classList.toggle('dark', n === 'dark');
    document.body.classList.toggle('dark', n === 'dark');
    return n;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ─── Navigation ───
  const [tab, setTab] = useState('dashboard');

  // ─── Leads State ───
  const [leads, setLeads] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selId, setSelId] = useState(null);
  const [selLead, setSelLead] = useState(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [sort, setSort] = useState('score-desc');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Modal ───
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    plot_type: '1200 Sq. Yards Plot (100 Trees)',
    location: 'Kadapa Valley (Phase I & II)',
    budget: '', timeline: 'Immediate (< 1 month)',
    token_paid: false, agent_assigned: 'Sarah Jenkins'
  });

  // ─── Voice ───
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recLang, setRecLang] = useState('en-IN');
  const [detLang, setDetLang] = useState('');
  const [transcript, setTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving] = useState(false);

  // ─── Gemini ───
  const [apiKey, setApiKey] = useState(() => {
    const s = localStorage.getItem('gemini_api_key');
    const d = '';
    if (s && (s.startsWith('AIzaSy') || s.startsWith('AQ.'))) return s;
    return d;
  });
  const setKey = k => { setApiKey(k); localStorage.setItem('gemini_api_key', k); };

  // ─── ROI ───
  const [priceKg, setPriceKg] = useState(8000);

  // ─── Toast ───
  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  // ─── AI Outbound Calling State ───
  const [outboundPhone, setOutboundPhone] = useState('');
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'ringing', 'in-progress', 'completed'
  const [isSimulatedCall, setIsSimulatedCall] = useState(false);
  const [activeCallId, setActiveCallId] = useState(null);
  const [liveTurns, setLiveTurns] = useState([]);
  const [callsHistory, setCallsHistory] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState(null);
  const [blandKey, setBlandKey] = useState(() => localStorage.getItem('bland_api_key') || '');
  const [webhookBase, setWebhookBase] = useState(() => localStorage.getItem('webhook_base_url') || '');
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backend_api_url') || DEFAULT_API);
  const sseRef = useRef(null);

  const saveBlandKey = (val) => { setBlandKey(val); localStorage.setItem('bland_api_key', val); };
  const saveWebhookBase = (val) => { setWebhookBase(val); localStorage.setItem('webhook_base_url', val); };
  const saveBackendUrl = (val) => { setBackendUrl(val); localStorage.setItem('backend_api_url', val); };

  const fetchCallsHistory = async () => {
    setLoadingCalls(true);
    try {
      const res = await fetch(`${backendUrl}/api/calls`);
      if (res.ok) {
        const data = await res.json();
        setCallsHistory(data);
      }
    } catch (err) {
      console.error("Error fetching call history:", err);
    } finally {
      setLoadingCalls(false);
    }
  };

  const connectToCallStream = (callId) => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = new EventSource(`${backendUrl}/api/calls/sim-stream/${callId}`);
    sseRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'status') {
          setCallStatus(data.status);
        } else if (data.type === 'turn') {
          setLiveTurns(p => {
            const exists = p.some(t => t.speaker === data.speaker && t.text === data.text);
            if (exists) return p;
            return [...p, { speaker: data.speaker, text: data.text }];
          });
        } else if (data.type === 'completed') {
          sse.close();
          toast("AI outbound call completed!", "success");
          setCallStatus('completed');
          fetchCallsHistory();
        } else if (data.type === 'error') {
          sse.close();
          toast("Call error: " + data.message, "error");
          setCallStatus('idle');
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    sse.onerror = () => {
      // Don't close immediately unless we want to, SSE auto-reconnects
    };
  };

  const triggerOutboundCall = async (phone, leadId = null) => {
    if (!phone) {
      toast("Please enter a phone number.", "warning");
      return;
    }
    setCallStatus('ringing');
    setLiveTurns([]);
    setActiveCallId(null);
    setIsSimulatedCall(false);
    toast(`Initiating AI call to ${phone}...`, 'info');

    try {
      const res = await fetch(`${backendUrl}/api/calls/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone, 
          lead_id: leadId,
          bland_api_key: blandKey,
          webhook_base_url: webhookBase
        })
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      const data = await res.json();
      setActiveCallId(data.call_id);
      
      // If it is a real call, we inform the user.
      if (data.mode === 'real') {
        toast("Real voice call triggered successfully via Bland AI!", "success");
        setIsSimulatedCall(false);
        setCallStatus('in-progress');
      } else {
        toast("No Bland AI key configured. Running call in Simulation Mode.", "info");
        setIsSimulatedCall(true);
        connectToCallStream(data.call_id);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to trigger call: " + err.message, "error");
      setCallStatus('idle');
    }
  };

  const stopActiveCall = () => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    setCallStatus('idle');
    setActiveCallId(null);
    setLiveTurns([]);
    setIsSimulatedCall(false);
    toast("Call ended.", "info");
    fetchCallsHistory();
  };

  useEffect(() => {
    if (tab === 'ai-outbound') {
      fetchCallsHistory();
    }
  }, [tab]);

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // ─── Local Recording Storage ───
  const [localRecs, setLocalRecs] = useState([]);
  const [expiredRecs, setExpiredRecs] = useState([]);
  const [settingsModal, setSettingsModal] = useState(false);

  const loadLocalRecordings = async () => {
    try {
      const recs = await getRecordings();
      setLocalRecs(recs);
      const expired = recs.filter(r => {
        const elapsed = Date.now() - r.timestamp;
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        return elapsed >= thirtyDaysMs;
      });
      setExpiredRecs(expired);
      if (expired.length > 0) {
        toast(`⚠️ You have ${expired.length} expired recording(s) that need backup.`, 'warning');
      }
    } catch (err) {
      console.error("Error loading local recordings:", err);
    }
  };

  const downloadRecording = (rec) => {
    const link = document.createElement('a');
    link.href = rec.data;
    link.download = rec.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Downloaded backup: ${rec.name}`, 'success');
  };

  const removeStoredRecording = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this local recording?")) {
      try {
        await deleteRecording(id);
        toast('Local recording removed.', 'success');
        loadLocalRecordings();
      } catch (err) {
        console.error(err);
        toast('Failed to delete recording.', 'error');
      }
    }
  };

  useEffect(() => {
    loadLocalRecordings();
  }, []);

  // ─── Initialize Seeds & Real-time Sync ───
  useEffect(() => {
    let unsub = null;
    let fallbackTimeout = setTimeout(() => {
      if (leads.length === 0) {
        console.warn("Firestore connection timed out. Falling back to local data.");
        toast("Firebase connecting... Using local backup.", "info");
        const local = localStorage.getItem('leads_data');
        if (local) setLeads(JSON.parse(local));
        else {
          const s = getFallbackSeeds();
          localStorage.setItem('leads_data', JSON.stringify(s));
          setLeads(s);
        }
        setLoading(false);
      }
    }, 4000);

    (async () => {
      setLoading(true);
      try {
        await initFirebaseSeeds();
        const q = query(collection(db, 'leads'));
        unsub = onSnapshot(q, (snapshot) => {
          clearTimeout(fallbackTimeout);
          const list = [];
          snapshot.forEach(doc => {
            list.push({ ...doc.data(), id: doc.id });
          });
          setLeads(list);
          if (list.length > 0 && !selId) {
            setSelId(list[0].id);
          }
          setLoading(false);
        }, (err) => {
          console.error("Firestore error: ", err);
          clearTimeout(fallbackTimeout);
          toast("Firestore connection failed. Using local storage.", "warning");
          const local = localStorage.getItem('leads_data');
          if (local) setLeads(JSON.parse(local));
          else {
            const s = getFallbackSeeds();
            localStorage.setItem('leads_data', JSON.stringify(s));
            setLeads(s);
          }
          setLoading(false);
        });
      } catch (e) {
        console.error("Firebase init failed: ", e);
        clearTimeout(fallbackTimeout);
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(fallbackTimeout);
      if (unsub) unsub();
    };
  }, []);

  // ─── Fetch Lead Detail (Fallback to local state array for instant response) ───
  useEffect(() => {
    if (!selId) { setSelLead(null); return; }
    const match = leads.find(l => l.id === selId);
    setSelLead(match || null);
  }, [selId, leads]);

  // ─── Filter & Sort ───
  useEffect(() => {
    let r = [...leads];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(l => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || l.plot_type.toLowerCase().includes(q));
    }
    if (stage !== 'all') r = r.filter(l => l.status.toLowerCase() === stage);
    if (sort === 'score-desc') r.sort((a, b) => b.ai_score - a.ai_score);
    else if (sort === 'score-asc') r.sort((a, b) => a.ai_score - b.ai_score);
    else if (sort === 'budget-desc') r.sort((a, b) => b.budget - a.budget);
    else if (sort === 'date-desc') r.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setFiltered(r);
  }, [leads, search, stage, sort]);

  // ─── Stage Change ───
  const changeStage = async (s) => {
    if (!selId) return;
    try {
      const docRef = doc(db, 'leads', selId);
      await updateDoc(docRef, { status: s });
      toast(`Pipeline → ${s}`, 'success');
    } catch (err) {
      console.error(err);
      toast(`Failed to update status.`, 'error');
    }
  };

  // ─── Delete Lead ───
  const deleteLead = async (id) => {
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this lead?")) {
      try {
        await deleteDoc(doc(db, 'leads', id));
        toast('Lead deleted successfully.', 'success');
        if (selId === id) {
          setSelId(null);
        }
      } catch (err) {
        console.error(err);
        toast('Failed to delete lead: ' + err.message, 'error');
      }
    }
  };

  // ─── Submit Lead ───
  const submitLead = async (e) => {
    e.preventDefault();
    try {
      const budgetVal = parseInt(form.budget || 0);
      if (budgetVal < 0) {
        toast('Budget cannot be negative.', 'warning');
        return;
      }
      const sc = calcScore(form.timeline, form.token_paid, budgetVal);
      const st = sc >= 80 ? 'Qualified' : sc >= 60 ? 'Warm' : 'Cold';
      const leadId = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        id: leadId,
        ...form,
        phone: form.phone || '+91 98765 43210',
        budget: budgetVal,
        ai_score: sc,
        status: st,
        created_at: new Date().toISOString(),
        insights: [form.token_paid ? 'Token advance cleared.' : 'Token pending.', `Interest in ${form.location}.`]
      };
      
      await setDoc(doc(db, 'leads', leadId), payload);
      setSelId(leadId);
      setModal(false);
      resetForm();
      toast('Lead created!', 'success');
    } catch (err) {
      console.error(err);
      toast(`Error: ${err.message || 'Failed to save lead'}`, 'error');
    }
  };

  const resetForm = () => setForm({ name: '', email: '', phone: '', plot_type: '1200 Sq. Yards Plot (100 Trees)', location: 'Kadapa Valley (Phase I & II)', budget: '', timeline: 'Immediate (< 1 month)', token_paid: false, agent_assigned: 'Sarah Jenkins' });

  const fillDemo = () => {
    const demos = [
      { name: 'Ramachandra Murthy', email: 'ramachandra.murthy@yahoo.com', phone: '+91 94405 82940', plot_type: '1.0 Acre Farmland (400 Trees)', location: 'Nellore Greenlands', budget: '12000000', timeline: 'Immediate (< 1 month)', token_paid: true, agent_assigned: 'Sarah Jenkins' },
      { name: 'Prathyusha Rao', email: 'prathyusha.r@fintech.in', phone: '+91 98909 23145', plot_type: '600 Sq. Yards Plot (50 Trees)', location: 'Chittoor Reserve', budget: '1200000', timeline: '1 - 3 months', token_paid: false, agent_assigned: 'Emma Watson' },
      { name: 'Rohan Deshmukh', email: 'rohan.d@gmail.com', phone: '+91 98112 83011', plot_type: '2400 Sq. Yards Plot (200 Trees)', location: 'Rayalaseema Orchards', budget: '4800000', timeline: '3 - 6 months', token_paid: true, agent_assigned: 'Michael Thorne' }
    ];
    setForm(demos[Math.floor(Math.random() * demos.length)]);
    toast('Demo data loaded!', 'info');
  };

  // ─── Audio Presets ───
  const playPreset = (lang) => {
    const presets = {
      'te-IN': { text: `Agent: Hello, welcome to Lohitha Dharma Projects. May I know your name?\nInvestor: Hello, my name is Harish Reddy.\nAgent: Mr. Harish Reddy, in which location do you want a plot?\nInvestor: I want to invest in Kadapa Valley Phase 2.\nAgent: Very good. Do you have an email ID?\nInvestor: Yes, my email is harish.reddy@gmail.com.\nAgent: What budget do you have in mind?\nInvestor: My budget is 25 Lakhs.\nAgent: When are you planning to register?\nInvestor: I am ready to register next month.\nAgent: Did you pay the advance token?\nInvestor: Yes, I paid ₹2 Lakhs online as an advance token.`, lang: 'Telugu (Auto-Translated)' },
      'hi-IN': { text: `Agent: Hello, welcome to Lohitha Dharma Projects. What is your name?\nInvestor: Hello, my name is Amit Sharma.\nAgent: Amit, in which of our projects do you want to invest?\nInvestor: I want to invest in Tirupati Foothills project.\nAgent: Excellent! Can you share your email address?\nInvestor: Yes, my email is amit.sharma@outlook.com.\nAgent: What is your investment budget?\nInvestor: My budget is 40 Lakhs.\nAgent: When are you planning to register?\nInvestor: I am planning to buy within the next two months.\nAgent: Have you paid the token advance?\nInvestor: Yes, I have paid the token advance.`, lang: 'Hindi (Auto-Translated)' },
      'en-IN': { text: `Agent: Hello, welcome to Lohitha Dharma Projects. May I have your name, please?\nInvestor: Hello, this is Suresh Naidu.\nAgent: Hello Suresh, which location/project are you looking at?\nInvestor: I am interested in purchasing a farmland plot in Nellore Greenlands.\nAgent: Nellore Greenlands is a beautiful choice. What is your email address?\nInvestor: My email is suresh.naidu@techcorp.in.\nAgent: What is your estimated investment budget?\nInvestor: My budget is around 75 Lakhs.\nAgent: Great, when are you planning to register the land?\nInvestor: I want to proceed with the registration within 3 months.\nAgent: Has the advance booking token payment been made?\nInvestor: Yes, my advance booking is sorted.`, lang: 'English (Auto-Detected)' }
    };
    const p = presets[lang] || presets['en-IN'];
    setTranscript(p.text); setDetLang(p.lang); setExtracted(null);
    toast(`Loaded ${p.lang} preset`, 'success');
  };

  // ─── Audio File Processing ───
  const processFile = (file) => {
    if (!file) return;

    // Ask for consent to store locally
    const shouldStore = window.confirm(`Would you like to store "${file.name}" locally on your computer for 30 days? This will allow you to play and backup this recording later.`);

    const key = localStorage.getItem('gemini_api_key') || '';
    toast(`Processing ${file.name}...`, 'info');
    setAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataURL = reader.result;
      const b64 = dataURL.split(',')[1];

      // If user accepted, save to IndexedDB
      if (shouldStore) {
        try {
          await saveRecording(file.name, dataURL);
          toast('Recording saved locally for 30 days.', 'success');
          loadLocalRecordings();
        } catch (err) {
          console.error("Failed to store recording:", err);
          toast('Failed to store recording locally.', 'error');
        }
      }

      if (key) {
        try {
          let mime = file.type || '';
          if (!mime || mime === 'application/octet-stream') {
            const ext = file.name.split('.').pop().toLowerCase();
            const map = { aac: 'audio/aac', mp3: 'audio/mp3', wav: 'audio/wav', m4a: 'audio/m4a', ogg: 'audio/ogg', opus: 'audio/opus', webm: 'audio/webm', flac: 'audio/flac' };
            mime = map[ext] || 'audio/mp3';
          }
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: "This is a real estate call recording. The speakers might speak in English, Telugu, or Hindi. Please transcribe and translate the entire conversation directly into English. Format the transcript as a dialogue with speakers labeled as 'Agent:' and 'Investor:'. The entire output MUST be in English." }] }] }) });
          if (!r.ok) throw new Error();
          const j = await r.json();
          setTranscript(j.candidates[0].content.parts[0].text);
          setDetLang('Auto-Detected (Lohith AI)');
          toast('Transcribed!', 'success');
        } catch {
          toast('Transcription failed.', 'error');
        } finally {
          setAnalyzing(false);
        }
      } else {
        setTimeout(() => {
          setAnalyzing(false);
          playPreset('en-IN');
        }, 1500);
      }
    };
    reader.onerror = () => {
      toast('File read error.', 'error');
      setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const onUpload = (e) => { const f = e.target.files[0]; if (f) { processFile(f); e.target.value = ''; } };
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && (f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|opus|webm|flac)$/i.test(f.name))) processFile(f); else toast('Upload an audio file.', 'error'); };

  // ─── Recording ───
  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Use Chrome for speech recognition.', 'error'); return; }
    setTranscript(''); setExtracted(null); let acc = '';
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = recLang;
    r.onstart = () => { setRecording(true); const l = recLang === 'te-IN' ? 'Telugu' : recLang === 'hi-IN' ? 'Hindi' : 'English'; setDetLang(`${l} (Live)`); toast(`Recording in ${l}...`, 'info'); };
    r.onerror = (e) => { toast(`Mic error: ${e.error}`, 'error'); setRecording(false); };
    r.onend = async () => {
      setRecording(false);
      const key = localStorage.getItem('gemini_api_key') || '';
      if (key && r.lang !== 'en-IN' && acc.trim()) {
        const l = r.lang === 'te-IN' ? 'Telugu' : 'Hindi';
        try {
          toast(`Translating ${l}...`, 'info');
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Translate this real estate call transcript from ${l} into English. Keep speaker labels. Return ONLY translated text:\n"${acc}"` }] }] }) });
          if (!res.ok) throw new Error();
          const j = await res.json();
          setTranscript(j.candidates[0].content.parts[0].text.trim());
          setDetLang(`${l} (Translated)`);
          toast('Translated!', 'success');
        } catch { toast('Translation failed.', 'warning'); }
      } else { toast('Recording stopped.', 'success'); }
    };
    r.onresult = (e) => { let f = '', i = ''; for (let x = 0; x < e.results.length; x++) { if (e.results[x].isFinal) f += e.results[x][0].transcript + ' '; else i += e.results[x][0].transcript; } acc = (f + i).trim(); setTranscript(acc); };
    recRef.current = r; r.start();
  };
  const stopRec = () => { if (recRef.current) recRef.current.stop(); setRecording(false); toast('Stopped.', 'success'); };

  // ─── Extract from Transcript ───
  const extractDetails = async () => {
    if (!transcript.trim()) { toast('No transcript to analyze.', 'error'); return; }
    setAnalyzing(true);
    const key = localStorage.getItem('gemini_api_key') || '';
    if (key) {
      try {
        toast('Extracting with Lohith AI...', 'info');
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Analyze this customer call transcript:\n"${transcript}"\n\nExtract and return ONLY a valid JSON object:\n{"name": string, "email": string|null, "budget": number, "location": string (one of: "Kadapa Valley (Phase I & II)", "Tirupati Foothills", "Chittoor Reserve", "Nellore Greenlands", "Rayalaseema Orchards"), "timeline": string (one of: "Immediate (< 1 month)", "1 - 3 months", "3 - 6 months", "6+ months"), "token_paid": boolean}\nNo markdown wrapping.` }] }] }) });
        if (!r.ok) throw new Error();
        const j = await r.json();
        let c = j.candidates[0].content.parts[0].text;
        if (c.startsWith('```')) c = c.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
        setExtracted(JSON.parse(c.trim()));
        toast('Details extracted!', 'success'); return;
      } catch { toast('Lohith AI failed, using local parser.', 'warning'); }
      finally { setAnalyzing(false); }
    }
    try {
      const r = await fetch(`${backendUrl}/api/leads/process-audio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) });
      if (!r.ok) throw new Error();
      setExtracted(await r.json()); toast('Extracted!', 'success');
    } catch { setExtracted(parseOffline(transcript)); toast('Extracted locally.', 'success'); }
    finally { setAnalyzing(false); }
  };

  // ─── Save Extracted ───
  const saveExtracted = async () => {
    if (!extracted) return;
    setSaving(true);
    const leadId = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
    const budgetVal = Math.max(0, parseInt(extracted.budget || 0));
    const pay = { 
      id: leadId,
      name: extracted.name, 
      email: extracted.email || 'investor@lohithadharma.com', 
      phone: '+91 98765 43210', 
      plot_type: plotFromBudget(budgetVal), 
      location: extracted.location, 
      budget: budgetVal, 
      timeline: extracted.timeline, 
      token_paid: extracted.token_paid 
    };
    try {
      const sc = calcScore(extracted.timeline, extracted.token_paid, budgetVal);
      const st = sc >= 80 ? 'Qualified' : sc >= 60 ? 'Warm' : 'Cold';
      const payload = {
        ...pay,
        ai_score: sc,
        status: st,
        created_at: new Date().toISOString(),
        agent_assigned: 'Sarah Jenkins',
        insights: [extracted.token_paid ? 'Token cleared.' : 'Token pending.', `From voice call: ${extracted.location}`]
      };
      
      await setDoc(doc(db, 'leads', leadId), payload);
      setSelId(leadId);
      toast('Saved!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to save to database.', 'error');
    } finally {
      setSaving(false);
      setExtracted(null);
      setTranscript('');
      setTab('dashboard');
    }
  };

  const doRefresh = () => { 
    setRefreshing(true); 
    // real-time onSnapshot listener automatically manages leads, but we simulate a 600ms visual refresh state
    setTimeout(() => { 
      setRefreshing(false); 
      toast('Refreshed!', 'success'); 
    }, 600); 
  };

  const exportCSV = () => {
    if (!filtered.length) { toast('No data to export.', 'error'); return; }
    const h = ['ID','Name','Email','Phone','Plot Type','Location','Budget','AI Score','Status','Created','Timeline','Token Paid','Agent'];
    const rows = filtered.map(l => [l.id, `"${l.name}"`, l.email, l.phone, `"${l.plot_type}"`, `"${l.location}"`, l.budget, l.ai_score, l.status, l.created_at, `"${l.timeline}"`, l.token_paid ? 'Yes' : 'No', `"${l.agent_assigned}"`]);
    const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    toast(`Exported ${filtered.length} leads!`, 'success');
  };

  // ─── Helpers ───
  const treesFromPlot = (p) => p.includes('50') ? 50 : p.includes('200') ? 200 : p.includes('400') ? 400 : 100;
  const plotFromBudget = (b) => b >= 12000000 ? '1.0 Acre Farmland (400 Trees)' : b >= 6000000 ? '0.5 Acre Farmland (200 Trees)' : b >= 3000000 ? '0.25 Acre Farmland (100 Trees)' : b >= 2400000 ? '1200 Sq. Yards Plot (100 Trees)' : '600 Sq. Yards Plot (50 Trees)';
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d) => { const dt = new Date(d), now = new Date(), diff = Math.ceil(Math.abs(now - dt) / 864e5); if (diff <= 1 && dt.getDate() === now.getDate()) return `Today`; if (diff <= 1) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const scoreBadge = (s) => s >= 85 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : s >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
  const statusBadge = (s) => s === 'Qualified' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : s === 'Warm' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

  // Stats
  const total = leads.length;
  const qualified = leads.filter(l => l.ai_score >= 80).length;
  const avg = total > 0 ? Math.round(leads.reduce((a, c) => a + c.ai_score, 0) / total) : 0;
  const pending = leads.filter(l => l.status === 'New' || l.status === 'Warm').length;

  // ROI Calc
  const trees = selLead ? treesFromPlot(selLead.plot_type) : 100;
  const yieldKg = trees * 8;
  const maturity = yieldKg * priceKg;

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════
  return (
    <div className="h-screen w-screen flex bg-app-bg text-app-text antialiased font-sans overflow-hidden">

      {/* ── Toasts ── */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg border text-sm font-medium animate-slide-in ${
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-300' :
            t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/50 dark:border-rose-700 dark:text-rose-300' :
            'bg-stone-100 border-stone-300 text-stone-800 dark:bg-stone-800/50 dark:border-stone-600 dark:text-stone-300'
          }`}>{t.msg}</div>
        ))}
      </div>

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-[#2C2825] border-r border-[#3D3530] flex-shrink-0">
        {/* Brand */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#3D3530]">
          <div className="w-8 h-8 rounded-lg bg-app-accent flex items-center justify-center text-white text-sm font-bold">LD</div>
          <div>
            <div className="text-white text-sm font-bold tracking-wide">Lohitha Dharma</div>
            <div className="text-[#9B918A] text-[10px]">Farmland CRM</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'voice-capture', icon: '🎙️', label: 'Voice Capture', badge: 'AI' },
            { id: 'ai-outbound', icon: '📞', label: 'AI Outbound', badge: 'Live' },
          ].map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${tab === n.id ? 'bg-app-accent/15 text-emerald-300' : 'text-[#9B918A] hover:text-stone-200 hover:bg-[#3D3530]/50'}`}>
              <span className="flex items-center gap-2.5"><span>{n.icon}</span>{n.label}</span>
              {n.badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tab === n.id ? 'bg-app-accent/25 text-emerald-300' : 'bg-[#3D3530] text-[#9B918A]'}`}>{n.badge}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-[#3D3530]">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-app-accent text-white text-xs font-bold flex items-center justify-center">PR</div>
            <div className="flex-1 min-w-0">
              <div className="text-stone-200 text-xs font-medium truncate">Pranav Developer</div>
              <div className="text-[#9B918A] text-[10px] truncate">admin@lohithadharma.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* ── Header ── */}
        <header className="h-14 border-b border-app-border bg-app-panel flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Active
            </div>
            <div className="hidden md:flex items-center relative">
              <svg className="absolute left-2.5 w-3.5 h-3.5 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="pl-8 pr-3 py-1.5 w-64 bg-app-input border border-app-border rounded-lg text-xs text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-app-muted hidden sm:inline">AP-South Node</span>
            <button onClick={toggleTheme} className="p-1.5 rounded-lg border border-app-border text-app-muted hover:text-app-text hover:bg-app-input transition-all text-xs cursor-pointer" title="Toggle theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button onClick={() => setSettingsModal(true)} className="p-1.5 rounded-lg border border-app-border text-app-muted hover:text-app-text hover:bg-app-input transition-all text-xs cursor-pointer flex items-center gap-1" title="Lohith AI Settings">
              <span>⚙️</span> <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto p-5 bg-app-bg">
          {tab === 'dashboard' && (
            <div className="space-y-5 max-w-[1400px] mx-auto">

              {/* Title Row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl font-bold text-app-text">Lead Dashboard</h1>
                  <p className="text-xs text-app-muted mt-0.5">Qualified leads and pipeline overview</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={exportCSV} className="btn-ghost text-xs cursor-pointer">↓ Export</button>
                  <button onClick={doRefresh} className="btn-ghost text-xs cursor-pointer flex items-center gap-1.5">
                    <span className={`inline-block ${refreshing ? 'animate-spin' : ''}`}>↻</span> Refresh
                  </button>
                  <button onClick={() => setModal(true)} className="btn-primary text-xs cursor-pointer">+ New Lead</button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Leads', value: total, sub: '+12% wk', subColor: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Qualified', value: qualified, sub: 'Score ≥ 80', subColor: 'text-app-muted' },
                  { label: 'Avg Score', value: `${avg}%`, sub: 'Pipeline health', subColor: 'text-app-muted' },
                  { label: 'Pending', value: pending, sub: 'Needs review', subColor: 'text-amber-600 dark:text-amber-400' },
                ].map((k, i) => (
                  <div key={i} className="bg-app-panel border border-app-border rounded-xl p-4">
                    <div className="text-[10px] font-semibold text-app-muted uppercase tracking-wider">{k.label}</div>
                    <div className="text-2xl font-bold text-app-text mt-1">{k.value}</div>
                    <div className={`text-[10px] mt-1 font-medium ${k.subColor}`}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Table + Inspector */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                {/* Table */}
                <div className="xl:col-span-2 bg-app-panel border border-app-border rounded-xl overflow-hidden">
                  {/* Tabs */}
                  <div className="px-4 pt-3 pb-0 flex items-center justify-between border-b border-app-border">
                    <div className="flex gap-5">
                      {['all','qualified','warm','new'].map(t => (
                        <button key={t} onClick={() => setStage(t)} className={`text-xs font-semibold pb-3 border-b-2 transition-all capitalize cursor-pointer ${stage === t ? 'border-app-accent text-app-accent' : 'border-transparent text-app-muted hover:text-app-text'}`}>{t === 'all' ? 'All Leads' : t}</button>
                      ))}
                    </div>
                    <select value={sort} onChange={e => setSort(e.target.value)} className="text-[11px] bg-app-input border border-app-border rounded-lg px-2 py-1 text-app-text mb-2 cursor-pointer focus:outline-none">
                      <option value="score-desc">Score ↓</option>
                      <option value="score-asc">Score ↑</option>
                      <option value="budget-desc">Budget ↓</option>
                      <option value="date-desc">Newest</option>
                    </select>
                  </div>

                  {/* Table Body */}
                  <div className="overflow-x-auto">
                    {loading ? (
                      <div className="py-16 text-center text-app-muted text-xs">Loading...</div>
                    ) : filtered.length === 0 ? (
                      <div className="py-16 text-center text-app-muted"><div className="text-2xl mb-2">📭</div><div className="text-xs">No leads found</div></div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-app-border bg-app-input/50">
                            <th className="px-4 py-2.5 text-left font-semibold text-app-muted uppercase text-[10px] tracking-wider">Lead</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-app-muted uppercase text-[10px] tracking-wider hidden md:table-cell">Location</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-app-muted uppercase text-[10px] tracking-wider">Budget</th>
                            <th className="px-3 py-2.5 text-center font-semibold text-app-muted uppercase text-[10px] tracking-wider">Score</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-app-muted uppercase text-[10px] tracking-wider hidden sm:table-cell">Status</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-app-muted uppercase text-[10px] tracking-wider hidden lg:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                          {filtered.map(l => (
                            <tr key={l.id} onClick={() => setSelId(l.id)} className={`cursor-pointer transition-colors hover:bg-app-accent/5 ${selId === l.id ? 'bg-app-accent/10 border-l-3 border-l-app-accent' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">{l.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                                  <div>
                                    <div className="font-semibold text-app-text">{l.name}</div>
                                    <div className="text-[10px] text-app-muted">{l.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-app-muted hidden md:table-cell">{l.location}</td>
                              <td className="px-3 py-3 font-medium text-app-text">{fmt(l.budget)}</td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center justify-center w-9 h-6 rounded-md border text-[11px] font-bold ${scoreBadge(l.ai_score)}`}>{l.ai_score}</span>
                              </td>
                              <td className="px-3 py-3 hidden sm:table-cell">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge(l.status)}`}>{l.status}</span>
                              </td>
                              <td className="px-3 py-3 text-app-muted hidden lg:table-cell">{fmtDate(l.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ── Inspector ── */}
                <aside className="bg-app-panel border border-app-border rounded-xl overflow-hidden min-h-[480px]">
                  {!selLead ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[480px]">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl mb-3">🔍</div>
                      <h3 className="text-sm font-bold text-app-text">Lead Inspector</h3>
                      <p className="text-xs text-app-muted mt-1.5 max-w-[200px]">Select a lead from the table to view details, AI insights, and ROI projections.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-app-border">
                      {/* Profile */}
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-app-accent/15 text-app-accent font-bold flex items-center justify-center text-sm">{selLead.name.split(' ').map(n => n[0]).join('')}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-app-text text-sm">{selLead.name}</div>
                            <div className="text-[10px] text-app-muted truncate">{selLead.email}</div>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${scoreBadge(selLead.ai_score)}`}>{selLead.ai_score}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <a href={`mailto:${selLead.email}`} className="flex-1 btn-ghost text-[10px] text-center">✉ Email</a>
                          <a href={`tel:${selLead.phone}`} className="flex-1 btn-ghost text-[10px] text-center">📞 Call</a>
                          <button onClick={() => deleteLead(selLead.id)} className="flex-1 btn-ghost text-[10px] text-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200/50 dark:border-red-900/50 hover:border-red-300">🗑️ Delete</button>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-4 space-y-2.5">
                        {[
                          ['Plot', selLead.plot_type],
                          ['Location', selLead.location],
                          ['Budget', fmt(selLead.budget)],
                          ['Timeline', selLead.timeline],
                          ['Token', selLead.token_paid ? '✓ Paid' : '✗ Pending'],
                          ['Agent', selLead.agent_assigned],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-app-muted">{k}</span>
                            <span className="text-app-text font-medium text-right max-w-[60%] truncate">{v}</span>
                          </div>
                        ))}
                        <div className="pt-2">
                          <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider">Pipeline Stage</label>
                          <select value={selLead.status} onChange={e => changeStage(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 bg-app-input border border-app-border rounded-lg text-xs text-app-text cursor-pointer focus:outline-none focus:border-app-accent">
                            <option>Qualified</option><option>Warm</option><option>New</option><option>Cold</option>
                          </select>
                        </div>
                      </div>


                      {/* Insights */}
                      {selLead.insights && selLead.insights.length > 0 && (
                        <div className="p-4 space-y-2">
                          <div className="text-[10px] font-semibold text-app-muted uppercase tracking-wider">AI Insights</div>
                          {selLead.insights.map((ins, i) => (
                            <div key={i} className="flex gap-2 text-xs text-app-text">
                              <span className="text-app-accent mt-0.5 flex-shrink-0">•</span>
                              <span>{ins}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}

          {/* ══════════ VOICE CAPTURE TAB ══════════ */}
          {tab === 'voice-capture' && (
            <div className="max-w-xl mx-auto space-y-5">
              <div>
                <h1 className="text-xl font-bold text-app-text">AI Voice Capture</h1>
                <p className="text-xs text-app-muted mt-0.5">Upload recordings to extract lead data with Lohith AI.</p>
              </div>

              {!apiKey && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-slide-in">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <span className="text-base mt-0.5">🔑</span>
                    <div>
                      <div className="font-bold">Gemini API Key Required</div>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                        Please set your Gemini API key in settings to enable actual audio transcription. Currently running in demo mode (preset mock transcripts).
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSettingsModal(true)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors text-[10px] whitespace-nowrap cursor-pointer">
                    Set API Key
                  </button>
                </div>
              )}

              {expiredRecs.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs animate-slide-in">
                  <div className="flex items-start gap-2 text-red-800 dark:text-red-300">
                    <span className="text-base mt-0.5">⚠️</span>
                    <div>
                      <div className="font-bold">Backup Reminder</div>
                      <p className="text-[11px] text-red-750 dark:text-red-400 mt-0.5">
                        Some recordings have been stored for 30+ days. Please backup (download) them now:
                        <span className="font-semibold block mt-1">
                          {expiredRecs.map(r => r.name).join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button onClick={() => expiredRecs.forEach(r => downloadRecording(r))} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-[10px] cursor-pointer">
                      📥 Backup All
                    </button>
                    <button onClick={async () => {
                      if (window.confirm("Are you sure you want to permanently clear these expired recordings?")) {
                        for (const r of expiredRecs) {
                          await deleteRecording(r.id);
                        }
                        toast("Expired recordings cleared.", "info");
                        loadLocalRecordings();
                      }
                    }} className="px-3 py-1.5 border border-red-200 dark:border-red-900 bg-transparent text-red-800 dark:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-950/30 font-medium rounded-lg transition-colors text-[10px] cursor-pointer">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Upload */}
              <div className="bg-app-panel border border-app-border rounded-xl p-5 space-y-4 shadow-sm">
                <div className="text-xs font-semibold text-app-text">Upload Recording</div>
                <div onClick={() => fileRef.current?.click()} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${dragging ? 'border-app-accent bg-app-accent/5' : 'border-app-border hover:border-app-accent bg-app-input/30'}`}>
                  <div className="text-2xl mb-1">📁</div>
                  <div className="text-xs font-medium text-app-text">{dragging ? 'Drop here' : 'Click or drag audio'}</div>
                  <div className="text-[10px] text-app-muted mt-0.5">MP3, WAV, M4A, AAC</div>
                  <input type="file" ref={fileRef} accept="audio/*" onChange={onUpload} className="hidden" />
                </div>
                <div className="text-[10px] font-semibold text-app-muted uppercase tracking-wider">Or load a preset</div>
                <div className="flex gap-2">
                  {[['en-IN','English'],['te-IN','Telugu'],['hi-IN','Hindi']].map(([c,l]) => (
                    <button key={c} onClick={() => playPreset(c)} className="btn-ghost text-[10px] flex-1 cursor-pointer">{l}</button>
                  ))}
                </div>
              </div>

              {/* Transcript */}
              {(transcript || analyzing) && (
                <div className="bg-app-panel border border-app-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-app-text">Transcript</div>
                    {detLang && <span className="text-[10px] text-app-accent font-medium">{detLang}</span>}
                  </div>
                  <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={6} className="w-full bg-app-input border border-app-border rounded-lg p-3 text-xs text-app-text resize-none focus:outline-none focus:border-app-accent" placeholder="Transcript appears here..." />
                  <button onClick={extractDetails} disabled={analyzing || !transcript.trim()} className="w-full btn-primary py-2.5 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    {analyzing ? <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</span> : '⚡ Extract Lead Details'}
                  </button>
                </div>
              )}

              {/* Extracted Card */}
              {extracted && (
                <div className="bg-app-panel border border-app-accent/30 rounded-xl p-5 space-y-4 animate-slide-in">
                  <div className="text-xs font-semibold text-app-accent uppercase tracking-wider">AI Extracted Lead</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ['Name', extracted.name],
                      ['Email', extracted.email || 'N/A'],
                      ['Budget', fmt(extracted.budget)],
                      ['Location', extracted.location],
                      ['Timeline', extracted.timeline],
                      ['Token', extracted.token_paid ? '✓ Paid' : '✗ Pending'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-app-muted text-[10px] font-semibold uppercase">{k}</div>
                        <div className="text-app-text font-medium mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveExtracted} disabled={saving} className="flex-1 btn-primary py-2 text-xs font-bold cursor-pointer disabled:opacity-50">
                      {saving ? 'Saving...' : '💾 Save to Database'}
                    </button>
                    <button onClick={() => setExtracted(null)} className="btn-ghost py-2 text-xs cursor-pointer">Dismiss</button>
                  </div>
                </div>
              )}

              {/* Local Saved Recordings */}
              <div className="bg-app-panel border border-app-border rounded-xl p-5 space-y-4 shadow-sm">
                <div className="text-xs font-semibold text-app-text flex items-center justify-between">
                  <span>💾 Local Saved Recordings</span>
                  <span className="text-[10px] text-app-muted font-normal">Stored up to 30 days</span>
                </div>

                {localRecs.length === 0 ? (
                  <div className="text-center py-6 text-app-muted text-xs">
                    No recordings saved on this computer yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {localRecs.map(rec => (
                      <LocalAudioPlayer 
                        key={rec.id} 
                        rec={rec} 
                        downloadRecording={downloadRecording} 
                        removeStoredRecording={removeStoredRecording} 
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'ai-outbound' && (
            <div className="space-y-5 max-w-[1200px] mx-auto">
              {/* Header Title */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl font-bold text-app-text">AI Outbound Lead Qualification</h1>
                  <p className="text-xs text-app-muted mt-0.5">Initiate automated AI calling and lead nurturing campaigns.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                
                {/* Outbound Dialer and Active Contacts */}
                <div className="lg:col-span-1 space-y-5">
                  
                  {/* Manual Dialer */}
                  <div className="bg-app-panel border border-app-border rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="text-xs font-semibold text-app-text">Quick Dialer</div>
                    <div className="flex gap-2">
                      <input 
                        value={outboundPhone} 
                        onChange={e => setOutboundPhone(e.target.value)} 
                        placeholder="Enter phone number (e.g. +91 98765 43210)" 
                        className="flex-1 px-3 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-app-accent" 
                      />
                      <button 
                        onClick={() => triggerOutboundCall(outboundPhone)} 
                        disabled={callStatus !== 'idle'} 
                        className="btn-primary px-4 py-2 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        📞 Call
                      </button>
                    </div>
                  </div>

                  {/* Pending Lead Contacts list for Calling */}
                  <div className="bg-app-panel border border-app-border rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="text-xs font-semibold text-app-text flex items-center justify-between">
                      <span>Nurture Contacts</span>
                      <span className="text-[10px] text-app-accent font-semibold px-2 py-0.5 rounded bg-app-accent/10">
                        {leads.filter(l => l.status === 'Warm' || l.status === 'New' || l.status === 'Cold').length} Pending
                      </span>
                    </div>
                    
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      {leads.filter(l => l.status === 'Warm' || l.status === 'New' || l.status === 'Cold').map(l => (
                        <div key={l.id} className="p-3 bg-app-input/20 border border-app-border rounded-lg flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-semibold text-app-text">{l.name}</div>
                            <div className="text-[10px] text-app-muted flex items-center gap-1.5 mt-0.5">
                              <span>{l.phone}</span>
                              <span>•</span>
                              <span className={`font-medium ${
                                l.status === 'Warm' ? 'text-amber-600 dark:text-amber-400' :
                                l.status === 'Cold' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                              }`}>{l.status}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setOutboundPhone(l.phone);
                              triggerOutboundCall(l.phone, l.id);
                            }} 
                            disabled={callStatus !== 'idle'}
                            className="px-2.5 py-1.5 bg-app-accent text-white hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed text-[10px] font-bold rounded-lg cursor-pointer"
                          >
                            Call Now
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Call Console Terminal */}
                <div className="lg:col-span-2 space-y-5">
                  {callStatus !== 'idle' ? (
                    <div className="bg-[#1E1B18] border border-[#3A332C] rounded-2xl overflow-hidden shadow-xl animate-slide-in">
                      {/* Console Header */}
                      <div className="px-4 py-3 bg-[#2D2824] border-b border-[#3A332C] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                          <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                            {callStatus === 'ringing' ? 'Ringing...' : callStatus === 'in-progress' ? 'Call in progress' : 'Call completed'}
                            {isSimulatedCall && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[9px] font-bold lowercase tracking-normal border border-amber-500/20">
                                simulated
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          ID: {activeCallId || 'CALL-CONNECTING'}
                        </div>
                      </div>

                      {/* Phone UI Container */}
                      <div className="p-6 flex flex-col items-center border-b border-[#3A332C] bg-[#24201D]">
                        {/* Outbound Phone Screen Mock */}
                        <div className="w-24 h-24 rounded-full bg-[#352F2B] border-4 border-[#443D37] flex items-center justify-center text-3xl shadow-inner relative">
                          🤖
                          {callStatus === 'ringing' && (
                            <div className="absolute inset-0 rounded-full border border-emerald-500 animate-ping opacity-60" />
                          )}
                          {callStatus === 'in-progress' && (
                            <div className="absolute -inset-1 rounded-full border-2 border-dashed border-app-accent animate-spin duration-10000" />
                          )}
                        </div>
                        
                        <div className="mt-3 text-center">
                          <div className="text-white text-base font-bold">{outboundPhone}</div>
                          <div className="text-[#9B918A] text-[11px] mt-0.5">AI Outbound Agent</div>
                        </div>

                        {/* Interactive Waveform */}
                        {callStatus === 'in-progress' && (
                          <div className="flex items-center gap-1.5 mt-6 h-8 justify-center">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => (
                              <span 
                                key={w} 
                                className="w-1 bg-[#C5A880] rounded-full animate-bounce" 
                                style={{ 
                                  height: `${12 + Math.sin(w) * 20}px`,
                                  animationDuration: `${0.4 + w * 0.08}s` 
                                }} 
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Live Dialogue Turns scroll */}
                      <div className="p-5 h-[300px] overflow-y-auto font-mono text-[11px] space-y-4 bg-[#1C1917] scrollbar-thin">
                        {liveTurns.length === 0 && callStatus === 'ringing' && (
                          <div className="text-[#9B918A] text-center pt-16 animate-pulse">
                            ☎️ Connection established. Waiting for answer...
                          </div>
                        )}
                        {liveTurns.length === 0 && !isSimulatedCall && callStatus === 'in-progress' && (
                          <div className="text-[#9B918A] text-center pt-12 space-y-4">
                            <div className="text-emerald-400 text-sm font-bold animate-pulse flex items-center justify-center gap-2">
                              <span>🟢</span> Live Call Active via Bland AI
                            </div>
                            <div className="max-w-xs mx-auto text-stone-400 text-[10px] leading-relaxed font-sans bg-[#24201D] p-4 rounded-xl border border-[#3E3834]">
                              Speak with the AI agent on your phone now. 
                              <br/><br/>
                              Bland AI will dynamically collect registration details, budget, and location. The full transcript, call duration, and qualified lead metrics will update in the CRM automatically once you hang up.
                            </div>
                          </div>
                        )}
                        {liveTurns.map((turn, idx) => (
                          <div key={idx} className={`flex gap-3 max-w-[85%] ${turn.speaker === 'Agent' ? '' : 'ml-auto flex-row-reverse'}`}>
                            <div className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] h-fit ${
                              turn.speaker === 'Agent' ? 'bg-app-accent/20 text-emerald-400' : 'bg-stone-700 text-stone-200'
                            }`}>
                              {turn.speaker}
                            </div>
                            <div className={`p-2.5 rounded-xl border leading-relaxed ${
                              turn.speaker === 'Agent' 
                                ? 'bg-[#292524] border-[#3E3834] text-stone-200 rounded-tl-none' 
                                : 'bg-[#1C1917] border-[#44403C] text-[#C5A880] rounded-tr-none text-right'
                            }`}>
                              {turn.text}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="px-5 py-3 bg-[#24201D] border-t border-[#3A332C] flex justify-between items-center">
                        <span className="text-[10px] text-stone-400 font-mono">
                          {callStatus === 'completed' ? 'Total duration: 36s' : isSimulatedCall ? 'Outbound channel: Simulated' : 'Outbound channel: Live Bland AI'}
                        </span>
                        <button 
                          onClick={stopActiveCall} 
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          {callStatus === 'completed' ? 'Close Console' : '❌ Disconnect Call'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-app-panel border border-app-border rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                      <div className="w-14 h-14 rounded-full bg-app-input flex items-center justify-center text-2xl mb-4">📞</div>
                      <h3 className="text-sm font-bold text-app-text">Live Call Monitor</h3>
                      <p className="text-xs text-app-muted mt-1.5 max-w-[300px]">
                        Start an outbound call using the quick dialer or select a contact. The live transcript and call controls will appear here.
                      </p>
                    </div>
                  )}

                  {/* Outbound Calls Logs */}
                  <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-app-border bg-app-input/30 font-semibold text-xs text-app-text">
                      Campaign Call History
                    </div>
                    {loadingCalls ? (
                      <div className="py-12 text-center text-xs text-app-muted">Loading history...</div>
                    ) : callsHistory.length === 0 ? (
                      <div className="py-12 text-center text-xs text-app-muted">No outbound calls triggered yet.</div>
                    ) : (
                      <div className="divide-y divide-app-border">
                        {callsHistory.map(call => (
                          <div key={call.id} className="p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-app-text">{call.phone}</span>
                                <span className="text-app-muted text-[10px] ml-2 font-mono">({call.id})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-app-muted">{fmtDate(call.created_at)}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                                  {call.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-app-muted">Duration: {call.duration} seconds</span>
                              <button 
                                onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                                className="text-app-accent hover:underline font-semibold cursor-pointer"
                              >
                                {expandedCallId === call.id ? 'Hide Transcript ▲' : 'Show Transcript ▼'}
                              </button>
                            </div>

                            {/* Expanded Transcript display */}
                            {expandedCallId === call.id && (
                              <div className="p-3 bg-app-input border border-app-border rounded-lg text-xs leading-relaxed text-app-text space-y-1 max-h-[250px] overflow-y-auto whitespace-pre-wrap font-mono font-bold">
                                {call.transcript ? call.transcript : "No transcript recorded."}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══════════ MODAL ══════════ */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setModal(false); resetForm(); }}>
          <div className="bg-app-panel modal-card border border-app-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-app-text">New Lead</h2>
              <button onClick={() => { setModal(false); resetForm(); }} className="text-app-muted hover:text-app-text text-lg cursor-pointer">×</button>
            </div>

            {/* Form */}
            <form id="new-lead-form" onSubmit={submitLead} className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {[
                { label: 'Full Name', key: 'name', type: 'text', required: true },
                { label: 'Email', key: 'email', type: 'email', required: true },
                { label: 'Phone', key: 'phone', type: 'tel' },
                { label: 'Budget (₹)', key: 'budget', type: 'number', required: true, min: 0 },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">{f.label}</label>
                  <input type={f.type} required={f.required} min={f.min !== undefined ? f.min : undefined} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-app-accent" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Plot Type</label>
                  <select value={form.plot_type} onChange={e => setForm({ ...form, plot_type: e.target.value })} className="w-full px-2.5 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none">
                    <option>600 Sq. Yards Plot (50 Trees)</option>
                    <option>1200 Sq. Yards Plot (100 Trees)</option>
                    <option>2400 Sq. Yards Plot (200 Trees)</option>
                    <option>0.25 Acre Farmland (100 Trees)</option>
                    <option>0.5 Acre Farmland (200 Trees)</option>
                    <option>1.0 Acre Farmland (400 Trees)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Location</label>
                  <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full px-2.5 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none">
                    <option>Kadapa Valley (Phase I & II)</option>
                    <option>Tirupati Foothills</option>
                    <option>Chittoor Reserve</option>
                    <option>Nellore Greenlands</option>
                    <option>Rayalaseema Orchards</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Timeline</label>
                  <select value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} className="w-full px-2.5 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none">
                    <option>Immediate (&lt; 1 month)</option>
                    <option>1 - 3 months</option>
                    <option>3 - 6 months</option>
                    <option>6+ months</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Token Paid</label>
                  <select value={form.token_paid} onChange={e => setForm({ ...form, token_paid: e.target.value === 'true' })} className="w-full px-2.5 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Agent</label>
                <select value={form.agent_assigned} onChange={e => setForm({ ...form, agent_assigned: e.target.value })} className="w-full px-2.5 py-2 bg-app-input border border-app-border rounded-lg text-xs text-app-text focus:outline-none">
                  <option>Sarah Jenkins</option><option>Michael Thorne</option><option>Emma Watson</option>
                </select>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-app-border flex items-center justify-between">
              <button type="button" onClick={fillDemo} className="btn-ghost text-xs cursor-pointer">⚡ Demo</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setModal(false); resetForm(); }} className="btn-ghost text-xs cursor-pointer">Cancel</button>
                <button type="submit" form="new-lead-form" className="btn-primary text-xs cursor-pointer">Create Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SETTINGS MODAL ══════════ */}
      {settingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSettingsModal(false)}>
          <div className="bg-app-panel modal-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-app-text">Lohith AI Settings</h2>
              <button onClick={() => setSettingsModal(false)} className="text-app-muted hover:text-app-text text-lg cursor-pointer">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-text">Gemini API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setKey(e.target.value)} 
                  placeholder="Paste your Gemini API key (AIzaSy...)" 
                  className="w-full bg-app-input border border-app-border rounded-lg p-2.5 text-xs text-app-text focus:outline-none focus:border-app-accent" 
                />
                <p className="text-[10px] text-app-muted mt-1 leading-relaxed">
                  Required for real-time multilingual transcription of your uploaded audio.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-text">Bland AI API Key</label>
                <input 
                  type="password" 
                  value={blandKey} 
                  onChange={e => saveBlandKey(e.target.value)} 
                  placeholder="Paste your Bland AI API key" 
                  className="w-full bg-app-input border border-app-border rounded-lg p-2.5 text-xs text-app-text focus:outline-none focus:border-app-accent" 
                />
                <p className="text-[10px] text-app-muted mt-1 leading-relaxed">
                  Required to trigger real phone calls to customers using Bland AI's agent network.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-text">Webhook Base URL (ngrok)</label>
                <input 
                  type="text" 
                  value={webhookBase} 
                  onChange={e => saveWebhookBase(e.target.value)} 
                  placeholder="https://xxxx.ngrok-free.app" 
                  className="w-full bg-app-input border border-app-border rounded-lg p-2.5 text-xs text-app-text focus:outline-none focus:border-app-accent" 
                />
                <p className="text-[10px] text-app-muted mt-1 leading-relaxed">
                  The public base URL (e.g. ngrok tunnel) used by Bland AI to send post-call transcripts back to your server.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-text">Backend API URL</label>
                <input 
                  type="text" 
                  value={backendUrl} 
                  onChange={e => saveBackendUrl(e.target.value)} 
                  placeholder="http://localhost:5000" 
                  className="w-full bg-app-input border border-app-border rounded-lg p-2.5 text-xs text-app-text focus:outline-none focus:border-app-accent" 
                />
                <p className="text-[10px] text-app-muted mt-1 leading-relaxed">
                  The URL of your running Flask server. Use http://localhost:5000 for local development.
                </p>
              </div>

              <button onClick={() => { setSettingsModal(false); toast("Settings saved!", "success"); }} className="w-full btn-primary py-2.5 text-xs font-bold cursor-pointer">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers (outside component) ───
function getFallbackSeeds() {
  return [
    { id: "LD-1001", name: "Karthik Reddy", email: "karthik.reddy@gmail.com", phone: "+91 98765 43210", plot_type: "1200 Sq. Yards Plot (100 Trees)", location: "Kadapa Valley (Phase I & II)", budget: 2400000, ai_score: 94, status: "Qualified", created_at: "2026-06-12T09:12:00Z", timeline: "Immediate (< 1 month)", token_paid: true, agent_assigned: "Sarah Jenkins", insights: ["Booking token advance of ₹2.4 Lakhs cleared.", "High interest in East-facing plots in Kadapa Valley.", "Requested soil health analysis.", "Drip irrigation agreement signed."] },
    { id: "LD-1002", name: "Dr. Amit Sharma", email: "amit.sharma@outlook.com", phone: "+91 99112 30044", plot_type: "0.5 Acre Farmland (200 Trees)", location: "Tirupati Foothills", budget: 6000000, ai_score: 88, status: "Qualified", created_at: "2026-06-14T14:35:00Z", timeline: "1 - 3 months", token_paid: true, agent_assigned: "Michael Thorne", insights: ["Planning long-term retirement farm.", "Down Payment 25% ready.", "Prefers Tirupati Foothills.", "Wants organic monitoring."] },
    { id: "LD-1003", name: "Srinivas Naidu", email: "srinivas.naidu@techcorp.in", phone: "+91 98450 89041", plot_type: "600 Sq. Yards Plot (50 Trees)", location: "Chittoor Reserve", budget: 1200000, ai_score: 75, status: "Warm", created_at: "2026-06-15T11:20:00Z", timeline: "1 - 3 months", token_paid: false, agent_assigned: "Emma Watson", insights: ["Interested in tax benefits.", "Comparing pricing structures.", "Down Payment pending bank clearance."] },
  ];
}

function calcScore(timeline, tokenPaid, budget) {
  let s = 40;
  if (timeline.includes("Immediate") || timeline.includes("< 1")) s += 30;
  else if (timeline.includes("1 - 3")) s += 20;
  else if (timeline.includes("3 - 6")) s += 10;
  if (tokenPaid) s += 25; else s += 5;
  if (budget >= 10000000) s += 5; else if (budget >= 5000000) s += 3;
  return Math.min(100, Math.max(10, s + Math.floor(Math.random() * 8) - 2));
}

function cleanInvestor(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let inv = [], hasPfx = false;
  for (let l of lines) if (/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:/i.test(l)) { hasPfx = true; break; }
  if (hasPfx) { for (let l of lines) if (/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:/i.test(l)) inv.push(l.replace(/^\s*(?:investor|customer|client|caller|guest|user|ans|buyer|a)\s*:\s*/i, '')); return inv.join('\n'); }
  let filt = [], hasAgent = false;
  for (let l of lines) { if (/^\s*(?:agent|q|representative|sales|staff|host|employee)\s*:/i.test(l)) { hasAgent = true; continue; } filt.push(l); }
  return hasAgent ? filt.join('\n') : text;
}

function parseOffline(text) {
  const c = cleanInvestor(text), cl = c.toLowerCase(), fl = text.toLowerCase();
  const em = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  let name = '';
  const pats = [/(?:my name is|i am|this is|here is)\s+([A-Za-z]+(?:\s+[A-Za-z]+){1,2})/i, /(?:मेरा नाम|मैं)\s+([^\s।]+(?:\s+[^\s।]+){0,2})/i, /(?:నా పేరు|నేను)\s+([^\s\.\,అండి]+(?:\s+[^\s\.\,అండి]+){0,2})/i];
  for (let p of pats) { let m = c.match(p) || text.match(p); if (m) { name = m[1].trim(); break; } }
  if (name) name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (!name || name === 'I' || name === 'This') name = em ? em[0].split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Interested Investor';
  let loc = 'Kadapa Valley (Phase I & II)';
  if (fl.includes('tirupati')) loc = 'Tirupati Foothills'; else if (fl.includes('chittoor')) loc = 'Chittoor Reserve'; else if (fl.includes('nellore')) loc = 'Nellore Greenlands'; else if (fl.includes('rayalaseema')) loc = 'Rayalaseema Orchards';
  let budget = 2400000;
  if (fl.includes('25')) budget = 2500000; else if (fl.includes('40')) budget = 4000000; else if (fl.includes('75')) budget = 7500000; else if (fl.includes('1.2') || fl.includes('crore')) budget = 12000000; else if (fl.includes('60')) budget = 6000000; else if (fl.includes('12')) budget = 1200000;
  let timeline = '1 - 3 months';
  if (fl.includes('immediate') || fl.includes('next month')) timeline = 'Immediate (< 1 month)'; else if (fl.includes('6+')) timeline = '6+ months';
  const token_paid = fl.includes('token') || fl.includes('paid') || fl.includes('advance') || fl.includes('sorted');
  return { name, email: em ? em[0] : '', budget, location: loc, timeline, token_paid };
}

// ─── WAV Encoding Helpers ───
function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferArr = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(bufferArr);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + result.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, result.length * 2, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([bufferArr], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ─── Local Recording Player Component with WAV transcoding ───
function LocalAudioPlayer({ rec, downloadRecording, removeStoredRecording }) {
  const [src, setSrc] = React.useState(rec.data);
  const [decoding, setDecoding] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let url = null;
    const isAac = rec.name.toLowerCase().endsWith('.aac');

    if (isAac) {
      setDecoding(true);
      (async () => {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const base64 = rec.data.split(',')[1];
          const binaryString = atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
          const wavBlob = bufferToWav(audioBuffer);
          url = URL.createObjectURL(wavBlob);
          
          if (active) {
            setSrc(url);
            setDecoding(false);
          }
        } catch (err) {
          console.error("AAC decoding error:", err);
          if (active) {
            setError(true);
            setDecoding(false);
          }
        }
      })();
    }

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [rec]);

  const isAac = rec.name.toLowerCase().endsWith('.aac');
  const elapsed = Date.now() - rec.timestamp;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const remainingMs = thirtyDaysMs - elapsed;
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const isExpired = remainingDays <= 0;

  return (
    <div className={`p-3 rounded-lg border text-xs flex flex-col gap-2 ${isExpired ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/40' : 'bg-app-input/20 border-app-border'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-app-text truncate">{rec.name}</div>
          <div className="text-[10px] text-app-muted mt-0.5">
            Uploaded {new Date(rec.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div>
          {isExpired ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[9px] font-bold uppercase tracking-wider animate-pulse">
              Expired
            </span>
          ) : (
            <span className="inline-block px-1.5 py-0.5 rounded bg-app-accent/10 text-app-accent text-[9px] font-semibold">
              {remainingDays}d left
            </span>
          )}
        </div>
      </div>

      <div className="w-full">
        {decoding ? (
          <div className="h-8 rounded bg-app-input flex items-center justify-center text-[10px] text-app-muted gap-2 border border-app-border">
            <span className="w-3.5 h-3.5 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
            Transcoding raw AAC to WAV for browser playback...
          </div>
        ) : error ? (
          <div className="h-8 rounded bg-red-50 dark:bg-red-950/10 flex items-center justify-center text-[10px] text-red-600 dark:text-red-400 gap-1.5 border border-red-200 dark:border-red-900/40 px-2">
            <span>⚠️</span>
            <span className="truncate">Playback failed. Click backup to play locally.</span>
          </div>
        ) : (
          <audio src={src} controls className="w-full h-8 rounded bg-transparent" />
        )}
      </div>

      {isAac && !decoding && !error && (
        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5 p-1 rounded border border-emerald-500/20 mt-0.5 flex items-start gap-1">
          <span>✓</span>
          <span>Transcoded to WAV container for browser compatibility.</span>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-1">
        <button onClick={() => downloadRecording(rec)} className="px-2.5 py-1 text-[10px] font-semibold rounded hover:opacity-95 active:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer" style={{ backgroundColor: 'var(--app-accent)', color: 'var(--app-accent-text)' }}>
          📥 Backup
        </button>
        <button onClick={() => removeStoredRecording(rec.id)} className="px-2.5 py-1 text-[10px] border border-app-border text-app-text hover:bg-app-input font-medium rounded transition-colors cursor-pointer">
          Delete
        </button>
      </div>
    </div>
  );
}
