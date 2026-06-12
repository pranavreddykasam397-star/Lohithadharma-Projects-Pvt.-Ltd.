/**
 * Real Estate AI Lead Qualification System - Frontend Engine
 * This script handles state management, filtering, sorting, and dynamic DOM rendering.
 * Built modularly to facilitate easy integration with backend APIs in the future.
 */

// ==========================================
// 1. Mock Data & Schema Definition
// ==========================================

/**
 * Lead Schema Reference:
 * @typedef {Object} Lead
 * @property {string} id - Unique identifier
 * @property {string} name - Full Name
 * @property {string} email - Email Address
 * @property {string} phone - Phone Number
 * @property {string} propertyType - Preferred property type (e.g. Condo, Single Family Home, Villa)
 * @property {string} location - Target geographic location
 * @property {number} budget - Maximum budget in USD
 * @property {number} aiScore - Calculated AI Qualification Score (0-100)
 * @property {('Qualified'|'Warm'|'Cold'|'Contacted'|'New')} status - Qualification status
 * @property {string} createdAt - ISO Timestamp of lead creation
 * @property {string[]} aiInsights - Array of key qualification findings from chat/email parser
 * @property {Object} details - Additional structured data
 * @property {string} details.timeline - Intended time to buy (e.g. "Within 1 month", "3-6 months")
 * @property {boolean} details.mortgageApproved - Pre-approved status
 * @property {string} details.agentAssigned - Name of the broker assigned
 */

const SAMPLE_LEADS = [
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
    location: "Vasant Kunj, Delhi",
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

// ==========================================
// 2. Global State
// ==========================================
const AppState = {
  leads: [],
  filteredLeads: [],
  currentTab: "all",
  searchQuery: "",
  sortBy: "score-desc",
  selectedLeadId: null,
  isLoading: false
};

// ==========================================
// 3. API Modularity Wrapper (With LocalStorage Fallback for Static GitHub Pages Preview)
// ==========================================
const UseLocalStorage = {
  isFallback: false,

  initialize() {
    this.isFallback = true;
    if (!localStorage.getItem('leads_data')) {
      // Seed initial sample leads into local storage if empty
      localStorage.setItem('leads_data', JSON.stringify(SAMPLE_LEADS));
    }
    console.warn("Express API Server is offline or unreachable. Transparently fell back to browser LocalStorage.");
  },

  getAllLeads() {
    const data = localStorage.getItem('leads_data');
    return JSON.parse(data || '[]');
  },

  getLeadDetails(id) {
    const leads = this.getAllLeads();
    return leads.find(l => l.id === id) || null;
  },

  updateLeadStatus(id, newStatus) {
    const leads = this.getAllLeads();
    const leadIndex = leads.findIndex(l => l.id === id);
    if (leadIndex !== -1) {
      leads[leadIndex].status = newStatus;
      localStorage.setItem('leads_data', JSON.stringify(leads));
    }
    return { success: true, updatedId: id, status: newStatus };
  },

  createLead(leadData) {
    const leads = this.getAllLeads();
    
    // Evaluate scores client-side under fallback mode
    const score = calculateMockAiScore(leadData.timeline, leadData.mortgageApproved, leadData.budget);
    const insights = generateMockAiInsights(leadData.name, leadData.propertyType, leadData.location, leadData.timeline, leadData.mortgageApproved, leadData.budget, score);
    
    let status = "Cold";
    if (score >= 80) status = "Qualified";
    else if (score >= 60) status = "Warm";

    const newLead = {
      id: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      propertyType: leadData.propertyType,
      location: leadData.location,
      budget: parseInt(leadData.budget, 10),
      aiScore: score,
      status: status,
      createdAt: new Date().toISOString(),
      aiInsights: insights,
      details: {
        timeline: leadData.timeline,
        mortgageApproved: leadData.mortgageApproved,
        agentAssigned: leadData.agentAssigned
      }
    };

    leads.unshift(newLead);
    localStorage.setItem('leads_data', JSON.stringify(leads));
    return newLead;
  }
};

const LeadsAPI = {
  async getAllLeads() {
    if (UseLocalStorage.isFallback) {
      return UseLocalStorage.getAllLeads();
    }
    try {
      const response = await fetch('/api/leads');
      if (!response.ok) throw new Error();
      return await response.json();
    } catch (error) {
      UseLocalStorage.initialize();
      showToast("Server down. Switched to offline mode.", "info");
      return UseLocalStorage.getAllLeads();
    }
  },

  async getLeadDetails(id) {
    if (UseLocalStorage.isFallback) {
      return UseLocalStorage.getLeadDetails(id);
    }
    try {
      const response = await fetch(`/api/leads/${id}`);
      if (!response.ok) throw new Error();
      return await response.json();
    } catch (error) {
      UseLocalStorage.initialize();
      return UseLocalStorage.getLeadDetails(id);
    }
  },

  async updateLeadStatus(id, newStatus) {
    if (UseLocalStorage.isFallback) {
      return UseLocalStorage.updateLeadStatus(id, newStatus);
    }
    try {
      const response = await fetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch (error) {
      UseLocalStorage.initialize();
      return UseLocalStorage.updateLeadStatus(id, newStatus);
    }
  },

  async createLead(leadData) {
    if (UseLocalStorage.isFallback) {
      return UseLocalStorage.createLead(leadData);
    }
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(leadData)
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch (error) {
      UseLocalStorage.initialize();
      return UseLocalStorage.createLead(leadData);
    }
  }
};

// ==========================================
// 4. UI Helper Functions
// ==========================================

function showToast(message, type = 'info') {
  // Check if toast-container exists, if not create it
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none';
    document.body.appendChild(container);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-card pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all transform translate-x-full opacity-0 ${
    type === 'success' 
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
      : type === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-white border-slate-200 text-slate-800'
  }`;
  
  // Icon SVG
  const icon = type === 'success' 
    ? `<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    : type === 'error'
    ? `<svg class="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    : `<svg class="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    
  toast.innerHTML = `
    ${icon}
    <span class="flex-1">${message}</span>
    <button class="text-current opacity-60 hover:opacity-100 transition-opacity ml-2 focus:outline-none" onclick="this.parentElement.remove()">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;
  
  container.appendChild(toast);
  
  // Transition in
  setTimeout(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  }, 10);
  
  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('translate-x-0', 'opacity-100');
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) {
    // Check if today or yesterday
    if (date.getDate() === now.getDate()) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Yesterday`;
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getAiScoreClass(score) {
  if (score >= 85) return {
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 score-glow-high',
    indicator: 'bg-emerald-500'
  };
  if (score >= 60) return {
    color: 'text-amber-600 bg-amber-50 border-amber-200 score-glow-mid',
    indicator: 'bg-amber-500'
  };
  return {
    color: 'text-rose-600 bg-rose-50 border-rose-200 score-glow-low',
    indicator: 'bg-rose-500'
  };
}

// ==========================================
// 5. DOM Rendering Core
// ==========================================

/**
 * Update KPI Summary Cards
 */
function renderKpiCards() {
  const leads = AppState.leads;
  
  const totalLeads = leads.length;
  const highQualifiedLeads = leads.filter(l => l.aiScore >= 80).length;
  const avgAiScore = Math.round(leads.reduce((acc, curr) => acc + curr.aiScore, 0) / (totalLeads || 1));
  const pendingAction = leads.filter(l => l.status === "New" || l.status === "Warm").length;

  document.getElementById('kpi-total-leads').textContent = totalLeads;
  document.getElementById('kpi-qualified').textContent = highQualifiedLeads;
  document.getElementById('kpi-avg-score').textContent = `${avgAiScore}/100`;
  document.getElementById('kpi-pending-action').textContent = pendingAction;
}

/**
 * Render Main Leads Table
 */
function renderLeadsTable() {
  const tableBody = document.getElementById('leads-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const leadsCountText = document.getElementById('leads-count-text');

  // Clear existing content
  tableBody.innerHTML = '';
  
  const currentLeads = AppState.filteredLeads;
  leadsCountText.textContent = `Showing ${currentLeads.length} of ${AppState.leads.length} leads`;

  if (currentLeads.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  currentLeads.forEach(lead => {
    const scoreStyle = getAiScoreClass(lead.aiScore);
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover border-b border-slate-100 cursor-pointer';
    tr.setAttribute('data-id', lead.id);
    
    // Set up highlight class if this lead is currently inspected
    if (AppState.selectedLeadId === lead.id) {
      tr.classList.add('bg-blue-50/50', 'border-l-4', 'border-l-blue-600');
    }

    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div class="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            ${lead.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div class="ml-4">
            <div class="text-sm font-semibold text-slate-900">${lead.name}</div>
            <div class="text-xs text-slate-500">${lead.id}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-slate-900 font-medium">${lead.propertyType}</div>
        <div class="text-xs text-slate-500">${lead.location}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-bold text-slate-900">${formatCurrency(lead.budget)}</div>
        <div class="text-xs text-slate-500">${lead.details.timeline}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <div class="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div class="${scoreStyle.indicator} h-1.5 rounded-full" style="width: ${lead.aiScore}%"></div>
          </div>
          <span class="inline-flex items-center justify-center text-xs font-bold w-9 h-6 rounded border ${scoreStyle.color}">
            ${lead.aiScore}
          </span>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="badge-status ${lead.status.toLowerCase()}">
          <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
          ${lead.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        ${formatDate(lead.createdAt)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onclick="event.stopPropagation()">
        <div class="flex items-center justify-end gap-2">
          <button class="action-btn-inspect p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Inspect AI Insights" data-id="${lead.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button class="action-btn-status p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Quick Qualify" data-id="${lead.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </button>
        </div>
      </td>
    `;
    
    // Add row click listener to inspect details
    tr.addEventListener('click', () => {
      selectLead(lead.id);
    });

    tableBody.appendChild(tr);
  });

  // Re-bind actions inside the table
  bindTableActions();
}

/**
 * Render Inspector Panel for Selected Lead
 */
function renderLeadInspector() {
  const inspector = document.getElementById('inspector-panel');
  const placeholder = document.getElementById('inspector-placeholder');
  const details = document.getElementById('inspector-details');
  const loading = document.getElementById('inspector-loading');

  if (loading) loading.classList.add('hidden');

  if (!AppState.selectedLeadId) {
    placeholder.classList.remove('hidden');
    details.classList.add('hidden');
    return;
  }

  placeholder.classList.add('hidden');
  details.classList.remove('hidden');

  const lead = AppState.leads.find(l => l.id === AppState.selectedLeadId);
  if (!lead) return;

  const scoreStyle = getAiScoreClass(lead.aiScore);

  // Bind lead data to inspector HTML
  document.getElementById('ins-avatar').textContent = lead.name.split(' ').map(n => n[0]).join('');
  document.getElementById('ins-name').textContent = lead.name;
  document.getElementById('ins-id').textContent = lead.id;
  document.getElementById('ins-email').textContent = lead.email;
  document.getElementById('ins-email-link').href = `mailto:${lead.email}`;
  document.getElementById('ins-phone').textContent = lead.phone;
  document.getElementById('ins-phone-link').href = `tel:${lead.phone}`;
  document.getElementById('ins-property').textContent = lead.propertyType;
  document.getElementById('ins-location').textContent = lead.location;
  document.getElementById('ins-budget').textContent = formatCurrency(lead.budget);
  document.getElementById('ins-timeline').textContent = lead.details.timeline;
  document.getElementById('ins-preapproval').textContent = lead.details.mortgageApproved ? "Approved ✓" : "Pending Action ⚠";
  document.getElementById('ins-preapproval').className = `text-sm font-semibold ${lead.details.mortgageApproved ? 'text-emerald-600' : 'text-amber-600'}`;
  document.getElementById('ins-agent').textContent = lead.details.agentAssigned;

  // AI Score badge
  const scoreBadge = document.getElementById('ins-score-badge');
  scoreBadge.textContent = `${lead.aiScore}% Match`;
  scoreBadge.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${scoreStyle.color}`;

  // AI Insights list
  const insightsList = document.getElementById('ins-insights-list');
  insightsList.innerHTML = '';
  lead.aiInsights.forEach(insight => {
    const li = document.createElement('li');
    li.className = 'flex items-start text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3';
    li.innerHTML = `
      <svg class="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>${insight}</span>
    `;
    insightsList.appendChild(li);
  });

  // Action status selectors
  const statusSelect = document.getElementById('ins-status-select');
  statusSelect.value = lead.status;
}

// ==========================================
// 6. Application Controllers & Logic
// ==========================================

async function selectLead(leadId) {
  AppState.selectedLeadId = leadId;
  
  // Re-render table to highlight active row
  renderLeadsTable();
  
  const placeholder = document.getElementById('inspector-placeholder');
  const details = document.getElementById('inspector-details');
  const loading = document.getElementById('inspector-loading');

  if (!leadId) {
    if (placeholder) placeholder.classList.remove('hidden');
    if (details) details.classList.add('hidden');
    if (loading) loading.classList.add('hidden');
    return;
  }

  // Show loading skeleton
  if (placeholder) placeholder.classList.add('hidden');
  if (details) details.classList.add('hidden');
  if (loading) loading.classList.remove('hidden');

  try {
    const fullLead = await LeadsAPI.getLeadDetails(leadId);
    
    // Update the local cache in global state
    const index = AppState.leads.findIndex(l => l.id === leadId);
    if (index !== -1) {
      AppState.leads[index] = fullLead;
    }

    // Render details
    renderLeadInspector();
  } catch (error) {
    console.error(`Failed to fetch lead details for ${leadId}:`, error);
    showToast(`Failed to load lead details: ${error.message}`, "error");
    
    // Fallback: hide loading, show placeholder
    if (loading) loading.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
  }
}

/**
 * Filter and Sort logic
 */
function applyFiltersAndSort() {
  let result = [...AppState.leads];

  // 1. Apply Status Tab Filter
  if (AppState.currentTab !== "all") {
    if (AppState.currentTab === "qualified") {
      result = result.filter(l => l.status === "Qualified");
    } else if (AppState.currentTab === "warm") {
      result = result.filter(l => l.status === "Warm");
    } else if (AppState.currentTab === "cold") {
      result = result.filter(l => l.status === "Cold");
    } else if (AppState.currentTab === "new") {
      result = result.filter(l => l.status === "New");
    }
  }

  // 2. Apply Search Query (Name, ID, Location, Property Type)
  if (AppState.searchQuery.trim() !== "") {
    const q = AppState.searchQuery.toLowerCase();
    result = result.filter(l => 
      l.name.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.propertyType.toLowerCase().includes(q)
    );
  }

  // 3. Apply Sorting
  if (AppState.sortBy === "score-desc") {
    result.sort((a, b) => b.aiScore - a.aiScore);
  } else if (AppState.sortBy === "score-asc") {
    result.sort((a, b) => a.aiScore - b.aiScore);
  } else if (AppState.sortBy === "budget-desc") {
    result.sort((a, b) => b.budget - a.budget);
  } else if (AppState.sortBy === "date-desc") {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  AppState.filteredLeads = result;
  renderLeadsTable();
}

// ==========================================
// 7. Event Binding & Initialization
// ==========================================

function bindEvents() {
  // Search Bar input
  const searchInput = document.getElementById('dashboard-search');
  searchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    applyFiltersAndSort();
  });

  // Tabs navigation
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('border-blue-600', 'text-blue-600', 'font-semibold');
        t.classList.add('border-transparent', 'text-slate-500');
      });
      
      const target = e.currentTarget;
      target.classList.remove('border-transparent', 'text-slate-500');
      target.classList.add('border-blue-600', 'text-blue-600', 'font-semibold');
      
      AppState.currentTab = target.getAttribute('data-tab');
      applyFiltersAndSort();
    });
  });

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', (e) => {
    AppState.sortBy = e.target.value;
    applyFiltersAndSort();
  });

  // Inspector Status selector
  const statusSelect = document.getElementById('ins-status-select');
  statusSelect.addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    const leadId = AppState.selectedLeadId;
    if (!leadId) return;

    // Show indicator/loading state in dropdown
    statusSelect.disabled = true;
    
    try {
      const response = await LeadsAPI.updateLeadStatus(leadId, newStatus);
      if (response.success) {
        // Update local state
        const lead = AppState.leads.find(l => l.id === leadId);
        if (lead) {
          lead.status = newStatus;
          // Trigger notifications/events or rebuild screen
          applyFiltersAndSort();
          renderKpiCards();
          renderLeadInspector();
          showToast(`Lead pipeline stage updated to: ${newStatus}`, "success");
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      showToast(`Failed to update status: ${err.message}`, "error");
      
      // Revert select dropdown to database state
      const lead = AppState.leads.find(l => l.id === leadId);
      if (lead) statusSelect.value = lead.status;
    } finally {
      statusSelect.disabled = false;
    }
  });

  // Close details side-panel helper (For responsive mobile layout drawer behavior)
  const closeInspectorBtn = document.getElementById('close-inspector');
  if (closeInspectorBtn) {
    closeInspectorBtn.addEventListener('click', () => {
      AppState.selectedLeadId = null;
      renderLeadsTable();
      renderLeadInspector();
    });
  }

  // Refresh Button click with spin animation
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Select the SVG icon inside the button to rotate it
      const icon = refreshBtn.querySelector('svg');
      if (icon) icon.classList.add('animate-spin');
      
      initializeDashboard().finally(() => {
        setTimeout(() => {
          if (icon) icon.classList.remove('animate-spin');
        }, 600);
        showToast("Dashboard metrics refreshed!", "success");
      });
    });
  }

  // Export CSV Button click
  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const leads = AppState.filteredLeads;
      if (leads.length === 0) {
        showToast("No leads available to export.", "error");
        return;
      }
      
      const headers = ["ID", "Name", "Email", "Phone", "Property Type", "Location", "Budget (INR)", "AI Score", "Status", "Created At", "Timeline", "Mortgage Approved", "Assigned Agent"];
      const rows = leads.map(l => [
        l.id,
        `"${l.name.replace(/"/g, '""')}"`,
        l.email,
        l.phone,
        `"${l.propertyType.replace(/"/g, '""')}"`,
        `"${l.location.replace(/"/g, '""')}"`,
        l.budget,
        l.aiScore,
        l.status,
        l.createdAt,
        `"${l.details.timeline.replace(/"/g, '""')}"`,
        l.details.mortgageApproved ? "Yes" : "No",
        `"${l.details.agentAssigned.replace(/"/g, '""')}"`
      ]);
      
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `aegis_ai_leads_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(`Exported ${leads.length} leads to CSV successfully!`, "success");
    });
  }

  // Sidebar links placeholder actions
  const sidebarLinks = document.querySelectorAll('aside nav a');
  sidebarLinks.forEach(link => {
    if (link.textContent.includes("Dashboard")) return;
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionName = link.textContent.replace(/Live/g, '').trim();
      showToast(`"${sectionName}" module is under active development.`, "info");
    });
  });
}

function bindTableActions() {
  // Inspect buttons inside rows
  document.querySelectorAll('.action-btn-inspect').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      selectLead(id);
    });
  });

  // Quick Qualify buttons
  document.querySelectorAll('.action-btn-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.getAttribute('data-id');
      const lead = AppState.leads.find(l => l.id === id);
      if (lead && lead.status !== "Qualified") {
        btn.classList.add('animate-pulse');
        try {
          await LeadsAPI.updateLeadStatus(id, "Qualified");
          lead.status = "Qualified";
          applyFiltersAndSort();
          renderKpiCards();
          if (AppState.selectedLeadId === id) {
            renderLeadInspector();
          }
          showToast(`Lead ${lead.name} has been quick-qualified!`, "success");
        } catch (err) {
          console.error("Failed to quick qualify:", err);
          showToast(`Failed to qualify lead: ${err.message}`, "error");
        } finally {
          btn.classList.remove('animate-pulse');
        }
      }
    });
  });
}

/**
 * App initialization entrypoint
 */
async function initializeDashboard() {
  AppState.isLoading = true;
  const tableBody = document.getElementById('leads-table-body');
  
  // Render loading skeleton
  tableBody.innerHTML = `
    <tr class="shimmer-loading"><td colspan="7" class="h-16"></td></tr>
    <tr class="shimmer-loading"><td colspan="7" class="h-16"></td></tr>
    <tr class="shimmer-loading"><td colspan="7" class="h-16"></td></tr>
  `;

  try {
    const leads = await LeadsAPI.getAllLeads();
    AppState.leads = leads;
    AppState.filteredLeads = [...leads];
    
    // Sort initially by high score
    AppState.leads.sort((a, b) => b.aiScore - a.aiScore);
    AppState.filteredLeads.sort((a, b) => b.aiScore - a.aiScore);

    // Initial render
    renderKpiCards();
    renderLeadsTable();
    
    // Select first lead as default inspect item
    if (leads.length > 0) {
      selectLead(leads[0].id);
    }
  } catch (error) {
    console.error("Dashboard failed to initialize:", error);
    showToast(`Database unreachable or API error: ${error.message}`, "error");
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-10 text-center text-rose-500 font-semibold">
          Error loading dashboard data. Database or API connection failed.
        </td>
      </tr>
    `;
  } finally {
    AppState.isLoading = false;
  }
}

/**
 * Bind modal toggle and submit events
 */
function bindModalEvents() {
  const modal = document.getElementById('add-lead-modal');
  const addLeadBtn = document.getElementById('btn-add-lead');
  const closeBtn = document.getElementById('close-add-lead-modal');
  const cancelBtn = document.getElementById('btn-cancel-add-lead');
  const form = document.getElementById('add-lead-form');

  if (!modal || !addLeadBtn) return;

  // Open modal
  addLeadBtn.addEventListener('click', () => {
    modal.classList.add('modal-visible');
  });

  // Fill demo data helper
  const fillDemoBtn = document.getElementById('btn-fill-demo');
  if (fillDemoBtn) {
    fillDemoBtn.addEventListener('click', () => {
      const demoLeads = [
        {
          name: "Rohan Kapoor",
          email: "rohan.kapoor@outlook.com",
          phone: "+91 98765 43210",
          property: "4 BHK Luxury Penthouse",
          location: "Worli, Mumbai",
          budget: "28000000",
          timeline: "Immediate (< 1 month)",
          loan: "true",
          agent: "Sarah Jenkins"
        },
        {
          name: "Neha Deshmukh",
          email: "neha.d@techcorp.in",
          phone: "+91 98123 45678",
          property: "3 BHK Apartment",
          location: "Whitefield, Bangalore",
          budget: "12000000",
          timeline: "1 - 3 months",
          loan: "true",
          agent: "Michael Thorne"
        },
        {
          name: "Vikram Malhotra",
          email: "vikram.m@retailgroup.co.in",
          phone: "+91 98721 48901",
          property: "Duplex Apartment",
          location: "Gachibowli, Hyderabad",
          budget: "9800000",
          timeline: "6+ months",
          loan: "false",
          agent: "Emma Watson"
        },
        {
          name: "Priyanka Sen",
          email: "priyanka.sen@apollo.org.in",
          phone: "+91 99309 12840",
          property: "Independent Villa",
          location: "Koregaon Park, Pune",
          budget: "55000000",
          timeline: "1 - 3 months",
          loan: "false",
          agent: "Sarah Jenkins"
        }
      ];
      
      const randomLead = demoLeads[Math.floor(Math.random() * demoLeads.length)];
      
      document.getElementById('form-name').value = randomLead.name;
      document.getElementById('form-email').value = randomLead.email;
      document.getElementById('form-phone').value = randomLead.phone;
      document.getElementById('form-property').value = randomLead.property;
      document.getElementById('form-location').value = randomLead.location;
      document.getElementById('form-budget').value = randomLead.budget;
      document.getElementById('form-timeline').value = randomLead.timeline;
      document.getElementById('form-loan').value = randomLead.loan;
      document.getElementById('form-agent').value = randomLead.agent;
      
      showToast("Demo lead criteria loaded!", "info");
    });
  }

  // Close modal helper
  const closeModal = () => {
    modal.classList.remove('modal-visible');
    form.reset();
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Handle lead form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('form-name').value;
    const email = document.getElementById('form-email').value;
    const phone = document.getElementById('form-phone').value;
    const propertyType = document.getElementById('form-property').value;
    const location = document.getElementById('form-location').value;
    const budget = parseInt(document.getElementById('form-budget').value, 10);
    const timeline = document.getElementById('form-timeline').value;
    const mortgageApproved = document.getElementById('form-loan').value === 'true';
    const agentAssigned = document.getElementById('form-agent').value;

    const leadData = {
      name,
      email,
      phone,
      propertyType,
      location,
      budget,
      timeline,
      mortgageApproved,
      agentAssigned
    };

    const submitBtn = document.querySelector('button[type="submit"][form="add-lead-form"]') || form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Run AI Qualification";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing AI Logic...";
    }

    try {
      const createdLead = await LeadsAPI.createLead(leadData);

      // Add to global state array
      AppState.leads.unshift(createdLead);
      AppState.currentTab = 'all';
      
      // Sync UI tab active styling
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.getAttribute('data-tab') === 'all') {
          t.classList.remove('border-transparent', 'text-slate-500');
          t.classList.add('border-blue-600', 'text-blue-600', 'font-semibold');
        } else {
          t.classList.remove('border-blue-600', 'text-blue-600', 'font-semibold');
          t.classList.add('border-transparent', 'text-slate-500');
        }
      });

      // Re-render and select
      applyFiltersAndSort();
      renderKpiCards();
      selectLead(createdLead.id);
      
      showToast(`Lead for ${name} created and qualified successfully!`, "success");

      // Close the modal
      closeModal();
    } catch (err) {
      console.error("Failed to submit lead:", err);
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
}

/**
 * Calculates a mock AI Qualification Score based on criteria inputs
 */
function calculateMockAiScore(timeline, loanApproved, budget) {
  let score = 40; // Base score
  
  // Timeline contribution
  if (timeline.includes("Immediate")) score += 30;
  else if (timeline.includes("1 - 3 months")) score += 20;
  else if (timeline.includes("3 - 6 months")) score += 10;
  else if (timeline.includes("6+ months")) score += 2;
  
  // Pre-approved financing contribution
  if (loanApproved) score += 25;
  else score += 5;
  
  // Budget scaling contribution (higher budgets receive minor boosts)
  if (budget >= 10000000) score += 5;      // >= 1 Crore (10M INR)
  else if (budget >= 5000000) score += 3;  // >= 50 Lakhs (5M INR)
  
  // Conversational variance offset
  const offset = Math.floor(Math.random() * 8) - 2; // range: -2 to +5
  score = Math.min(100, Math.max(10, score + offset));
  return score;
}

/**
 * Generates structured mock AI Findings based on submitted lead data
 */
function generateMockAiInsights(name, propertyType, location, timeline, loanApproved, budget, score) {
  const insights = [];
  
  if (loanApproved) {
    insights.push(`Verified pre-approved home loan details. Funding is fully secured.`);
  } else {
    insights.push(`Home loan pre-approval is pending. Action required from assigned broker.`);
  }

  if (timeline.includes("Immediate")) {
    insights.push(`High urgency buyer: searching for immediate occupancy (< 30 days).`);
  } else if (timeline.includes("6+")) {
    insights.push(`Long-term buyer profile: currently in initial planning/research stage.`);
  } else {
    insights.push(`Medium urgency buyer: planning acquisition within the next quarter.`);
  }

  insights.push(`Targeting ${propertyType} in the premium cluster of ${location}.`);

  if (score >= 85) {
    insights.push(`Highly qualified lead (Score: ${score}%). Conversation indicates strong purchase intent.`);
  } else if (score >= 65) {
    insights.push(`Moderate qualification match (Score: ${score}%). Nurturing required on pricing structure.`);
  } else {
    insights.push(`Low qualification metrics. Require verification of buying timeline and capability.`);
  }
  
  return insights;
}

// Start core operations on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    bindModalEvents();
    initializeDashboard();
  });
} else {
  bindEvents();
  bindModalEvents();
  initializeDashboard();
}
