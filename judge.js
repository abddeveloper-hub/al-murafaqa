// ==============================================================================
// AL MURAFAQA • TOKEN-GATED JUDGE PORTAL CONTROLLER (judge.js)
// Fest-locked adjudication, spreadsheet scoring grid, live revocation checks.
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

function getScoredCriterionRules() {
  return rulesState.filter((r) => {
    const pts = Number(r.max_points);
    return Number.isFinite(pts) && pts > 0;
  });
}

function getRubricMaxTotal(scoredRules = getScoredCriterionRules()) {
  return scoredRules.reduce((sum, r) => sum + Number(r.max_points || 0), 0);
}

function computeRowTotal(row, scoredRules = getScoredCriterionRules()) {
  if (!row) return null;
  if (scoredRules.length === 0) {
    if (row.score === '' || row.score === null || row.score === undefined) return null;
    const n = Number(row.score);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }
  const map = row.criteria_scores && typeof row.criteria_scores === 'object' ? row.criteria_scores : {};
  let hasAny = false;
  let sum = 0;
  scoredRules.forEach((rule) => {
    const v = map[rule.id];
    if (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) {
      hasAny = true;
      sum += Number(v);
    }
  });
  if (hasAny) {
    return Math.round(sum * 100) / 100;
  }
  if (row.score !== '' && row.score !== null && row.score !== undefined && Number.isFinite(Number(row.score))) {
    return Math.round(Number(row.score) * 100) / 100;
  }
  return null;
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
        max_total: m.max_total ?? null,
        criteria_scores: m.criteria_scores && typeof m.criteria_scores === 'object' ? { ...m.criteria_scores } : {},
        remarks: m.remarks || '',
      }))
    : [];

  renderRulesList();
  renderScoringGrid();
  updatePublicationStatusPill(activeEntry);
  startSessionSecurityWatch();
}

function renderRulesList() {
  const container = document.getElementById('judge-rules-list');
  if (!container) return;

  if (rulesState.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">No rules or criteria added yet. Click "Add Rule / Criterion" or "Load 100-Pt Rubric Preset" above.</div>';
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
          <label class="block text-[11px] font-bold uppercase text-slate-600 mb-1">Max Pts (Grid Column)</label>
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
      renderScoringGridHeadersOnly();
    });
  });
  container.querySelectorAll('.input-rule-points').forEach((el) => {
    el.addEventListener('input', () => {
      rulesState[Number(el.getAttribute('data-idx'))].max_points = el.value;
      renderScoringGrid();
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
      renderScoringGrid();
    });
  });
  container.querySelectorAll('.btn-move-rule-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      if (idx >= rulesState.length - 1) return;
      [rulesState[idx + 1], rulesState[idx]] = [rulesState[idx], rulesState[idx + 1]];
      renderRulesList();
      renderScoringGrid();
    });
  });
  container.querySelectorAll('.btn-remove-rule').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      rulesState.splice(idx, 1);
      renderRulesList();
      renderScoringGrid();
    });
  });
}

function renderScoringGridHeadersOnly() {
  const scoredRules = getScoredCriterionRules();
  scoredRules.forEach((rule) => {
    const th = document.querySelector(`#judge-remarks-list th[data-rule-col="${rule.id}"] .crit-col-title`);
    if (th) th.textContent = rule.title || 'Criterion';
  });
}

function recomputeJudgeGridRanks() {
  const scoredRules = getScoredCriterionRules();
  const rubricMax = getRubricMaxTotal(scoredRules);
  const progressEl = document.getElementById('judge-grid-progress');

  const computed = remarksState.map((row, idx) => {
    const tot = computeRowTotal(row, scoredRules);
    row.score = tot;
    row.max_total = rubricMax > 0 ? rubricMax : null;
    return { idx, total: tot };
  });

  const sortedValid = computed
    .filter((x) => x.total !== null)
    .sort((a, b) => b.total - a.total);

  const rankByIdx = new Map();
  let lastScore = null;
  let currentRank = 0;
  sortedValid.forEach((item, pos) => {
    if (lastScore === null || item.total < lastScore) {
      currentRank = pos + 1;
      lastScore = item.total;
    }
    rankByIdx.set(item.idx, currentRank);
  });

  computed.forEach(({ idx, total }) => {
    const totalCell = document.querySelector(`#judge-remarks-list .judge-row-total[data-idx="${idx}"]`);
    if (totalCell && totalCell.tagName !== 'INPUT') {
      totalCell.textContent = total !== null ? (rubricMax > 0 ? `${total} / ${rubricMax}` : String(total)) : '—';
    }
    const rankEl = document.querySelector(`#judge-remarks-list .judge-row-rank[data-idx="${idx}"]`);
    if (rankEl) {
      const r = rankByIdx.get(idx);
      if (r === 1) {
        rankEl.textContent = '1ST';
        rankEl.className = 'judge-row-rank inline-flex px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px]';
      } else if (r === 2) {
        rankEl.textContent = '2ND';
        rankEl.className = 'judge-row-rank inline-flex px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 font-mono font-bold text-[10px]';
      } else if (r === 3) {
        rankEl.textContent = '3RD';
        rankEl.className = 'judge-row-rank inline-flex px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-200 font-mono font-bold text-[10px]';
      } else if (r) {
        rankEl.textContent = `#${r}`;
        rankEl.className = 'judge-row-rank font-mono font-semibold text-[11px] text-slate-600';
      } else {
        rankEl.textContent = '—';
        rankEl.className = 'judge-row-rank font-mono text-[11px] text-slate-400';
      }
    }
  });

  if (progressEl) {
    progressEl.textContent = `${sortedValid.length} of ${remarksState.length} competitor(s) scored`;
  }
}

function handleGridVerticalNav(e, containerSelector) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const col = e.target.getAttribute('data-col');
  const idx = Number(e.target.getAttribute('data-idx'));
  if (!col || !Number.isFinite(idx)) return;

  const delta = e.key === 'ArrowUp' ? -1 : 1;
  const inputs = Array.from(document.querySelectorAll(`${containerSelector} input[data-col="${col}"]`));
  const pos = inputs.indexOf(e.target);
  const next = pos !== -1 ? inputs[pos + delta] : null;
  if (next) {
    e.preventDefault();
    next.focus();
    next.select?.();
  }
}

function renderScoringGrid() {
  const container = document.getElementById('judge-remarks-list');
  const summaryEl = document.getElementById('judge-grid-summary');
  if (!container) return;

  const scoredRules = getScoredCriterionRules();
  const rubricMax = getRubricMaxTotal(scoredRules);
  const searchVal = (document.getElementById('judge-grid-search')?.value || '').trim().toLowerCase();

  if (summaryEl) {
    summaryEl.textContent = scoredRules.length > 0
      ? `${scoredRules.length} Rubric Columns • Max ${rubricMax} pts`
      : 'Direct Total Score Grid';
  }

  if (remarksState.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">No competitors in scoring grid yet. Click <strong>Import Fest Competitors</strong> or <strong>Add Competitor Row</strong> above to start scoring fast.</div>';
    const progressEl = document.getElementById('judge-grid-progress');
    if (progressEl) progressEl.textContent = '0 of 0 competitor(s) scored';
    return;
  }

  const indexedRows = remarksState
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (!searchVal) return true;
      return (item.contestant_name || '').toLowerCase().includes(searchVal) ||
        (item.institution || '').toLowerCase().includes(searchVal) ||
        (item.remarks || '').toLowerCase().includes(searchVal);
    });

  if (indexedRows.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">No competitors match your grid filter.</div>';
    return;
  }

  const critHeadersHtml = scoredRules.map((rule) => `
    <th class="py-3 px-2.5 text-center border-l border-slate-200 min-w-[115px]" data-rule-col="${escapeHtml(rule.id)}">
      <div class="crit-col-title text-[11px] font-bold text-slate-800 truncate max-w-[130px] mx-auto" title="${escapeHtml(rule.title)}">${escapeHtml(rule.title || 'Criterion')}</div>
      <div class="text-[10px] font-mono text-indigo-700 font-bold">/ ${escapeHtml(String(rule.max_points))} pts</div>
    </th>
  `).join('');

  const rowsHtml = indexedRows.map(({ item, idx }) => {
    const critMap = item.criteria_scores && typeof item.criteria_scores === 'object' ? item.criteria_scores : {};
    const critCellsHtml = scoredRules.map((rule) => {
      const val = critMap[rule.id] ?? '';
      return `
        <td class="py-2 px-2 border-l border-slate-200 text-center bg-white/60">
          <input
            type="number"
            min="0"
            max="${escapeHtml(String(rule.max_points))}"
            step="0.5"
            class="input-grid-crit w-20 h-9 px-2 bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-lg font-mono text-sm font-bold text-center text-slate-900 focus:outline-none"
            data-idx="${idx}"
            data-rule-id="${escapeHtml(rule.id)}"
            data-max="${escapeHtml(String(rule.max_points))}"
            data-col="crit_${escapeHtml(rule.id)}"
            value="${escapeHtml(val === null || val === undefined ? '' : String(val))}"
            placeholder="0–${escapeHtml(String(rule.max_points))}"
          />
        </td>
      `;
    }).join('');

    const totalVal = computeRowTotal(item, scoredRules);
    const totalCellHtml = scoredRules.length > 0
      ? `<span class="judge-row-total inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono font-extrabold text-sm min-w-[78px]" data-idx="${idx}">${totalVal !== null ? `${totalVal} / ${rubricMax}` : '—'}</span>`
      : `<input type="number" min="0" step="0.5" class="input-rem-score judge-row-total w-24 h-9 px-2 bg-white border border-slate-300 focus:border-indigo-600 rounded-lg font-mono text-sm font-bold text-center text-slate-900" data-idx="${idx}" data-col="total" value="${escapeHtml(item.score === null || item.score === undefined ? '' : String(item.score))}" placeholder="0–100"/>`;

    return `
      <tr class="hover:bg-indigo-50/30 transition-colors">
        <td class="py-2.5 px-3 text-center whitespace-nowrap">
          <span class="judge-row-rank font-mono text-[11px] text-slate-400" data-idx="${idx}">—</span>
        </td>
        <td class="py-2 px-3 min-w-[210px]">
          <input type="text" class="input-rem-name w-full h-8 px-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg text-xs font-bold text-slate-900 mb-1" data-idx="${idx}" data-col="name" value="${escapeHtml(item.contestant_name)}" placeholder="Competitor / Team Name"/>
          <input type="text" class="input-rem-inst w-full h-7 px-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-lg text-[11px] text-slate-600" data-idx="${idx}" data-col="inst" value="${escapeHtml(item.institution)}" placeholder="Delegation / Institution"/>
        </td>
        ${critCellsHtml}
        <td class="py-2 px-3 border-l border-slate-200 text-center whitespace-nowrap">
          ${totalCellHtml}
        </td>
        <td class="py-2 px-3 border-l border-slate-200 min-w-[180px]">
          <input type="text" class="input-rem-notes w-full h-9 px-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg text-xs text-slate-800" data-idx="${idx}" data-col="notes" value="${escapeHtml(item.remarks)}" placeholder="Quick remarks..."/>
        </td>
        <td class="py-2 px-2 border-l border-slate-200 text-center whitespace-nowrap">
          <button type="button" class="btn-remove-remark p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer" data-idx="${idx}" title="Remove Row">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs">
      <thead class="bg-slate-100/90 text-slate-600 font-bold uppercase border-b border-slate-200">
        <tr>
          <th class="py-3 px-3 text-center w-16">Rank</th>
          <th class="py-3 px-3">Competitor / Institution</th>
          ${critHeadersHtml}
          <th class="py-3 px-3 text-center border-l border-slate-200">Total Score</th>
          <th class="py-3 px-3 border-l border-slate-200">Jury Remarks</th>
          <th class="py-3 px-2 border-l border-slate-200 text-center w-12"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200 bg-white">
        ${rowsHtml}
      </tbody>
    </table>
  `;

  container.querySelectorAll('.input-rem-name').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].contestant_name = el.value; });
    el.addEventListener('keydown', (e) => handleGridVerticalNav(e, '#judge-remarks-list'));
  });
  container.querySelectorAll('.input-rem-inst').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].institution = el.value; });
    el.addEventListener('keydown', (e) => handleGridVerticalNav(e, '#judge-remarks-list'));
  });
  container.querySelectorAll('.input-grid-crit').forEach((el) => {
    el.addEventListener('input', () => {
      const idx = Number(el.getAttribute('data-idx'));
      const ruleId = el.getAttribute('data-rule-id');
      const maxPts = Number(el.getAttribute('data-max'));
      let valStr = el.value.trim();
      if (valStr !== '') {
        let num = Number(valStr);
        if (!Number.isFinite(num) || num < 0) num = 0;
        if (Number.isFinite(maxPts) && maxPts > 0 && num > maxPts) {
          num = maxPts;
          el.value = String(maxPts);
        }
        if (!remarksState[idx].criteria_scores || typeof remarksState[idx].criteria_scores !== 'object') {
          remarksState[idx].criteria_scores = {};
        }
        remarksState[idx].criteria_scores[ruleId] = num;
      } else if (remarksState[idx].criteria_scores) {
        delete remarksState[idx].criteria_scores[ruleId];
      }
      recomputeJudgeGridRanks();
    });
    el.addEventListener('keydown', (e) => handleGridVerticalNav(e, '#judge-remarks-list'));
  });
  container.querySelectorAll('.input-rem-score').forEach((el) => {
    el.addEventListener('input', () => {
      remarksState[Number(el.getAttribute('data-idx'))].score = el.value;
      recomputeJudgeGridRanks();
    });
    el.addEventListener('keydown', (e) => handleGridVerticalNav(e, '#judge-remarks-list'));
  });
  container.querySelectorAll('.input-rem-notes').forEach((el) => {
    el.addEventListener('input', () => { remarksState[Number(el.getAttribute('data-idx'))].remarks = el.value; });
    el.addEventListener('keydown', (e) => handleGridVerticalNav(e, '#judge-remarks-list'));
  });
  container.querySelectorAll('.btn-remove-remark').forEach((btn) => {
    btn.addEventListener('click', () => {
      remarksState.splice(Number(btn.getAttribute('data-idx')), 1);
      renderScoringGrid();
    });
  });

  recomputeJudgeGridRanks();
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

async function loadFestCompetitorsIntoGrid() {
  if (!activeFest?.id) return;
  try {
    const [regs, assignments, students, leaders] = await Promise.all([
      db.getRegistrations ? db.getRegistrations() : [],
      db.getTeamAssignments ? db.getTeamAssignments() : [],
      db.getTeamStudents ? db.getTeamStudents() : [],
      db.getTeamLeaders ? db.getTeamLeaders() : [],
    ]);

    const leaderMap = new Map((leaders || []).map((l) => [l.id, l]));
    const studentMap = new Map((students || []).map((s) => [s.id, s]));
    const candidates = [];

    (regs || []).filter((r) => r.event_id === activeFest.id && !r.is_restricted).forEach((r) => {
      const cName = (r.team_name || r.leader_name || '').trim();
      if (cName) candidates.push({ name: cName, institution: r.college_name || '' });
    });

    (assignments || []).filter((a) => a.event_id === activeFest.id).forEach((a) => {
      const leader = leaderMap.get(a.team_leader_id);
      const inst = leader?.institution_name || leader?.team_name || '';
      (Array.isArray(a.student_ids) ? a.student_ids : []).forEach((sid) => {
        const stu = studentMap.get(sid);
        if (stu?.student_name) candidates.push({ name: stu.student_name.trim(), institution: inst });
      });
    });

    (students || []).forEach((stu) => {
      const evList = Array.isArray(stu.assigned_events) ? stu.assigned_events : [];
      if (evList.some((ev) => ev && ev.event_id === activeFest.id) && stu.student_name) {
        const leader = leaderMap.get(stu.team_leader_id);
        candidates.push({ name: stu.student_name.trim(), institution: leader?.institution_name || leader?.team_name || '' });
      }
    });

    if (candidates.length === 0) {
      showToast('No registered or assigned competitors found for this Fest yet.', 'info');
      return;
    }

    let addedCount = 0;
    candidates.forEach((cand) => {
      const exists = remarksState.some(
        (x) => (x.contestant_name || '').trim().toLowerCase() === cand.name.toLowerCase()
      );
      if (!exists) {
        remarksState.push({
          id: `eval_${Date.now()}_${remarksState.length}`,
          contestant_name: cand.name,
          institution: cand.institution,
          score: '',
          max_total: null,
          criteria_scores: {},
          remarks: '',
        });
        addedCount++;
      }
    });

    renderScoringGrid();
    showToast(
      addedCount > 0 ? `Imported ${addedCount} competitor(s) into the scoring grid.` : 'All registered competitors are already in the grid.',
      'info'
    );
  } catch (err) {
    showToast('Could not load competitors: ' + err.message, 'error');
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

  document.getElementById('btn-load-rubric-preset')?.addEventListener('click', () => {
    const hasCustom = rulesState.some((r) => (r.title || '').trim().length > 0);
    if (hasCustom && !confirm('Replace current rules with the standard 4-criterion (100 pt) rubric preset?')) return;
    const base = Date.now();
    rulesState = [
      { id: `rule_${base}_1`, title: 'Technical Execution & Form', description: 'Accuracy, grammar, structure, and adherence to classical rules.', max_points: 30 },
      { id: `rule_${base}_2`, title: 'Content Depth & Theme', description: 'Originality, textual mastery, and thematic alignment.', max_points: 30 },
      { id: `rule_${base}_3`, title: 'Presentation & Delivery', description: 'Voice modulation, fluency, expression, and audience clarity.', max_points: 20 },
      { id: `rule_${base}_4`, title: 'Stage Decorum & Timing', description: 'Composure, discipline, and adherence to time limit.', max_points: 20 },
    ];
    renderRulesList();
    renderScoringGrid();
    showToast('Loaded 4-criterion (100 pt) scoring grid columns!', 'success');
  });

  document.getElementById('btn-add-judge-rule')?.addEventListener('click', () => {
    rulesState.push({ id: `rule_${Date.now()}_${rulesState.length}`, title: '', description: '', max_points: '' });
    renderRulesList();
    renderScoringGrid();
  });

  document.getElementById('btn-add-judge-remark')?.addEventListener('click', () => {
    remarksState.push({
      id: `eval_${Date.now()}_${remarksState.length}`,
      contestant_name: '',
      institution: '',
      score: '',
      max_total: null,
      criteria_scores: {},
      remarks: '',
    });
    renderScoringGrid();
  });

  document.getElementById('btn-sort-judge-grid')?.addEventListener('click', () => {
    const scoredRules = getScoredCriterionRules();
    remarksState.sort((a, b) => {
      const ta = computeRowTotal(a, scoredRules);
      const tb = computeRowTotal(b, scoredRules);
      return (tb ?? -1) - (ta ?? -1);
    });
    renderScoringGrid();
    showToast('Grid sorted by live score rank.', 'info');
  });

  document.getElementById('judge-grid-search')?.addEventListener('input', renderScoringGrid);
  document.getElementById('btn-load-fest-competitors')?.addEventListener('click', loadFestCompetitorsIntoGrid);

  document.getElementById('btn-save-sync-judgment')?.addEventListener('click', async () => {
    if (!activeToken || !activeFest?.id) return;
    const btn = document.getElementById('btn-save-sync-judgment');
    const summaryVal = sanitizePlainText(document.getElementById('judge-rules-summary')?.value || '', 4000);

    const hasValidRule = rulesState.some((r) => sanitizePlainText(r.title, 200) || sanitizePlainText(r.description, 2000));
    if (!hasValidRule && !summaryVal) {
      showToast('Please enter at least one judgment rule/criterion or general guideline before syncing.', 'warning');
      return;
    }

    const scoredRules = getScoredCriterionRules();
    const rubricMax = getRubricMaxTotal(scoredRules);
    const preparedRemarks = remarksState.map((r) => {
      const tot = computeRowTotal(r, scoredRules);
      return {
        ...r,
        score: tot,
        max_total: rubricMax > 0 ? rubricMax : null,
      };
    });

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Syncing with Admin...</span>';
    }

    try {
      const saved = await db.saveJudgeJudgment(activeToken, activeFest.id, {
        rules: rulesState,
        rules_summary: summaryVal,
        scores_or_remarks: preparedRemarks,
      });
      activeEntry = saved;
      updatePublicationStatusPill(saved);
      if (saved._cloudSyncWarning) {
        showToast(saved._cloudSyncWarning, 'warning');
      } else {
        showToast('Saved & synced scoring grid and rules directly to Admin Dashboard!', 'success');
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
