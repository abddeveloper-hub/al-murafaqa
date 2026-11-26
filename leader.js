// ==============================================================================
// AL MURAFAQA • QUINTA EDICION — TEAM LEADER PORTAL CONTROLLER (leader.js)
// Vanilla ES Module with Token Access, Student Roster & Programme Allocation Desk
// ==============================================================================

import { db, isConfigured, getShareablePortalUrl } from './supabase-config.js';

// Global Controller State
let activeLeader = null;
let cachedStudents = [];
let cachedEvents = [];
let cachedAssignments = [];
let cachedTeams = [];
let currentTab = 'students';
let activeAllocEvent = null;

// ==============================================================================
// 1. INITIALIZATION & TOKEN AUTHENTICATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkTokenFromUrlOrSession();
});

// Check if token is present in URL query string or session storage
async function checkTokenFromUrlOrSession() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || urlParams.get('t');

  if (tokenFromUrl) {
    document.getElementById('input-leader-token').value = tokenFromUrl.trim().toUpperCase();
    await authenticateWithToken(tokenFromUrl);
    return;
  }

  // Check session storage
  const storedToken = sessionStorage.getItem('almurafaqa_active_leader_token');
  if (storedToken) {
    document.getElementById('input-leader-token').value = storedToken;
    await authenticateWithToken(storedToken);
  } else {
    showAuthView();
  }
}

// Authenticate Team Leader by Token
async function authenticateWithToken(token) {
  if (!token) {
    showToast('Please enter your delegation token.', 'warning');
    return;
  }

  const cleanToken = token.trim().toUpperCase();
  const btn = document.getElementById('btn-verify-token');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Verifying Token...</span>';
  }

  try {
    const leader = await db.getTeamLeaderByToken(cleanToken);

    if (!leader) {
      throw new Error(`Token "${cleanToken}" is not recognized or has been suspended. Please check your token or contact the festival desk.`);
    }

    activeLeader = leader;
    sessionStorage.setItem('almurafaqa_active_leader_token', cleanToken);

    // Update URL without refreshing so token is bookmarkable
    const newUrl = `${window.location.pathname}?token=${encodeURIComponent(cleanToken)}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);

    showToast(`Welcome, ${leader.leader_name}! Portal unlocked for ${leader.institution_name}.`, 'success');
    showDashboardView();
    await loadDelegationData();
  } catch (err) {
    showToast(err.message || 'Authentication failed. Check your token.', 'error');
    showAuthView();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">lock_open</span><span>Authenticate &amp; Enter Portal</span>';
    }
  }
}

function showAuthView() {
  document.getElementById('view-token-auth')?.classList.remove('hidden');
  document.getElementById('view-dashboard')?.classList.add('hidden');
}

function showDashboardView() {
  document.getElementById('view-token-auth')?.classList.add('hidden');
  document.getElementById('view-dashboard')?.classList.remove('hidden');
  updateHeaderUI();
}

function updateHeaderUI() {
  if (!activeLeader) return;
  document.getElementById('header-institution-name').textContent = activeLeader.institution_name;
  document.getElementById('header-leader-name').textContent = activeLeader.leader_name;
  document.getElementById('header-team-title').textContent = activeLeader.team_name || 'Delegation Roster';
  
  const tokenChip = document.getElementById('badge-token-chip');
  if (tokenChip) {
    tokenChip.textContent = activeLeader.token;
  }
}

// ==============================================================================
// 2. DATA LOADING & TELEMETRY
// ==============================================================================

async function loadDelegationData() {
  if (!activeLeader) return;

  try {
    const [students, events, assignments, teams] = await Promise.all([
      db.getTeamStudents(activeLeader.id),
      db.getEvents(),
      db.getTeamAssignments(activeLeader.id),
      db.getTeamGroups(activeLeader.id),
    ]);

    cachedStudents = students || [];
    cachedEvents = (events || []).filter((e) => e.status !== 'closed');
    cachedAssignments = assignments || [];
    cachedTeams = teams || [];

    updateTelemetry();
    renderStudentsTable();
    renderTeamsGrid();
    renderProgrammesGrid();
    renderPrintRoster();
  } catch (err) {
    console.error('Error loading delegation data:', err);
    showToast('Error syncing delegation records: ' + err.message, 'error');
  }
}

function updateTelemetry() {
  if (!activeLeader) return;

  const count = cachedStudents.length;
  const max = activeLeader.max_students || 50;
  const percent = Math.min(100, Math.round((count / max) * 100));

  document.getElementById('metric-student-count').textContent = count;
  document.getElementById('metric-quota-total').textContent = `/ ${max} Allowed`;
  document.getElementById('metric-quota-bar').style.width = `${percent}%`;

  const assignedEventsCount = cachedAssignments.length;
  document.getElementById('metric-events-assigned').textContent = assignedEventsCount;

  document.getElementById('tab-badge-students').textContent = count;
  document.getElementById('tab-badge-programmes').textContent = assignedEventsCount;

  const tabBadgeTeams = document.getElementById('tab-badge-teams');
  if (tabBadgeTeams) tabBadgeTeams.textContent = cachedTeams.length;
}

// ==============================================================================
// 3. TAB 1: STUDENTS ROSTER DESK
// ==============================================================================

function renderStudentsTable() {
  const tbody = document.getElementById('table-students-body');
  const emptyState = document.getElementById('students-empty-state');
  if (!tbody) return;

  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-students')?.value || '').toLowerCase().trim();
  const categoryVal = document.getElementById('filter-student-category')?.value || '';

  const filtered = cachedStudents.filter((s) => {
    const matchesSearch = !searchVal || 
      s.student_name.toLowerCase().includes(searchVal) || 
      (s.student_code && s.student_code.toLowerCase().includes(searchVal)) ||
      (s.phone && s.phone.includes(searchVal));

    const matchesCat = !categoryVal || s.category === categoryVal;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  filtered.forEach((student) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition-colors';

    const eventsList = Array.isArray(student.assigned_events) ? student.assigned_events : [];
    const eventsBadges = eventsList.length > 0 
      ? eventsList.map((ev) => `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold" title="${escapeHtml(ev.event_title)} • ${ev.time_slot || ''}">
            <span class="material-symbols-outlined text-[12px] text-amber-600">verified</span>
            <span class="truncate max-w-[130px]">${escapeHtml(ev.event_title)}</span>
          </span>
        `).join('')
      : '<span class="text-slate-400 text-[11px] italic">Not assigned to any stage</span>';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-brand-700">
        ${escapeHtml(student.student_code)}
      </td>
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${escapeHtml(student.student_name)}</div>
        <div class="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
          ${student.phone ? `<span><span class="material-symbols-outlined text-[12px] align-middle">call</span> ${escapeHtml(student.phone)}</span>` : ''}
          ${student.email ? `<span><span class="material-symbols-outlined text-[12px] align-middle">mail</span> ${escapeHtml(student.email)}</span>` : ''}
        </div>
      </td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
          ${escapeHtml(student.category)}
        </span>
        <span class="text-slate-400 text-[10px] ml-1">${escapeHtml(student.gender || 'Male')}</span>
      </td>
      <td class="py-3 px-4">
        <div class="flex flex-wrap gap-1 max-w-xs">
          ${eventsBadges}
        </div>
      </td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
            title="View Digital Pass & QR Code"
            onclick="window.openStudentPassModal('${student.id}')"
          >
            <span class="material-symbols-outlined text-[18px]">badge</span>
          </button>

          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit Student Information"
            onclick="window.openEditStudentModal('${student.id}')"
          >
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>

          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
            title="Remove Student from Delegation"
            onclick="window.deleteStudentPrompt('${student.id}', '${escapeHtml(student.student_name)}')"
          >
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Student Modal: Add & Edit
function openAddStudentModal() {
  if (!activeLeader) return;

  if (cachedStudents.length >= (activeLeader.max_students || 50)) {
    showToast(`Delegation quota reached (${activeLeader.max_students} students). Contact festival administration to request extra slots.`, 'warning');
    return;
  }

  const form = document.getElementById('form-student');
  if (form) form.reset();
  document.getElementById('student-edit-id').value = '';
  document.getElementById('modal-student-title').textContent = 'Enroll New Student';

  // Suggest chest number based on institution initials
  const initials = activeLeader.institution_name.split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase() || 'COR';
  document.getElementById('student-code').value = `${initials}-${100 + cachedStudents.length + 1}`;

  document.getElementById('modal-student')?.classList.remove('hidden');
  document.getElementById('modal-student')?.classList.add('flex');
}

function openEditStudentModal(studentId) {
  const student = cachedStudents.find((s) => s.id === studentId);
  if (!student) return;

  document.getElementById('student-edit-id').value = student.id;
  document.getElementById('student-name').value = student.student_name;
  document.getElementById('student-code').value = student.student_code;
  document.getElementById('student-category').value = student.category;
  document.getElementById('student-gender').value = student.gender || 'Male';
  document.getElementById('student-phone').value = student.phone || '';
  document.getElementById('student-email').value = student.email || '';

  document.getElementById('modal-student-title').textContent = 'Edit Student Details';
  document.getElementById('modal-student')?.classList.remove('hidden');
  document.getElementById('modal-student')?.classList.add('flex');
}

async function handleSaveStudent(e) {
  e.preventDefault();
  if (!activeLeader) return;

  const editId = document.getElementById('student-edit-id').value;
  const name = document.getElementById('student-name').value.trim();
  const code = document.getElementById('student-code').value.trim().toUpperCase();
  const category = document.getElementById('student-category').value;
  const gender = document.getElementById('student-gender').value;
  const phone = document.getElementById('student-phone').value.trim();
  const email = document.getElementById('student-email').value.trim();

  const btn = document.getElementById('btn-save-student');
  btn.disabled = true;

  try {
    if (editId) {
      await db.updateTeamStudent(editId, {
        student_name: name,
        student_code: code,
        category,
        gender,
        phone,
        email,
      });
      showToast(`Student "${name}" updated successfully.`, 'success');
    } else {
      await db.addTeamStudent({
        team_leader_id: activeLeader.id,
        student_name: name,
        student_code: code,
        category,
        gender,
        phone,
        email,
      });
      showToast(`Student "${name}" enrolled in delegation.`, 'success');
    }

    closeAllModals();
    await loadDelegationData();
  } catch (err) {
    showToast('Failed to save student: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteStudentPrompt(studentId, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from this delegation? Any programme allocations for this student will also be updated.`)) {
    return;
  }

  try {
    await db.deleteTeamStudent(studentId);
    showToast(`Removed "${name}" from delegation.`, 'info');
    await loadDelegationData();
  } catch (err) {
    showToast('Error removing student: ' + err.message, 'error');
  }
}

// ==============================================================================
// 4. TAB 2: TEAMS & SQUADS DESK
// ==============================================================================

function renderTeamsGrid() {
  const container = document.getElementById('teams-grid-container');
  const emptyState = document.getElementById('teams-empty-state');
  if (!container) return;

  container.innerHTML = '';
  const searchVal = (document.getElementById('search-teams')?.value || '').toLowerCase().trim();
  const catVal = document.getElementById('filter-team-category')?.value || '';

  const filtered = cachedTeams.filter((t) => {
    const matchesSearch = !searchVal || 
      t.team_name.toLowerCase().includes(searchVal) || 
      (t.notes && t.notes.toLowerCase().includes(searchVal));
    const matchesCat = !catVal || t.category === catVal;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    container.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach((team) => {
    const memberIds = team.student_ids || [];
    const members = cachedStudents.filter((s) => memberIds.includes(s.id));
    const targetEvent = cachedEvents.find((e) => e.id === team.event_id);

    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-brand-300 transition-all';
    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              ${escapeHtml(team.category || 'General')}
            </span>
            <h3 class="text-base font-bold text-slate-900 mt-1">${escapeHtml(team.team_name)}</h3>
          </div>
          <div class="flex items-center gap-1">
            <button 
              type="button" 
              class="p-1.5 text-slate-400 hover:text-brand-700 rounded-lg transition-colors" 
              title="Edit Team" 
              onclick="window.openEditTeamModal('${team.id}')"
            >
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button 
              type="button" 
              class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors" 
              title="Delete Team" 
              onclick="window.deleteTeamPrompt('${team.id}', '${escapeHtml(team.team_name)}')"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>

        <!-- Target Event Pill -->
        <div class="mt-2.5 flex items-center gap-1 text-xs text-slate-600">
          <span class="material-symbols-outlined text-[16px] text-amber-600">theater_comedy</span>
          <span class="font-medium">${targetEvent ? escapeHtml(targetEvent.title) : 'General Squad (Flexible)'}</span>
        </div>

        <!-- Members List -->
        <div class="mt-3 pt-3 border-t border-slate-100">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>Roster Members</span>
            <span class="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">${members.length} Students</span>
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scroll pr-1">
            ${members.length > 0 ? members.map((m) => `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                <strong class="font-mono text-[10px] text-brand-800">${escapeHtml(m.student_code)}</strong>
                <span>${escapeHtml(m.student_name)}</span>
              </span>
            `).join('') : '<span class="text-xs text-slate-400 italic">No members assigned</span>'}
          </div>
        </div>

        ${team.notes ? `
          <div class="mt-2.5 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
            ${escapeHtml(team.notes)}
          </div>
        ` : ''}
      </div>

      <!-- Bottom Action -->
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <button 
          type="button" 
          class="flex-1 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          onclick="window.allocateTeamPrompt('${team.id}')"
        >
          <span class="material-symbols-outlined text-[16px]">how_to_reg</span>
          <span>Allocate to Programme</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function openAddTeamModal() {
  const form = document.getElementById('form-team-group');
  if (form) form.reset();
  document.getElementById('team-group-edit-id').value = '';
  document.getElementById('modal-team-title').textContent = 'Assemble Delegation Team / Squad';

  // Populate event dropdown
  const eventSelect = document.getElementById('team-group-event');
  if (eventSelect) {
    eventSelect.innerHTML = '<option value="">General Team (Any event)</option>';
    cachedEvents.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.title} • Day ${e.day_number} (${e.category} • Team: ${e.team_size_min || 1}-${e.team_size_max || 10})`;
      eventSelect.appendChild(opt);
    });
  }

  renderTeamStudentsChecklist([]);

  const modal = document.getElementById('modal-team-group');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function openEditTeamModal(teamId) {
  const team = cachedTeams.find((t) => t.id === teamId);
  if (!team) return;

  document.getElementById('team-group-edit-id').value = team.id;
  document.getElementById('modal-team-title').textContent = `Edit Team: ${team.team_name}`;
  document.getElementById('team-group-name').value = team.team_name || '';
  document.getElementById('team-group-category').value = team.category || 'Senior';
  document.getElementById('team-group-notes').value = team.notes || '';

  // Populate event dropdown
  const eventSelect = document.getElementById('team-group-event');
  if (eventSelect) {
    eventSelect.innerHTML = '<option value="">General Team (Any event)</option>';
    cachedEvents.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.title} • Day ${e.day_number} (${e.category} • Team: ${e.team_size_min || 1}-${e.team_size_max || 10})`;
      if (e.id === team.event_id) opt.selected = true;
      eventSelect.appendChild(opt);
    });
  }

  renderTeamStudentsChecklist(team.student_ids || []);

  const modal = document.getElementById('modal-team-group');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function renderTeamStudentsChecklist(selectedIds = []) {
  const container = document.getElementById('team-students-checklist');
  const countLabel = document.getElementById('team-selected-count-label');
  if (!container) return;

  container.innerHTML = '';

  if (cachedStudents.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-400">
        No students enrolled yet. Please add students in the Students Roster tab first.
      </div>
    `;
    if (countLabel) countLabel.textContent = '0 selected';
    return;
  }

  cachedStudents.forEach((s) => {
    const isChecked = selectedIds.includes(s.id);
    const row = document.createElement('label');
    row.className = 'flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs transition-colors';
    row.innerHTML = `
      <input 
        type="checkbox" 
        value="${s.id}" 
        class="team-member-checkbox rounded text-brand-600 focus:ring-brand-500 w-4 h-4" 
        ${isChecked ? 'checked' : ''}
      />
      <div class="flex-1 min-w-0 flex items-center justify-between">
        <span class="font-bold text-slate-900 truncate">${escapeHtml(s.student_name)}</span>
        <span class="font-mono text-[10px] font-bold text-slate-500 shrink-0 ml-2">${escapeHtml(s.student_code)} (${escapeHtml(s.category)})</span>
      </div>
    `;
    container.appendChild(row);
  });

  function updateCount() {
    const checked = container.querySelectorAll('.team-member-checkbox:checked').length;
    if (countLabel) countLabel.textContent = `${checked} selected`;
  }

  container.querySelectorAll('.team-member-checkbox').forEach((cb) => {
    cb.addEventListener('change', updateCount);
  });
  updateCount();
}

async function handleSaveTeamGroup(e) {
  e.preventDefault();
  if (!activeLeader) return;

  const editId = document.getElementById('team-group-edit-id')?.value || null;
  const name = document.getElementById('team-group-name')?.value.trim();
  const category = document.getElementById('team-group-category')?.value;
  const eventId = document.getElementById('team-group-event')?.value || null;
  const notes = document.getElementById('team-group-notes')?.value.trim();

  const checkedBoxes = document.querySelectorAll('#team-students-checklist .team-member-checkbox:checked');
  const studentIds = Array.from(checkedBoxes).map((cb) => cb.value);

  if (studentIds.length === 0) {
    showToast('Please select at least 1 student member for this team.', 'warning');
    return;
  }

  try {
    await db.saveTeamGroup({
      id: editId,
      team_leader_id: activeLeader.id,
      team_name: name,
      category: category,
      event_id: eventId,
      student_ids: studentIds,
      notes: notes,
    });

    showToast(`Team "${name}" saved with ${studentIds.length} members!`, 'success');
    closeAllModals();
    await loadDelegationData();
  } catch (err) {
    showToast('Failed to save team: ' + err.message, 'error');
  }
}

async function deleteTeamPrompt(teamId, teamName) {
  if (!confirm(`Delete team "${teamName}"? The student records will remain enrolled in your delegation.`)) {
    return;
  }
  try {
    await db.deleteTeamGroup(teamId);
    showToast(`Team "${teamName}" deleted.`, 'info');
    await loadDelegationData();
  } catch (err) {
    showToast('Failed to delete team: ' + err.message, 'error');
  }
}

function allocateTeamPrompt(teamId) {
  const team = cachedTeams.find((t) => t.id === teamId);
  if (!team) return;

  if (team.event_id) {
    openAllocationModal(team.event_id);
    setTimeout(() => {
      const teamSelect = document.getElementById('alloc-team-quick-select');
      if (teamSelect) {
        teamSelect.value = team.id;
        teamSelect.dispatchEvent(new Event('change'));
      }
    }, 50);
  } else {
    switchLeaderTab('programmes');
    showToast(`Select the competition programme to allocate "${team.team_name}".`, 'info');
  }
}

// ==============================================================================
// 5. TAB 3: PROGRAMME ALLOCATION DESK
// ==============================================================================

function renderProgrammesGrid() {
  const container = document.getElementById('grid-programmes-container');
  if (!container) return;

  container.innerHTML = '';

  const dayFilter = document.getElementById('filter-programme-day')?.value || '';
  const catFilter = document.getElementById('filter-programme-category')?.value || '';

  // Populate category filter dropdown if empty
  const catSelect = document.getElementById('filter-programme-category');
  if (catSelect && catSelect.options.length <= 1) {
    const categories = Array.from(new Set(cachedEvents.map((e) => e.category).filter(Boolean)));
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
  }

  const filteredEvents = cachedEvents.filter((ev) => {
    const matchesDay = !dayFilter || String(ev.day_number) === dayFilter;
    const matchesCat = !catFilter || ev.category === catFilter;
    return matchesDay && matchesCat;
  });

  if (filteredEvents.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p class="text-xs text-slate-500 font-semibold">No festival programmes match the selected filters.</p>
      </div>
    `;
    return;
  }

  filteredEvents.forEach((ev) => {
    const minSize = ev.team_size_min || 1;
    const maxSize = ev.team_size_max || 1;
    const isTeam = maxSize > 1 || ev.participation_type === 'team';
    const progCode = ev.code || ('PRG-' + String(ev.id || '').slice(0, 4).toUpperCase());

    // Check if delegation has assigned students for this event
    const assignment = cachedAssignments.find((a) => a.event_id === ev.id);
    const assignedStudentIds = assignment ? (assignment.student_ids || []) : [];
    const assignedStudentsList = cachedStudents.filter((s) => assignedStudentIds.includes(s.id));
    const isAssigned = assignedStudentsList.length > 0;

    const card = document.createElement('div');
    card.className = `p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
      isAssigned 
        ? 'bg-amber-50/50 border-amber-300 shadow-sm' 
        : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
    }`;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
              ${escapeHtml(progCode)}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isTeam ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
            }">
              ${isTeam ? `Group Squad (${minSize}-${maxSize} Members)` : 'Individual Solo (1 Slot)'}
            </span>
          </div>
          <span class="text-[11px] font-bold text-slate-500">Day ${ev.day_number || 1}</span>
        </div>

        <h3 class="font-bold text-sm text-slate-900">${escapeHtml(ev.title)}</h3>
        <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span class="material-symbols-outlined text-[14px]">schedule</span>
          <span>${escapeHtml(ev.time_slot || 'Time TBA')}</span>
          ${ev.reporting_time ? `<span class="text-amber-700 font-medium">(${escapeHtml(ev.reporting_time)})</span>` : ''}
          <span>•</span>
          <span class="material-symbols-outlined text-[14px]">location_on</span>
          <span>${escapeHtml(ev.venue || 'Dome')}</span>
        </p>

        <!-- Quota & Points Metadata -->
        <div class="mt-2.5 flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1 text-[11px] font-bold text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
            <span class="material-symbols-outlined text-[13px]">domain</span>
            <span>Max ${ev.max_teams_per_institution || 1} entry/college</span>
          </span>
          ${
            ev.points_first
              ? `
                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  <span class="material-symbols-outlined text-[13px]">military_tech</span>
                  <span>1st: ${ev.points_first} pts</span>
                </span>
              `
              : ''
          }
        </div>

        <!-- Current Delegation Representation -->
        <div class="mt-4 pt-3 border-t border-slate-100">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delegation Allocation:</span>
          ${
            isAssigned
              ? `
                <div class="mt-1 flex flex-wrap gap-1.5">
                  ${assignedStudentsList.map((s) => `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold">
                      <span class="material-symbols-outlined text-[13px] text-emerald-700">check_circle</span>
                      <span>${escapeHtml(s.student_name)}</span>
                      <span class="font-mono text-[10px] text-emerald-700">(${s.student_code})</span>
                    </span>
                  `).join('')}
                </div>
              `
              : `
                <div class="mt-1 text-xs text-slate-400 italic">
                  Not assigned yet
                </div>
              `
          }
        </div>
      </div>

      <!-- Allocation Action Button -->
      <div class="mt-4 pt-3 flex items-center gap-2">
        <button 
          type="button" 
          class="flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
            isAssigned 
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm' 
              : 'bg-brand-700 hover:bg-brand-800 text-white shadow-sm'
          }"
          onclick="window.openAllocationModal('${ev.id}')"
        >
          <span class="material-symbols-outlined text-[16px]">${isAssigned ? 'edit' : 'person_add'}</span>
          <span>${isAssigned ? 'Manage Allocated Students' : 'Assign Students'}</span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function openAllocationModal(eventId) {
  const event = cachedEvents.find((e) => e.id === eventId);
  if (!event || !activeLeader) return;

  activeAllocEvent = event;
  document.getElementById('alloc-event-id').value = event.id;
  const progCode = event.code ? `[${event.code}] ` : '';
  document.getElementById('modal-alloc-event-title').textContent = `${progCode}${event.title}`;

  const min = event.team_size_min || 1;
  const max = event.team_size_max || 1;
  const maxInst = event.max_teams_per_institution || 1;
  document.getElementById('modal-alloc-event-rules').textContent = max > 1 
    ? `Team Event: Must select between ${min} and ${max} participants. (Quota: max ${maxInst} entry per delegation).`
    : `Individual Competition: Select exactly 1 student participant. (Quota: max ${maxInst} entry per delegation).`;

  document.getElementById('alloc-rule-hint').textContent = max > 1 ? `Min: ${min} / Max: ${max} (Max ${maxInst} entry/inst)` : `Required: 1 (Max ${maxInst} entry/inst)`;

  // Get currently assigned students for this event
  const assignment = cachedAssignments.find((a) => a.event_id === event.id);
  const currentAssignedIds = assignment ? (assignment.student_ids || []) : [];

  const listContainer = document.getElementById('alloc-students-list');
  listContainer.innerHTML = '';

  if (cachedStudents.length === 0) {
    listContainer.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-500">
        You have not enrolled any students yet. Please enroll students in the <strong>Students Roster</strong> tab first.
      </div>
    `;
    document.getElementById('btn-confirm-allocation').disabled = true;
    return;
  }

  document.getElementById('btn-confirm-allocation').disabled = false;

  cachedStudents.forEach((student) => {
    const isChecked = currentAssignedIds.includes(student.id);

    const label = document.createElement('label');
    label.className = 'flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors';
    label.innerHTML = `
      <input 
        type="checkbox" 
        value="${student.id}" 
        class="alloc-student-checkbox rounded text-brand-600 focus:ring-brand-500 w-4 h-4" 
        ${isChecked ? 'checked' : ''}
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-xs">${escapeHtml(student.student_name)}</span>
          <span class="font-mono text-[10px] font-bold text-slate-500">${escapeHtml(student.student_code)}</span>
        </div>
        <div class="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
          <span>${escapeHtml(student.category)}</span>
          <span>•</span>
          <span>${(student.assigned_events || []).length} other events assigned</span>
        </div>
      </div>
    `;

    listContainer.appendChild(label);
  });

  updateAllocSelectionCounter();

  // Attach change listener to update counter
  listContainer.querySelectorAll('.alloc-student-checkbox').forEach((cb) => {
    cb.addEventListener('change', updateAllocSelectionCounter);
  });

  // Populate Team Auto-Select Dropdown
  const teamSelect = document.getElementById('alloc-team-quick-select');
  if (teamSelect) {
    teamSelect.innerHTML = '<option value="">-- Choose Existing Team / Squad --</option>';
    cachedTeams.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.team_name} (${t.category} • ${(t.student_ids || []).length} members)`;
      teamSelect.appendChild(opt);
    });
    teamSelect.onchange = () => {
      const selectedTeamId = teamSelect.value;
      if (!selectedTeamId) return;
      const team = cachedTeams.find((t) => t.id === selectedTeamId);
      if (team) {
        const teamStudentIds = team.student_ids || [];
        listContainer.querySelectorAll('.alloc-student-checkbox').forEach((cb) => {
          cb.checked = teamStudentIds.includes(cb.value);
        });
        updateAllocSelectionCounter();
      }
    };
  }

  document.getElementById('modal-allocation')?.classList.remove('hidden');
  document.getElementById('modal-allocation')?.classList.add('flex');
}

function updateAllocSelectionCounter() {
  const selected = document.querySelectorAll('#alloc-students-list .alloc-student-checkbox:checked');
  const counterEl = document.getElementById('alloc-selected-counter');
  if (counterEl) {
    counterEl.textContent = `${selected.length} student${selected.length === 1 ? '' : 's'} selected`;
  }
}

async function handleConfirmAllocation() {
  if (!activeAllocEvent || !activeLeader) return;

  const checkedBoxes = Array.from(document.querySelectorAll('#alloc-students-list .alloc-student-checkbox:checked'));
  const selectedIds = checkedBoxes.map((cb) => cb.value);

  const min = activeAllocEvent.team_size_min || 1;
  const max = activeAllocEvent.team_size_max || 1;

  if (selectedIds.length === 0) {
    showToast('Please select at least 1 student or click "Unassign All".', 'warning');
    return;
  }

  if (selectedIds.length < min) {
    showToast(`This event requires a minimum of ${min} participants (you selected ${selectedIds.length}).`, 'warning');
    return;
  }

  if (selectedIds.length > max) {
    showToast(`This event allows a maximum of ${max} participants (you selected ${selectedIds.length}).`, 'warning');
    return;
  }

  const btn = document.getElementById('btn-confirm-allocation');
  btn.disabled = true;

  try {
    await db.saveTeamAssignment(activeLeader.id, activeAllocEvent.id, selectedIds);
    showToast(`Assigned ${selectedIds.length} student(s) to "${activeAllocEvent.title}".`, 'success');
    closeAllModals();
    await loadDelegationData();
  } catch (err) {
    showToast('Error saving programme allocation: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleRemoveAllocation() {
  if (!activeAllocEvent || !activeLeader) return;

  if (!confirm(`Are you sure you want to unassign all delegation students from "${activeAllocEvent.title}"?`)) {
    return;
  }

  try {
    await db.removeTeamAssignment(activeLeader.id, activeAllocEvent.id);
    showToast(`Unassigned all participants from "${activeAllocEvent.title}".`, 'info');
    closeAllModals();
    await loadDelegationData();
  } catch (err) {
    showToast('Error removing assignment: ' + err.message, 'error');
  }
}

// ==============================================================================
// 5. TAB 3: PRINTABLE DELEGATION PASSPORT & BADGES
// ==============================================================================

function renderPrintRoster() {
  if (!activeLeader) return;

  document.getElementById('print-token').textContent = activeLeader.token;
  document.getElementById('print-date').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('print-institution').textContent = activeLeader.institution_name;
  document.getElementById('print-leader').textContent = activeLeader.leader_name;
  document.getElementById('print-phone').textContent = activeLeader.leader_phone || '---';
  document.getElementById('print-total-members').textContent = `${cachedStudents.length} Students`;

  const tbody = document.getElementById('print-roster-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (cachedStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-4 text-center text-slate-400 italic">No students enrolled yet.</td>
      </tr>
    `;
    return;
  }

  cachedStudents.forEach((student, idx) => {
    const events = (student.assigned_events || []).map((e) => e.event_title).join(', ') || 'No Stage Assigned';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2 border-r border-slate-300 text-center font-bold text-slate-600">${idx + 1}</td>
      <td class="p-2 border-r border-slate-300 font-mono font-bold text-brand-700">${escapeHtml(student.student_code)}</td>
      <td class="p-2 border-r border-slate-300 font-bold text-slate-900">${escapeHtml(student.student_name)}</td>
      <td class="p-2 border-r border-slate-300 text-slate-700 font-medium">${escapeHtml(student.category)}</td>
      <td class="p-2 font-medium text-slate-700">${escapeHtml(events)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openStudentPassModal(studentId) {
  const student = cachedStudents.find((s) => s.id === studentId);
  if (!student || !activeLeader) return;

  document.getElementById('pass-student-name').textContent = student.student_name;
  document.getElementById('pass-institution').textContent = activeLeader.institution_name;

  const ticketCode = (student.assigned_events && student.assigned_events[0]?.ticket_code) || `ALM-${student.student_code}`;
  document.getElementById('pass-ticket-code').textContent = ticketCode;

  // Generate QR Code via clean reliable QR API pointing to accredited participant profile
  const studentRef = student.student_code || student.id;
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  );
  const profileUrl = (!isLocalHost && window.location.origin)
    ? `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/profile.html?id=${encodeURIComponent(studentRef)}`
    : `https://abddeveloper-hub.github.io/al-murafaqa/profile.html?id=${encodeURIComponent(studentRef)}`;

  const qrImg = document.getElementById('pass-qr-img');
  if (qrImg) {
    const primaryUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(profileUrl)}`;
    const fallbackUrl = `https://quickchart.io/qr?size=250&text=${encodeURIComponent(profileUrl)}`;
    qrImg.onerror = function() {
      if (this.src !== fallbackUrl) this.src = fallbackUrl;
    };
    qrImg.src = primaryUrl;
  }

  const eventsBox = document.getElementById('pass-events-container');
  if (eventsBox) {
    eventsBox.innerHTML = '';
    const events = student.assigned_events || [];
    if (events.length === 0) {
      eventsBox.innerHTML = '<span class="text-slate-400 italic">General Delegate Pass (No Competition Stages)</span>';
    } else {
      events.forEach((ev) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-[11px] font-semibold text-slate-800';
        item.innerHTML = `
          <span>${escapeHtml(ev.event_title)}</span>
          <span class="text-slate-500">Day ${ev.day_number || 1} • ${escapeHtml(ev.time_slot || '')}</span>
        `;
        eventsBox.appendChild(item);
      });
    }
  }

  document.getElementById('modal-pass')?.classList.remove('hidden');
  document.getElementById('modal-pass')?.classList.add('flex');
}

// ==============================================================================
// 6. EVENT LISTENERS & NAVIGATION
// ==============================================================================

function setupEventListeners() {
  // Token Login Form
  const formLogin = document.getElementById('form-token-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('input-leader-token').value;
      await authenticateWithToken(token);
    });
  }

  // Copy Direct Link Button
  const btnCopyLink = document.getElementById('btn-copy-portal-link');
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (!activeLeader) return;
      const shareUrl = getShareablePortalUrl(activeLeader.token, 'leader.html');
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Direct portal link copied to clipboard!', 'success');
      }).catch(() => {
        prompt('Copy this delegation portal link:', shareUrl);
      });
    });
  }

  // Token chip click
  const tokenChip = document.getElementById('badge-token-chip');
  if (tokenChip) {
    tokenChip.addEventListener('click', () => {
      if (!activeLeader) return;
      navigator.clipboard.writeText(activeLeader.token).then(() => {
        showToast(`Token "${activeLeader.token}" copied to clipboard!`, 'info');
      });
    });
  }

  // Sign out
  const btnSignout = document.getElementById('btn-leader-signout');
  if (btnSignout) {
    btnSignout.addEventListener('click', () => {
      if (confirm('Sign out of the Team Leader Portal?')) {
        sessionStorage.removeItem('almurafaqa_active_leader_token');
        activeLeader = null;
        window.location.href = window.location.pathname;
      }
    });
  }

  // Tab Navigation
  document.querySelectorAll('.leader-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchLeaderTab(tab);
    });
  });

  // Quick Action Buttons
  document.getElementById('btn-quick-add-student')?.addEventListener('click', openAddStudentModal);
  document.getElementById('btn-open-add-student-modal')?.addEventListener('click', openAddStudentModal);
  document.getElementById('btn-quick-add-team')?.addEventListener('click', openAddTeamModal);
  document.getElementById('btn-open-add-team-modal')?.addEventListener('click', openAddTeamModal);
  document.getElementById('btn-empty-add-team')?.addEventListener('click', openAddTeamModal);
  document.getElementById('btn-quick-print')?.addEventListener('click', () => {
    switchLeaderTab('passes');
    window.print();
  });

  // Student & Team Form Submits
  document.getElementById('form-student')?.addEventListener('submit', handleSaveStudent);
  document.getElementById('form-team-group')?.addEventListener('submit', handleSaveTeamGroup);

  // Search & Filter Listeners (Debounced for Silky Smooth Typing)
  let stuSearchTimer = null;
  document.getElementById('search-students')?.addEventListener('input', () => {
    if (stuSearchTimer) clearTimeout(stuSearchTimer);
    stuSearchTimer = setTimeout(renderStudentsTable, 100);
  });
  document.getElementById('filter-student-category')?.addEventListener('change', renderStudentsTable);

  let teamSearchTimer = null;
  document.getElementById('search-teams')?.addEventListener('input', () => {
    if (teamSearchTimer) clearTimeout(teamSearchTimer);
    teamSearchTimer = setTimeout(renderTeamsGrid, 100);
  });
  document.getElementById('filter-team-category')?.addEventListener('change', renderTeamsGrid);
  document.getElementById('filter-programme-day')?.addEventListener('change', renderProgrammesGrid);
  document.getElementById('filter-programme-category')?.addEventListener('change', renderProgrammesGrid);

  // Allocation Confirm & Remove
  document.getElementById('btn-confirm-allocation')?.addEventListener('click', handleConfirmAllocation);
  document.getElementById('btn-remove-allocation')?.addEventListener('click', handleRemoveAllocation);

  // Modal Closers
  document.querySelectorAll('.btn-close-modal').forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });

  // Close modals clicking outside
  ['modal-student', 'modal-team-group', 'modal-allocation', 'modal-pass'].forEach((modalId) => {
    const el = document.getElementById(modalId);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) closeAllModals();
      });
    }
  });
}

function switchLeaderTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll('.leader-tab-btn').forEach((btn) => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    if (isTarget) {
      btn.className = 'leader-tab-btn px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all bg-brand-700 text-white shadow-sm active';
    } else {
      btn.className = 'leader-tab-btn px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2 transition-all';
    }
  });

  document.querySelectorAll('.leader-tab-pane').forEach((pane) => {
    pane.classList.add('hidden');
  });

  const activePane = document.getElementById(`pane-${tabName}`);
  if (activePane) activePane.classList.remove('hidden');
}

function closeAllModals() {
  ['modal-student', 'modal-team-group', 'modal-allocation', 'modal-pass'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  });
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-slate-900 text-white',
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
  };

  toast.className = `p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold pointer-events-auto transform transition-all duration-200 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${icons[type] || 'info'}</span>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button type="button" class="p-1 opacity-70 hover:opacity-100" onclick="this.parentElement.remove()">
      <span class="material-symbols-outlined text-[14px]">close</span>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 250);
  }, 4500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global window exposed functions for HTML onclick handlers
window.openStudentPassModal = openStudentPassModal;
window.openEditStudentModal = openEditStudentModal;
window.deleteStudentPrompt = deleteStudentPrompt;
window.openAllocationModal = openAllocationModal;
window.openAddTeamModal = openAddTeamModal;
window.openEditTeamModal = openEditTeamModal;
window.deleteTeamPrompt = deleteTeamPrompt;
window.allocateTeamPrompt = allocateTeamPrompt;
