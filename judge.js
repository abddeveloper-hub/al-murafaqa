// ==============================================================================
// AL MURAFAQA • TOKEN-GATED JUDGE PORTAL CONTROLLER (judge.js)
// Enforces Fest-locked adjudication, live revocation detection, and Admin sync.
// ==============================================================================

import {
  db,
  getSupabaseClient,
  sanitizePlainText,
} from './supabase-config.js';

const SESSION_KEY = 'almurafaqa_judge_session_token';

let activeToken = '';
let activeTokenRecord = null;
let activeFest = null;
let activeEntry = null;
let rulesState = [];
let remarksState = [];
let realtimeChannel = null;
let heartbeatTimer = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('judge-toast-container');
  if (!container) return;
  const styles = {
    success: 'bg-emerald-900 text-white border-emerald-700',
    error: 'bg-red-900 text-white border-red-700',
    warning: 'bg-amber-900 text-white border-amber-700',
    info: 'bg-slate-900 text-white border-slate-700',
  };
  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center justify-between gap-3 ${styles[type] || styles.info}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'opacity-70 hover:opacity-100 text-white font-bold px-1';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function setAuthError(message = '') {
  const box = document.getElementById('judge-auth-error');
  const txt = document.getElementById('judge-auth-error-text');
  if (!box || !txt) return;
  if (!message) {
    box.classList.add('hidden');
    return;
  }
  txt.textContent = message;
  box.classList.remove('hidden');
}

function showAuthGate(errorMsg = '') {
  activeToken = '';
  activeTokenRecord = null;
  activeFest = null;
  activeEntry = null;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}

  document.getElementById('view-judge-dashboard')?.classList.add('hidden');
  document.getElementById('view-judge-auth')?.classList.remove('hidden');
  setAuthError(errorMsg);
}

function updatePublicationStatusPill(entry) {
  const badge = document.getElementById('judge-pub-status-badge');
  const publicBtn = document.getElementById('btn-view-public-judgment');
  const syncedLabel = document.getElementById('judge-last-synced-label');
  if (!badge) return;

  if (entry?.is_published === true) {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-600"></span><span>Published to Public</span>';
    if (publicBtn && activeFest?.id) {
      publicBtn.href = `judgment.html?festId=${encodeURIComponent(activeFest.id)}`;
      publicBtn.classList.remove('hidden');
    }
  } else if (entry && (entry.status === 'SUBMITTED' || (Array.isArray(entry.rules) && entry.rules.length > 0) || (entry.rules_summary || '').trim())) {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span><span>Synced with Admin – Awaiting Publication</span>';
    publicBtn?.classList.add('hidden');
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Draft – Ready to Sync</span>';
    publicBtn?.classList.add('hidden');
  }

  if (syncedLabel) {
    syncedLabel.textContent = entry?.updated_at
      ? `Last synced: ${new Date(entry.updated_at).toLocaleString()}`
      : 'Not yet synced with Admin';
  }
}

function populateWorkspace(verified) {
  activeTokenRecord = verified.tokenRecord;
  activeFest = verified.fest;
  activeEntry = verified.entry || null;
  activeToken = activeTokenRecord.token;

  try { sessionStorage.setItem(SESSION_KEY, activeToken); } catch (_) {}

  document.getElementById('view-judge-auth')?.classList.add('hidden');
  document.getElementById('view-judge-dashboard')?.classList.remove('hidden');

  const codePart = activeFest.code ? `${activeFest.code} • ` : '';
  document.getElementById('header-fest-title').textContent = activeFest.title || 'Assigned Fest';
  document.getElementById('header-judge-meta').textContent = `Judge: ${activeTokenRecord.judge_name} • ${codePart}${activeFest.category || 'Programme'} • Venue: ${activeFest.venue || 'Main Stage'}`;
  document.getElementById('badge-judge-token-chip').textContent = activeToken;

  document.getElementById('fest-banner-title').textContent = activeFest.title || 'Assigned Fest';
  document.getElementById('fest-banner-details').textContent = `${codePart}${activeFest.category || 'Programme'} • Day ${activeFest.day_number || 1} (${activeFest.time_slot || 'TBA'}) • ${activeFest.venue || 'Main Stage'}${activeFest.rules ? ` — Fest Note: ${activeFest.rules}` : ''}`;
  document.getElementById('fest-banner-judge').textContent = `${activeTokenRecord.judge_name}${activeTokenRecord.judge_email ? ` (${activeTokenRecord.judge_email})` : ''}`;

  const summaryEl = document.getElementById('judge-rules-summary');
  if (summaryEl) {
    summaryEl.value = activeEntry?.rules_summary || '';
  }

  rulesState = Array.isArray(activeEntry?.rules) && activeEntry.rules.length > 0
    ? activeEntry.rules.map((r, i) => ({
        id: r.id || `rule_${Date.now()}_${i}`,
        title: r.title || '',
        description: r.description || '',
        max_points: r.max_points ?? '',
      }))
    : [{ id: `rule_${Date.now()}_0`, title: '', description: '', max_points: '' }];

  remarksState = Array.isArray(activeEntry?.scores_or_remarks)
    ? activeEntry.scores_or_remarks.map((m, i) => ({
        id: m.id || `eval_${Date.now()}_${i}`,
        contestant_name: m.contestant_name || '',
        institution: m.institution || '',
        score: m.score ?? '',
        remarks: m.remarks || '',
      }))
    : [];

  renderRulesList();
  renderRemarksList();
  updatePublicationStatusPill(activeEntry);
  startSessionSecurityWatch();
}

function renderRulesList() {
  const container = document.getElementById('judge-rules-list');
  if (!container) return;

  if (rulesState.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">No rules or criteria added yet. Click "+ Add Rule / Criterion" above.</div>';
    return;
  }

  container.innerHTML = rulesState.map((rule, idx) => `
    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3" data-rule-idx="${idx}">
      <div class="flex items-center justify-between gap-2">
        <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-bold text-[11px]">Rule / Criterion #${idx + 1}</span>
        <div class="flex items-center gap-1">
          <button type="button" class="btn-move-rule-up p-1.5 rounded-lg text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 cursor-pointer" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up">
            <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
          </button>
          <button type="button" class="btn-move-rule-down p-1.5 rounded-lg text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 cursor-pointer" data-idx="${idx}" ${idx === rulesState.length - 1 ? 'disabled' : ''} title="Move Down">
            <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
          </button>
          <button type="button" class="btn-remove-rule p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer" data-idx="${idx}" title="Remove Rule">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div class="sm:col-span-9">
          <label class="block text-[11px] font-bold uppercase text-slate-600 mb-1">Rule or Criterion Title *</label>
          <input type="text" class="input-rule-title w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-indigo-600" data-idx="${idx}" value="${escapeHtml(rule.title)}" placeholder="e.g. Tajweed &amp; Pronunciation Accuracy"/>
        </div>
        <div class="sm:col-span-3">
          <label class="block text-[11px] font-bold uppercase text-slate-600 mb-1">Weight / Max Pts</label>
          <input type="number" min="0" step="1" class="input-rule-points w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600" data-idx="${idx}" value="${escapeHtml(rule.max_points === null || rule.max_points === undefined ? '' : String(rule.max_points))}" placeholder="e.g. 30"/>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-600 mb-1">Detailed Rule / Evaluation Standard</label>
        <textarea rows="2" class="input-rule-desc w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-600" data-idx="${idx}" placeholder="Describe scoring expectations, penalties, or adjudication notes...">${escapeHtml(rule.description)}</textarea>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.input-rule-title').forEach((el) => {
    el.addEventListener('input', () => {
      rulesState[Number(el.getAttribute('data-idx'))].title = el.value;
    });
  });
  container.querySelectorAll('.input-rule-points').forEach((el) => {
    el.addEventListener('input', () => {
      rulesState[Number(el.getAttribute('data-idx'))].max_points = el.value;
    });
  });
  container.querySelectorAll('.input-rule-desc').forEach((el) => {
    el.addEventListener('input', () => {
      rulesState[Number(el.getAttribute('data-idx'))].description = el.value;
    });
  });
  container.querySelectorAll('.btn-move-rule-up').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      if (idx <= 0) return;
      [rulesState[idx - 1], rulesState[idx]] = [rulesState[idx], rulesState[idx - 1]];
      renderRulesList();
    });
  });
  container.querySelectorAll('.btn-move-rule-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      if (idx >= rulesState.length - 1) return;
      [rulesState[idx + 1], rulesState[idx]] = [rulesState[idx], rulesState[idx + 1]];
      renderRulesList();
    });
  });
  container.querySelectorAll('.btn-remove-rule').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      rulesState.splice(idx, 1);
      renderRulesList();
    });
  });
}

function renderRemarksList() {
  const container = document.getElementById('judge-remarks-list');
  if (!container) return;

  if (remarksState.length === 0) {
    container.innerHTML = '<div class="p-5 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">No participant evaluation remarks added yet. Click "+ Add Evaluation Row" or "Import Registered Competitors" above.</div>';
    return;
  }

  container.innerHTML = remarksState.map((item, idx) => `
    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
      <div class="sm:col-span-3">
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Competitor / Team</label>
        <input type="text" class="input-rem-name w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900" data-idx="${idx}" value="${escapeHtml(item.contestant_name)}" placeholder="Competitor name"/>
      </div>
      <div class="sm:col-span-3">
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Institution</label>
        <input type="text" class="input-rem-inst w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800" data-idx="${idx}" value="${escapeHtml(item.institution)}" placeholder="Delegation / College"/>
      </div>
      <div class="sm:col-span-2">
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Score</label>
        <input type="number" min="0" step="0.5" class="input-rem-score w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900" data-idx="${idx}" value="${escapeHtml(item.score === null || item.score === undefined ? '' : String(item.score))}" placeholder="0-100"/>
      </div>
      <div class="sm:col-span-3">
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Jury Remarks</label>
        <input type="text" class="input-rem-notes w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800" data-idx="${idx}" value="${escapeHtml(item.remarks)}" placeholder="Evaluation notes..."/>
      </div>
      <div class="sm:col-span-1 flex justify-end pt-5">
        <button type="button" class="btn-remove-remark p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer" data-idx="${idx}" title="Remove Row">
          <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.input-rem-name').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].contestant_name = el.value; });
  });
  container.querySelectorAll('.input-rem-inst').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].institution = el.value; });
  });
  container.querySelectorAll('.input-rem-score').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].score = el.value; });
  });
  container.querySelectorAll('.input-rem-notes').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].remarks = el.value; });
  });
  container.querySelectorAll('.btn-remove-remark').forEach((btn) => {
    btn.addEventListener('click', () => {
      remarksState.splice(Number(btn.getAttribute('data-idx')), 1);
      renderRemarksList();
    });
  });
}

async function validateActiveSessionStillValid() {
  if (!activeToken) return;
  try {
    const res = await db.verifyJudgeToken(activeToken);
    if (res?.entry) {
      activeEntry = res.entry;
      updatePublicationStatusPill(activeEntry);
    }
  } catch (err) {
    const msg = err?.message || '';
    if (/invalid|revoked|expired|unauthorized|no longer exists|could not be found/i.test(msg)) {
      showAuthGate(msg || 'This token is invalid or has been revoked by the admin');
      showToast('Session ended: your token was revoked or expired.', 'error');
    }
  }
}

function startSessionSecurityWatch() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (!document.hidden && activeToken) {
      validateActiveSessionStillValid();
    }
  }, 15000);

  window.addEventListener('storage', (e) => {
    if ((e.key === 'almurafaqa_judge_tokens' || e.key === 'almurafaqa_judgment_entries') && activeToken) {
      validateActiveSessionStillValid();
    }
  });

  if (!realtimeChannel) {
    getSupabaseClient().then((client) => {
      if (!client || realtimeChannel) return;
      realtimeChannel = client
        .channel(`judge:token_${activeTokenRecord?.id || 'portal'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_tokens' }, () => {
          if (activeToken) validateActiveSessionStillValid();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'judgment_entries' }, () => {
          if (activeToken) validateActiveSessionStillValid();
        })
        .subscribe();
    }).catch(() => {});
  }
}

async function authenticateWithToken(rawToken) {
  const btn = document.getElementById('btn-verify-judge-token');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Verifying Access...</span>';
  }
  setAuthError('');

  try {
    const verified = await db.verifyJudgeToken(rawToken);
    populateWorkspace(verified);
    showToast(`Authenticated for Fest: ${verified.fest.title}`, 'success');
  } catch (err) {
    showAuthGate(err?.message || 'This token is invalid or has been revoked by the admin');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">lock_open</span><span>Verify Token &amp; Open Fest Desk</span>';
    }
  }
}

function bindEvents() {
  document.getElementById('form-judge-token-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = document.getElementById('input-judge-token')?.value || '';
    await authenticateWithToken(val);
  });

  document.getElementById('btn-judge-logout')?.addEventListener('click', () => {
    showAuthGate('');
    showToast('Signed out from Judge Portal.', 'info');
  });

  document.getElementById('btn-add-judge-rule')?.addEventListener('click', () => {
    rulesState.push({ id: `rule_${Date.now()}_${rulesState.length}`, title: '', description: '', max_points: '' });
    renderRulesList();
  });

  document.getElementById('btn-add-judge-remark')?.addEventListener('click', () => {
    remarksState.push({ id: `eval_${Date.now()}_${remarksState.length}`, contestant_name: '', institution: '', score: '', remarks: '' });
    renderRemarksList();
  });

  document.getElementById('btn-load-fest-competitors')?.addEventListener('click', async () => {
    if (!activeFest?.id) return;
    try {
      const regs = await db.getRegistrations();
      const festRegs = (regs || []).filter((r) => r.event_id === activeFest.id && !r.is_restricted);
      if (festRegs.length === 0) {
        showToast('No registered competitors found for this assigned Fest yet.', 'info');
        return;
      }
      let addedCount = 0;
      festRegs.forEach((r) => {
        const cName = (r.team_name || r.leader_name || '').trim();
        if (!cName) return;
        if (!remarksState.some((x) => x.contestant_name.trim().toLowerCase() === cName.toLowerCase())) {
          remarksState.push({
            id: `eval_${Date.now()}_${remarksState.length}`,
            contestant_name: cName,
            institution: r.college_name || '',
            score: '',
            remarks: '',
          });
          addedCount++;
        }
      });
      renderRemarksList();
      showToast(addedCount > 0 ? `Imported ${addedCount} competitor row(s) for ${activeFest.title}.` : 'All registered competitors are already listed.', 'info');
    } catch (err) {
      showToast('Could not load competitors: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-save-sync-judgment')?.addEventListener('click', async () => {
    if (!activeToken || !activeFest?.id) return;
    const btn = document.getElementById('btn-save-sync-judgment');
    const summaryVal = sanitizePlainText(document.getElementById('judge-rules-summary')?.value || '', 4000);

    const hasValidRule = rulesState.some((r) => sanitizePlainText(r.title, 200) || sanitizePlainText(r.description, 2000));
    if (!hasValidRule && !summaryVal) {
      showToast('Please enter at least one judgment rule/criterion or general guideline before syncing.', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Syncing with Admin...</span>';
    }

    try {
      const saved = await db.saveJudgeJudgment(activeToken, activeFest.id, {
        rules: rulesState,
        rules_summary: summaryVal,
        scores_or_remarks: remarksState,
      });
      activeEntry = saved;
      updatePublicationStatusPill(saved);
      if (saved._cloudSyncWarning) {
        showToast(saved._cloudSyncWarning, 'warning');
      } else {
        showToast('Saved & synced directly to Admin Dashboard!', 'success');
      }
    } catch (err) {
      const msg = err?.message || 'Failed to sync judgment entry.';
      if (/invalid|revoked|expired|unauthorized/i.test(msg)) {
        showAuthGate(msg);
      }
      showToast(msg, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">cloud_upload</span><span>Save &amp; Sync to Admin</span>';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  const params = new URLSearchParams(window.location.search);
  const urlToken = (params.get('token') || '').trim();
  const savedSessionToken = (() => {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  })();

  const candidateToken = urlToken || savedSessionToken;
  if (candidateToken) {
    const inputEl = document.getElementById('input-judge-token');
    if (inputEl) inputEl.value = candidateToken.toUpperCase();
    await authenticateWithToken(candidateToken);
  } else {
    showAuthGate('');
  }
});
