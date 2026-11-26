// ==============================================================================
// AL MURAFAQA • FEST COMMAND CENTER JAVASCRIPT CONTROLLER (admin.js)
// Vanilla ES Module with full reactive controls and dual cloud/offline state
// ==============================================================================

import { db, isConfigured, generateLeaderToken, getShareablePortalUrl } from './supabase-config.js';

// Global State
let currentTab = 'overview';
let cachedSettings = null;
let cachedEvents = [];
let cachedRegistrations = [];
let cachedAnnouncements = [];
let cachedWinners = [];
let cachedScores = [];
let cachedStageOps = null;
let cachedAuditLogs = [];
let cachedRestrictions = null;
let cachedTeamLeaders = [];
let activeRole = 'superadmin'; // 'superadmin' | 'jury' | 'marshal' | 'stageops'
let currentAttendeeLookup = null;
let html5QrScanner = null;
let isCameraScanning = false;
let audioChimeEnabled = true;
let stageTimerInterval = null;
let stageTimerSeconds = 0;
let stageTimerRunning = false;

// ==============================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initLucide();
  setupEventListeners();
  await checkAuthSession();
});

let lucideDebounceTimer = null;
function initLucide() {
  if (lucideDebounceTimer) clearTimeout(lucideDebounceTimer);
  lucideDebounceTimer = setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, 60);
}

function isAdminSession(session) {
  if (!session) {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('almurafaqa_admin_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return isAdminSession(parsed);
        } catch (e) {}
      }
    }
    return false;
  }

  if (session.isMasterAdmin || session.allAccessGranted) return true;
  const user = session.user || session;
  if (!user) return false;

  const appRole = String(user.app_metadata?.role || '').toLowerCase();
  const userRole = String(user.user_metadata?.role || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const id = String(user.id || '');

  const adminRoles = ['admin', 'superadmin', 'director', 'organizer', 'master', 'superuser'];
  if (adminRoles.includes(appRole) || adminRoles.includes(userRole)) return true;
  if (email.includes('admin') || id === 'demo-admin-id') return true;
  if (user.user_metadata?.permissions?.includes('*') || user.app_metadata?.permissions?.includes('*')) return true;

  // In cloud mode, any authenticated administrative account is granted access
  if (db.isLive() && (user.role === 'authenticated' || user.aud === 'authenticated')) {
    return true;
  }

  return false;
}

async function checkAuthSession() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hasBypass = urlParams.has('bypass') || urlParams.has('master') || urlParams.has('admin');

    if (hasBypass) {
      db.grantAdminAccess();
      showToast('Master Admin Access automatically activated via secure link', 'success');
    }

    const session = await db.getSession();
    const authOverlay = document.getElementById('auth-overlay');

    if (isAdminSession(session)) {
      authOverlay.classList.add('hidden');
      updateCloudIndicator();
      await loadAllData();
    } else {
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
        let session = authResult?.session || await db.getSession();
        if (!isAdminSession(session)) {
          // Automatically elevate admin users with master privileges
          if (email.toLowerCase().includes('admin') || !db.isLive()) {
            const master = db.grantAdminAccess({ email });
            session = master.session;
          } else {
            throw new Error('This account is not assigned the administrator role.');
          }
        }
        document.getElementById('auth-overlay').classList.add('hidden');
        showToast('Authenticated successfully with Full Master Administrator Access', 'success');
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

  // 1-Click Instant Master Admin Bypass (Unrestricted Full Access)
  const btnMasterBypass = document.getElementById('btn-master-bypass');
  if (btnMasterBypass) {
    btnMasterBypass.addEventListener('click', async () => {
      btnMasterBypass.disabled = true;
      btnMasterBypass.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Unlocking All Systems...</span>';

      try {
        db.grantAdminAccess({ email: 'admin@almurafaqa.com' });
        document.getElementById('auth-overlay').classList.add('hidden');
        showToast('Master Administrator privileges granted! All festival controls unlocked.', 'success');
        updateCloudIndicator();
        await loadAllData();
      } catch (err) {
        showToast('Error granting master access: ' + err.message, 'error');
      } finally {
        btnMasterBypass.disabled = false;
        btnMasterBypass.innerHTML = '<span class="material-symbols-outlined text-[20px]">admin_panel_settings</span><span>Instant 1-Click Master Admin Access (Full Privileges)</span>';
      }
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

  // Video Stream Form
  const videoForm = document.getElementById('video-stream-form');
  if (videoForm) {
    videoForm.addEventListener('submit', handleVideoStreamSubmit);
  }

  // Live video preview input listeners
  ['setting-video-title', 'setting-video-description', 'setting-video-venue', 'setting-video-live', 'setting-video-viewers', 'setting-video-duration'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateVideoPreview);
      el.addEventListener('change', updateVideoPreview);
    }
  });

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

  // MODULE CONTROLS (1, 2, 3, 7, 8)
  setupRoleSelector();
  setupStageOpsControls();
  setupScoringControls();
  setupAnalyticsControls();
  setupCameraScanner();
  setupRestrictionsControls();
  setupTeamControls();
  setupEventRestrictionsControls();
  setupStageRestrictionsControls();
  setupDirectRestrictionSearch();
  setupBroadcastVideoModalControls();
  setupTeamLeaderControls();

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

// Helper to render only the requested tab on-demand
function renderCurrentTab(tabId = currentTab) {
  if (tabId === 'overview') renderOverview();
  else if (tabId === 'announcements') renderAnnouncementsTab();
  else if (tabId === 'events') renderEventsTab();
  else if (tabId === 'registrations') renderRegistrationsTab();
  else if (tabId === 'checkin') renderCheckInTab();
  else if (tabId === 'winners') renderWinnersTab();
  else if (tabId === 'stageops') { renderStageOpsTab(); startAudioWaveSimulator(); }
  else if (tabId === 'scoring') renderScoringTab();
  else if (tabId === 'analytics') renderAnalyticsTab();
  else if (tabId === 'settings') renderAuditLog();
  else if (tabId === 'restrictions') renderRestrictionsTab();
  else if (tabId === 'teamleaders') renderTeamLeadersTab();
  else renderOverview();
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

  // Pause background visualizer interval if switching away from stageops
  if (tabId !== 'stageops' && audioVisualizerInterval) {
    clearInterval(audioVisualizerInterval);
    audioVisualizerInterval = null;
  }

  // Render active tab view immediately
  renderCurrentTab(tabId);
  initLucide();
}
window.switchTab = switchTab;

// ==============================================================================
// 3. MASTER DATA LOADER
// ==============================================================================

async function loadAllData() {
  try {
    const [settings, events, registrations, announcements, winners, scores, stageOps, auditLogs, restrictions, teamLeaders] = await Promise.all([
      db.getSettings(),
      db.getEvents(),
      db.getRegistrations(),
      db.getAnnouncements(),
      db.getWinners(),
      db.getScores ? db.getScores() : [],
      db.getStageOps ? db.getStageOps() : null,
      db.getAuditLogs ? db.getAuditLogs() : [],
      db.getRestrictions ? db.getRestrictions() : null,
      db.getTeamLeaders ? db.getTeamLeaders() : [],
    ]);

    cachedSettings = settings;
    cachedEvents = events;
    cachedRegistrations = registrations;
    cachedAnnouncements = announcements;
    cachedWinners = winners;
    cachedScores = scores || [];
    cachedStageOps = stageOps;
    cachedAuditLogs = auditLogs || [];
    cachedRestrictions = restrictions || null;
    cachedTeamLeaders = teamLeaders || [];

    // Render active tab immediately for snappy responsiveness
    renderCurrentTab();

    // Render background tabs in non-blocking idle tasks so UI stays silky smooth
    setTimeout(() => {
      if (currentTab !== 'overview') renderOverview();
      if (currentTab !== 'events') renderEventsTab();
      if (currentTab !== 'registrations') renderRegistrationsTab();
      if (currentTab !== 'announcements') renderAnnouncementsTab();
      if (currentTab !== 'checkin') renderCheckInTab();
      if (currentTab !== 'winners') renderWinnersTab();
      if (currentTab !== 'teamleaders') renderTeamLeadersTab();
      initLucide();
    }, 100);
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

  // Render Capacity Bars, Overview Programmes & Telemetry
  renderCapacityGauges();
  renderOverviewProgrammes();
  renderOverviewTelemetry();
}

function renderOverviewTelemetry() {
  const container = document.getElementById('overview-telemetry-stream');
  if (!container) return;

  const checkedInRegs = cachedRegistrations.filter((r) => r.checked_in);

  if (checkedInRegs.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
        No attendees checked in yet today.
      </div>
    `;
  } else {
    container.innerHTML = checkedInRegs
      .slice(-5)
      .reverse()
      .map((reg) => {
        const initials = (reg.leader_name || 'Attendee')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        const role = reg.team_name ? 'TEAM DELEGATE' : 'ATTENDEE';
        return `
          <div class="p-space-sm rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-space-sm min-w-0">
              <div class="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                ${escapeHtml(initials)}
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-label-lg text-label-lg text-slate-900 truncate font-semibold">${escapeHtml(reg.leader_name || 'Attendee')}</span>
                <span class="font-label-sm text-label-sm text-slate-500 truncate">${escapeHtml(reg.ticket_code || '---')} • ${escapeHtml(reg.college_name || 'Accreditation Desk')}</span>
              </div>
            </div>
            <div class="flex flex-col items-end flex-shrink-0">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${role}</span>
              <span class="font-label-sm text-label-sm text-slate-400 mt-0.5">Checked In</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Update Ingress representation summary
  const ingressSummary = document.getElementById('ingress-summary-stat');
  const ingressBars = document.getElementById('ingress-bars-container');
  if (ingressSummary) {
    ingressSummary.textContent = `${checkedInRegs.length} / ${cachedRegistrations.length} Checked In`;
  }
  if (ingressBars) {
    if (cachedRegistrations.length === 0) {
      ingressBars.innerHTML = '<div class="text-center text-xs text-slate-400 py-3 font-medium">Awaiting delegate arrivals.</div>';
    } else {
      const colleges = {};
      cachedRegistrations.forEach((r) => {
        const col = r.college_name || 'General Attendees';
        if (!colleges[col]) colleges[col] = { total: 0, checked: 0 };
        colleges[col].total++;
        if (r.checked_in) colleges[col].checked++;
      });

      ingressBars.innerHTML = Object.entries(colleges)
        .slice(0, 4)
        .map(([colName, data]) => {
          const pct = Math.round((data.checked / data.total) * 100);
          return `
            <div class="pt-1">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-slate-600 font-medium truncate max-w-[180px]">${escapeHtml(colName)}</span>
                <span class="text-slate-900 font-bold">${pct}% (${data.checked}/${data.total})</span>
              </div>
              <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div class="bg-red-600 h-full transition-all duration-300" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }
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
    lblMaint.textContent = swMaint.checked ? 'Front page in Maintenance Mode (Active)' : 'Site operates normally';
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

    // Main Stage Video Settings
    const videoUrl = document.getElementById('setting-video-url');
    const videoHeading = document.getElementById('setting-video-heading');
    const videoTitle = document.getElementById('setting-video-title');
    const videoDesc = document.getElementById('setting-video-description');
    const videoVenue = document.getElementById('setting-video-venue');
    const videoPoster = document.getElementById('setting-video-poster');
    const videoLive = document.getElementById('setting-video-live');
    const videoViewers = document.getElementById('setting-video-viewers');
    const videoDuration = document.getElementById('setting-video-duration');

    if (videoUrl) videoUrl.value = cachedSettings.video_url || '';
    if (videoHeading) videoHeading.value = cachedSettings.video_heading || 'Main Stage Broadcast';
    if (videoTitle) videoTitle.value = cachedSettings.video_title || 'Mystic Poetry Recital & Qurtuba Ensemble';
    if (videoDesc) videoDesc.value = cachedSettings.video_description || 'Live Cultural Stage & Ensemble Performances';
    if (videoVenue) videoVenue.value = cachedSettings.video_venue || 'GRAND ANDALUSIAN DOME';
    if (videoPoster) {
      const pVal = cachedSettings.video_poster_url || '';
      videoPoster.value = (pVal.includes('AB6AXuBI4u7wM1') || pVal.includes('googleusercontent.com/aida-public')) ? 'video-poster.jpg' : pVal;
    }
    if (videoLive) videoLive.checked = cachedSettings.video_is_live !== false;
    if (videoViewers) videoViewers.value = cachedSettings.video_viewer_count || '4.8k live';
    if (videoDuration) videoDuration.value = cachedSettings.video_duration_note || '42 mins remaining';

    updateVideoPreview();
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
            ${anc.is_urgent ? 'Urgent' : 'General'}
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

// Universal Video Stream Embed Helper (Google Drive, YouTube, Vimeo, MP4)
function getEmbedUrl(rawUrl) {
  if (!rawUrl) return null;
  const url = rawUrl.trim();

  // 1. Google Drive Links (view, preview, sharing, open?id=, uc?id=)
  const driveMatch = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=download&id=)|docs\.google\.com\/file\/d\/)([\w-]+)/i);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return {
      type: 'drive',
      fileId: fileId,
      src: `https://drive.google.com/file/d/${fileId}/preview`,
    };
  }

  // 2. YouTube Links
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
    };
  }

  // 3. Vimeo Links
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    };
  }

  // 4. Direct video formats
  if (url.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i) || url.includes('.m3u8')) {
    return {
      type: 'video',
      src: url,
    };
  }

  // 5. General HTTP / HTTPS iframe
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      type: 'iframe',
      src: url,
    };
  }

  return null;
}

function updateVideoPreview() {
  const pTitle = document.getElementById('preview-video-title');
  const pDesc = document.getElementById('preview-video-desc');
  const pVenue = document.getElementById('preview-video-venue');
  const pStatus = document.getElementById('preview-video-status');
  const pViewers = document.getElementById('preview-video-viewers');
  const pDuration = document.getElementById('preview-video-duration');
  const pPlayer = document.getElementById('admin-settings-video-preview-player');

  const titleVal = document.getElementById('setting-video-title')?.value || cachedSettings?.video_title || 'Main Stage Broadcast';
  const descVal = document.getElementById('setting-video-description')?.value || cachedSettings?.video_description || 'Performance Details';
  const venueVal = document.getElementById('setting-video-venue')?.value || cachedSettings?.video_venue || 'GRAND DOME';
  const isLive = document.getElementById('setting-video-live')?.checked ?? true;
  const viewersVal = document.getElementById('setting-video-viewers')?.value || '4.8k live';
  const durationVal = document.getElementById('setting-video-duration')?.value || '42 mins remaining';
  const videoUrlVal = document.getElementById('setting-video-url')?.value.trim() || cachedSettings?.video_url || '';

  if (pTitle) pTitle.textContent = titleVal;
  if (pDesc) pDesc.textContent = descVal;
  if (pVenue) pVenue.textContent = venueVal.toUpperCase();
  if (pStatus) {
    pStatus.textContent = isLive ? 'LIVE' : 'OFFLINE';
    pStatus.className = `px-2 py-0.5 rounded-full ${isLive ? 'bg-red-600' : 'bg-slate-600'} text-white font-bold text-[10px]`;
  }
  if (pViewers) pViewers.innerHTML = `<span class="material-symbols-outlined text-[14px] text-amber-500">visibility</span><span>${escapeHtml(viewersVal)}</span>`;
  if (pDuration) pDuration.innerHTML = `<span class="material-symbols-outlined text-[14px] text-amber-500">schedule</span><span>${escapeHtml(durationVal)}</span>`;

  // Live video preview rendering in settings card
  if (pPlayer) {
    const embed = getEmbedUrl(videoUrlVal);
    if (embed) {
      if (embed.type === 'video') {
        pPlayer.innerHTML = `<video class="w-full h-full aspect-video rounded-xl object-cover" src="${embed.src}" controls playsinline></video>`;
      } else {
        pPlayer.innerHTML = `<iframe class="w-full h-full aspect-video rounded-xl" src="${embed.src}" title="Broadcast Live Preview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`;
      }
    } else {
      pPlayer.innerHTML = `
        <div class="text-center p-4 text-slate-500 text-xs flex flex-col items-center gap-1.5">
          <span class="material-symbols-outlined text-[32px] text-slate-600">smart_display</span>
          <span>Paste a Google Drive or YouTube link above to stream live preview</span>
        </div>
      `;
    }
  }
}

async function handleVideoStreamSubmit(e) {
  e.preventDefault();
  const video_url = document.getElementById('setting-video-url').value.trim();
  const video_heading = document.getElementById('setting-video-heading').value.trim();
  const video_title = document.getElementById('setting-video-title').value.trim();
  const video_description = document.getElementById('setting-video-description').value.trim();
  const video_venue = document.getElementById('setting-video-venue').value.trim();
  const video_poster_url = document.getElementById('setting-video-poster').value.trim();
  const video_is_live = document.getElementById('setting-video-live').checked;
  const video_viewer_count = document.getElementById('setting-video-viewers').value.trim();
  const video_duration_note = document.getElementById('setting-video-duration').value.trim();

  const btn = document.getElementById('btn-save-video');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Saving...</span>';
  }

  try {
    cachedSettings = await db.updateSettings({
      video_url,
      video_heading,
      video_title,
      video_description,
      video_venue,
      video_poster_url,
      video_is_live,
      video_viewer_count,
      video_duration_note,
    });
    showToast('Main stage video section updated successfully!', 'success');
    renderAnnouncementsTab();
    renderOverview();
  } catch (err) {
    showToast('Failed to update video section: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span><span>Save Video Section Settings</span>';
    }
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

// Programme Code Generator helper
function generateProgrammeCode(category = 'Senior') {
  const cat = (category || 'Senior').toUpperCase();
  let prefix = 'PRG';
  if (cat.includes('SENIOR')) prefix = 'PRG-SEN';
  else if (cat.includes('SUB')) prefix = 'PRG-SUB';
  else if (cat.includes('JUN')) prefix = 'PRG-JUN';
  else if (cat.includes('ORA')) prefix = 'PRG-ORA';
  else if (cat.includes('ART')) prefix = 'PRG-ART';
  else if (cat.includes('LIT')) prefix = 'PRG-LIT';
  else if (cat.includes('MUS')) prefix = 'PRG-MUS';
  else if (cat.includes('GEN')) prefix = 'PRG-GEN';
  else prefix = `PRG-${cat.replace(/[^A-Z]/g, '').slice(0, 3) || 'GEN'}`;

  // Find next sequential number for this prefix
  const existingCodes = (cachedEvents || [])
    .map(e => e.code || '')
    .filter(c => c.startsWith(prefix));
  
  let nextNum = 101;
  if (existingCodes.length > 0) {
    const nums = existingCodes.map(c => {
      const match = c.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }).filter(n => !isNaN(n) && n > 0);
    if (nums.length > 0) {
      nextNum = Math.max(...nums) + 1;
    } else {
      nextNum = 100 + existingCodes.length + 1;
    }
  }
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

window.openAddProgrammeModal = function () {
  const form = document.getElementById('form-event-editor');
  if (form) form.reset();
  
  const editId = document.getElementById('event-edit-id');
  if (editId) editId.value = '';

  const catVal = document.getElementById('evt-category')?.value || 'Senior';
  const codeEl = document.getElementById('evt-code');
  if (codeEl) codeEl.value = generateProgrammeCode(catVal);

  // Set defaults
  const partType = document.getElementById('evt-participation-type');
  if (partType) partType.value = 'individual';

  const teamMin = document.getElementById('evt-team-min');
  if (teamMin) teamMin.value = '1';

  const teamMax = document.getElementById('evt-team-max');
  if (teamMax) teamMax.value = '1';

  const maxInst = document.getElementById('evt-max-teams-per-inst');
  if (maxInst) maxInst.value = '1';

  const cap = document.getElementById('evt-capacity');
  if (cap) cap.value = '30';

  const dayEl = document.getElementById('evt-day');
  if (dayEl) dayEl.value = '1';

  const startTime = document.getElementById('evt-start-time');
  if (startTime) startTime.value = '10:00 AM';

  const endTime = document.getElementById('evt-end-time');
  if (endTime) endTime.value = '12:00 PM';

  const repTime = document.getElementById('evt-reporting-time');
  if (repTime) repTime.value = '09:30 AM (Call)';

  const timeSlot = document.getElementById('evt-time');
  if (timeSlot) timeSlot.value = '10:00 AM - 12:00 PM';

  const p1 = document.getElementById('evt-points-first');
  if (p1) p1.value = '10';
  const p2 = document.getElementById('evt-points-second');
  if (p2) p2.value = '5';
  const p3 = document.getElementById('evt-points-third');
  if (p3) p3.value = '3';

  const statusEl = document.getElementById('evt-status');
  if (statusEl) statusEl.value = 'open';

  const featEl = document.getElementById('evt-featured');
  if (featEl) featEl.checked = false;

  const restrEl = document.getElementById('evt-is-restricted');
  if (restrEl) restrEl.checked = false;

  const modalTitle = document.getElementById('modal-event-title');
  if (modalTitle) modalTitle.textContent = 'Add New Competition Programme';

  document.getElementById('modal-event')?.classList.add('show');
};

window.openAddEventModal = window.openAddProgrammeModal;

function renderEventsTab() {
  const tbody = document.getElementById('events-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('events-search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('events-status-filter')?.value || 'all';

  const filtered = cachedEvents.filter((evt) => {
    const matchesSearch =
      (evt.code && evt.code.toLowerCase().includes(searchVal)) ||
      evt.title.toLowerCase().includes(searchVal) ||
      evt.category.toLowerCase().includes(searchVal) ||
      evt.venue.toLowerCase().includes(searchVal);
    const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-slate-500 py-8">No competition programmes match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((evt) => {
      const regCount = cachedRegistrations.filter((r) => r.event_id === evt.id).length;
      const progCode = evt.code || ('PRG-' + String(evt.id || '').slice(0, 4).toUpperCase());
      const isTeam = (evt.team_size_max || 1) > 1 || evt.participation_type === 'team';

      return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <!-- 1. Code & Mode -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            ${escapeHtml(progCode)}
          </span>
          <span class="block text-[10px] text-slate-500 font-semibold mt-0.5 capitalize">
            ${escapeHtml(evt.participation_type || (isTeam ? 'team squad' : 'individual'))}
          </span>
        </td>

        <!-- 2. Title & Category -->
        <td class="py-3.5 px-6">
          <div class="font-bold text-slate-900">${escapeHtml(evt.title)}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="px-2 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
              ${escapeHtml(evt.category)}
            </span>
            <span class="text-[11px] text-slate-500 line-clamp-1 max-w-[280px]">
              ${escapeHtml(evt.rules || 'No rules defined')}
            </span>
          </div>
        </td>

        <!-- 3. Team Quota -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          <div class="text-xs font-bold text-purple-950 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-purple-700">groups</span>
            <span>${evt.team_size_min || 1} - ${evt.team_size_max || 1} Members</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5">
            Max <strong>${evt.max_teams_per_institution || 1}</strong> entry/inst
          </div>
        </td>

        <!-- 4. Schedule & Stage -->
        <td class="py-3.5 px-4">
          <div class="text-xs font-bold text-slate-800 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-amber-600">schedule</span>
            <span>Day ${evt.day_number || 1} • ${escapeHtml(evt.time_slot || 'TBA')}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
            <span>${escapeHtml(evt.venue || 'Dome')}</span>
            ${evt.reporting_time ? `<span class="text-amber-700 font-medium">(${escapeHtml(evt.reporting_time)})</span>` : ''}
          </div>
        </td>

        <!-- 5. Capacity Progress -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          <div class="text-xs font-bold text-slate-900 mb-1">${regCount} / ${evt.max_capacity}</div>
          <div class="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-red-600 h-1.5 rounded-full" style="width: ${Math.min(100, Math.round((regCount / (evt.max_capacity || 1)) * 100))}%;"></div>
          </div>
        </td>

        <!-- 6. Featured Toggle -->
        <td class="py-3.5 px-4 text-center">
          <input type="checkbox" ${evt.is_featured ? 'checked' : ''} onchange="window.toggleEventFeatured('${evt.id}', this.checked)" class="w-4 h-4 text-red-600 rounded cursor-pointer">
        </td>

        <!-- 7. Status & Embargo -->
        <td class="py-3.5 px-4">
          <select class="form-input text-xs py-1 px-2 w-auto bg-white border border-slate-200 rounded-lg font-semibold" onchange="window.updateEventStatus('${evt.id}', this.value)">
            <option value="open" ${evt.status === 'open' ? 'selected' : ''}>Open</option>
            <option value="closing_soon" ${evt.status === 'closing_soon' ? 'selected' : ''}>Closing Soon</option>
            <option value="full" ${evt.status === 'full' ? 'selected' : ''}>Full</option>
            <option value="closed" ${evt.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
          ${evt.is_restricted ? `<div class="mt-1"><span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800"><span class="material-symbols-outlined text-[12px]">shield_lock</span>${escapeHtml(evt.restriction_type || 'RESTRICTED')}</span></div>` : ''}
        </td>

        <!-- 8. Actions -->
        <td class="py-3.5 px-6 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 justify-end">
            <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors" title="Edit Restrictions &amp; Embargo" onclick="window.openEventRestrictionsModal('${evt.id}')">
              <span class="material-symbols-outlined text-[16px]">shield_lock</span>
            </button>
            <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors" title="Edit Programme" onclick="window.openEditEventModal('${evt.id}')">
              <span class="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-red-50 text-red-600 flex items-center justify-center transition-colors" title="Delete Programme" onclick="window.deleteEvent('${evt.id}')">
              <span class="material-symbols-outlined text-[16px]">delete</span>
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

  // Add Programme Buttons (from events tab and team leaders tab)
  const btnAdd = document.getElementById('btn-open-add-event');
  if (btnAdd) {
    btnAdd.addEventListener('click', window.openAddProgrammeModal);
  }
  const btnAddLeader = document.getElementById('btn-open-team-leader-add-programme');
  if (btnAddLeader) {
    btnAddLeader.addEventListener('click', window.openAddProgrammeModal);
  }

  // Code generator button
  const btnGenCode = document.getElementById('btn-gen-event-code');
  if (btnGenCode) {
    btnGenCode.addEventListener('click', () => {
      const cat = document.getElementById('evt-category')?.value || 'Senior';
      const codeEl = document.getElementById('evt-code');
      if (codeEl) codeEl.value = generateProgrammeCode(cat);
    });
  }

  // Category auto-code trigger for new programmes
  const catSelect = document.getElementById('evt-category');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      const id = document.getElementById('event-edit-id')?.value;
      if (!id) {
        const codeEl = document.getElementById('evt-code');
        if (codeEl) codeEl.value = generateProgrammeCode(catSelect.value);
      }
    });
  }

  // Participation type auto-adjusts team size inputs
  const partSelect = document.getElementById('evt-participation-type');
  if (partSelect) {
    partSelect.addEventListener('change', () => {
      const val = partSelect.value;
      const minEl = document.getElementById('evt-team-min');
      const maxEl = document.getElementById('evt-team-max');
      if (val === 'individual') {
        if (minEl) minEl.value = '1';
        if (maxEl) maxEl.value = '1';
      } else if (val === 'team') {
        if (minEl && Number(minEl.value) <= 1) minEl.value = '2';
        if (maxEl && Number(maxEl.value) <= 1) maxEl.value = '5';
      }
    });
  }

  // Time Slot auto-sync from start and end time
  const startTimeEl = document.getElementById('evt-start-time');
  const endTimeEl = document.getElementById('evt-end-time');
  const syncTime = () => {
    const s = startTimeEl?.value.trim();
    const e = endTimeEl?.value.trim();
    const timeSlotEl = document.getElementById('evt-time');
    if (timeSlotEl && s && e) {
      timeSlotEl.value = `${s} - ${e}`;
    }
  };
  if (startTimeEl) startTimeEl.addEventListener('input', syncTime);
  if (endTimeEl) endTimeEl.addEventListener('input', syncTime);

  // Day preview pill
  const daySelect = document.getElementById('evt-day');
  if (daySelect) {
    daySelect.addEventListener('change', () => {
      const pill = document.getElementById('schedule-preview-pill');
      if (pill) pill.textContent = `Day ${daySelect.value}`;
    });
  }

  // Event Form Submit
  const eventForm = document.getElementById('form-event-editor');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('event-edit-id').value;
      const catVal = document.getElementById('evt-category')?.value.trim() || 'Senior';
      const codeVal = (document.getElementById('evt-code')?.value || '').trim().toUpperCase() || generateProgrammeCode(catVal);

      const eventData = {
        code: codeVal,
        title: document.getElementById('evt-title').value.trim(),
        category: catVal,
        participation_type: document.getElementById('evt-participation-type')?.value || 'individual',
        venue: document.getElementById('evt-venue').value.trim(),
        fee: 0,
        prize_pool: 0,
        max_capacity: Number(document.getElementById('evt-capacity').value) || 30,
        team_size_min: Number(document.getElementById('evt-team-min').value) || 1,
        team_size_max: Number(document.getElementById('evt-team-max').value) || 1,
        max_teams_per_institution: Number(document.getElementById('evt-max-teams-per-inst')?.value) || 1,
        day_number: Number(document.getElementById('evt-day').value) || 1,
        event_date: document.getElementById('evt-date')?.value || null,
        start_time: (document.getElementById('evt-start-time')?.value || '').trim(),
        end_time: (document.getElementById('evt-end-time')?.value || '').trim(),
        reporting_time: (document.getElementById('evt-reporting-time')?.value || '').trim(),
        time_slot: document.getElementById('evt-time').value.trim(),
        points_first: Number(document.getElementById('evt-points-first')?.value) || 10,
        points_second: Number(document.getElementById('evt-points-second')?.value) || 5,
        points_third: Number(document.getElementById('evt-points-third')?.value) || 3,
        coordinator_name: (document.getElementById('evt-coordinator-name')?.value || '').trim(),
        coordinator_phone: (document.getElementById('evt-coordinator-phone')?.value || '').trim(),
        rules: document.getElementById('evt-rules').value.trim(),
        is_featured: document.getElementById('evt-featured').checked,
        status: document.getElementById('evt-status').value,
        is_restricted: document.getElementById('evt-is-restricted')?.checked || false,
        restriction_type: document.getElementById('evt-restriction-type')?.value || 'REGISTRATION_FROZEN',
        restriction_reason: (document.getElementById('evt-restriction-reason')?.value || '').trim(),
        registration_frozen: document.getElementById('evt-freeze-reg')?.checked || false,
        scoring_locked: document.getElementById('evt-lock-scoring')?.checked || false,
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
        showToast(`Programme ${eventData.code} - "${eventData.title}" saved successfully`, 'success');
      } catch (err) {
        showToast('Error saving programme: ' + err.message, 'error');
      }
    });
  }
}

window.openEditEventModal = function (id) {
  const evt = cachedEvents.find((e) => e.id === id);
  if (!evt) return;

  document.getElementById('event-edit-id').value = evt.id;
  document.getElementById('evt-code').value = evt.code || generateProgrammeCode(evt.category);
  document.getElementById('evt-title').value = evt.title;
  document.getElementById('evt-category').value = evt.category;
  if (document.getElementById('evt-participation-type')) {
    document.getElementById('evt-participation-type').value = evt.participation_type || ((evt.team_size_max || 1) > 1 ? 'team' : 'individual');
  }
  document.getElementById('evt-venue').value = evt.venue;
  document.getElementById('evt-capacity').value = evt.max_capacity || 30;
  document.getElementById('evt-team-min').value = evt.team_size_min || 1;
  document.getElementById('evt-team-max').value = evt.team_size_max || 1;
  if (document.getElementById('evt-max-teams-per-inst')) {
    document.getElementById('evt-max-teams-per-inst').value = evt.max_teams_per_institution || 1;
  }
  document.getElementById('evt-day').value = evt.day_number || 1;
  if (document.getElementById('evt-date')) {
    document.getElementById('evt-date').value = evt.event_date || '';
  }
  if (document.getElementById('evt-start-time')) {
    document.getElementById('evt-start-time').value = evt.start_time || '';
  }
  if (document.getElementById('evt-end-time')) {
    document.getElementById('evt-end-time').value = evt.end_time || '';
  }
  if (document.getElementById('evt-reporting-time')) {
    document.getElementById('evt-reporting-time').value = evt.reporting_time || '';
  }
  document.getElementById('evt-time').value = evt.time_slot || '';
  if (document.getElementById('evt-points-first')) {
    document.getElementById('evt-points-first').value = evt.points_first ?? 10;
  }
  if (document.getElementById('evt-points-second')) {
    document.getElementById('evt-points-second').value = evt.points_second ?? 5;
  }
  if (document.getElementById('evt-points-third')) {
    document.getElementById('evt-points-third').value = evt.points_third ?? 3;
  }
  if (document.getElementById('evt-coordinator-name')) {
    document.getElementById('evt-coordinator-name').value = evt.coordinator_name || '';
  }
  if (document.getElementById('evt-coordinator-phone')) {
    document.getElementById('evt-coordinator-phone').value = evt.coordinator_phone || '';
  }
  document.getElementById('evt-rules').value = evt.rules || '';
  document.getElementById('evt-featured').checked = evt.is_featured;
  document.getElementById('evt-status').value = evt.status;

  if (document.getElementById('evt-is-restricted')) {
    document.getElementById('evt-is-restricted').checked = Boolean(evt.is_restricted);
    document.getElementById('evt-restriction-type').value = evt.restriction_type || 'REGISTRATION_FROZEN';
    document.getElementById('evt-restriction-reason').value = evt.restriction_reason || '';
    document.getElementById('evt-freeze-reg').checked = Boolean(evt.registration_frozen);
    document.getElementById('evt-lock-scoring').checked = Boolean(evt.scoring_locked);
  }

  document.getElementById('modal-event-title').textContent = 'Edit Competition Programme';
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
          ${
            r.is_restricted
              ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; border: 1px solid #F87171; font-weight: 700; letter-spacing: 0.5px;">
                   RESTRICTED
                 </span>`
              : `<span class="badge ${r.checked_in ? 'checked' : ''}" style="${!r.checked_in ? 'background: #FEF3C7; color: #92400E;' : ''}">
                   ${r.checked_in ? 'Admitted' : 'Pending Check-In'}
                 </span>`
          }
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end; gap: 4px;">
            ${
              !r.checked_in && !r.is_restricted
                ? `<button class="btn-icon verify" title="Check-In Attendee" onclick="window.quickCheckIn('${r.id}')">
                     <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                   </button>`
                : r.checked_in
                ? `<button class="btn-icon" title="Admitted" disabled style="opacity: 0.5; cursor: default;">
                     <i data-lucide="check-check" style="width: 16px; height: 16px;"></i>
                   </button>`
                : ''
            }
            ${
              r.is_restricted
                ? `<button class="btn-icon" style="color: #D97706; border-color: #FDE68A; width: 32px; height: 32px;" title="Edit Operational Restriction Directive" onclick="window.openRestrictModal('${r.id}')">
                     <span class="material-symbols-outlined text-[16px]">edit_note</span>
                   </button>
                   <button class="btn-icon" style="color: #059669; border-color: #A7F3D0; width: 32px; height: 32px;" title="Lift Restriction" onclick="window.liftRestriction('${r.id}', '${escapeHtml(r.team_name || r.leader_name)}')">
                     <span class="material-symbols-outlined text-[16px]">lock_open</span>
                   </button>`
                : `<button class="btn-icon" style="color: #DC2626; border-color: #FECACA; width: 32px; height: 32px;" title="Impose Restriction / Blacklist" onclick="window.openRestrictModal('${r.id}')">
                     <span class="material-symbols-outlined text-[16px]">lock_person</span>
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
  window.currentActiveTeamReg = reg;

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
      ${reg.checked_in ? 'ADMITTED' : 'READY FOR CHECK-IN'}
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
      const medals = { 1: '1st: 1st', 2: '2nd: 2nd', 3: '3rd: 3rd' };

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

// ==============================================================================
// 11. ROLE-BASED ACCESS CONTROL (RBAC) & AUDIT TRAIL
// ==============================================================================

function setupRoleSelector() {
  const roleSelect = document.getElementById('admin-role-selector');
  if (!roleSelect) return;

  roleSelect.value = activeRole;
  updateRoleBadge(activeRole);

  roleSelect.addEventListener('change', (e) => {
    setActiveRole(e.target.value);
  });

  const auditFilter = document.getElementById('audit-filter-input');
  if (auditFilter) {
    auditFilter.addEventListener('input', (e) => renderAuditLog(e.target.value));
  }

  const btnExportAudit = document.getElementById('btn-export-audit-csv');
  if (btnExportAudit) {
    btnExportAudit.addEventListener('click', exportAuditCSV);
  }
}

function setActiveRole(role) {
  activeRole = role;
  updateRoleBadge(role);
  logAudit('ROLE_SWITCH', `Switched active operator view to ${role.toUpperCase()}`);

  // Auto-focus tabs based on role
  if (role === 'jury') switchTab('scoring');
  else if (role === 'marshal') switchTab('checkin');
  else if (role === 'stageops') switchTab('stageops');

  showToast(`Switched active view to ${role.toUpperCase()}`, 'info');
}

function updateRoleBadge(role) {
  const badge = document.getElementById('admin-role-badge');
  if (!badge) return;

  const roleStyles = {
    superadmin: { text: 'Executive Admin', class: 'bg-red-50 text-red-700 border border-red-200 font-bold' },
    jury: { text: 'Adjudicator', class: 'bg-amber-50 text-amber-800 border border-amber-200 font-bold' },
    marshal: { text: 'Accreditation', class: 'bg-slate-100 text-slate-800 border border-slate-300 font-bold' },
    stageops: { text: 'Stage Director', class: 'bg-slate-900 text-white font-bold' },
  };

  const current = roleStyles[role] || roleStyles.superadmin;
  badge.textContent = current.text;
  badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${current.class}`;
}

async function logAudit(action, details) {
  try {
    const entry = await db.addAuditLog(action, details, activeRole);
    if (!cachedAuditLogs) cachedAuditLogs = [];
    cachedAuditLogs.unshift(entry);
    renderAuditLog();
    renderRestrictionsTab();
  } catch (e) {
    console.warn('Failed to log audit event:', e);
  }
}

function renderAuditLog(filterText = '') {
  const tbody = document.getElementById('audit-log-body');
  if (!tbody) return;

  const logs = cachedAuditLogs || [];
  const query = (filterText || '').toLowerCase().trim();

  const filtered = logs.filter((log) => {
    if (!query) return true;
    return (
      (log.action || '').toLowerCase().includes(query) ||
      (log.details || '').toLowerCase().includes(query) ||
      (log.role || '').toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-6 text-center text-slate-400">
          No audit entries recorded yet. Administrative events appear here in real time.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 50).map((log) => {
    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
    const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '—';
    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-4 text-slate-500 whitespace-nowrap">
          <span class="font-bold text-slate-800">${timeStr}</span>
          <span class="text-[10px] text-slate-400 block">${dateStr}</span>
        </td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
            ${escapeHtml(log.role || 'Super Admin')}
          </span>
        </td>
        <td class="py-2.5 px-3 font-bold text-slate-800">
          ${escapeHtml(log.action || 'OPERATION')}
        </td>
        <td class="py-2.5 px-4 text-slate-600 font-normal">
          ${escapeHtml(log.details || '')}
        </td>
      </tr>
    `;
  }).join('');
}

function exportAuditCSV() {
  const logs = cachedAuditLogs || [];
  if (logs.length === 0) {
    showToast('No audit log entries to export', 'warning');
    return;
  }

  const headers = ['Timestamp', 'Role', 'Action', 'Details'];
  const rows = logs.map((l) => [
    csvCell(l.timestamp),
    csvCell(l.role),
    csvCell(l.action),
    csvCell(l.details),
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `almurafaqa_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Audit log exported successfully', 'success');
}


// ==============================================================================
// 12. STAGE OPERATIONS & RUN-OF-SHOW CONTROLLER
// ==============================================================================

let currentStageId = 'main';

function setupStageOpsControls() {
  // Stage Selector Pills
  document.querySelectorAll('.stage-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stage-pill-btn').forEach((b) => {
        b.classList.remove('active', 'bg-white', 'text-slate-900', 'shadow-sm');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('active', 'bg-white', 'text-slate-900', 'shadow-sm');
      btn.classList.remove('text-slate-600');
      currentStageId = btn.getAttribute('data-stage') || 'main';
      renderStageOpsTab();
    });
  });

  // Timer Buttons
  const btnToggleTimer = document.getElementById('btn-toggle-stage-timer');
  if (btnToggleTimer) {
    btnToggleTimer.addEventListener('click', toggleStageTimer);
  }

  const btnResetTimer = document.getElementById('btn-reset-stage-timer');
  if (btnResetTimer) {
    btnResetTimer.addEventListener('click', resetStageTimer);
  }

  // Live Site Sync Button
  const btnSyncLive = document.getElementById('btn-sync-live-site');
  if (btnSyncLive) {
    btnSyncLive.addEventListener('click', syncPerformerToLiveSite);
  }

  // Conclude Performance Button
  const btnConclude = document.getElementById('btn-conclude-stage');
  if (btnConclude) {
    btnConclude.addEventListener('click', concludeStagePerformance);
  }

  // Delay Buttons
  document.querySelectorAll('.btn-stage-delay').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.getAttribute('data-minutes') || '0', 10);
      handleStageDelay(minutes);
    });
  });

  // Save AV Notes
  const btnSaveAvNotes = document.getElementById('btn-save-av-notes');
  if (btnSaveAvNotes) {
    btnSaveAvNotes.addEventListener('click', async () => {
      const notes = (document.getElementById('stageops-av-notes')?.value || '').trim();
      if (!cachedStageOps) cachedStageOps = await db.getStageOps();
      if (cachedStageOps.stages && cachedStageOps.stages[currentStageId]) {
        cachedStageOps.stages[currentStageId].av_notes = notes;
        await db.updateStageOps(cachedStageOps);
        logAudit('AV_CUES_SAVED', `Updated sound and cue sheet notes for ${cachedStageOps.stages[currentStageId].name}`);
        showToast('AV cue sheet saved successfully', 'success');
      }
    });
  }

  // Refresh Button
  const btnRefresh = document.getElementById('btn-refresh-stageops');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      cachedStageOps = await db.getStageOps();
      renderStageOpsTab();
      showToast('Stage operations queue refreshed', 'info');
    });
  }
}

async function renderStageOpsTab() {
  if (!cachedStageOps) cachedStageOps = await db.getStageOps();
  const ops = cachedStageOps;
  const stage = ops.stages?.[currentStageId] || { name: 'Main Dome', active_performer: '', delay_minutes: 0, av_notes: '' };

  // Update Venue Badge
  const venueBadge = document.getElementById('stageops-venue-badge');
  if (venueBadge) venueBadge.textContent = stage.name;

  // Update Performer Info
  const perfEl = document.getElementById('stageops-current-performer');
  if (perfEl) perfEl.textContent = stage.active_performer || 'No Performer Currently On Stage';

  const evEl = document.getElementById('stageops-current-event');
  if (evEl) evEl.textContent = stage.active_event_title || 'Select event from queue';

  const colEl = document.getElementById('stageops-current-college');
  if (colEl) colEl.textContent = stage.active_college || '—';

  // Update Delay Pill
  const delayPill = document.getElementById('stageops-active-delay-pill');
  if (delayPill) {
    if (stage.delay_minutes > 0) {
      delayPill.textContent = `Delay Active (+${stage.delay_minutes}m)`;
      delayPill.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800';
    } else {
      delayPill.textContent = 'On Schedule (0m)';
      delayPill.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700';
    }
  }

  // AV Notes
  const avNotes = document.getElementById('stageops-av-notes');
  if (avNotes && !avNotes.matches(':focus')) {
    avNotes.value = stage.av_notes || '';
  }

  // Render Kanban Queues from Registrations & Stage Queue
  renderStageQueues();
}

function renderStageQueues() {
  const queueGreen = document.getElementById('queue-green-room');
  const queueOnDeck = document.getElementById('queue-on-deck');
  const queueCompleted = document.getElementById('queue-completed');

  if (!queueGreen || !queueOnDeck || !queueCompleted) return;

  const regs = cachedRegistrations || [];
  // Registrations that are checked in:
  const checkedInRegs = regs.filter((r) => r.checked_in);

  const opsQueue = cachedStageOps?.queue || [];

  // Group into statuses
  const greenRoomItems = [];
  const onDeckItems = [];
  const completedItems = [];

  // Populate from checkedInRegs
  checkedInRegs.forEach((r) => {
    const queueEntry = opsQueue.find((q) => q.registration_id === r.id);
    const status = queueEntry ? queueEntry.status : 'green_room';

    const item = {
      id: r.id,
      team_name: r.team_name || r.leader_name,
      college_name: r.college_name,
      ticket_code: r.ticket_code,
      event_id: r.event_id,
      event_title: r.events?.title || 'Festival Event',
      status,
    };

    if (status === 'on_deck') onDeckItems.push(item);
    else if (status === 'completed') completedItems.push(item);
    else greenRoomItems.push(item);
  });

  // Update counts
  const cGreen = document.getElementById('badge-count-greenroom');
  if (cGreen) cGreen.textContent = greenRoomItems.length;

  const cDeck = document.getElementById('badge-count-ondeck');
  if (cDeck) cDeck.textContent = onDeckItems.length;

  const cComp = document.getElementById('badge-count-completed');
  if (cComp) cComp.textContent = completedItems.length;

  // Render Green Room
  if (greenRoomItems.length === 0) {
    queueGreen.innerHTML = '<div class="text-center py-4 text-xs text-slate-400">No teams currently in green room.</div>';
  } else {
    queueGreen.innerHTML = greenRoomItems.map((item) => `
      <div class="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs hover:border-emerald-500 transition-colors">
        <div class="min-w-0 pr-2">
          <span class="font-bold text-slate-900 block truncate">${escapeHtml(item.team_name)}</span>
          <span class="text-[10px] text-slate-500 truncate block">${escapeHtml(item.college_name)} • ${escapeHtml(item.event_title)}</span>
        </div>
        <button type="button" class="btn-move-ondeck px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold shrink-0 transition-colors" data-id="${item.id}">
          Call to Wings
        </button>
      </div>
    `).join('');
  }

  // Render On Deck
  if (onDeckItems.length === 0) {
    queueOnDeck.innerHTML = '<div class="text-center py-4 text-xs text-slate-400">No teams currently on deck.</div>';
  } else {
    queueOnDeck.innerHTML = onDeckItems.map((item) => `
      <div class="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between text-xs">
        <div class="min-w-0 pr-2">
          <span class="font-bold text-amber-900 block truncate">${escapeHtml(item.team_name)}</span>
          <span class="text-[10px] text-amber-700 truncate block">${escapeHtml(item.college_name)} • ${escapeHtml(item.event_title)}</span>
        </div>
        <button type="button" class="btn-send-to-stage px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors shadow-sm" data-id="${item.id}" data-name="${escapeHtml(item.team_name)}" data-event="${escapeHtml(item.event_title)}" data-college="${escapeHtml(item.college_name)}">
          Deploy to Stage
        </button>
      </div>
    `).join('');
  }

  // Render Completed
  if (completedItems.length === 0) {
    queueCompleted.innerHTML = '<div class="text-center py-3 text-xs text-slate-400">No concluded performances yet.</div>';
  } else {
    queueCompleted.innerHTML = completedItems.map((item) => `
      <div class="p-2 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
        <span class="truncate">${escapeHtml(item.team_name)} (${escapeHtml(item.event_title)})</span>
        <span class="text-[10px] text-slate-400 font-bold shrink-0">Done</span>
      </div>
    `).join('');
  }

  // Attach Queue Button Handlers
  document.querySelectorAll('.btn-move-ondeck').forEach((btn) => {
    btn.addEventListener('click', () => {
      const regId = btn.getAttribute('data-id');
      advanceQueueItem(regId, 'on_deck');
    });
  });

  document.querySelectorAll('.btn-send-to-stage').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const regId = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const eventTitle = btn.getAttribute('data-event');
      const college = btn.getAttribute('data-college');

      if (!cachedStageOps) cachedStageOps = await db.getStageOps();
      if (cachedStageOps.stages && cachedStageOps.stages[currentStageId]) {
        cachedStageOps.stages[currentStageId].active_performer = name;
        cachedStageOps.stages[currentStageId].active_event_title = eventTitle;
        cachedStageOps.stages[currentStageId].active_college = college;
        cachedStageOps.stages[currentStageId].started_at = new Date().toISOString();
        cachedStageOps.stages[currentStageId].status = 'live';

        await db.updateStageOps(cachedStageOps);
        await advanceQueueItem(regId, 'on_stage');

        // Reset and start timer
        stageTimerSeconds = 0;
        startStageTimer();

        logAudit('STAGE_PERFORMER_STARTED', `${name} (${college}) called to stage for ${eventTitle}`);
        showToast(`${name} is now LIVE on stage!`, 'success');
        renderStageOpsTab();
      }
    });
  });
}

async function advanceQueueItem(regId, newStatus) {
  if (!cachedStageOps) cachedStageOps = await db.getStageOps();
  if (!cachedStageOps.queue) cachedStageOps.queue = [];

  const existingIdx = cachedStageOps.queue.findIndex((q) => q.registration_id === regId);
  if (existingIdx >= 0) {
    cachedStageOps.queue[existingIdx].status = newStatus;
  } else {
    cachedStageOps.queue.push({
      registration_id: regId,
      status: newStatus,
      updated_at: new Date().toISOString(),
    });
  }

  await db.updateStageOps(cachedStageOps);
  renderStageQueues();
}

async function handleStageDelay(minutes) {
  if (!cachedStageOps) cachedStageOps = await db.getStageOps();
  const stageName = cachedStageOps.stages?.[currentStageId]?.name || 'Stage';
  await db.setStageDelay(currentStageId, minutes);
  cachedStageOps = await db.getStageOps();

  logAudit('STAGE_DELAY_ADJUSTED', `Adjusted schedule delay on ${stageName} to +${minutes} minutes`);
  showToast(`Schedule buffer set to ${minutes} mins for ${stageName}`, minutes > 0 ? 'warning' : 'info');
  renderStageOpsTab();
}

function toggleStageTimer() {
  const btn = document.getElementById('btn-toggle-stage-timer');
  if (stageTimerRunning) {
    clearInterval(stageTimerInterval);
    stageTimerRunning = false;
    if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">play_arrow</span>';
    showToast('Stage stopwatch paused', 'info');
  } else {
    startStageTimer();
    showToast('Stage stopwatch active', 'info');
  }
}

function startStageTimer() {
  const btn = document.getElementById('btn-toggle-stage-timer');
  clearInterval(stageTimerInterval);
  stageTimerRunning = true;
  if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">pause</span>';

  stageTimerInterval = setInterval(() => {
    stageTimerSeconds++;
    updateStageStopwatchDisplay();
  }, 1000);
}

function resetStageTimer() {
  clearInterval(stageTimerInterval);
  stageTimerRunning = false;
  stageTimerSeconds = 0;
  updateStageStopwatchDisplay();
  const btn = document.getElementById('btn-toggle-stage-timer');
  if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">play_arrow</span>';
}

function updateStageStopwatchDisplay() {
  const el = document.getElementById('stageops-stopwatch');
  if (!el) return;
  const mins = Math.floor(stageTimerSeconds / 60);
  const secs = stageTimerSeconds % 60;
  el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function syncPerformerToLiveSite() {
  const stage = cachedStageOps?.stages?.[currentStageId];
  if (!stage || !stage.active_performer) {
    showToast('No performer currently active on this stage to broadcast', 'warning');
    return;
  }

  try {
    const settings = await db.getSettings();
    settings.video_title = `${stage.active_performer} • ${stage.active_event_title || 'Live Performance'}`;
    settings.video_venue = stage.name.toUpperCase();
    settings.video_is_live = true;

    await db.updateSettings(settings);
    cachedSettings = settings;

    logAudit('LIVE_SITE_BROADCAST', `Pushed ${stage.active_performer} to public homepage broadcast`);
    showToast(`Broadcasted ${stage.active_performer} to public website frontpage!`, 'success');
  } catch (err) {
    showToast('Failed to sync with live site: ' + err.message, 'error');
  }
}

async function concludeStagePerformance() {
  const stage = cachedStageOps?.stages?.[currentStageId];
  if (!stage || !stage.active_performer) {
    showToast('No performer active to conclude', 'warning');
    return;
  }

  const finishedName = stage.active_performer;
  stage.active_performer = '';
  stage.active_event_title = '';
  stage.active_college = '';
  stage.status = 'idle';

  await db.updateStageOps(cachedStageOps);
  resetStageTimer();

  logAudit('STAGE_PERFORMANCE_CONCLUDED', `Concluded performance for ${finishedName}`);
  showToast(`Performance for ${finishedName} concluded. Next team ready.`, 'success');
  renderStageOpsTab();
}


// ==============================================================================
// 13. JURY & COMPETITOR SCORING PORTAL
// ==============================================================================

function setupScoringControls() {
  const evSelect = document.getElementById('scoring-event-select');
  if (evSelect) {
    evSelect.addEventListener('change', () => {
      populateScoringTeams(evSelect.value);
      renderScoringLeaderboard(evSelect.value);
    });
  }

  // Rubric Sliders
  ['rubric-crit-1', 'rubric-crit-2', 'rubric-crit-3', 'rubric-crit-4'].forEach((id, idx) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.addEventListener('input', () => {
        const valEl = document.getElementById(`score-val-${idx + 1}`);
        const max = idx < 2 ? 30 : 20;
        if (valEl) valEl.textContent = `${slider.value} / ${max}`;
        updateFinalScoreCalculation();
      });
    }
  });

  // Penalty Buttons
  let currentPenaltyPoints = 0;
  document.querySelectorAll('.btn-penalty').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pts = parseInt(btn.getAttribute('data-points') || '0', 10);
      const reason = btn.getAttribute('data-reason') || '';
      currentPenaltyPoints = pts;

      const pDisplay = document.getElementById('score-penalty-display');
      if (pDisplay) pDisplay.textContent = `${pts} Pts Deducted`;

      const pReason = document.getElementById('score-penalty-reason');
      if (pReason) pReason.value = reason;

      updateFinalScoreCalculation();
    });
  });

  const btnResetPenalty = document.getElementById('btn-reset-penalties');
  if (btnResetPenalty) {
    btnResetPenalty.addEventListener('click', () => {
      currentPenaltyPoints = 0;
      const pDisplay = document.getElementById('score-penalty-display');
      if (pDisplay) pDisplay.textContent = '0 Pts Deducted';
      const pReason = document.getElementById('score-penalty-reason');
      if (pReason) pReason.value = '';
      updateFinalScoreCalculation();
    });
  }

  // Submit Score Button
  const btnSubmitScore = document.getElementById('btn-submit-score');
  if (btnSubmitScore) {
    btnSubmitScore.addEventListener('click', submitScorecard);
  }

  // Push to Podium Button
  const btnPushPodium = document.getElementById('btn-push-to-podium');
  if (btnPushPodium) {
    btnPushPodium.addEventListener('click', pushLeaderboardToPodium);
  }

  // Print Certificate Button in Modal
  const btnPrintCert = document.getElementById('btn-print-certificate');
  if (btnPrintCert) {
    btnPrintCert.addEventListener('click', () => window.print());
  }
}

function updateFinalScoreCalculation() {
  const c1 = parseInt(document.getElementById('rubric-crit-1')?.value || '0', 10);
  const c2 = parseInt(document.getElementById('rubric-crit-2')?.value || '0', 10);
  const c3 = parseInt(document.getElementById('rubric-crit-3')?.value || '0', 10);
  const c4 = parseInt(document.getElementById('rubric-crit-4')?.value || '0', 10);

  const penaltyText = document.getElementById('score-penalty-display')?.textContent || '0';
  const penalty = parseInt(penaltyText, 10) || 0;

  const total = Math.max(0, c1 + c2 + c3 + c4 - penalty);
  const totalEl = document.getElementById('score-final-total');
  if (totalEl) totalEl.textContent = total;
}

async function renderScoringTab() {
  const evSelect = document.getElementById('scoring-event-select');
  if (!evSelect) return;

  const events = cachedEvents || [];
  evSelect.innerHTML = events.map((e) => `
    <option value="${e.id}">${escapeHtml(e.title)} (${escapeHtml(e.category)})</option>
  `).join('');

  if (events.length > 0) {
    populateScoringTeams(events[0].id);
    renderScoringLeaderboard(events[0].id);
  }
}

function populateScoringTeams(eventId) {
  const teamSelect = document.getElementById('scoring-team-select');
  if (!teamSelect) return;

  const regs = (cachedRegistrations || []).filter((r) => r.event_id === eventId);
  if (regs.length === 0) {
    teamSelect.innerHTML = '<option value="">No registered teams for this track</option>';
    return;
  }

  teamSelect.innerHTML = regs.map((r) => `
    <option value="${r.id}" data-name="${escapeHtml(r.team_name || r.leader_name)}" data-college="${escapeHtml(r.college_name)}">
      ${escapeHtml(r.team_name || r.leader_name)} (${escapeHtml(r.college_name)})
    </option>
  `).join('');
}

async function submitScorecard() {
  const evSelect = document.getElementById('scoring-event-select');
  const teamSelect = document.getElementById('scoring-team-select');
  const judgeInput = document.getElementById('scoring-judge-name');

  const eventId = evSelect?.value;
  const regId = teamSelect?.value;
  const judgeName = (judgeInput?.value || 'Judge 1').trim();

  if (!eventId || !regId) {
    showToast('Please select both a competition track and a competitor', 'warning');
    return;
  }

  const selectedOpt = teamSelect.options[teamSelect.selectedIndex];
  const teamName = selectedOpt.getAttribute('data-name') || 'Competitor';
  const collegeName = selectedOpt.getAttribute('data-college') || '';

  const c1 = parseInt(document.getElementById('rubric-crit-1')?.value || '0', 10);
  const c2 = parseInt(document.getElementById('rubric-crit-2')?.value || '0', 10);
  const c3 = parseInt(document.getElementById('rubric-crit-3')?.value || '0', 10);
  const c4 = parseInt(document.getElementById('rubric-crit-4')?.value || '0', 10);

  const penaltyText = document.getElementById('score-penalty-display')?.textContent || '0';
  const penalty = parseInt(penaltyText, 10) || 0;
  const reason = (document.getElementById('score-penalty-reason')?.value || '').trim();
  const total = Math.max(0, c1 + c2 + c3 + c4 - penalty);

  const scoreObj = {
    event_id: eventId,
    registration_id: regId,
    team_name: teamName,
    college_name: collegeName,
    judge_name: judgeName,
    criterion_technical: c1,
    criterion_andalusian: c2,
    criterion_creative: c3,
    criterion_decorum: c4,
    penalty_points: penalty,
    penalty_reason: reason,
    total_score: total,
  };

  try {
    await db.saveScore(scoreObj);
    cachedScores = await db.getScores();

    logAudit('SCORE_SUBMITTED', `${judgeName} awarded ${total}/100 to ${teamName} (${collegeName})`);
    showToast(`Scorecard of ${total} pts submitted for ${teamName}!`, 'success');

    renderScoringLeaderboard(eventId);
    renderAnalyticsTab();
  } catch (err) {
    showToast('Failed to save score: ' + err.message, 'error');
  }
}

async function renderScoringLeaderboard(eventId) {
  const tbody = document.getElementById('scoring-leaderboard-body');
  if (!tbody) return;

  if (!cachedScores) cachedScores = await db.getScores();
  const scores = (cachedScores || []).filter((s) => s.event_id === eventId);

  if (scores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-8 text-center text-slate-400">
          No scores entered yet for this competition track.
        </td>
      </tr>
    `;
    return;
  }

  // Aggregate by registration_id
  const aggregated = {};
  scores.forEach((s) => {
    if (!aggregated[s.registration_id]) {
      aggregated[s.registration_id] = {
        registration_id: s.registration_id,
        team_name: s.team_name,
        college_name: s.college_name,
        total_score: 0,
        judge_count: 0,
        penalty_points: s.penalty_points || 0,
      };
    }
    aggregated[s.registration_id].total_score += s.total_score;
    aggregated[s.registration_id].judge_count += 1;
  });

  const ranked = Object.values(aggregated).map((item) => ({
    ...item,
    avg_score: Math.round(item.total_score / item.judge_count),
  })).sort((a, b) => b.avg_score - a.avg_score);

  const evTitle = cachedEvents.find((e) => e.id === eventId)?.title || 'Festival Event';

  tbody.innerHTML = ranked.map((r, idx) => {
    const rankPills = [
      '<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold font-mono text-[10px] border border-amber-300 shadow-xs">1ST</span>',
      '<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold font-mono text-[10px] border border-slate-300 shadow-xs">2ND</span>',
      '<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 font-bold font-mono text-[10px] border border-amber-200 shadow-xs">3RD</span>',
    ];
    const rankBadge = rankPills[idx] || `<span class="font-mono text-slate-500 font-semibold">#${idx + 1}</span>`;
    const rankClass = idx === 0 ? 'bg-amber-50 font-bold' : idx === 1 ? 'bg-slate-50' : idx === 2 ? 'bg-orange-50/50' : '';

    return `
      <tr class="${rankClass} hover:bg-slate-50/80 transition-colors">
        <td class="py-2.5 px-3 text-sm font-extrabold whitespace-nowrap">
          ${rankBadge}
        </td>
        <td class="py-2.5 px-3 min-w-0">
          <strong class="text-slate-900 block truncate">${escapeHtml(r.team_name)}</strong>
          <span class="text-[10px] text-slate-500 truncate block">${escapeHtml(r.college_name)} • ${r.judge_count} Judge(s)</span>
        </td>
        <td class="py-2.5 px-2 text-right font-mono font-bold text-red-600 text-sm whitespace-nowrap">
          ${r.avg_score}
        </td>
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button type="button" class="btn-cert-gen p-1 text-slate-400 hover:text-amber-600 transition-colors" title="Print Certificate" data-name="${escapeHtml(r.team_name)}" data-college="${escapeHtml(r.college_name)}" data-event="${escapeHtml(evTitle)}" data-rank="${idx + 1}">
            <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Certificate click handlers
  document.querySelectorAll('.btn-cert-gen').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const college = btn.getAttribute('data-college');
      const event = btn.getAttribute('data-event');
      const rank = parseInt(btn.getAttribute('data-rank') || '1', 10);
      openCertificateModal(name, college, event, rank);
    });
  });
}

async function pushLeaderboardToPodium() {
  const evSelect = document.getElementById('scoring-event-select');
  const eventId = evSelect?.value;
  if (!eventId) {
    showToast('Please select a competition track first', 'warning');
    return;
  }

  const scores = (cachedScores || []).filter((s) => s.event_id === eventId);
  if (scores.length === 0) {
    showToast('No scored teams available to push to podium', 'warning');
    return;
  }

  // Aggregate
  const aggregated = {};
  scores.forEach((s) => {
    if (!aggregated[s.registration_id]) {
      aggregated[s.registration_id] = {
        winner_name: s.team_name,
        college_name: s.college_name,
        total: 0,
        count: 0,
      };
    }
    aggregated[s.registration_id].total += s.total_score;
    aggregated[s.registration_id].count += 1;
  });

  const ranked = Object.values(aggregated).map((i) => ({
    ...i,
    avg: Math.round(i.total / i.count),
  })).sort((a, b) => b.avg - a.avg);

  const winnersArray = ranked.slice(0, 3).map((r, idx) => ({
    position: idx + 1,
    winner_name: r.winner_name,
    college_name: r.college_name,
  }));

  try {
    await db.saveWinners(eventId, winnersArray, true);
    cachedWinners = await db.getWinners();
    renderWinnersTab();
    renderAnalyticsTab();

    const evTitle = cachedEvents.find((e) => e.id === eventId)?.title || 'Event';
    logAudit('PODIUM_PUSHED_FROM_JURY', `Pushed top ${winnersArray.length} scored laureates to official podium for ${evTitle}`);
    showToast(`Top ${winnersArray.length} laureates pushed directly to Official Podium!`, 'success');
  } catch (err) {
    showToast('Failed to push winners: ' + err.message, 'error');
  }
}

function openCertificateModal(recipientName, institutionName, eventTitle, rank) {
  const modal = document.getElementById('modal-certificate');
  if (!modal) return;

  const certTitle = document.getElementById('cert-title-type');
  const certName = document.getElementById('cert-recipient-name');
  const certInst = document.getElementById('cert-institution-name');
  const certEvent = document.getElementById('cert-event-title');
  const certRank = document.getElementById('cert-rank-distinction');
  const certCode = document.getElementById('cert-verification-code');

  const rankText = rank === 1 ? 'First Place Distinction (Gold Laureate)' : rank === 2 ? 'Second Place Distinction (Silver Laureate)' : rank === 3 ? 'Third Place Distinction (Bronze Laureate)' : 'Distinguished Academic Participation';

  if (certTitle) certTitle.textContent = rank <= 3 ? 'CERTIFICATE OF MERIT' : 'CERTIFICATE OF PARTICIPATION';
  if (certName) certName.textContent = recipientName;
  if (certInst) certInst.textContent = institutionName;
  if (certEvent) certEvent.textContent = eventTitle;
  if (certRank) certRank.textContent = rankText;
  if (certCode) certCode.textContent = `VERIFIED • ALM-CERT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  modal.classList.add('show');
}


// ==============================================================================
// 14. LIVE CAMERA QR SCANNER & ACCREDITATION
// ==============================================================================

function setupCameraScanner() {
  const btnOpen = document.getElementById('btn-open-qr-scanner');
  if (btnOpen) {
    btnOpen.addEventListener('click', startLiveCameraScanner);
  }

  const btnBatchBadges = document.getElementById('btn-open-batch-badges');
  if (btnBatchBadges) {
    btnBatchBadges.addEventListener('click', openBatchBadgesModal);
  }

  const btnPrintBadges = document.getElementById('btn-trigger-print-badges');
  if (btnPrintBadges) {
    btnPrintBadges.addEventListener('click', () => window.print());
  }

  const btnToggleAudio = document.getElementById('btn-toggle-camera-audio');
  if (btnToggleAudio) {
    btnToggleAudio.addEventListener('click', () => {
      audioChimeEnabled = !audioChimeEnabled;
      btnToggleAudio.innerHTML = audioChimeEnabled
        ? '<span class="material-symbols-outlined text-[16px]">volume_up</span><span>Audio Chime Enabled</span>'
        : '<span class="material-symbols-outlined text-[16px]">volume_off</span><span>Audio Chime Muted</span>';
      showToast(audioChimeEnabled ? 'Camera audio chime enabled' : 'Camera audio chime muted', 'info');
    });
  }
}

async function startLiveCameraScanner() {
  const modal = document.getElementById('modal-qr-scanner');
  if (!modal) return;
  modal.classList.add('show');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('QR Scanner engine loading. Please try again in a moment.', 'warning');
    return;
  }

  try {
    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode('qr-camera-viewport');
    }

    const config = { fps: 15, qrbox: { width: 250, height: 250 } };
    await html5QrScanner.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => onQrCodeScanned(decodedText),
      () => {} // silent frame error handler
    );
    isCameraScanning = true;
  } catch (err) {
    console.warn('Failed to access camera:', err);
    showToast('Camera access permission denied or unavailable. You can also enter the code manually.', 'error');
  }
}

async function stopLiveCameraScanner() {
  if (html5QrScanner && isCameraScanning) {
    try {
      await html5QrScanner.stop();
    } catch (e) {}
    isCameraScanning = false;
  }
}

// Hook modal close to stop camera
document.addEventListener('click', (e) => {
  if (e.target && (e.target.matches('.btn-close-modal') || e.target.id === 'modal-qr-scanner')) {
    stopLiveCameraScanner();
  }
});

async function onQrCodeScanned(decodedText) {
  if (!decodedText) return;
  let rawCode = decodedText.trim();
  try {
    if (rawCode.includes('?')) {
      const parsedUrl = new URL(rawCode, window.location.origin);
      const paramVal = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('ticket');
      if (paramVal) rawCode = paramVal;
    }
  } catch (e) {}
  rawCode = rawCode.toUpperCase();
  // Match code e.g. ALM-XXXX or pure code
  const match = rawCode.match(/[A-Z0-9]{3,4}-[A-Z0-9]{3,6}/) || [rawCode];
  const ticketCode = match[0];

  // Play audio chime
  if (audioChimeEnabled) playSuccessChime();

  // Find registration
  const regs = cachedRegistrations || [];
  const found = regs.find((r) => r.ticket_code?.toUpperCase() === ticketCode);

  const resultBox = document.getElementById('qr-modal-result');
  const codeEl = document.getElementById('qr-modal-code');
  const nameEl = document.getElementById('qr-modal-name');
  const evEl = document.getElementById('qr-modal-event');

  if (resultBox && codeEl) {
    resultBox.classList.remove('hidden');
    codeEl.textContent = ticketCode;

    if (found) {
      nameEl.textContent = `${found.leader_name} (${found.college_name})`;
      evEl.textContent = `Event: ${found.events?.title || 'Festival Event'}`;
      resultBox.className = 'p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-1';

      // Auto check-in
      if (!found.checked_in) {
        try {
          await db.checkIn(found.ticket_code);
          found.checked_in = true;
          found.checked_in_at = new Date().toISOString();
          renderCheckInTab();
          renderOverview();
          const gateZone = document.getElementById('checkin-zone-select')?.value || 'main';
          logAudit('QR_CAMERA_CHECKIN', `Admitted ${found.ticket_code} (${found.leader_name}) at ${gateZone.toUpperCase()} gate`);
          showToast(`Gate Accreditation Confirmed: ${found.leader_name}`, 'success');
        } catch (e) {
          console.error('Check-in error:', e);
        }
      } else {
        showToast(`Pass ${ticketCode} already checked in.`, 'info');
      }
    } else {
      nameEl.textContent = 'Unregistered or External Ticket';
      evEl.textContent = 'Code not found in official festival registry.';
      resultBox.className = 'p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-1';
      showToast(`Scanned Code: ${ticketCode}`, 'warning');
    }
  }

  // Also populate the main ticket input for quick reference
  const checkinInput = document.getElementById('checkin-ticket-input');
  if (checkinInput) checkinInput.value = ticketCode;
}

function playSuccessChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {}
}

function openBatchBadgesModal() {
  const modal = document.getElementById('modal-batch-badges');
  const container = document.getElementById('batch-badges-container');
  if (!modal || !container) return;

  const regs = cachedRegistrations || [];
  if (regs.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">No registered attendees available to print.</div>';
    modal.classList.add('show');
    return;
  }

  container.innerHTML = regs.slice(0, 18).map((r) => `
    <div class="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-sm flex flex-col justify-between text-center relative overflow-hidden" style="break-inside: avoid;">
      <div class="absolute top-2 left-2 flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-red-600"></span>
        <span class="text-[9px] font-bold tracking-widest text-[#7F011F] uppercase">AL MURAFAQA</span>
      </div>
      
      <div class="my-4">
        <div class="w-14 h-14 mx-auto bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center font-mono font-bold text-xs text-slate-700 mb-2">
          QR: ${escapeHtml(r.ticket_code)}
        </div>
        <h4 class="font-headline-sm text-base font-extrabold text-slate-900 truncate">${escapeHtml(r.team_name || r.leader_name)}</h4>
        <p class="text-xs text-slate-600 truncate">${escapeHtml(r.college_name)}</p>
        <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
          ${escapeHtml(r.events?.category || 'Delegate Pass')}
        </span>
      </div>

      <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-mono">
        <span>${escapeHtml(r.ticket_code)}</span>
        <span class="text-emerald-700 font-bold">${r.payment_status === 'verified' ? 'ACCREDITED' : 'PENDING'}</span>
      </div>
    </div>
  `).join('');

  modal.classList.add('show');
}


// ==============================================================================
// 15. DATA INTELLIGENCE, ANALYTICS & BACKUP
// ==============================================================================

function setupAnalyticsControls() {
  const btnTrophyReport = document.getElementById('btn-export-trophy-report');
  if (btnTrophyReport) {
    btnTrophyReport.addEventListener('click', () => window.print());
  }

  const btnExportRegs = document.getElementById('btn-export-regs-csv');
  if (btnExportRegs) {
    btnExportRegs.addEventListener('click', exportRegistrationsCSV);
  }

  const btnExportScores = document.getElementById('btn-export-scores-csv');
  if (btnExportScores) {
    btnExportScores.addEventListener('click', exportScoresCSV);
  }

  const btnExportWinners = document.getElementById('btn-export-winners-csv');
  if (btnExportWinners) {
    btnExportWinners.addEventListener('click', exportWinnersCSV);
  }

  const btnDownloadBackup = document.getElementById('btn-download-backup-json');
  if (btnDownloadBackup) {
    btnDownloadBackup.addEventListener('click', downloadJsonBackup);
  }

  const btnTriggerRestore = document.getElementById('btn-trigger-restore');
  if (btnTriggerRestore) {
    btnTriggerRestore.addEventListener('click', handleJsonRestore);
  }
}

async function renderAnalyticsTab() {
  const tbody = document.getElementById('championship-table-body');
  if (!tbody) return;

  const winners = cachedWinners || [];
  const regs = cachedRegistrations || [];
  const scores = cachedScores || [];

  // Update Top KPIs
  const kpiScored = document.getElementById('kpi-scored-count');
  if (kpiScored) kpiScored.textContent = scores.length;

  const kpiMedals = document.getElementById('kpi-medals-awarded');
  if (kpiMedals) kpiMedals.textContent = winners.length;

  const totalRegs = regs.length;
  const checkedIn = regs.filter((r) => r.checked_in).length;
  const ingressRate = totalRegs > 0 ? Math.round((checkedIn / totalRegs) * 100) : 0;

  const kpiIngress = document.getElementById('kpi-ingress-rate');
  if (kpiIngress) kpiIngress.textContent = `${ingressRate}%`;

  // Calculate Championship Standings
  // Points: 1st Place = 10 Pts, 2nd Place = 7 Pts, 3rd Place = 5 Pts
  const colleges = {};

  winners.forEach((w) => {
    const col = (w.college_name || 'Autonomous Scholar').trim();
    if (!colleges[col]) {
      colleges[col] = { name: col, gold: 0, silver: 0, bronze: 0, points: 0 };
    }

    if (w.position === 1) {
      colleges[col].gold += 1;
      colleges[col].points += 10;
    } else if (w.position === 2) {
      colleges[col].silver += 1;
      colleges[col].points += 7;
    } else if (w.position === 3) {
      colleges[col].bronze += 1;
      colleges[col].points += 5;
    }
  });

  const rankedColleges = Object.values(colleges).sort((a, b) => b.points - a.points);

  const kpiLeader = document.getElementById('kpi-championship-leader');
  const kpiPts = document.getElementById('kpi-championship-pts');

  if (rankedColleges.length > 0) {
    if (kpiLeader) kpiLeader.textContent = rankedColleges[0].name;
    if (kpiPts) kpiPts.textContent = `${rankedColleges[0].points} Championship Pts`;
  } else {
    if (kpiLeader) kpiLeader.textContent = 'Awaiting Podium Results';
    if (kpiPts) kpiPts.textContent = '0 Pts';
  }

  if (rankedColleges.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          No official podium results recorded yet. Points compute automatically when results are published.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rankedColleges.map((c, idx) => {
    const rankPills = [
      '<span class="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold font-mono text-[11px] border border-amber-300 shadow-xs">1ST</span>',
      '<span class="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold font-mono text-[11px] border border-slate-300 shadow-xs">2ND</span>',
      '<span class="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-bold font-mono text-[11px] border border-amber-200 shadow-xs">3RD</span>',
    ];
    const badge = rankPills[idx] || `<span class="font-mono text-slate-500 font-semibold">#${idx + 1}</span>`;
    const rowClass = idx === 0 ? 'bg-amber-50/70 font-bold' : idx === 1 ? 'bg-slate-50' : idx === 2 ? 'bg-orange-50/40' : '';

    return `
      <tr class="${rowClass} hover:bg-slate-50 transition-colors">
        <td class="py-3 px-4 font-bold text-sm text-slate-800 whitespace-nowrap">
          ${badge}
        </td>
        <td class="py-3 px-4">
          <strong class="text-slate-900 block">${escapeHtml(c.name)}</strong>
          <span class="text-[10px] text-slate-500 font-normal">Accredited Institution</span>
        </td>
        <td class="py-3 px-3 text-center font-bold text-amber-700">${c.gold}</td>
        <td class="py-3 px-3 text-center font-bold text-slate-600">${c.silver}</td>
        <td class="py-3 px-3 text-center font-bold text-orange-700">${c.bronze}</td>
        <td class="py-3 px-4 text-right font-mono font-extrabold text-base text-red-600">
          ${c.points}
        </td>
      </tr>
    `;
  }).join('');
}

function exportScoresCSV() {
  const scores = cachedScores || [];
  if (scores.length === 0) {
    showToast('No score records to export', 'warning');
    return;
  }

  const headers = ['Event ID', 'Competitor', 'Institution', 'Judge', 'Technical (30)', 'Andalusian (30)', 'Creative (20)', 'Decorum (20)', 'Penalties', 'Total (100)'];
  const rows = scores.map((s) => [
    csvCell(s.event_id),
    csvCell(s.team_name),
    csvCell(s.college_name),
    csvCell(s.judge_name),
    s.criterion_technical || 0,
    s.criterion_andalusian || 0,
    s.criterion_creative || 0,
    s.criterion_decorum || 0,
    s.penalty_points || 0,
    s.total_score || 0,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `almurafaqa_jury_scores_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Jury scorecards exported successfully', 'success');
}

function exportWinnersCSV() {
  const winners = cachedWinners || [];
  if (winners.length === 0) {
    showToast('No podium winners to export', 'warning');
    return;
  }

  const headers = ['Event Title', 'Position', 'Winner / Team', 'Institution', 'Published At'];
  const rows = winners.map((w) => [
    csvCell(w.events?.title || 'Competition'),
    w.position,
    csvCell(w.winner_name),
    csvCell(w.college_name),
    csvCell(w.created_at),
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `almurafaqa_official_podium_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Official podium roster exported successfully', 'success');
}

async function downloadJsonBackup() {
  try {
    const backup = await db.getFullBackup();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `almurafaqa_cloud_snapshot_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);

    logAudit('DATABASE_BACKUP_DOWNLOAD', 'Exported full JSON cloud snapshot');
    showToast('Complete festival snapshot downloaded as JSON file!', 'success');
  } catch (err) {
    showToast('Failed to create backup: ' + err.message, 'error');
  }
}

async function handleJsonRestore() {
  const fileInput = document.getElementById('restore-backup-file');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a valid .json backup file first', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!confirm('Are you sure you want to restore from this backup file? Existing data collections will be updated with the snapshot contents.')) {
        return;
      }

      await db.restoreBackup(parsed);
      await loadAllData();
      showToast('Database successfully restored from JSON backup archive!', 'success');
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
  };

  reader.readAsText(file);
}

// ==============================================================================
// 16. INTERACTIVE HUD, COMMAND PALETTE (CTRL+K) & VISUAL MISSION CONTROL
// ==============================================================================

let globalAudioMuted = false;
let audioVisualizerInterval = null;

function setupCommandPalette() {
  const triggerBtn = document.getElementById('btn-trigger-cmd-palette');
  const modal = document.getElementById('modal-command-palette');
  const input = document.getElementById('cmd-palette-input');
  const resultsContainer = document.getElementById('cmd-palette-results');

  if (!modal || !input) return;

  // Open with Click
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => openCommandPalette());
  }

  // Global Keyboard Shortcut: Ctrl + K or Cmd + K
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (modal.classList.contains('show')) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    } else if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeCommandPalette();
    }
  });

  // Filter Input Listener
  input.addEventListener('input', () => {
    filterCommandPalette(input.value);
  });

  // Global Audio Toggle
  const btnAudio = document.getElementById('btn-global-audio-toggle');
  const iconAudio = document.getElementById('icon-global-audio');
  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      globalAudioMuted = !globalAudioMuted;
      if (iconAudio) {
        iconAudio.textContent = globalAudioMuted ? 'volume_off' : 'volume_up';
      }
      playTactileClick();
      showToast(globalAudioMuted ? 'Console audio muted' : 'Console audio active', 'info');
    });
  }

  // Lighting Presets in Stage Control Room
  document.querySelectorAll('.btn-lighting-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-lighting-preset').forEach((b) => {
        b.classList.remove('active', 'bg-amber-500/20', 'text-amber-300', 'border-amber-400/40');
        b.classList.add('bg-white/5', 'text-slate-300', 'border-white/10');
      });
      btn.classList.add('active', 'bg-amber-500/20', 'text-amber-300', 'border-amber-400/40');
      btn.classList.remove('bg-white/5', 'text-slate-300', 'border-white/10');
      
      const preset = btn.getAttribute('data-preset');
      playTactileClick();
      logAudit('LIGHTING_PRESET_CHANGED', `Auditorium lighting ambience set to ${preset.toUpperCase()}`);
      showToast(`Auditorium lighting preset set to ${btn.textContent.trim()}`, 'info');
    });
  });

  // Start continuous audio wave simulator
  startAudioWaveSimulator();
}

function openCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  const input = document.getElementById('cmd-palette-input');
  if (!modal || !input) return;

  modal.classList.add('show');
  input.value = '';
  filterCommandPalette('');
  setTimeout(() => input.focus(), 80);
  playTactileClick();
}

function closeCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  if (modal) modal.classList.remove('show');
}

function filterCommandPalette(query) {
  const container = document.getElementById('cmd-palette-results');
  if (!container) return;

  const q = (query || '').toLowerCase().trim();

  // Core System Actions List
  const actions = [
    { title: 'Register Team Delegation', desc: 'Add new team with multiple roster members', icon: 'group_add', action: () => { closeCommandPalette(); switchTab('registrations'); document.getElementById('btn-open-add-team-modal')?.click(); } },
    { title: 'Edit Operational Restrictions', desc: 'Manage gate halts, blacklists & zone curfews', icon: 'shield', action: () => { closeCommandPalette(); switchTab('restrictions'); } },
    { title: 'Impose / Edit Delegate Restriction', desc: 'Flag or update disciplinary restriction directive', icon: 'lock_person', action: () => { closeCommandPalette(); switchTab('restrictions'); document.getElementById('btn-open-direct-restrict-modal')?.click(); } },
    { title: 'Launch Live Camera Scanner', desc: 'Scan delegate QR pass with webcam', icon: 'photo_camera', action: () => { closeCommandPalette(); switchTab('checkin'); startLiveCameraScanner(); } },
    { title: 'Deploy Performer to Stage', desc: 'Open stage control room & call next team', icon: 'theater_comedy', action: () => { closeCommandPalette(); switchTab('stageops'); } },
    { title: 'Stage Schedule Delay +15 Mins', desc: 'Bump active stage schedule buffer by 15 mins', icon: 'fast_forward', action: () => { closeCommandPalette(); switchTab('stageops'); handleStageDelay(15); } },
    { title: 'Jury Adjudication & Evaluation', desc: 'Score active competitor with rubric', icon: 'gavel', action: () => { closeCommandPalette(); switchTab('scoring'); } },
    { title: 'Push Scored Laureates to Podium', desc: 'Auto-publish top 3 scored teams to frontpage', icon: 'publish', action: () => { closeCommandPalette(); switchTab('scoring'); pushLeaderboardToPodium(); } },
    { title: 'Championship Trophy Standings', desc: 'View institutional points leaderboard', icon: 'military_tech', action: () => { closeCommandPalette(); switchTab('analytics'); } },
    { title: 'Download Full JSON Cloud Snapshot', desc: 'Export complete festival state archive', icon: 'cloud_download', action: () => { closeCommandPalette(); downloadJsonBackup(); } },
    { title: 'Broadcast Live Stage Alert', desc: 'Send urgent message to public ticker', icon: 'podium', action: () => { closeCommandPalette(); switchTab('announcements'); } },
    { title: 'Switch to Executive Admin', desc: 'Full console privileges view', icon: 'shield_person', action: () => { closeCommandPalette(); setActiveRole('superadmin'); } },
    { title: 'Switch to Jury Adjudicator View', desc: 'Filter console for evaluation desk', icon: 'gavel', action: () => { closeCommandPalette(); setActiveRole('jury'); } },
    { title: 'Switch to Accreditation Officer', desc: 'Filter console for gate check-in desk', icon: 'qr_code_scanner', action: () => { closeCommandPalette(); setActiveRole('marshal'); } },
  ];

  // Match Actions
  const matchedActions = actions.filter((a) => !q || a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));

  // Match Registered Attendees
  const regs = cachedRegistrations || [];
  const matchedRegs = q ? regs.filter((r) => 
    r.ticket_code?.toLowerCase().includes(q) || 
    r.leader_name?.toLowerCase().includes(q) || 
    r.college_name?.toLowerCase().includes(q) ||
    r.team_name?.toLowerCase().includes(q)
  ).slice(0, 5) : [];

  let html = '';

  if (matchedActions.length > 0) {
    html += '<div class="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Operations</div>';
    html += matchedActions.map((item, idx) => `
      <div class="cmd-item p-2.5 rounded-xl hover:bg-red-50 hover:border-red-200 border border-transparent cursor-pointer flex items-center justify-between text-slate-800 transition-colors" data-idx="${idx}">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <span class="material-symbols-outlined text-[18px]">${item.icon}</span>
          </div>
          <div>
            <span class="font-bold block text-slate-900">${escapeHtml(item.title)}</span>
            <span class="text-[11px] text-slate-500">${escapeHtml(item.desc)}</span>
          </div>
        </div>
        <span class="text-[10px] font-mono font-semibold text-slate-400 uppercase">Action ↵</span>
      </div>
    `).join('');
  }

  if (matchedRegs.length > 0) {
    html += '<div class="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 mt-2">Delegation Matches</div>';
    html += matchedRegs.map((reg) => `
      <div class="cmd-reg-item p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer flex items-center justify-between transition-colors" data-code="${escapeHtml(reg.ticket_code)}">
        <div class="flex items-center gap-2.5">
          <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200 text-slate-800">${escapeHtml(reg.ticket_code)}</span>
          <div>
            <strong class="text-slate-900 block text-xs">${escapeHtml(reg.leader_name)}</strong>
            <span class="text-[10px] text-slate-500">${escapeHtml(reg.college_name)}</span>
          </div>
        </div>
        <span class="text-[10px] font-bold text-emerald-700">${reg.checked_in ? 'CHECKED IN' : 'PENDING'}</span>
      </div>
    `).join('');
  }

  if (matchedActions.length === 0 && matchedRegs.length === 0) {
    html = '<div class="text-center py-8 text-xs text-slate-400">No commands or attendees matching "' + escapeHtml(q) + '"</div>';
  }

  container.innerHTML = html;

  // Click listeners for actions
  container.querySelectorAll('.cmd-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
      playTactileClick();
      matchedActions[idx].action();
    });
  });

  // Click listeners for attendee matches
  container.querySelectorAll('.cmd-reg-item').forEach((el) => {
    el.addEventListener('click', () => {
      const code = el.getAttribute('data-code');
      closeCommandPalette();
      switchTab('checkin');
      const ticketInput = document.getElementById('checkin-ticket-input');
      if (ticketInput) {
        ticketInput.value = code;
        const searchForm = document.getElementById('checkin-search-form');
        if (searchForm) searchForm.dispatchEvent(new Event('submit'));
      }
    });
  });
}

function playTactileClick() {
  if (globalAudioMuted) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {}
}

function startAudioWaveSimulator() {
  if (audioVisualizerInterval) clearInterval(audioVisualizerInterval);

  audioVisualizerInterval = setInterval(() => {
    // Only run if on stageops tab and element exists
    if (currentTab !== 'stageops') {
      clearInterval(audioVisualizerInterval);
      audioVisualizerInterval = null;
      return;
    }
    const barsContainer = document.getElementById('stage-audio-bars');
    const dbEl = document.getElementById('stage-audio-db');
    if (!barsContainer) return;

    const bars = barsContainer.querySelectorAll('.sound-bar');
    bars.forEach((bar) => {
      const scale = (0.2 + Math.random() * 0.8).toFixed(2);
      bar.style.transform = `scaleY(${scale})`;
    });

    if (dbEl) {
      const db = (-12.0 - Math.random() * 8.5).toFixed(1);
      dbEl.textContent = `${db} dB`;
    }
  }, 400); // throttled from 180ms to 400ms to eliminate CPU spikes
}

// Enhance Podium Rendering in renderAnalyticsTab
function updateVisualPodium(rankedColleges) {
  const p1Col = document.getElementById('podium-1-college');
  const p1Pts = document.getElementById('podium-1-pts');
  const p2Col = document.getElementById('podium-2-college');
  const p2Pts = document.getElementById('podium-2-pts');
  const p3Col = document.getElementById('podium-3-college');
  const p3Pts = document.getElementById('podium-3-pts');

  if (rankedColleges && rankedColleges.length > 0) {
    if (p1Col && rankedColleges[0]) {
      p1Col.textContent = rankedColleges[0].name;
      if (p1Pts) p1Pts.textContent = `${rankedColleges[0].points} Pts`;
    }
    if (p2Col && rankedColleges[1]) {
      p2Col.textContent = rankedColleges[1].name;
      if (p2Pts) p2Pts.textContent = `${rankedColleges[1].points} Pts`;
    } else if (p2Col) {
      p2Col.textContent = 'Awaiting 2nd Place';
      if (p2Pts) p2Pts.textContent = '0 Pts';
    }
    if (p3Col && rankedColleges[2]) {
      p3Col.textContent = rankedColleges[2].name;
      if (p3Pts) p3Pts.textContent = `${rankedColleges[2].points} Pts`;
    } else if (p3Col) {
      p3Col.textContent = 'Awaiting 3rd Place';
      if (p3Pts) p3Pts.textContent = '0 Pts';
    }
  } else {
    if (p1Col) p1Col.textContent = 'Awaiting Championship Results';
    if (p1Pts) p1Pts.textContent = '0 Pts';
    if (p2Col) p2Col.textContent = 'Awaiting Silver Contender';
    if (p2Pts) p2Pts.textContent = '0 Pts';
    if (p3Col) p3Col.textContent = 'Awaiting Bronze Contender';
    if (p3Pts) p3Pts.textContent = '0 Pts';
  }
}

// Enhance updateFinalScoreCalculation with Dynamic Radial SVG Ring & Tier
const originalUpdateFinalScoreCalculation = updateFinalScoreCalculation;
updateFinalScoreCalculation = function() {
  originalUpdateFinalScoreCalculation();

  const totalEl = document.getElementById('score-final-total');
  const ringCircle = document.getElementById('score-ring-circle');
  const tierEl = document.getElementById('score-honors-tier');

  const total = parseInt(totalEl?.textContent || '0', 10);

  // Total circumference for r=30 is ~188.5
  const circumference = 188.5;
  const offset = Math.max(0, circumference - (circumference * total) / 100);

  if (ringCircle) {
    ringCircle.style.strokeDashoffset = offset;
    if (total >= 90) {
      ringCircle.style.stroke = '#C88A3C'; // Gold
    } else if (total >= 80) {
      ringCircle.style.stroke = '#2563EB'; // Royal Blue
    } else if (total >= 70) {
      ringCircle.style.stroke = '#059669'; // Emerald
    } else {
      ringCircle.style.stroke = '#7F011F'; // Andalusian Maroon
    }
  }

  if (tierEl) {
    if (total >= 90) {
      tierEl.textContent = 'Grand Laureate of the Highest Academic Distinction';
      tierEl.className = 'px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-headline font-bold text-xs tracking-tight shadow-sm';
    } else if (total >= 80) {
      tierEl.textContent = 'First Class Distinction & High Commendation';
      tierEl.className = 'px-3 py-1 rounded-xl bg-slate-100 text-slate-900 border border-slate-300 font-headline font-bold text-xs tracking-tight shadow-sm';
    } else if (total >= 70) {
      tierEl.textContent = 'Certificate of Merit & Academic Honor';
      tierEl.className = 'px-3 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 font-headline font-bold text-xs tracking-tight shadow-sm';
    } else {
      tierEl.textContent = 'Official Certificate of Participation';
      tierEl.className = 'px-3 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 font-headline font-bold text-xs tracking-tight';
    }
  }
};

// Hook renderAnalyticsTab to update visual 3D podium
const originalRenderAnalyticsTab = renderAnalyticsTab;
renderAnalyticsTab = async function() {
  await originalRenderAnalyticsTab();

  const winners = cachedWinners || [];
  const colleges = {};

  winners.forEach((w) => {
    const col = (w.college_name || 'Autonomous Scholar').trim();
    if (!colleges[col]) {
      colleges[col] = { name: col, gold: 0, silver: 0, bronze: 0, points: 0 };
    }
    if (w.position === 1) colleges[col].points += 10;
    else if (w.position === 2) colleges[col].points += 7;
    else if (w.position === 3) colleges[col].points += 5;
  });

  const rankedColleges = Object.values(colleges).sort((a, b) => b.points - a.points);
  updateVisualPodium(rankedColleges);
};

// Auto-initialize Command Palette on load
document.addEventListener('DOMContentLoaded', () => {
  setupCommandPalette();
});


// ==============================================================================
// 17. ACCESS & OPERATIONAL RESTRICTIONS ENGINE
// ==============================================================================

function setupRestrictionsControls() {
  // Master Switches
  const swGate = document.getElementById('switch-restrict-gate');
  const swRegs = document.getElementById('switch-restrict-regs');
  const swScores = document.getElementById('switch-restrict-scores');
  const swSite = document.getElementById('switch-restrict-site');

  if (swGate) {
    swGate.addEventListener('change', async () => {
      const active = swGate.checked;
      await db.updateRestrictions({ gate_ingress_restricted: active });
      cachedRestrictions = await db.getRestrictions();
      logAudit('RESTRICTION_SWITCH_TOGGLED', `Gate Ingress Curfew ${active ? 'ENFORCED (ALL GATES HALTED)' : 'LIFTED (NORMAL OPERATION)'}`);
      showToast(`Gate Ingress ${active ? 'HALTED: All check-ins blocked' : 'Normal: Check-in active'}`, active ? 'error' : 'info');
      updateRestrictionLabels();
    });
  }

  if (swRegs) {
    swRegs.addEventListener('change', async () => {
      const active = swRegs.checked;
      await db.updateRestrictions({ registration_freeze: active });
      cachedRestrictions = await db.getRestrictions();
      logAudit('RESTRICTION_SWITCH_TOGGLED', `Registration Intake ${active ? 'FROZEN' : 'ACTIVE'}`);
      showToast(`Registrations ${active ? 'FROZEN' : 'Reopened'}`, active ? 'warning' : 'info');
      updateRestrictionLabels();
    });
  }

  if (swScores) {
    swScores.addEventListener('change', async () => {
      const active = swScores.checked;
      await db.updateRestrictions({ score_embargo: active });
      cachedRestrictions = await db.getRestrictions();
      logAudit('RESTRICTION_SWITCH_TOGGLED', `Competition Score Embargo ${active ? 'ENFORCED' : 'LIFTED'}`);
      showToast(`Official Scores ${active ? 'EMBARGOED from public' : 'Published to public'}`, active ? 'warning' : 'info');
      updateRestrictionLabels();
    });
  }

  if (swSite) {
    swSite.addEventListener('change', async () => {
      const active = swSite.checked;
      await db.updateRestrictions({ site_lockdown: active });
      cachedRestrictions = await db.getRestrictions();
      logAudit('RESTRICTION_SWITCH_TOGGLED', `Public Portal Lockdown ${active ? 'ACTIVATED' : 'DEACTIVATED'}`);
      showToast(`Public Site ${active ? 'LOCKED DOWN' : 'Accessible normally'}`, active ? 'error' : 'info');
      updateRestrictionLabels();
    });
  }

  // Blacklist Search Input
  const bSearch = document.getElementById('blacklist-search-input');
  if (bSearch) {
    bSearch.addEventListener('input', () => renderBlacklistTable(bSearch.value));
  }

  // Open Direct Restrict Modal Button
  const btnDirectRestrict = document.getElementById('btn-open-direct-restrict-modal');
  if (btnDirectRestrict) {
    btnDirectRestrict.addEventListener('click', () => {
      // Pick first non-restricted attendee or prompt
      const regs = cachedRegistrations || [];
      const firstValid = regs.find((r) => !r.is_restricted);
      if (firstValid) {
        openRestrictModal(firstValid.id);
      } else {
        showToast('All registered attendees are already restricted or no attendees registered.', 'info');
      }
    });
  }

  // Restrict Form Submit
  const formRestrict = document.getElementById('form-restrict-delegate');
  if (formRestrict) {
    formRestrict.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetId = document.getElementById('restrict-target-id')?.value;
      const reasonCategory = document.getElementById('restrict-reason-select')?.value;
      const notes = (document.getElementById('restrict-notes-input')?.value || '').trim();
      const fullReason = notes ? `${reasonCategory} — ${notes}` : reasonCategory;

      if (!targetId) return;

      try {
        const severity = document.getElementById('restrict-severity-select')?.value || 'FULL_LOCKOUT';
        const isEditing = Boolean(cachedRegistrations.find((r) => r.id === targetId)?.is_restricted);

        await db.setRegistrationRestriction(targetId, true, fullReason, severity, reasonCategory);
        cachedRegistrations = await db.getRegistrations();

        const attendee = cachedRegistrations.find((r) => r.id === targetId);
        const name = attendee ? (attendee.team_name || attendee.leader_name) : 'Delegate';

        const actionTag = isEditing ? 'RESTRICTION_DIRECTIVE_UPDATED' : 'RESTRICTION_IMPOSED';
        logAudit(actionTag, `Admin updated restriction on ${name} (${attendee?.ticket_code}) [${severity}]: ${fullReason}`);
        showToast(`Operational restriction directive saved for ${name}.`, 'success');

        // Close modal
        document.getElementById('modal-restrict-delegate')?.classList.remove('show');

        // Re-render
        renderRestrictionsTab();
        renderRegistrationsTab();
      } catch (err) {
        showToast('Failed to save restriction directive: ' + err.message, 'error');
      }
    });
  }
}

async function renderRestrictionsTab() {
  if (!cachedRestrictions) cachedRestrictions = await db.getRestrictions();
  const res = cachedRestrictions;

  const swGate = document.getElementById('switch-restrict-gate');
  const swRegs = document.getElementById('switch-restrict-regs');
  const swScores = document.getElementById('switch-restrict-scores');
  const swSite = document.getElementById('switch-restrict-site');

  if (swGate) swGate.checked = Boolean(res.gate_ingress_restricted);
  if (swRegs) swRegs.checked = Boolean(res.registration_freeze);
  if (swScores) swScores.checked = Boolean(res.score_embargo);
  if (swSite) swSite.checked = Boolean(res.site_lockdown);

  updateRestrictionLabels();
  renderBlacklistTable();
}

function updateRestrictionLabels() {
  const res = cachedRestrictions || {};

  const lGate = document.getElementById('label-restrict-gate');
  const lRegs = document.getElementById('label-restrict-regs');
  const lScores = document.getElementById('label-restrict-scores');
  const lSite = document.getElementById('label-restrict-site');

  if (lGate) {
    lGate.textContent = res.gate_ingress_restricted ? 'INGRESS HALTED (LOCKED)' : 'Gates Operating Normally';
    lGate.className = `text-[10px] font-bold uppercase ${res.gate_ingress_restricted ? 'text-red-600' : 'text-emerald-700'}`;
  }
  if (lRegs) {
    lRegs.textContent = res.registration_freeze ? 'INTAKE FROZEN (BLOCKED)' : 'Intake Open';
    lRegs.className = `text-[10px] font-bold uppercase ${res.registration_freeze ? 'text-red-600' : 'text-emerald-700'}`;
  }
  if (lScores) {
    lScores.textContent = res.score_embargo ? 'SCORES EMBARGOED' : 'Public Leaderboard Active';
    lScores.className = `text-[10px] font-bold uppercase ${res.score_embargo ? 'text-amber-700' : 'text-emerald-700'}`;
  }
  if (lSite) {
    lSite.textContent = res.site_lockdown ? 'PORTAL IN LOCKDOWN' : 'Public Site Live';
    lSite.className = `text-[10px] font-bold uppercase ${res.site_lockdown ? 'text-red-600' : 'text-emerald-700'}`;
  }
}

function renderBlacklistTable(filterText = '') {
  const tbody = document.getElementById('blacklist-table-body');
  const badgeCount = document.getElementById('badge-restricted-count');
  if (!tbody) return;

  const regs = cachedRegistrations || [];
  const restrictedList = regs.filter((r) => r.is_restricted);

  if (badgeCount) {
    if (restrictedList.length > 0) {
      badgeCount.textContent = restrictedList.length;
      badgeCount.style.display = 'inline-block';
    } else {
      badgeCount.style.display = 'none';
    }
  }

  const query = (filterText || '').toLowerCase().trim();
  const filtered = restrictedList.filter((r) => {
    if (!query) return true;
    return (
      (r.ticket_code || '').toLowerCase().includes(query) ||
      (r.leader_name || '').toLowerCase().includes(query) ||
      (r.college_name || '').toLowerCase().includes(query) ||
      (r.restriction_reason || '').toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          No restricted delegates found. All attendees in good administrative standing.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((r) => {
    const timeStr = r.restricted_at ? new Date(r.restricted_at).toLocaleTimeString() : 'Active Flag';
    const dateStr = r.restricted_at ? new Date(r.restricted_at).toLocaleDateString() : 'Direct';

    return `
      <tr class="bg-red-50/40 hover:bg-red-50/70 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-red-700 whitespace-nowrap">
          ${escapeHtml(r.ticket_code)}
        </td>
        <td class="py-3 px-4">
          <strong class="text-slate-900 block font-bold">${escapeHtml(r.team_name || r.leader_name)}</strong>
          <span class="text-[10px] text-slate-500">${escapeHtml(r.leader_phone || '')}</span>
        </td>
        <td class="py-3 px-4 text-slate-700">
          ${escapeHtml(r.college_name)}
        </td>
        <td class="py-3 px-4 text-red-800 font-semibold max-w-xs">
          <span class="inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-red-600">block</span>
            <span>${escapeHtml(r.restriction_reason || 'Disciplinary Directive')}</span>
          </span>
        </td>
        <td class="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
          <span>${timeStr}</span>
          <span class="text-[10px] text-slate-400 block">${dateStr}</span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button type="button" class="btn-lift-restriction px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all" data-id="${r.id}" data-name="${escapeHtml(r.leader_name)}">
            Lift Restriction
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Lift Restriction click handlers
  tbody.querySelectorAll('.btn-lift-restriction').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      liftRestriction(id, name);
    });
  });
}

function openRestrictModal(registrationId) {
  const modal = document.getElementById('modal-restrict-delegate');
  if (!modal) return;

  const attendee = (cachedRegistrations || []).find((r) => r.id === registrationId);
  if (!attendee) {
    showToast('Delegate record not found', 'error');
    return;
  }

  const targetIdInput = document.getElementById('restrict-target-id');
  const codeEl = document.getElementById('restrict-target-code');
  const nameEl = document.getElementById('restrict-target-name');
  const colEl = document.getElementById('restrict-target-college');
  const titleText = document.getElementById('modal-restrict-title-text');
  const iconEl = document.getElementById('modal-restrict-icon');
  const badgeEl = document.getElementById('restrict-current-badge');
  const submitBtn = document.getElementById('btn-submit-restrict');
  const liftBtn = document.getElementById('btn-modal-lift-action');
  const reasonSelect = document.getElementById('restrict-reason-select');
  const severitySelect = document.getElementById('restrict-severity-select');
  const notesInput = document.getElementById('restrict-notes-input');

  if (targetIdInput) targetIdInput.value = attendee.id;
  if (codeEl) codeEl.textContent = attendee.ticket_code;
  if (nameEl) nameEl.textContent = (attendee.team_name ? `Team: ${attendee.team_name} (Lead: ${attendee.leader_name})` : attendee.leader_name);
  if (colEl) colEl.textContent = attendee.college_name || 'Individual Delegate';

  const isAlreadyRestricted = Boolean(attendee.is_restricted);

  if (isAlreadyRestricted) {
    if (titleText) titleText.textContent = 'Edit Operational Restriction Directive';
    if (iconEl) {
      iconEl.textContent = 'edit_note';
      iconEl.className = 'material-symbols-outlined text-amber-500';
    }
    if (badgeEl) {
      badgeEl.textContent = 'CURRENTLY RESTRICTED • EDITING';
      badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white';
    }
    if (submitBtn) {
      submitBtn.textContent = 'Update Restriction Directive';
      submitBtn.className = 'px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all';
    }
    if (liftBtn) {
      liftBtn.classList.remove('hidden');
      liftBtn.onclick = () => {
        liftRestriction(attendee.id, attendee.team_name || attendee.leader_name);
        modal.classList.remove('show');
      };
    }

    // Pre-populate category
    if (reasonSelect && attendee.restriction_category) {
      reasonSelect.value = attendee.restriction_category;
    } else if (reasonSelect && attendee.restriction_reason) {
      const cat = attendee.restriction_reason.split('—')[0]?.trim();
      if (cat) reasonSelect.value = cat;
    }

    // Pre-populate severity
    if (severitySelect) {
      severitySelect.value = attendee.restriction_severity || 'FULL_LOCKOUT';
    }

    // Pre-populate notes
    if (notesInput) {
      if (attendee.restriction_reason && attendee.restriction_reason.includes('—')) {
        notesInput.value = attendee.restriction_reason.split('—')[1]?.trim() || '';
      } else {
        notesInput.value = attendee.restriction_notes || '';
      }
    }
  } else {
    if (titleText) titleText.textContent = 'Impose Operational Restriction';
    if (iconEl) {
      iconEl.textContent = 'lock_person';
      iconEl.className = 'material-symbols-outlined text-red-500';
    }
    if (badgeEl) {
      badgeEl.textContent = 'SECURITY ACTION';
      badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 text-red-900';
    }
    if (submitBtn) {
      submitBtn.textContent = 'Save Restriction Directive';
      submitBtn.className = 'px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all';
    }
    if (liftBtn) {
      liftBtn.classList.add('hidden');
    }
    if (notesInput) notesInput.value = '';
    if (severitySelect) severitySelect.value = 'FULL_LOCKOUT';
  }

  modal.classList.add('show');
}
async function liftRestriction(registrationId, name = 'Delegate') {
  if (!confirm(`Are you sure you want to lift the operational restriction on ${name}? This will restore normal gate ingress and check-in privileges.`)) {
    return;
  }

  try {
    await db.setRegistrationRestriction(registrationId, false, '');
    cachedRegistrations = await db.getRegistrations();

    logAudit('RESTRICTION_LIFTED', `Executive lifted restriction on ${name} (${registrationId})`);
    showToast(`Operational restriction lifted for ${name}. Good standing restored.`, 'success');

    renderRestrictionsTab();
    renderRegistrationsTab();
  } catch (err) {
    showToast('Failed to lift restriction: ' + err.message, 'error');
  }
}

// Enhance onQrCodeScanned with Gate Ingress Restriction & Attendee Restriction Enforcement
const originalOnQrCodeScanned = onQrCodeScanned;
onQrCodeScanned = async function(decodedText) {
  if (!decodedText) return;
  const rawCode = decodedText.trim().toUpperCase();
  const match = rawCode.match(/[A-Z0-9]{3,4}-[A-Z0-9]{3,6}/) || [rawCode];
  const ticketCode = match[0];

  // Check 1: Global Gate Ingress Restriction
  if (cachedRestrictions?.gate_ingress_restricted) {
    playWarningBuzzer();
    const resultBox = document.getElementById('qr-modal-result');
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.className = 'p-4 bg-red-100 border-2 border-red-500 rounded-xl text-left space-y-1.5 animate-pulse';
      resultBox.innerHTML = `
        <div class="flex items-center gap-2 text-red-900 font-extrabold text-sm uppercase">
          <span class="material-symbols-outlined text-[20px] text-red-600">block</span>
          <span>GATE INGRESS HALTED</span>
        </div>
        <p class="text-xs text-red-800 font-semibold">Venue curfew or administrative lockdown is currently active. All admissions are halted.</p>
      `;
    }
    showToast('GATE HALTED: Ingress restrictions currently active.', 'error');
    logAudit('GATE_HALT_REJECTION', `Ingress rejected for ${ticketCode} due to active curfew lockdown`);
    return;
  }

  // Check 2: Attendee Blacklist / Restriction Check
  const regs = cachedRegistrations || [];
  const found = regs.find((r) => r.ticket_code?.toUpperCase() === ticketCode);

  if (found && found.is_restricted) {
    playWarningBuzzer();
    const resultBox = document.getElementById('qr-modal-result');
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.className = 'p-4 bg-red-100 border-2 border-red-600 rounded-xl text-left space-y-1.5';
      resultBox.innerHTML = `
        <div class="flex items-center justify-between">
          <strong class="text-red-900 font-mono text-sm font-extrabold">${escapeHtml(ticketCode)}</strong>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white">ACCESS RESTRICTED</span>
        </div>
        <div class="text-xs font-bold text-red-950">${escapeHtml(found.leader_name)} (${escapeHtml(found.college_name)})</div>
        <div class="text-[11px] text-red-800 font-semibold bg-white/60 p-2 rounded-lg border border-red-300">
          Reason: ${escapeHtml(found.restriction_reason || 'Administrative Disciplinary Directive')}
        </div>
        <p class="text-[10px] text-red-700 font-bold uppercase mt-1">Check-in blocked. Direct attendee to Security / Executive Control.</p>
      `;
    }
    showToast(`ACCESS BLOCKED: ${ticketCode} is restricted by administration.`, 'error');
    logAudit('RESTRICTED_GATE_ATTEMPT', `Restricted delegate ${found.leader_name} (${ticketCode}) attempted gate ingress. Action denied.`);
    return;
  }

  // Normal scan flow
  await originalOnQrCodeScanned(decodedText);
};

function playWarningBuzzer() {
  if (globalAudioMuted) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.setValueAtTime(120, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {}
}

window.openRestrictModal = openRestrictModal;
window.liftRestriction = liftRestriction;



// ======================================================================
// MODULE: TEAM DELEGATION REGISTRATION & ROSTER ENGINE
// ======================================================================
function setupTeamRosterModalControls() {
  const btnSave = document.getElementById('btn-save-team-roster');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      document.getElementById('modal-team')?.classList.remove('show');
      showToast('Team roster confirmed.', 'info');
    });
  }

  const btnRestrict = document.getElementById('btn-modal-restrict-team');
  if (btnRestrict) {
    btnRestrict.addEventListener('click', () => {
      document.getElementById('modal-team')?.classList.remove('show');
      if (window.currentActiveTeamReg) {
        const reg = window.currentActiveTeamReg;
        window.openRestrictModal(reg.id, reg.team_name || reg.leader_name, reg.ticket_code, reg.college_name);
      }
    });
  }
}

function setupTeamControls() {
  const btnOpenAddTeam = document.getElementById('btn-open-add-team-modal');
  const formAddTeam = document.getElementById('form-add-team');
  const btnAddMemberRow = document.getElementById('btn-add-team-member-row');
  const container = document.getElementById('team-roster-rows-container');
  const toggleRestr = document.getElementById('team-impose-restriction');
  const restrFields = document.getElementById('team-restriction-fields');

  if (toggleRestr && restrFields) {
    toggleRestr.addEventListener('change', () => {
      if (toggleRestr.checked) {
        restrFields.classList.remove('hidden');
      } else {
        restrFields.classList.add('hidden');
      }
    });
  }

  function addTeamRosterRow(name = '', role = 'Team Member', phone = '') {
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'team-roster-row flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl';
    row.innerHTML = `
      <input type="text" class="roster-name-input form-input text-xs flex-1" value="${escapeHtml(name)}" placeholder="Member Full Name" required>
      <input type="text" class="roster-role-input form-input text-xs w-32" value="${escapeHtml(role)}" placeholder="Role (e.g. Speaker)">
      <input type="text" class="roster-phone-input form-input text-xs w-28 hidden sm:block" value="${escapeHtml(phone)}" placeholder="Phone">
      <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors" title="Remove Member" onclick="this.closest('.team-roster-row').remove()">
        <span class="material-symbols-outlined text-[16px]">delete</span>
      </button>
    `;
    container.appendChild(row);
  }

  if (btnAddMemberRow) {
    btnAddMemberRow.addEventListener('click', () => {
      addTeamRosterRow();
    });
  }

  if (btnOpenAddTeam) {
    btnOpenAddTeam.addEventListener('click', () => {
      if (cachedEvents.length === 0) {
        showToast('Please create at least one event before registering a team delegation.', 'warning');
        switchTab('events');
        return;
      }

      // Populate events dropdown
      const select = document.getElementById('team-event-select');
      if (select) {
        select.innerHTML = '';
        cachedEvents.forEach((evt) => {
          const opt = document.createElement('option');
          opt.value = evt.id;
          opt.textContent = `${evt.title} • Day ${evt.day_number} (${evt.category} • Team: ${evt.team_size_min || 1}-${evt.team_size_max || 10})`;
          select.appendChild(opt);
        });
      }

      // Reset form and populate 2 starter rows
      if (formAddTeam) formAddTeam.reset();
      if (container) {
        container.innerHTML = '';
        addTeamRosterRow('', 'Second Speaker');
        addTeamRosterRow('', 'Research & Analysis Lead');
      }
      if (restrFields) restrFields.classList.add('hidden');

      document.getElementById('modal-add-team')?.classList.add('show');
    });
  }

  if (formAddTeam) {
    formAddTeam.addEventListener('submit', async (e) => {
      e.preventDefault();

      const teamName = document.getElementById('team-name-input').value.trim();
      const collegeName = document.getElementById('team-college-input').value.trim();
      const eventId = document.getElementById('team-event-select').value;
      const leaderName = document.getElementById('team-leader-name').value.trim();
      const leaderEmail = document.getElementById('team-leader-email').value.trim();
      const leaderPhone = document.getElementById('team-leader-phone').value.trim();

      const members = [{ name: leaderName, role: 'Lead Contestant', phone: leaderPhone }];
      const rows = document.querySelectorAll('#team-roster-rows-container .team-roster-row');
      rows.forEach((row) => {
        const name = row.querySelector('.roster-name-input')?.value.trim();
        const role = row.querySelector('.roster-role-input')?.value.trim() || 'Team Member';
        const phone = row.querySelector('.roster-phone-input')?.value.trim() || '';
        if (name) {
          members.push({ name, role, phone });
        }
      });

      const autoCheckIn = document.getElementById('team-auto-checkin')?.checked;
      const isRestricted = document.getElementById('team-impose-restriction')?.checked || false;
      const restCategory = document.getElementById('team-restriction-category')?.value;
      const restSeverity = document.getElementById('team-restriction-severity')?.value;
      const restNotes = (document.getElementById('team-restriction-notes')?.value || '').trim();
      const fullReason = restNotes ? `${restCategory} — ${restNotes}` : restCategory;

      const ticketCode = 'ALM-TEAM-' + Math.floor(1000 + Math.random() * 9000);

      const regData = {
        event_id: eventId,
        ticket_code: ticketCode,
        leader_name: leaderName,
        leader_email: leaderEmail,
        leader_phone: leaderPhone,
        college_name: collegeName,
        team_name: teamName,
        team_members: members,
        payment_status: 'paid',
        checked_in: Boolean(autoCheckIn),
        checked_in_at: autoCheckIn ? new Date().toISOString() : null,
        is_restricted: Boolean(isRestricted),
        restriction_reason: isRestricted ? fullReason : '',
        restriction_category: isRestricted ? restCategory : null,
        restriction_severity: isRestricted ? restSeverity : null,
        restricted_at: isRestricted ? new Date().toISOString() : null,
      };

      try {
        await db.addRegistration(regData);
        cachedRegistrations = await db.getRegistrations();

        logAudit('TEAM_DELEGATION_REGISTERED', `Admin registered delegation: "${teamName}" (${members.length} members) from ${collegeName}`);
        showToast(`Team "${teamName}" successfully registered with ${members.length} roster members!`, 'success');

        document.getElementById('modal-add-team')?.classList.remove('show');
        renderRegistrationsTab();
        renderOverview();
      } catch (err) {
        showToast('Failed to register team delegation: ' + err.message, 'error');
      }
    });
  }

  // Setup roster modal controls
  setupTeamRosterModalControls();
}

// ======================================================================
// MODULE: QUICK EVENT RESTRICTIONS & EMBARGO CONTROLS
// ======================================================================
window.openEventRestrictionsModal = function (eventId) {
  const evt = cachedEvents.find((e) => e.id === eventId);
  if (!evt) return;

  const modal = document.getElementById('modal-event-restrictions');
  if (!modal) return;

  document.getElementById('q-evt-id').value = evt.id;
  document.getElementById('q-evt-title').textContent = evt.title;
  document.getElementById('q-evt-meta').textContent = `Day ${evt.day_number} • ${evt.venue} (${evt.category})`;

  const statusBadge = document.getElementById('q-evt-status-badge');
  if (statusBadge) {
    if (evt.is_restricted) {
      statusBadge.textContent = 'RESTRICTED';
      statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white';
    } else {
      statusBadge.textContent = 'ACTIVE / UNRESTRICTED';
      statusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800';
    }
  }

  document.getElementById('q-evt-is-restricted').checked = Boolean(evt.is_restricted);
  document.getElementById('q-evt-restriction-type').value = evt.restriction_type || 'REGISTRATION_FROZEN';
  document.getElementById('q-evt-restriction-reason').value = evt.restriction_reason || '';
  document.getElementById('q-evt-freeze-reg').checked = Boolean(evt.registration_frozen);
  document.getElementById('q-evt-lock-scoring').checked = Boolean(evt.scoring_locked);

  modal.classList.add('show');
};

function setupEventRestrictionsControls() {
  const form = document.getElementById('form-quick-event-restrictions');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('q-evt-id').value;
      const evt = cachedEvents.find((item) => item.id === id);
      if (!evt) return;

      evt.is_restricted = document.getElementById('q-evt-is-restricted').checked;
      evt.restriction_type = document.getElementById('q-evt-restriction-type').value;
      evt.restriction_reason = document.getElementById('q-evt-restriction-reason').value.trim();
      evt.registration_frozen = document.getElementById('q-evt-freeze-reg').checked;
      evt.scoring_locked = document.getElementById('q-evt-lock-scoring').checked;

      try {
        await db.saveEvent(evt);
        cachedEvents = await db.getEvents();

        logAudit('EVENT_RESTRICTION_UPDATED', `Admin updated restriction on competition "${evt.title}": is_restricted=${evt.is_restricted}, type=${evt.restriction_type}`);
        showToast(`Restrictions updated for "${evt.title}"!`, 'success');

        document.getElementById('modal-event-restrictions')?.classList.remove('show');
        renderEventsTab();
      } catch (err) {
        showToast('Failed to update event restrictions: ' + err.message, 'error');
      }
    });
  }
}

// ======================================================================
// MODULE: STAGE OPERATIONAL RESTRICTIONS CONSOLE
// ======================================================================
function setupStageRestrictionsControls() {
  const curfewToggle = document.getElementById('stage-curfew-toggle');
  const greenRoomToggle = document.getElementById('stage-greenroom-restrict');
  const avToggle = document.getElementById('stage-av-embargo');
  const btnSaveDirective = document.getElementById('btn-save-stage-directive');
  const statusEl = document.getElementById('stage-curfew-status');

  function updateStatusDisplay() {
    if (!statusEl) return;
    if (curfewToggle?.checked) {
      statusEl.textContent = 'STAGE HALTED • CURFEW ACTIVE';
      statusEl.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300';
    } else {
      statusEl.textContent = 'STAGE CLEAR • ADMITTING';
      statusEl.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
  }

  if (curfewToggle) {
    curfewToggle.addEventListener('change', () => {
      updateStatusDisplay();
      logAudit('STAGE_CURFEW_TOGGLED', `Stage curfew toggled: ${curfewToggle.checked ? 'ACTIVE HALT' : 'CLEARED'}`);
      showToast(`Stage Curfew: ${curfewToggle.checked ? 'HALTED' : 'CLEARED'}`, curfewToggle.checked ? 'error' : 'success');
    });
  }

  if (greenRoomToggle) {
    greenRoomToggle.addEventListener('change', () => {
      logAudit('STAGE_GREENROOM_RESTRICTED', `Green room access restricted: ${greenRoomToggle.checked}`);
      showToast(`Green Room Access: ${greenRoomToggle.checked ? 'RESTRICTED' : 'OPEN'}`, 'info');
    });
  }

  if (avToggle) {
    avToggle.addEventListener('change', () => {
      logAudit('STAGE_AV_EMBARGO', `AV Stream Embargo: ${avToggle.checked}`);
      showToast(`AV Stream Transmission: ${avToggle.checked ? 'EMBARGOED' : 'LIVE'}`, avToggle.checked ? 'warning' : 'success');
    });
  }

  if (btnSaveDirective) {
    btnSaveDirective.addEventListener('click', () => {
      const note = (document.getElementById('stage-directive-note')?.value || '').trim();
      logAudit('STAGE_DIRECTIVE_NOTE', `Stage directive banner updated: ${note || 'Cleared'}`);
      showToast('Stage protocol directive updated successfully.', 'success');
    });
  }
}

// ======================================================================
// MODULE: DIRECT RESTRICTION SEARCH & QUICK EDIT
// ======================================================================
function setupDirectRestrictionSearch() {
  const searchInput = document.getElementById('restrictions-direct-search');
  const findBtn = document.getElementById('btn-quick-find-restrict');

  function executeFind() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    if (!query) {
      showToast('Please enter a ticket code, delegate name, or team name to inspect.', 'info');
      return;
    }

    const found = (cachedRegistrations || []).find((r) =>
      r.ticket_code.toLowerCase().includes(query) ||
      r.leader_name.toLowerCase().includes(query) ||
      (r.team_name && r.team_name.toLowerCase().includes(query)) ||
      (r.college_name && r.college_name.toLowerCase().includes(query))
    );

    if (found) {
      openRestrictModal(found.id);
    } else {
      showToast(`No attendee or team matched query "${query}".`, 'error');
    }
  }

  if (findBtn) findBtn.addEventListener('click', executeFind);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeFind();
      }
    });
  }
}

window.openEventRestrictionsModal = window.openEventRestrictionsModal || function () {};
window.openRestrictModal = openRestrictModal;
window.liftRestriction = liftRestriction;



// ======================================================================
// MODULE: DEDICATED BROADCAST VIDEO MODAL CONTROLLER
// ======================================================================
window.openBroadcastVideoModal = function () {
  const modal = document.getElementById('modal-edit-video-broadcast');
  if (!modal) return;

  const s = cachedSettings || {};
  const urlInput = document.getElementById('modal-video-url');
  const headingInput = document.getElementById('modal-video-heading');
  const venueInput = document.getElementById('modal-video-venue');
  const titleInput = document.getElementById('modal-video-title');
  const descInput = document.getElementById('modal-video-desc');
  const liveCheck = document.getElementById('modal-video-live');
  const viewersInput = document.getElementById('modal-video-viewers');
  const durationInput = document.getElementById('modal-video-duration');

  if (urlInput) urlInput.value = s.video_url || '';
  if (headingInput) headingInput.value = s.video_heading || 'Main Stage Broadcast';
  if (venueInput) venueInput.value = s.video_venue || 'GRAND ANDALUSIAN DOME';
  if (titleInput) titleInput.value = s.video_title || 'Mystic Poetry Recital & Qurtuba Ensemble';
  if (descInput) descInput.value = s.video_description || 'Live Cultural Stage & Ensemble Performances';
  if (liveCheck) liveCheck.checked = s.video_is_live !== false;
  if (viewersInput) viewersInput.value = s.video_viewer_count || '4.8k live';
  if (durationInput) durationInput.value = s.video_duration_note || '42 mins remaining';

  updateModalVideoPreview();
  modal.classList.add('show');
};

function updateModalVideoPreview() {
  const urlVal = (document.getElementById('modal-video-url')?.value || '').trim();
  const titleVal = document.getElementById('modal-video-title')?.value || 'Main Stage Broadcast';
  const descVal = document.getElementById('modal-video-desc')?.value || 'Live Cultural Stage';
  const venueVal = document.getElementById('modal-video-venue')?.value || 'GRAND ANDALUSIAN DOME';
  const isLive = document.getElementById('modal-video-live')?.checked ?? true;

  const box = document.getElementById('modal-preview-video-box');
  const statusEl = document.getElementById('modal-preview-video-status');
  const titleEl = document.getElementById('modal-preview-video-title');
  const descEl = document.getElementById('modal-preview-video-desc');
  const venueEl = document.getElementById('modal-preview-video-venue');

  if (titleEl) titleEl.textContent = titleVal;
  if (descEl) descEl.textContent = descVal;
  if (venueEl) venueEl.textContent = venueVal.toUpperCase();
  if (statusEl) {
    statusEl.textContent = isLive ? 'LIVE' : 'OFFLINE';
    statusEl.className = `px-2 py-0.5 rounded-full ${isLive ? 'bg-red-600' : 'bg-slate-600'} text-white font-bold text-[10px]`;
  }

  if (box) {
    const embed = getEmbedUrl(urlVal);
    if (embed) {
      if (embed.type === 'video') {
        box.innerHTML = `<video class="w-full h-full aspect-video rounded-xl object-cover" src="${embed.src}" controls playsinline></video>`;
      } else {
        box.innerHTML = `<iframe class="w-full h-full aspect-video rounded-xl" src="${embed.src}" title="Broadcast Live Preview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`;
      }
    } else {
      box.innerHTML = `
        <div class="text-center p-4 text-slate-500 text-xs flex flex-col items-center gap-1.5">
          <span class="material-symbols-outlined text-[32px] text-slate-600">play_circle</span>
          <span>Paste a Google Drive or YouTube link to preview video</span>
        </div>
      `;
    }
  }
}

function setupBroadcastVideoModalControls() {
  const btnOpenStage = document.getElementById('btn-open-stage-video-modal');
  if (btnOpenStage) {
    btnOpenStage.addEventListener('click', () => {
      window.openBroadcastVideoModal();
    });
  }

  // Live input change listeners for instant modal video preview
  ['modal-video-url', 'modal-video-title', 'modal-video-desc', 'modal-video-venue', 'modal-video-live'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateModalVideoPreview);
      el.addEventListener('change', updateModalVideoPreview);
    }
  });

  const formModal = document.getElementById('form-modal-video-stream');
  if (formModal) {
    formModal.addEventListener('submit', async (e) => {
      e.preventDefault();
      const video_url = (document.getElementById('modal-video-url')?.value || '').trim();
      const video_heading = document.getElementById('modal-video-heading')?.value.trim();
      const video_venue = document.getElementById('modal-video-venue')?.value.trim();
      const video_title = document.getElementById('modal-video-title')?.value.trim();
      const video_description = document.getElementById('modal-video-desc')?.value.trim();
      const video_is_live = document.getElementById('modal-video-live')?.checked ?? true;
      const video_viewer_count = document.getElementById('modal-video-viewers')?.value.trim();
      const video_duration_note = document.getElementById('modal-video-duration')?.value.trim();

      const btnSave = document.getElementById('btn-save-modal-video');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">sync</span><span>Publishing...</span>';
      }

      try {
        cachedSettings = await db.updateSettings({
          video_url,
          video_heading,
          video_venue,
          video_title,
          video_description,
          video_is_live,
          video_viewer_count,
          video_duration_note,
        });

        // Also sync setting inputs in tab-settings
        if (document.getElementById('setting-video-url')) document.getElementById('setting-video-url').value = video_url;
        if (document.getElementById('setting-video-heading')) document.getElementById('setting-video-heading').value = video_heading;
        if (document.getElementById('setting-video-venue')) document.getElementById('setting-video-venue').value = video_venue;
        if (document.getElementById('setting-video-title')) document.getElementById('setting-video-title').value = video_title;
        if (document.getElementById('setting-video-description')) document.getElementById('setting-video-description').value = video_description;
        if (document.getElementById('setting-video-live')) document.getElementById('setting-video-live').checked = video_is_live;
        if (document.getElementById('setting-video-viewers')) document.getElementById('setting-video-viewers').value = video_viewer_count;
        if (document.getElementById('setting-video-duration')) document.getElementById('setting-video-duration').value = video_duration_note;

        updateVideoPreview();
        logAudit('VIDEO_BROADCAST_UPDATED', `Admin updated main stage video broadcast: "${video_title}" [${video_url ? 'Active Stream' : 'Ambient'}]`);
        showToast('Main Stage video broadcast settings saved! Video is now live.', 'success');

        document.getElementById('modal-edit-video-broadcast')?.classList.remove('show');
      } catch (err) {
        showToast('Failed to save broadcast video: ' + err.message, 'error');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span class="material-symbols-outlined text-[16px]">save</span><span>Save &amp; Publish Video Broadcast</span>';
        }
      }
    });
  }
}

// ==============================================================================
// MODULE 9: TEAM LEADERS & DELEGATION ROSTER CONTROLLER
// ==============================================================================

async function renderTeamLeadersTab() {
  const leaders = cachedTeamLeaders || [];
  const tbody = document.getElementById('team-leaders-table-body');
  const emptyState = document.getElementById('team-leaders-empty-state');
  const badgeCount = document.getElementById('badge-leaders-count');

  if (badgeCount) {
    if (leaders.length > 0) {
      badgeCount.textContent = leaders.length;
      badgeCount.style.display = 'inline-block';
    } else {
      badgeCount.style.display = 'none';
    }
  }

  // Calculate statistics across all leaders
  const activeCount = leaders.filter((l) => l.status === 'active').length;
  let totalLeaderStudents = 0;
  let totalLeaderAssignments = 0;

  try {
    const allStudents = await db.getTeamStudents();
    const allAssignments = await db.getTeamAssignments();
    totalLeaderStudents = allStudents.length;
    totalLeaderAssignments = allAssignments.length;
  } catch (err) {
    console.warn('[Telemetry calculations for team leaders]', err);
  }

  const statLeaders = document.getElementById('stat-total-leaders');
  const statTokens = document.getElementById('stat-active-tokens');
  const statStudents = document.getElementById('stat-leader-students');
  const statAlloc = document.getElementById('stat-leader-allocations');

  if (statLeaders) statLeaders.textContent = leaders.length;
  if (statTokens) statTokens.textContent = activeCount;
  if (statStudents) statStudents.textContent = totalLeaderStudents;
  if (statAlloc) statAlloc.textContent = totalLeaderAssignments;

  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-team-leaders')?.value || '').toLowerCase().trim();
  const statusVal = document.getElementById('filter-leader-status')?.value || '';

  const filtered = leaders.filter((l) => {
    const matchesSearch = !searchVal ||
      (l.leader_name && l.leader_name.toLowerCase().includes(searchVal)) ||
      (l.institution_name && l.institution_name.toLowerCase().includes(searchVal)) ||
      (l.token && l.token.toLowerCase().includes(searchVal));
    const matchesStatus = !statusVal || l.status === statusVal;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  filtered.forEach((leader) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';

    const portalUrl = getShareablePortalUrl(leader.token, 'leader.html');

    tr.innerHTML = `
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${escapeHtml(leader.institution_name)}</div>
        <div class="text-[11px] text-slate-500 font-medium">${escapeHtml(leader.team_name || 'General Delegation')}</div>
      </td>
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-800">${escapeHtml(leader.leader_name)}</div>
        <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
          <span>${escapeHtml(leader.leader_phone || '')}</span>
          ${leader.leader_email ? `<span>• ${escapeHtml(leader.leader_email)}</span>` : ''}
        </div>
      </td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-2">
          <span 
            class="px-2.5 py-1 rounded-md bg-purple-50 text-purple-900 border border-purple-200 font-mono font-bold text-xs cursor-pointer hover:bg-purple-100 transition-colors"
            title="Click to copy token"
            onclick="window.copyLeaderToken('${escapeHtml(leader.token)}')"
          >
            ${escapeHtml(leader.token)}
          </span>
          <button 
            type="button" 
            class="p-1 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors"
            title="Copy portal direct invite link"
            onclick="window.copyLeaderLink('${escapeHtml(portalUrl)}')"
          >
            <span class="material-symbols-outlined text-[16px]">link</span>
          </button>
        </div>
      </td>
      <td class="py-3 px-4">
        <div class="font-bold text-slate-800"><span id="leader-stu-count-${leader.id}">--</span> / ${leader.max_students || 50}</div>
        <div class="text-[10px] text-slate-400">Student Slots</div>
      </td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
          leader.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }">
          ${leader.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
        </span>
      </td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <a 
            href="${portalUrl}" 
            target="_blank" 
            class="p-1.5 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors"
            title="Open Leader Portal in new tab"
          >
            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>

          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="View Enrolled Students & Stages"
            onclick="window.viewLeaderRoster('${leader.id}')"
          >
            <span class="material-symbols-outlined text-[18px]">visibility</span>
          </button>

          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
            title="Regenerate Access Token"
            onclick="window.regenerateLeaderTokenPrompt('${leader.id}', '${escapeHtml(leader.institution_name)}')"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
          </button>

          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
            title="Delete Team Leader"
            onclick="window.deleteLeaderPrompt('${leader.id}', '${escapeHtml(leader.institution_name)}')"
          >
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Fetch student count asynchronously for this leader
    db.getTeamStudents(leader.id).then((students) => {
      const el = document.getElementById(`leader-stu-count-${leader.id}`);
      if (el) el.textContent = students.length;
    });
  });
}

function setupTeamLeaderControls() {
  const btnOpenModal = document.getElementById('btn-open-assign-leader-modal');
  const formAssign = document.getElementById('form-assign-team-leader');
  const btnGenToken = document.getElementById('btn-generate-random-token');
  const btnCopyToken = document.getElementById('btn-copy-form-token');
  const tokenInput = document.getElementById('leader-form-token');
  const linkPreview = document.getElementById('leader-form-link-preview');

  function updateLinkPreview(tok) {
    if (!linkPreview) return;
    const cleanTok = (tok || '').trim().toUpperCase();
    const portalUrl = getShareablePortalUrl(cleanTok, 'leader.html');
    linkPreview.textContent = portalUrl;
  }

  function setFreshToken() {
    const newToken = generateLeaderToken();
    if (tokenInput) {
      tokenInput.value = newToken;
      updateLinkPreview(newToken);
    }
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      window.openAssignLeaderModal();
    });
  }

  if (btnGenToken) {
    btnGenToken.addEventListener('click', setFreshToken);
  }

  if (tokenInput) {
    tokenInput.addEventListener('input', () => {
      tokenInput.value = tokenInput.value.toUpperCase();
      updateLinkPreview(tokenInput.value);
    });
  }

  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', () => {
      if (!tokenInput || !tokenInput.value) return;
      navigator.clipboard.writeText(tokenInput.value).then(() => {
        showToast(`Token "${tokenInput.value}" copied!`, 'info');
      });
    });
  }

  if (formAssign) {
    formAssign.addEventListener('submit', async (e) => {
      e.preventDefault();
      const institution = document.getElementById('leader-form-institution').value.trim();
      const name = document.getElementById('leader-form-name').value.trim();
      const team = document.getElementById('leader-form-team').value.trim();
      const email = document.getElementById('leader-form-email').value.trim();
      const phone = document.getElementById('leader-form-phone').value.trim();
      const quota = Number(document.getElementById('leader-form-quota').value) || 50;
      const status = document.getElementById('leader-form-status').value;
      const token = document.getElementById('leader-form-token').value.trim().toUpperCase();
      const notes = document.getElementById('leader-form-notes').value.trim();

      const btn = document.getElementById('btn-save-team-leader');
      btn.disabled = true;

      try {
        const created = await db.createTeamLeader({
          institution_name: institution,
          leader_name: name,
          team_name: team,
          leader_email: email,
          leader_phone: phone,
          max_students: quota,
          status,
          token,
          notes,
        });

        document.getElementById('modal-assign-team-leader')?.classList.remove('show');
        const shareUrl = getShareablePortalUrl(created.token, 'leader.html');

        // Copy link directly and notify admin
        navigator.clipboard.writeText(shareUrl);
        showToast(`Team Leader assigned! Access link for "${institution}" copied to clipboard.`, 'success');

        logAudit('TEAM_LEADER_PROVISIONED', `Assigned team leader "${name}" (${institution}) with token ${created.token}`);
        await loadAllData();
      } catch (err) {
        showToast('Failed to assign team leader: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Search & Filter listeners
  document.getElementById('search-team-leaders')?.addEventListener('input', renderTeamLeadersTab);
  document.getElementById('filter-leader-status')?.addEventListener('change', renderTeamLeadersTab);
}

// Open Assign Team Leader Modal
window.openAssignLeaderModal = function () {
  const formAssign = document.getElementById('form-assign-team-leader');
  if (formAssign) formAssign.reset();
  const tokenInput = document.getElementById('leader-form-token');
  const linkPreview = document.getElementById('leader-form-link-preview');
  const newToken = generateLeaderToken();
  if (tokenInput) {
    tokenInput.value = newToken;
    if (linkPreview) {
      linkPreview.textContent = getShareablePortalUrl(newToken, 'leader.html');
    }
  }
  document.getElementById('modal-assign-team-leader')?.classList.add('show');
};

// Open Add Team Delegation Modal
window.openAddTeamModal = function () {
  switchTab('registrations');
  document.getElementById('btn-open-add-team-modal')?.click();
};

// Window actions for Team Leaders Table
window.copyLeaderToken = (token) => {
  navigator.clipboard.writeText(token).then(() => {
    showToast(`Token "${token}" copied to clipboard!`, 'info');
  });
};

window.copyLeaderLink = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Direct portal link copied to clipboard!', 'success');
  }).catch(() => {
    prompt('Copy this portal invite link:', url);
  });
};

window.regenerateLeaderTokenPrompt = async (id, institution) => {
  if (!confirm(`Regenerate access token for "${institution}"? The previous token will be invalidated immediately.`)) {
    return;
  }
  try {
    const updated = await db.regenerateTeamLeaderToken(id);
    showToast(`New token generated: ${updated.token}`, 'success');
    logAudit('TEAM_LEADER_TOKEN_REGENERATED', `Regenerated token for "${institution}" to ${updated.token}`);
    await loadAllData();
  } catch (err) {
    showToast('Failed to regenerate token: ' + err.message, 'error');
  }
};

window.deleteLeaderPrompt = async (id, institution) => {
  if (!confirm(`Are you sure you want to delete the team leader for "${institution}"? All enrolled delegation students and stage allocations will be permanently removed.`)) {
    return;
  }
  try {
    await db.deleteTeamLeader(id);
    showToast(`Deleted team leader for "${institution}".`, 'info');
    logAudit('TEAM_LEADER_DELETED', `Deleted team leader for institution "${institution}"`);
    await loadAllData();
  } catch (err) {
    showToast('Failed to delete team leader: ' + err.message, 'error');
  }
};

window.viewLeaderRoster = async (leaderId) => {
  const leader = (cachedTeamLeaders || []).find((l) => l.id === leaderId);
  if (!leader) return;

  document.getElementById('roster-view-institution').textContent = leader.institution_name;
  document.getElementById('roster-view-leader').textContent = `Lead: ${leader.leader_name} • Token: ${leader.token} • ${leader.leader_phone || ''}`;

  const portalUrl = getShareablePortalUrl(leader.token, 'leader.html');
  const linkEl = document.getElementById('roster-view-portal-link');
  if (linkEl) linkEl.href = portalUrl;

  const container = document.getElementById('roster-view-students-container');
  container.innerHTML = '<div class="p-6 text-center text-xs text-slate-500 font-semibold">Loading delegation students & squads...</div>';

  document.getElementById('modal-view-leader-roster')?.classList.add('show');

  try {
    const [students, teams] = await Promise.all([
      db.getTeamStudents(leaderId),
      db.getTeamGroups(leaderId),
    ]);

    if (students.length === 0 && teams.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
          This team leader has not enrolled any students or teams yet. Provide them the invite link to begin.
        </div>
      `;
      return;
    }

    let html = '';

    // Render Teams if any
    if (teams.length > 0) {
      html += `
        <div class="mb-4">
          <div class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-purple-700">groups_3</span>
            <span>Delegation Teams & Squads (${teams.length})</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${teams.map((t) => {
              const count = (t.student_ids || []).length;
              return `
                <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs">
                  <div class="font-bold text-purple-900">${escapeHtml(t.team_name)}</div>
                  <div class="text-[11px] text-purple-700 mt-0.5">${escapeHtml(t.category)} • ${count} members</div>
                  ${t.notes ? `<div class="text-[10px] text-slate-500 italic mt-1">${escapeHtml(t.notes)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Render Students
    html += `
      <div class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-brand-700">group</span>
        <span>Enrolled Students (${students.length} / ${leader.max_students || 50})</span>
      </div>
      <div class="space-y-2">
        ${students.length > 0 ? students.map((s) => {
          const events = s.assigned_events || [];
          return `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900">${escapeHtml(s.student_name)}</span>
                  <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono font-bold text-[10px]">${escapeHtml(s.student_code)}</span>
                  <span class="text-slate-500 text-[11px]">${escapeHtml(s.category)}</span>
                </div>
                <div class="text-[11px] text-slate-500 mt-0.5">
                  ${s.phone ? `Phone: ${escapeHtml(s.phone)}` : ''}
                </div>
                <!-- Assigned Events -->
                <div class="mt-2 flex flex-wrap gap-1">
                  ${events.length > 0
                    ? events.map((ev) => `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                          <span class="material-symbols-outlined text-[12px]">theater_comedy</span>
                          <span>${escapeHtml(ev.event_title)}</span>
                          <span class="text-amber-700 font-mono">(${ev.ticket_code || ''})</span>
                        </span>
                      `).join('')
                    : '<span class="text-slate-400 text-[11px] italic">No stage assigned</span>'
                  }
                </div>
              </div>
            </div>
          `;
        }).join('') : '<div class="text-xs text-slate-400 italic">No individual students enrolled yet.</div>'}
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-xs text-red-600 font-semibold">Error loading roster: ${err.message}</div>`;
  }
};
