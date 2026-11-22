// ==============================================================================
// AL MURAFAQA • FEST COMMAND CENTER JAVASCRIPT CONTROLLER (admin.js)
// Vanilla ES Module with full reactive controls and dual cloud/offline state
// ==============================================================================

import { db, isConfigured } from './supabase-config.js';

// Global State
let currentTab = 'overview';
let cachedSettings = null;
let cachedEvents = [];
let cachedRegistrations = [];
let cachedAnnouncements = [];
let cachedWinners = [];
let currentAttendeeLookup = null;

// ==============================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initLucide();
  setupEventListeners();
  await checkAuthSession();
});

function initLucide() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function isAdminSession(session) {
  if (!session?.user) return false;
  if (!db.isLive()) {
    return session.user.id === 'demo-admin-id' || session.user.app_metadata?.role === 'admin';
  }
  return (
    session.user.app_metadata?.role === 'admin' ||
    session.user.user_metadata?.role === 'admin'
  );
}

async function checkAuthSession() {
  try {
    const session = await db.getSession();
    const authOverlay = document.getElementById('auth-overlay');

    if (isAdminSession(session)) {
      authOverlay.classList.add('hidden');
      updateCloudIndicator();
      await loadAllData();
    } else {
      if (session?.user && db.isLive()) await db.signOut();
      authOverlay.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Auth verification error:', err);
    document.getElementById('auth-overlay').classList.remove('hidden');
  }
}

function updateCloudIndicator() {
  const dot = document.getElementById('cloud-indicator-dot');
  const text = document.getElementById('cloud-indicator-text');
  if (db.isLive()) {
    dot.className = 'cloud-dot';
    text.textContent = 'Supabase Cloud Mode';
  } else {
    dot.className = 'cloud-dot demo';
    text.textContent = 'Local Demo Mode (Offline)';
  }
}

// ==============================================================================
// 2. EVENT LISTENERS SETUP
// ==============================================================================

function setupEventListeners() {
  // Login Form
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('btn-submit-login');
      btn.disabled = true;
      btn.innerHTML = '<span>Verifying credentials...</span>';

      try {
        const authResult = await db.signIn(email, password);
        const session = authResult?.session || await db.getSession();
        if (!isAdminSession(session)) {
          if (session?.user && db.isLive()) await db.signOut();
          throw new Error('This account is not assigned the administrator role.');
        }
        document.getElementById('auth-overlay').classList.add('hidden');
        showToast('Authenticated successfully as Administrator', 'success');
        updateCloudIndicator();
        await loadAllData();
      } catch (err) {
        showToast(err.message || 'Login failed. Check credentials.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock</span><span>Authenticate Session</span>';
        initLucide();
      }
    });
  }

  // Quick Demo Auto-Fill
  const btnDemo = document.getElementById('btn-quick-demo');
  if (btnDemo) {
    btnDemo.addEventListener('click', () => {
      document.getElementById('login-email').value = 'admin@almurafaqa.com';
      document.getElementById('login-password').value = 'admin123';
      showToast('Demo credentials filled. Click Authenticate.', 'info');
    });
  }

  // Sign Out
  const btnSignout = document.getElementById('btn-signout');
  if (btnSignout) {
    btnSignout.addEventListener('click', async () => {
      try {
        await db.signOut();
        document.getElementById('auth-overlay').classList.remove('hidden');
        showToast('Signed out of command center', 'info');
      } catch (err) {
        showToast('Sign out failed: ' + err.message, 'error');
      }
    });
  }

  // Mobile Sidebar Drawer Controls
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const closeSidebarBtn = document.getElementById('btn-close-sidebar');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = sidebar.classList.contains('-translate-x-full');
      if (isHidden) {
        openSidebar();
      } else {
        closeSidebar();
      }
    });
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', closeSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Tab Navigation (clicking any tab closes sidebar on mobile)
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
      closeSidebar();
    });
  });

  // Overview Quick Actions
  const btnQuickNew = document.getElementById('btn-quick-new-programme');
  if (btnQuickNew) {
    btnQuickNew.addEventListener('click', () => {
      switchTab('events');
      const btnOpen = document.getElementById('btn-open-add-event');
      if (btnOpen) btnOpen.click();
    });
  }

  const btnQuickScan = document.getElementById('btn-quick-scan-pass');
  if (btnQuickScan) {
    btnQuickScan.addEventListener('click', () => switchTab('checkin'));
  }

  const btnQuickBroadcast = document.getElementById('btn-quick-broadcast');
  if (btnQuickBroadcast) {
    btnQuickBroadcast.addEventListener('click', () => switchTab('announcements'));
  }

  const btnQuickExport = document.getElementById('btn-quick-export');
  if (btnQuickExport) {
    btnQuickExport.addEventListener('click', exportRegistrationsCSV);
  }

  // Global Search Input
  const globalSearch = document.getElementById('global-search-input');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      const val = e.target.value;
      if (currentTab === 'overview') {
        renderOverviewProgrammes(val);
      } else if (currentTab === 'events') {
        const evSearch = document.getElementById('events-search-input');
        if (evSearch) {
          evSearch.value = val;
          renderEventsTab();
        }
      } else if (currentTab === 'registrations') {
        const regSearch = document.getElementById('reg-search-input');
        if (regSearch) {
          regSearch.value = val;
          renderRegistrationsTab();
        }
      }
    });
  }

  // Emergency Switches
  setupEmergencySwitches();

  // Settings Form
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSettingsSubmit);
  }

  // Announcement Form
  const ancForm = document.getElementById('announcement-form');
  if (ancForm) {
    ancForm.addEventListener('submit', handleAnnouncementSubmit);
  }

  // Event Modals & Filters
  setupEventControls();

  // Registration Filters & Modals
  setupRegistrationControls();

  // Venue Check-In Lookup
  setupCheckInControls();

  // Winners Form
  setupWinnersControls();

  // Global Modal Close Buttons
  document.querySelectorAll('.btn-close-modal').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('show'));
    });
  });

  // Close modals clicking outside
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('show');
    });
  });
}

// Switch Active Tab
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
    if (isTarget) {
      btn.className = 'nav-item flex items-center gap-space-md px-space-md py-space-sm transition-all duration-200 group bg-red-600 text-white font-label-lg font-bold rounded-xl shadow-md shadow-red-600/25 w-full text-left active';
    } else {
      btn.className = 'nav-item flex items-center gap-space-md px-space-md py-space-sm rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 group w-full text-left';
    }
  });

  document.querySelectorAll('.tab-pane').forEach((pane) => {
    const isTarget = pane.id === `tab-${tabId}`;
    pane.classList.toggle('active', isTarget);
    pane.classList.toggle('hidden', !isTarget);
  });

  initLucide();
}
window.switchTab = switchTab;

// ==============================================================================
// 3. MASTER DATA LOADER
// ==============================================================================

async function loadAllData() {
  try {
    const [settings, events, registrations, announcements, winners] = await Promise.all([
      db.getSettings(),
      db.getEvents(),
      db.getRegistrations(),
      db.getAnnouncements(),
      db.getWinners(),
    ]);

    cachedSettings = settings;
    cachedEvents = events;
    cachedRegistrations = registrations;
    cachedAnnouncements = announcements;
    cachedWinners = winners;

    renderOverview();
    renderAnnouncementsTab();
    renderEventsTab();
    renderRegistrationsTab();
    renderCheckInTab();
    renderWinnersTab();

    initLucide();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    showToast('Failed to load live data. Retrying with local cache.', 'error');
  }
}

// ==============================================================================
// 4. TAB 1: OVERVIEW & MASTER SWITCHES
// ==============================================================================

function renderOverview() {
  if (!cachedSettings) return;

  // Sync Emergency Switches
  const swReg = document.getElementById('switch-registrations');
  const swTicker = document.getElementById('switch-ticker');
  const swMaint = document.getElementById('switch-maintenance');

  if (swReg) swReg.checked = cachedSettings.registrations_open;
  if (swTicker) swTicker.checked = cachedSettings.live_ticker_enabled;
  if (swMaint) swMaint.checked = cachedSettings.maintenance_mode;

  updateSwitchLabels();

  // Calculate Metrics
  const totalRegs = cachedRegistrations.length;
  const checkedInCount = cachedRegistrations.filter((r) => r.checked_in).length;
  const pendingCheckInCount = cachedRegistrations.filter((r) => !r.checked_in).length;

  // Calculate institutions and teams
  const institutionsSet = new Set(
    cachedRegistrations.map((r) => r.college_name || r.institution).filter(Boolean)
  );
  const totalInstitutions = institutionsSet.size;
  const totalTeams = cachedRegistrations.filter((r) => r.team_name && r.team_name.trim().length > 0).length;

  const elRegs = document.getElementById('stat-total-regs');
  if (elRegs) elRegs.textContent = totalRegs.toLocaleString();

  const totalParticipants = cachedRegistrations.reduce((count, registration) => {
    const members = Array.isArray(registration.team_members) ? registration.team_members.length : 1;
    return count + Math.max(members, 1);
  }, 0);
  const elParts = document.getElementById('stat-total-participants');
  if (elParts) elParts.textContent = totalParticipants.toLocaleString();

  const elProgs = document.getElementById('stat-total-programmes');
  if (elProgs) elProgs.textContent = cachedEvents.length.toString();

  const elInstitutions = document.getElementById('stat-total-institutions');
  if (elInstitutions) elInstitutions.textContent = totalInstitutions.toLocaleString();

  const elTeams = document.getElementById('stat-total-teams');
  if (elTeams) elTeams.textContent = totalTeams.toLocaleString();

  const elChecked = document.getElementById('stat-checkedin-count');
  if (elChecked) elChecked.textContent = checkedInCount.toLocaleString();

  // Pending Admission Badge in Sidebar
  const badge = document.getElementById('badge-pending-count');
  if (badge) {
    badge.textContent = pendingCheckInCount;
    badge.style.display = pendingCheckInCount > 0 ? 'inline-block' : 'none';
  }

  // Render Capacity Bars & Overview Programmes
  renderCapacityGauges();
  renderOverviewProgrammes();
}

let currentOverviewCategory = 'all';
let currentOverviewDay = 'all';

function renderOverviewProgrammes() {
  const tbody = document.getElementById('overview-programmes-table-body');
  if (!tbody) return;

  let list = cachedEvents;
  if (currentOverviewCategory && currentOverviewCategory !== 'all') {
    const fLower = currentOverviewCategory.toLowerCase();
    list = list.filter(
      (e) =>
        (e.category && e.category.toLowerCase().includes(fLower)) ||
        (e.title && e.title.toLowerCase().includes(fLower))
    );
  }

  if (currentOverviewDay && currentOverviewDay !== 'all') {
    const dayNum = Number(currentOverviewDay);
    list = list.filter((e) => Number(e.day_number) === dayNum);
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 font-medium">No programmes scheduled for this track.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((evt) => {
      const regCount = cachedRegistrations.filter((r) => r.event_id === evt.id).length;
      const cap = evt.max_capacity || 40;
      const pct = Math.min(100, Math.round((regCount / cap) * 100));

      let statusBadge = '';
      if (evt.status === 'open') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-label-sm text-xs font-bold inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>In Progress</span>';
      } else if (evt.status === 'closing_soon') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-label-sm text-xs font-bold">Closing Soon</span>';
      } else if (evt.status === 'full') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-label-sm text-xs font-bold">Capacity Full</span>';
      } else {
        statusBadge = '<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-label-sm text-xs font-semibold">Scheduled</span>';
      }

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-3.5 px-6 whitespace-nowrap">
          <div class="flex flex-col">
            <span class="font-headline-sm text-sm font-bold text-red-600">${escapeHtml(evt.time_slot || '20:00 - 22:00')}</span>
            <span class="text-xs text-slate-500 font-medium">Day ${evt.day_number || 1} • ${escapeHtml(evt.category)}</span>
          </div>
        </td>
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full ${evt.status === 'open' ? 'bg-red-600 animate-pulse' : 'bg-slate-300'}"></div>
            <div>
              <span class="font-label-lg text-sm font-bold text-slate-900 block">${escapeHtml(evt.title)}</span>
              <span class="text-xs text-slate-500 truncate max-w-xs block">${escapeHtml(evt.rules || 'Official competition track')}</span>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 text-xs text-slate-800 font-medium">
            <span class="material-symbols-outlined text-[16px] text-red-600">theater_comedy</span>
            ${escapeHtml(evt.venue || 'Gran Domo Andalusí')}
          </span>
        </td>
        <td class="py-3.5 px-4">
          <span class="text-xs text-slate-700 font-medium">${escapeHtml(evt.category)} • Min ${evt.team_size_min || 1}</span>
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap">
          <div class="flex flex-col gap-1 w-28">
            <div class="flex justify-between text-xs">
              <span class="text-slate-800 font-semibold">${regCount} / ${cap}</span>
              <span class="text-red-600 font-bold">${pct}%</span>
            </div>
            <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div class="bg-red-600 h-full rounded-full" style="width: ${pct}%;"></div>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-6 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-1">
            <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors" title="Edit Programme" onclick="window.openEditEventModal('${evt.id}')">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors" title="View Details" onclick="window.switchTab('events')">
              <span class="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

window.filterOverviewSchedule = function (cat, btn) {
  currentOverviewCategory = cat;
  document.querySelectorAll('#tab-overview button[onclick^="window.filterOverviewSchedule"]').forEach((b) => {
    b.className = 'px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-label-sm text-label-sm transition-colors';
  });
  if (btn) {
    btn.className = 'px-3 py-1.5 rounded-xl bg-red-600 text-white font-label-sm text-label-sm font-semibold shadow-sm';
  }
  renderOverviewProgrammes();
};

window.filterOverviewByDay = function (day, btn) {
  currentOverviewDay = day;
  document.querySelectorAll('#tab-overview button[onclick^="window.filterOverviewByDay"]').forEach((b) => {
    b.className = 'px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-label-sm text-label-sm transition-colors shadow-sm';
  });
  if (btn) {
    btn.className = 'px-3 py-1.5 rounded-lg bg-red-600 text-white font-label-sm text-label-sm font-bold shadow-sm transition-colors';
  }
  const countLabel = document.getElementById('overview-schedule-count');
  if (countLabel) {
    countLabel.textContent = day === 'all'
      ? 'Showing all curated festival programmes across active hall spaces'
      : `Showing curated programmes scheduled for Day ${day}`;
  }
  renderOverviewProgrammes();
};

function updateSwitchLabels() {
  const swReg = document.getElementById('switch-registrations');
  const swTicker = document.getElementById('switch-ticker');
  const swMaint = document.getElementById('switch-maintenance');

  const lblReg = document.getElementById('label-reg-status');
  const lblTicker = document.getElementById('label-ticker-status');
  const lblMaint = document.getElementById('label-maint-status');

  if (lblReg && swReg) {
    lblReg.textContent = swReg.checked ? 'Accepting registrations' : 'Registrations paused globally';
    lblReg.style.color = swReg.checked ? 'var(--status-verified)' : 'var(--fest-red)';
  }
  if (lblTicker && swTicker) {
    lblTicker.textContent = swTicker.checked ? 'Ticker active on front page' : 'Ticker hidden on front page';
  }
  if (lblMaint && swMaint) {
    lblMaint.textContent = swMaint.checked ? '⚠️ Front page in Maintenance Mode' : 'Site operates normally';
    lblMaint.style.color = swMaint.checked ? 'var(--fest-red)' : 'var(--text-muted)';
  }
}

function setupEmergencySwitches() {
  const swReg = document.getElementById('switch-registrations');
  const swTicker = document.getElementById('switch-ticker');
  const swMaint = document.getElementById('switch-maintenance');

  const saveSwitch = async (toggle, setting, enabledMessage, disabledMessage) => {
    const previousValue = Boolean(cachedSettings?.[setting]);
    const nextValue = toggle.checked;
    updateSwitchLabels();

    try {
      cachedSettings = await db.updateSettings({ [setting]: nextValue });
      showToast(nextValue ? enabledMessage : disabledMessage, setting === 'maintenance_mode' && nextValue ? 'warning' : 'info');
    } catch (err) {
      toggle.checked = previousValue;
      updateSwitchLabels();
      showToast('Failed to save setting: ' + err.message, 'error');
    }
  };

  if (swReg) {
    swReg.addEventListener('change', () => {
      saveSwitch(swReg, 'registrations_open', 'Registrations OPENED globally', 'Registrations PAUSED globally');
    });
  }

  if (swTicker) {
    swTicker.addEventListener('change', () => {
      saveSwitch(swTicker, 'live_ticker_enabled', 'Announcement ticker activated', 'Announcement ticker silenced');
    });
  }

  if (swMaint) {
    swMaint.addEventListener('change', () => {
      saveSwitch(swMaint, 'maintenance_mode', 'Site set to MAINTENANCE mode', 'Site returned to LIVE mode');
    });
  }
}

function renderCapacityGauges() {
  const container = document.getElementById('capacity-bars-container');
  if (!container) return;

  if (cachedEvents.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">No events created yet.</p>';
    return;
  }

  container.innerHTML = cachedEvents
    .map((evt) => {
      const registeredCount = cachedRegistrations.filter((r) => r.event_id === evt.id).length;
      const cap = evt.max_capacity || 50;
      const pct = Math.min(100, Math.round((registeredCount / cap) * 100));

      return `
      <div class="capacity-item">
        <div class="capacity-header">
          <span>${escapeHtml(evt.title)} (${escapeHtml(evt.category)})</span>
          <span><strong>${registeredCount}</strong> / ${cap} slots (${pct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
    })
    .join('');
}

// ==============================================================================
// 5. TAB 2: SITE & ANNOUNCEMENTS
// ==============================================================================

function renderAnnouncementsTab() {
  if (cachedSettings) {
    const phoneInput = document.getElementById('setting-phone');
    const tickerInput = document.getElementById('setting-ticker');

    if (phoneInput) phoneInput.value = cachedSettings.support_phone || '';
    if (tickerInput) tickerInput.value = cachedSettings.live_ticker_text || '';
  }

  const tbody = document.getElementById('announcements-table-body');
  if (!tbody) return;

  if (cachedAnnouncements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No announcements posted yet.</td></tr>';
    return;
  }

  tbody.innerHTML = cachedAnnouncements
    .map((anc) => {
      return `
      <tr>
        <td><strong>${escapeHtml(anc.title)}</strong></td>
        <td style="max-width: 380px;">${escapeHtml(anc.message)}</td>
        <td>
          <span class="badge" style="background: ${anc.is_urgent ? '#FEE2E2' : '#E0E7FF'}; color: ${anc.is_urgent ? '#B91C1C' : '#4338CA'};">
            ${anc.is_urgent ? '🚨 Urgent' : 'General'}
          </span>
        </td>
        <td>
          <span class="badge ${anc.is_active ? 'verified' : 'rejected'}">
            ${anc.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn-icon" title="Toggle active status" onclick="window.toggleAnnouncementActive('${anc.id}')">
              <i data-lucide="${anc.is_active ? 'eye-off' : 'eye'}" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="btn-icon reject" title="Delete announcement" onclick="window.deleteAnnouncement('${anc.id}')">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  initLucide();
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const support_phone = document.getElementById('setting-phone').value.trim();
  const live_ticker_text = document.getElementById('setting-ticker').value.trim();

  try {
    cachedSettings = await db.updateSettings({ support_phone, live_ticker_text });
    showToast('Festival settings & live ticker updated successfully', 'success');
  } catch (err) {
    showToast('Failed to update settings: ' + err.message, 'error');
  }
}

async function handleAnnouncementSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('anc-title').value.trim();
  const message = document.getElementById('anc-message').value.trim();
  const is_urgent = document.getElementById('anc-urgent').checked;

  try {
    await db.saveAnnouncement({ title, message, is_urgent, is_active: true });
    e.target.reset();
    cachedAnnouncements = await db.getAnnouncements();
    renderAnnouncementsTab();
    showToast('New broadcast announcement published', 'success');
  } catch (err) {
    showToast('Failed to publish announcement: ' + err.message, 'error');
  }
}

window.toggleAnnouncementActive = async function (id) {
  const item = cachedAnnouncements.find((a) => a.id === id);
  if (!item) return;
  const previousValue = item.is_active;
  item.is_active = !item.is_active;
  try {
    await db.saveAnnouncement(item);
    cachedAnnouncements = await db.getAnnouncements();
    renderAnnouncementsTab();
    showToast(`Announcement ${item.is_active ? 'activated' : 'deactivated'}`, 'info');
  } catch (err) {
    item.is_active = previousValue;
    renderAnnouncementsTab();
    showToast('Failed to update announcement: ' + err.message, 'error');
  }
};

window.deleteAnnouncement = async function (id) {
  if (!confirm('Are you sure you want to remove this announcement?')) return;
  try {
    await db.deleteAnnouncement(id);
    cachedAnnouncements = await db.getAnnouncements();
    renderAnnouncementsTab();
    showToast('Announcement removed', 'info');
  } catch (err) {
    showToast('Failed to delete announcement: ' + err.message, 'error');
  }
};

// ==============================================================================
// 6. TAB 3: EVENTS & SCHEDULE MANAGER
// ==============================================================================

function renderEventsTab() {
  const tbody = document.getElementById('events-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('events-search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('events-status-filter')?.value || 'all';

  const filtered = cachedEvents.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchVal) ||
      evt.category.toLowerCase().includes(searchVal) ||
      evt.venue.toLowerCase().includes(searchVal);
    const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No competitions match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((evt) => {
      const regCount = cachedRegistrations.filter((r) => r.event_id === evt.id).length;
      return `
      <tr>
        <td>
          <strong>${escapeHtml(evt.title)}</strong>
          <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(evt.rules || 'No rules defined')}</span>
        </td>
        <td>
          <span class="badge" style="background: rgba(227, 90, 36, 0.1); color: var(--fest-orange);">
            ${escapeHtml(evt.category)}
          </span>
        </td>
        <td>
          <strong>Day ${evt.day_number}</strong> • ${escapeHtml(evt.time_slot)}
          <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(evt.venue)}</span>
        </td>
        <td>
          <div style="font-size: 0.8rem; font-weight: 700; margin-bottom: 4px;">${regCount} / ${evt.max_capacity}</div>
          <div class="progress-track" style="width: 100px; height: 6px;">
            <div class="progress-fill" style="width: ${Math.min(100, Math.round((regCount / evt.max_capacity) * 100))}%;"></div>
          </div>
        </td>
        <td>
          <input type="checkbox" ${evt.is_featured ? 'checked' : ''} onchange="window.toggleEventFeatured('${evt.id}', this.checked)" style="width: 18px; height: 18px; accent-color: var(--fest-orange); cursor: pointer;">
        </td>
        <td>
          <select class="form-input" style="padding: 4px 8px; font-size: 0.8rem; width: auto;" onchange="window.updateEventStatus('${evt.id}', this.value)">
            <option value="open" ${evt.status === 'open' ? 'selected' : ''}>Open</option>
            <option value="closing_soon" ${evt.status === 'closing_soon' ? 'selected' : ''}>Closing Soon</option>
            <option value="full" ${evt.status === 'full' ? 'selected' : ''}>Full</option>
            <option value="closed" ${evt.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn-icon" title="Edit event" onclick="window.openEditEventModal('${evt.id}')">
              <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="btn-icon reject" title="Delete event" onclick="window.deleteEvent('${evt.id}')">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  initLucide();
}

function setupEventControls() {
  const searchInput = document.getElementById('events-search-input');
  const statusFilter = document.getElementById('events-status-filter');
  if (searchInput) searchInput.addEventListener('input', renderEventsTab);
  if (statusFilter) statusFilter.addEventListener('change', renderEventsTab);

  // Add Event Button
  const btnAdd = document.getElementById('btn-open-add-event');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      document.getElementById('form-event-editor').reset();
      document.getElementById('event-edit-id').value = '';
      document.getElementById('modal-event-title').textContent = 'Add New Competition Event';
      document.getElementById('modal-event').classList.add('show');
    });
  }

  // Event Form Submit
  const eventForm = document.getElementById('form-event-editor');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('event-edit-id').value;
      const eventData = {
        title: document.getElementById('evt-title').value.trim(),
        category: document.getElementById('evt-category').value.trim(),
        venue: document.getElementById('evt-venue').value.trim(),
        fee: 0,
        prize_pool: 0,
        max_capacity: Number(document.getElementById('evt-capacity').value),
        team_size_min: Number(document.getElementById('evt-team-min').value),
        team_size_max: Number(document.getElementById('evt-team-max').value),
        day_number: Number(document.getElementById('evt-day').value),
        time_slot: document.getElementById('evt-time').value.trim(),
        rules: document.getElementById('evt-rules').value.trim(),
        is_featured: document.getElementById('evt-featured').checked,
        status: document.getElementById('evt-status').value,
      };
      if (id) eventData.id = id;

      try {
        await db.saveEvent(eventData);
        document.getElementById('modal-event').classList.remove('show');
        cachedEvents = await db.getEvents();
        renderEventsTab();
        renderOverview();
        renderRegistrationsTab();
        renderWinnersTab();
        showToast(`Event ${id ? 'updated' : 'created'} successfully`, 'success');
      } catch (err) {
        showToast('Error saving event: ' + err.message, 'error');
      }
    });
  }
}

window.openEditEventModal = function (id) {
  const evt = cachedEvents.find((e) => e.id === id);
  if (!evt) return;

  document.getElementById('event-edit-id').value = evt.id;
  document.getElementById('evt-title').value = evt.title;
  document.getElementById('evt-category').value = evt.category;
  document.getElementById('evt-venue').value = evt.venue;
  document.getElementById('evt-capacity').value = evt.max_capacity;
  document.getElementById('evt-team-min').value = evt.team_size_min || 1;
  document.getElementById('evt-team-max').value = evt.team_size_max || 1;
  document.getElementById('evt-day').value = evt.day_number || 1;
  document.getElementById('evt-time').value = evt.time_slot;
  document.getElementById('evt-rules').value = evt.rules || '';
  document.getElementById('evt-featured').checked = evt.is_featured;
  document.getElementById('evt-status').value = evt.status;

  document.getElementById('modal-event-title').textContent = 'Edit Competition Event';
  document.getElementById('modal-event').classList.add('show');
};

window.updateEventStatus = async function (id, status) {
  const evt = cachedEvents.find((e) => e.id === id);
  if (!evt) return;
  const previousStatus = evt.status;
  evt.status = status;
  try {
    await db.saveEvent(evt);
    renderEventsTab();
    renderOverview();
    showToast(`Status updated to ${status.replace('_', ' ').toUpperCase()}`, 'info');
  } catch (err) {
    evt.status = previousStatus;
    renderEventsTab();
    showToast('Failed to update event status: ' + err.message, 'error');
  }
};

window.toggleEventFeatured = async function (id, is_featured) {
  const evt = cachedEvents.find((e) => e.id === id);
  if (!evt) return;
  const previousValue = evt.is_featured;
  evt.is_featured = is_featured;
  try {
    await db.saveEvent(evt);
    renderEventsTab();
    renderOverview();
    showToast(`Event ${is_featured ? 'featured on front page' : 'unfeatured'}`, 'info');
  } catch (err) {
    evt.is_featured = previousValue;
    renderEventsTab();
    showToast('Failed to update event: ' + err.message, 'error');
  }
};

window.deleteEvent = async function (id) {
  if (!confirm('Are you sure you want to delete this event? This will also remove its associated registrations.')) return;
  try {
    await db.deleteEvent(id);
    [cachedEvents, cachedRegistrations, cachedWinners] = await Promise.all([
      db.getEvents(),
      db.getRegistrations(),
      db.getWinners(),
    ]);
    renderEventsTab();
    renderOverview();
    renderRegistrationsTab();
    renderCheckInTab();
    renderWinnersTab();
    showToast('Event and its registrations removed', 'info');
  } catch (err) {
    showToast('Failed to delete event: ' + err.message, 'error');
  }
};

// ==============================================================================
// 7. TAB 3: TEAMS & PARTICIPANTS / REGISTRATIONS DESK
// ==============================================================================

function renderRegistrationsTab() {
  const tbody = document.getElementById('registrations-table-body');
  const eventSelect = document.getElementById('reg-event-filter');
  if (!tbody) return;

  // Rebuild the filter so newly created or deleted events stay in sync.
  if (eventSelect) {
    const selectedEventId = eventSelect.value || 'all';
    eventSelect.length = 1;
    cachedEvents.forEach((evt) => {
      const opt = document.createElement('option');
      opt.value = evt.id;
      opt.textContent = evt.title;
      eventSelect.appendChild(opt);
    });
    eventSelect.value = cachedEvents.some((evt) => evt.id === selectedEventId) ? selectedEventId : 'all';
  }

  const searchVal = (document.getElementById('reg-search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('reg-status-filter')?.value || 'all';
  const eventFilter = eventSelect?.value || 'all';

  const filtered = cachedRegistrations.filter((r) => {
    const matchesSearch =
      r.ticket_code.toLowerCase().includes(searchVal) ||
      r.leader_name.toLowerCase().includes(searchVal) ||
      r.leader_phone.toLowerCase().includes(searchVal) ||
      (r.college_name && r.college_name.toLowerCase().includes(searchVal)) ||
      (r.team_name && r.team_name.toLowerCase().includes(searchVal));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'admitted' && r.checked_in) ||
      (statusFilter === 'not_admitted' && !r.checked_in);
    const matchesEvent = eventFilter === 'all' || r.event_id === eventFilter;
    return matchesSearch && matchesStatus && matchesEvent;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No registrations match search or filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((r) => {
      const evt = cachedEvents.find((e) => e.id === r.event_id) || r.events;
      const membersCount = Array.isArray(r.team_members) ? r.team_members.length : 1;

      return `
      <tr>
        <td>
          <span style="font-family: var(--font-display); font-weight: 800; color: var(--fest-red); letter-spacing: 0.5px;">
            ${escapeHtml(r.ticket_code)}
          </span>
          <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">${formatDate(r.created_at)}</span>
        </td>
        <td>
          <strong>${escapeHtml(r.leader_name)}</strong>
          <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.leader_phone)} • ${escapeHtml(r.leader_email)}</span>
          ${r.team_name ? `<span style="font-size: 0.75rem; color: var(--fest-orange); font-weight: 600;">Team: ${escapeHtml(r.team_name)}</span>` : ''}
        </td>
        <td>
          <strong>${evt ? escapeHtml(evt.title) : 'Unknown Event'}</strong>
          <button class="btn-demo-quick" style="padding: 2px 6px; font-size: 0.7rem; margin-top: 2px;" onclick="window.viewTeamModal('${r.id}')">
            View Roster (${membersCount})
          </button>
        </td>
        <td>${escapeHtml(r.college_name)}</td>
        <td>
          <span class="badge ${r.checked_in ? 'checked' : ''}" style="${!r.checked_in ? 'background: #FEF3C7; color: #92400E;' : ''}">
            ${r.checked_in ? '✓ Admitted' : 'Pending Check-In'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            ${
              !r.checked_in
                ? `<button class="btn-icon verify" title="Check-In Attendee" onclick="window.quickCheckIn('${r.id}')">
                     <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                   </button>`
                : `<button class="btn-icon" title="Admitted" disabled style="opacity: 0.5; cursor: default;">
                     <i data-lucide="check-check" style="width: 16px; height: 16px;"></i>
                   </button>`
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  initLucide();
}

window.quickCheckIn = async function (id) {
  try {
    await db.checkIn(id, true);
    cachedRegistrations = await db.getRegistrations();
    renderRegistrationsTab();
    renderOverview();
    renderCheckInTab();
    showToast('Attendee checked in successfully', 'success');
  } catch (err) {
    showToast('Check-in failed: ' + err.message, 'error');
  }
};

function setupRegistrationControls() {
  const searchInput = document.getElementById('reg-search-input');
  const statusFilter = document.getElementById('reg-status-filter');
  const eventFilter = document.getElementById('reg-event-filter');

  if (searchInput) searchInput.addEventListener('input', renderRegistrationsTab);
  if (statusFilter) statusFilter.addEventListener('change', renderRegistrationsTab);
  if (eventFilter) eventFilter.addEventListener('change', renderRegistrationsTab);

  // Open On-Spot Walk-In Modal
  const btnOnSpot = document.getElementById('btn-open-onspot-modal');
  if (btnOnSpot) {
    btnOnSpot.addEventListener('click', () => {
      if (cachedEvents.length === 0) {
        showToast('Please create at least one event before adding walk-in registrations.', 'warning');
        switchTab('events');
        return;
      }
      const select = document.getElementById('onspot-event');
      select.innerHTML = '';
      cachedEvents.forEach((evt) => {
        const opt = document.createElement('option');
        opt.value = evt.id;
        opt.textContent = `${evt.title} • Day ${evt.day_number}`;
        select.appendChild(opt);
      });
      document.getElementById('form-onspot').reset();
      document.getElementById('modal-onspot').classList.add('show');
    });
  }

  // On-Spot Form Submit
  const formOnSpot = document.getElementById('form-onspot');
  if (formOnSpot) {
    formOnSpot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const event_id = document.getElementById('onspot-event').value;
      if (!event_id) {
        showToast('Please select a valid event for this registration.', 'warning');
        return;
      }
      const leader_name = document.getElementById('onspot-name').value.trim();
      const leader_email = document.getElementById('onspot-email').value.trim();
      const leader_phone = document.getElementById('onspot-phone').value.trim();
      const college_name = document.getElementById('onspot-college').value.trim();
      const team_name = document.getElementById('onspot-team').value.trim();
      const autoCheckIn = document.getElementById('onspot-checkin').checked;

      const regData = {
        event_id,
        leader_name,
        leader_email,
        leader_phone,
        college_name,
        team_name: team_name || null,
        payment_status: 'free',
        transaction_id: 'FREE-ENTRY',
        checked_in: autoCheckIn,
        checked_in_at: autoCheckIn ? new Date().toISOString() : null,
      };

      try {
        const created = await db.addRegistration(regData);
        document.getElementById('modal-onspot').classList.remove('show');
        cachedRegistrations = await db.getRegistrations();
        renderRegistrationsTab();
        renderOverview();
        showToast(`Registered successfully! Ticket Code: ${created.ticket_code}`, 'success');
      } catch (err) {
        showToast('Registration failed: ' + err.message, 'error');
      }
    });
  }

  // Export CSV
  const btnCsv = document.getElementById('btn-export-csv');
  if (btnCsv) {
    btnCsv.addEventListener('click', exportRegistrationsCSV);
  }
}

window.updatePaymentStatus = async function (id, status) {
  try {
    await db.updatePayment(id, status);
    cachedRegistrations = await db.getRegistrations();
    renderRegistrationsTab();
    renderOverview();
  } catch (err) {
    console.warn('Payment status update bypassed:', err.message);
  }
};

window.viewTeamModal = function (id) {
  const reg = cachedRegistrations.find((r) => r.id === id);
  if (!reg) return;

  const titleEl = document.getElementById('modal-team-title');
  const contentEl = document.getElementById('modal-team-content');

  titleEl.textContent = `${reg.team_name || reg.leader_name} • Roster (${reg.ticket_code})`;

  let members = [];
  try {
    members = typeof reg.team_members === 'string' ? JSON.parse(reg.team_members) : reg.team_members;
  } catch (e) {
    members = [];
  }
  if (!Array.isArray(members) || members.length === 0) {
    members = [{ name: reg.leader_name, role: 'Lead Contestant' }];
  }

  contentEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <p style="font-size: 0.85rem; color: var(--text-muted);">College / Affiliation: <strong>${escapeHtml(reg.college_name)}</strong></p>
      <p style="font-size: 0.85rem; color: var(--text-muted);">Contact: <strong>${escapeHtml(reg.leader_phone)}</strong> (${escapeHtml(reg.leader_email)})</p>
    </div>
    <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
      <table style="width: 100%;">
        <thead>
          <tr>
            <th>Member Name</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          ${members
            .map(
              (m, idx) => `
            <tr>
              <td><strong>${escapeHtml(m.name || 'Member ' + (idx + 1))}</strong></td>
              <td><span class="badge" style="background: rgba(227, 90, 36, 0.1); color: var(--fest-orange);">${escapeHtml(m.role || 'Member')}</span></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('modal-team').classList.add('show');
};

function exportRegistrationsCSV() {
  if (cachedRegistrations.length === 0) {
    showToast('No registrations to export', 'info');
    return;
  }

  const headers = ['Ticket Code', 'Event Title', 'Leader Name', 'Email', 'Phone', 'Institution', 'Team Name', 'Checked In'];
  const csvCell = (value) => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const rows = cachedRegistrations.map((r) => {
    const evt = cachedEvents.find((e) => e.id === r.event_id) || r.events;
    return [
      r.ticket_code,
      evt ? evt.title : 'Unknown',
      r.leader_name,
      r.leader_email,
      r.leader_phone,
      r.college_name,
      r.team_name || '',
      r.checked_in ? 'YES' : 'NO',
    ].map(csvCell);
  });

  const csvContent = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const downloadUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.setAttribute('href', downloadUrl);
  link.setAttribute('download', `al_murafaqa_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  showToast('CSV downloaded successfully', 'success');
}

// ==============================================================================
// 8. TAB 5: VENUE CHECK-IN DESK
// ==============================================================================

function renderCheckInTab() {
  const streamBody = document.getElementById('checkin-stream-body');
  if (!streamBody) return;

  const checkedInList = cachedRegistrations
    .filter((r) => r.checked_in)
    .sort((a, b) => new Date(b.checked_in_at || 0) - new Date(a.checked_in_at || 0));

  if (checkedInList.length === 0) {
    streamBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No attendees checked in yet today.</td></tr>';
    return;
  }

  streamBody.innerHTML = checkedInList
    .slice(0, 15)
    .map((r) => {
      const evt = cachedEvents.find((e) => e.id === r.event_id) || r.events;
      return `
      <tr>
        <td><strong style="color: var(--fest-red);">${escapeHtml(r.ticket_code)}</strong></td>
        <td>${escapeHtml(r.leader_name)} ${r.team_name ? `(${escapeHtml(r.team_name)})` : ''}</td>
        <td>${evt ? escapeHtml(evt.title) : 'Event'}</td>
        <td>${escapeHtml(r.college_name)}</td>
        <td>${formatTime(r.checked_in_at)}</td>
      </tr>
    `;
    })
    .join('');

  initLucide();
}

function setupCheckInControls() {
  const form = document.getElementById('checkin-search-form');
  const ticketInput = document.getElementById('checkin-ticket-input');
  const resultCard = document.getElementById('attendee-result-card');
  const btnConfirm = document.getElementById('btn-confirm-checkin');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawQuery = ticketInput.value.trim().toUpperCase();
      if (!rawQuery) return;

      const normalizedQuery = rawQuery.replace(/[\s-]/g, '');
      const found = cachedRegistrations.find((r) => {
        const code = (r.ticket_code || '').toUpperCase();
        const normCode = code.replace(/[\s-]/g, '');
        return code === rawQuery || normCode === normalizedQuery || normCode === `ALM${normalizedQuery}`;
      });

      if (!found) {
        resultCard.classList.remove('active');
        resultCard.classList.add('hidden');
        showToast(`Ticket ${rawQuery} not found in system`, 'error');
        return;
      }

      currentAttendeeLookup = found;
      displayAttendeeCheckInCard(found);
    });
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      if (!currentAttendeeLookup) return;

      try {
        await db.checkIn(currentAttendeeLookup.id, true);
        cachedRegistrations = await db.getRegistrations();
        currentAttendeeLookup = cachedRegistrations.find((r) => r.id === currentAttendeeLookup.id);
        if (!currentAttendeeLookup) throw new Error('Registration could not be reloaded after check-in.');
        displayAttendeeCheckInCard(currentAttendeeLookup);
        renderCheckInTab();
        renderOverview();
        renderRegistrationsTab();
        showToast(`Admitted ${currentAttendeeLookup.leader_name} (${currentAttendeeLookup.ticket_code})`, 'success');
      } catch (err) {
        showToast('Check-in failed: ' + err.message, 'error');
      }
    });
  }
}

function displayAttendeeCheckInCard(reg) {
  const resultCard = document.getElementById('attendee-result-card');
  const evt = cachedEvents.find((e) => e.id === reg.event_id) || reg.events;

  document.getElementById('res-ticket-code').textContent = reg.ticket_code;
  document.getElementById('res-leader-name').textContent = reg.leader_name;
  document.getElementById('res-college').textContent = reg.college_name;
  document.getElementById('res-event-title').textContent = evt ? evt.title : 'Event';
  document.getElementById('res-phone').textContent = reg.leader_phone;

  // Badge Container
  const badgeContainer = document.getElementById('res-status-badge-container');
  badgeContainer.innerHTML = `
    <span class="badge ${reg.checked_in ? 'checked' : 'pending'}" style="font-size: 0.85rem; padding: 6px 12px; ${!reg.checked_in ? 'background: #FEF3C7; color: #92400E;' : ''}">
      ${reg.checked_in ? '✓ ADMITTED' : 'READY FOR CHECK-IN'}
    </span>
  `;

  const btnConfirm = document.getElementById('btn-confirm-checkin');
  const labelConfirm = document.getElementById('btn-checkin-label');

  if (reg.checked_in) {
    btnConfirm.style.background = '#6B7280';
    labelConfirm.textContent = `Already Admitted (${formatTime(reg.checked_in_at)})`;
    btnConfirm.disabled = true;
  } else {
    btnConfirm.style.background = 'var(--status-verified)';
    labelConfirm.textContent = 'Confirm Gate Check-In';
    btnConfirm.disabled = false;
  }

  resultCard.classList.remove('hidden');
  resultCard.classList.add('active');
  initLucide();
}

// ==============================================================================
// 9. TAB 6: RESULTS & WINNERS PUBLISHER
// ==============================================================================

function renderWinnersTab() {
  const select = document.getElementById('winner-event-select');
  if (select) {
    const selectedEventId = select.value;
    select.innerHTML = '';

    if (cachedEvents.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No events available';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
    }

    cachedEvents.forEach((evt) => {
      const opt = document.createElement('option');
      opt.value = evt.id;
      opt.textContent = `${evt.title} (${evt.category})`;
      select.appendChild(opt);
    });

    if (cachedEvents.length > 0) {
      select.value = cachedEvents.some((evt) => evt.id === selectedEventId) ? selectedEventId : cachedEvents[0].id;
      select.dispatchEvent(new Event('change'));
    }
  }

  // Right column: Published Winners Feed
  const container = document.getElementById('published-winners-container');
  if (!container) return;

  if (cachedWinners.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No winners published yet.</p>';
    return;
  }

  // Group winners by event
  const byEvent = {};
  cachedWinners.forEach((w) => {
    if (!byEvent[w.event_id]) byEvent[w.event_id] = [];
    byEvent[w.event_id].push(w);
  });

  container.innerHTML = Object.keys(byEvent)
    .map((evtId) => {
      const evt = cachedEvents.find((e) => e.id === evtId);
      const list = byEvent[evtId].sort((a, b) => a.position - b.position);
      const medals = { 1: '🥇 1st', 2: '🥈 2nd', 3: '🥉 3rd' };

      return `
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; background: #FFFBF9;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: var(--fest-dark); font-size: 0.95rem;">${evt ? escapeHtml(evt.title) : 'Event'}</strong>
          <span class="badge ${list[0]?.published ? 'verified' : 'pending'}">${list[0]?.published ? 'Published' : 'Draft'}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
          ${list
            .map(
              (w) => `
            <div style="display: flex; justify-content: space-between;">
              <span><strong>${medals[w.position] || w.position}:</strong> ${escapeHtml(w.winner_name)}</span>
              <span style="color: var(--text-muted);">${escapeHtml(w.college_name)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    })
    .join('');
}

function setupWinnersControls() {
  const form = document.getElementById('winners-form');
  const select = document.getElementById('winner-event-select');

  if (select) {
    select.addEventListener('change', () => {
      const eventId = select.value;
      const existing = cachedWinners.filter((w) => w.event_id === eventId);
      const w1 = existing.find((w) => w.position === 1);
      const w2 = existing.find((w) => w.position === 2);
      const w3 = existing.find((w) => w.position === 3);

      document.getElementById('win-1-name').value = w1 ? w1.winner_name : '';
      document.getElementById('win-1-college').value = w1 ? w1.college_name : '';
      document.getElementById('win-2-name').value = w2 ? w2.winner_name : '';
      document.getElementById('win-2-college').value = w2 ? w2.college_name : '';
      document.getElementById('win-3-name').value = w3 ? w3.winner_name : '';
      document.getElementById('win-3-college').value = w3 ? w3.college_name : '';

      const pubToggle = document.getElementById('winner-publish-toggle');
      if (pubToggle) {
        pubToggle.checked = existing.length > 0 ? Boolean(existing[0]?.published) : true;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const eventId = select?.value;
      if (!eventId) {
        showToast('Please select an event before saving podium results.', 'warning');
        return;
      }
      const isPublished = document.getElementById('winner-publish-toggle').checked;

      const winnersArray = [
        {
          position: 1,
          winner_name: document.getElementById('win-1-name').value.trim(),
          college_name: document.getElementById('win-1-college').value.trim(),
        },
        {
          position: 2,
          winner_name: document.getElementById('win-2-name').value.trim(),
          college_name: document.getElementById('win-2-college').value.trim(),
        },
        {
          position: 3,
          winner_name: document.getElementById('win-3-name').value.trim(),
          college_name: document.getElementById('win-3-college').value.trim(),
        },
      ].filter((w) => w.winner_name.length > 0);

      if (winnersArray.length === 0) {
        showToast('Please enter at least one winner name before saving.', 'warning');
        return;
      }

      try {
        await db.saveWinners(eventId, winnersArray, isPublished);
        cachedWinners = await db.getWinners();
        renderWinnersTab();
        showToast('Podium results recorded and saved successfully', 'success');
      } catch (err) {
        showToast('Failed to save winners: ' + err.message, 'error');
      }
    });
  }
}

// Format helpers
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function formatTime(isoStr) {
  if (!isoStr) return 'Checked In';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? 'Checked In' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ==============================================================================
// 10. UTILITIES & TOAST NOTIFICATIONS
// ==============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const icons = {
    success: 'check-circle',
    error: 'alert-circle',
    warning: 'alert-triangle',
    info: 'info',
  };

  const borders = {
    success: 'var(--status-verified)',
    error: 'var(--status-rejected)',
    warning: 'var(--status-pending)',
    info: 'var(--fest-gold)',
  };

  toast.style.borderLeftColor = borders[type] || 'var(--fest-gold)';
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" style="width: 18px; height: 18px;"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  initLucide();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
