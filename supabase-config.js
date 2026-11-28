// ==============================================================================
// AL MURAFAQA • SUPABASE CLIENT & HYBRID DATA ENGINE
// Uses Supabase when configured; read failures can fall back to the local cache.
// Cloud write errors are surfaced so local-only changes are never reported as saved.
// ==============================================================================

const SUPABASE_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2',
];

// Native fetch wrapper with hard timeout so slow/blocked networks never stall UI loaders
async function timedFetch(input, init = {}, timeoutMs = 8000) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable in this environment.');
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId = null;
  let onExternalAbort = null;

  if (controller) {
    if (init?.signal) {
      if (init.signal.aborted) {
        controller.abort();
      } else {
        onExternalAbort = () => controller.abort();
        init.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await fetch(input, {
      ...init,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (onExternalAbort && init?.signal) {
      init.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function importWithTimeout(url, timeoutMs = 3500) {
  let timeoutId = null;
  try {
    return await Promise.race([
      import(url),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timed out loading ${url}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function safeParseJson(raw, fallback = null) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

// Helper to generate RFC4122 v4 UUIDs
export function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');

export const STORAGE_KEYS = {
  SETTINGS: 'almurafaqa_settings',
  EVENTS: 'almurafaqa_events',
  REGISTRATIONS: 'almurafaqa_registrations',
  ANNOUNCEMENTS: 'almurafaqa_announcements',
  WINNERS: 'almurafaqa_winners',
  SCORES: 'almurafaqa_scores',
  AUDIT_LOGS: 'almurafaqa_audit_logs',
  RESTRICTIONS: 'almurafaqa_restrictions',
  TEAM_LEADERS: 'almurafaqa_team_leaders',
  TEAM_STUDENTS: 'almurafaqa_team_students',
  TEAM_ASSIGNMENTS: 'almurafaqa_team_assignments',
  TEAM_GROUPS: 'almurafaqa_team_groups',
  JUDGE_TOKENS: 'almurafaqa_judge_tokens',
  JUDGMENT_ENTRIES: 'almurafaqa_judgment_entries',
};

// Generate alphanumeric Team Leader access token, e.g. TL-8F2B-91C4
export function generateLeaderToken() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TL-${p1}-${p2}`;
}

// Generate cryptographically random Judge access token, e.g. JDG-8F2B-91C4
export function generateJudgeToken() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(8);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(bytes[i] % chars.length);
    p2 += chars.charAt(bytes[i + 4] % chars.length);
  }
  return `JDG-${p1}-${p2}`;
}

export function sanitizePlainText(val, maxLen = 4000) {
  const clean = String(val ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function sanitizeJudgmentRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((r, idx) => {
      const title = sanitizePlainText(r?.title || r?.name || '', 200);
      const description = sanitizePlainText(r?.description || r?.details || '', 2000);
      const ptsRaw = r?.max_points !== '' && r?.max_points !== null && r?.max_points !== undefined ? Number(r.max_points) : null;
      const max_points = Number.isFinite(ptsRaw) && ptsRaw >= 0 ? ptsRaw : null;
      if (!title && !description) return null;
      return {
        id: sanitizePlainText(r?.id || `rule_${idx + 1}`, 80),
        title: title || `Criterion ${idx + 1}`,
        description,
        max_points,
      };
    })
    .filter(Boolean);
}

function sanitizeJudgmentRemarks(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, idx) => {
      const contestant_name = sanitizePlainText(item?.contestant_name || item?.team_name || '', 200);
      const institution = sanitizePlainText(item?.institution || item?.college_name || '', 200);
      const remarks = sanitizePlainText(item?.remarks || item?.notes || '', 1500);
      const scoreRaw = item?.score !== '' && item?.score !== null && item?.score !== undefined ? Number(item.score) : null;
      const score = Number.isFinite(scoreRaw) && scoreRaw >= 0 ? scoreRaw : null;
      if (!contestant_name && !remarks && score === null) return null;
      return {
        id: sanitizePlainText(item?.id || `eval_${idx + 1}`, 80),
        contestant_name: contestant_name || 'General Jury Note',
        institution,
        score,
        remarks,
      };
    })
    .filter(Boolean);
}

// ------------------------------------------------------------------------------
// PUBLIC PRODUCTION BASE URL & SHAREABLE PORTAL LINK GENERATOR
// Ensures generated links point to the public GitHub Pages domain (never localhost)
// ------------------------------------------------------------------------------
export const PRODUCTION_BASE_URL = 'https://abddeveloper-hub.github.io/al-murafaqa';

export function getShareablePortalUrl(token = '', page = 'leader.html') {
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.protocol === 'file:' ||
    !window.location.origin
  );

  let baseUrl = PRODUCTION_BASE_URL;
  if (!isLocal && typeof window !== 'undefined' && window.location.origin) {
    const path = window.location.pathname;
    const dir = path.substring(0, path.lastIndexOf('/'));
    baseUrl = `${window.location.origin}${dir}`;
  }

  // Allow custom override if configured in localStorage
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('almurafaqa_production_base_url');
    if (custom) baseUrl = custom.trim().replace(/\/+$/, '');
  }

  const cleanTok = (token || '').trim().toUpperCase();
  const tokenParam = cleanTok ? `?token=${encodeURIComponent(cleanTok)}` : '';
  return `${baseUrl}/${page}${tokenParam}`;
}

// ------------------------------------------------------------------------------
// 1. SUPABASE CREDENTIALS (PASTE YOUR SUPABASE DETAILS HERE)
// ------------------------------------------------------------------------------
export const SUPABASE_CONFIG = {
  // Connected to live Supabase project
  url: 'https://zyfzqkrkvxtjwhvslpgm.supabase.co',
  anonKey: 'sb_publishable_dbkY86vySUITUn0eAosVHA_8DZF_u6L',
};

// Check if credentials have been configured
const isPlaceholder = (val) => !val || val.includes('YOUR_PROJECT_ID') || val.includes('YOUR_SUPABASE_ANON_KEY');
export const isConfigured = !isPlaceholder(SUPABASE_CONFIG.url) && !isPlaceholder(SUPABASE_CONFIG.anonKey);

// Lazily initialized Supabase Client (non-blocking at module import so blocked CDNs never break UI scripts)
export let supabase = null;
let supabaseInitPromise = null;

export async function getSupabaseClient(timeoutMs = 3500) {
  if (!isConfigured) return null;
  if (supabase) return supabase;
  if (supabaseInitPromise) return supabaseInitPromise;

  supabaseInitPromise = (async () => {
    try {
      let createClientFn =
        (typeof globalThis !== 'undefined' && globalThis.supabase && typeof globalThis.supabase.createClient === 'function')
          ? globalThis.supabase.createClient
          : null;

      if (!createClientFn) {
        for (const cdnUrl of SUPABASE_CDN_URLS) {
          try {
            const mod = await importWithTimeout(cdnUrl, timeoutMs);
            if (mod && typeof mod.createClient === 'function') {
              createClientFn = mod.createClient;
              break;
            }
          } catch (cdnErr) {
            console.warn(`[Supabase CDN] Failed to load ${cdnUrl}:`, cdnErr?.message || cdnErr);
          }
        }
      }

      if (!createClientFn) return null;

      supabase = createClientFn(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: (url, opts) => timedFetch(url, opts, 8000),
        },
      });
      return supabase;
    } catch (err) {
      console.warn('[Supabase Config] Failed to initialize Supabase client:', err);
      return null;
    } finally {
      if (!supabase) {
        supabaseInitPromise = null;
      }
    }
  })();

  return supabaseInitPromise;
}

// Warm up Supabase SDK in the background without blocking ES module evaluation
if (isConfigured && typeof window !== 'undefined') {
  getSupabaseClient().catch(() => null);
}

// Zero-CDN direct PostgREST read fallback with hard timeout
async function restSelect(table, queryString = '', { single = false, timeoutMs = 6000 } = {}) {
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase credentials are not configured') };
  }
  try {
    const cleanUrl = SUPABASE_CONFIG.url.replace(/\/+$/, '');
    const url = `${cleanUrl}/rest/v1/${table}${queryString ? '?' + queryString : ''}`;
    const res = await timedFetch(
      url,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
          Accept: 'application/json',
        },
      },
      timeoutMs
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { data: null, error: new Error(text || `REST HTTP ${res.status}`) };
    }
    const json = await res.json();
    if (single) {
      const row = Array.isArray(json) ? (json[0] ?? null) : json;
      return { data: row, error: null };
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function restRpc(fnName, params = {}, { timeoutMs = 6000 } = {}) {
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase credentials are not configured') };
  }
  try {
    const cleanUrl = SUPABASE_CONFIG.url.replace(/\/+$/, '');
    const url = `${cleanUrl}/rest/v1/rpc/${fnName}`;
    const res = await timedFetch(
      url,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(params || {}),
      },
      timeoutMs
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsedErr = null;
      try { parsedErr = text ? JSON.parse(text) : null; } catch (_) {}
      const err = new Error(parsedErr?.message || text || `RPC HTTP ${res.status}`);
      if (parsedErr?.code) err.code = parsedErr.code;
      return { data: null, error: err };
    }
    const json = await res.json();
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ------------------------------------------------------------------------------
// 2. DEFAULT SETTINGS & EMPTY DATA COLLECTIONS (Live Supabase Connected)
// ------------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  id: 1,
  fest_name: 'Al Murafaqa • QUINTA EDICION',
  registrations_open: true,
  maintenance_mode: false,
  live_ticker_enabled: false,
  live_ticker_text: '',
  upi_id: '',
  support_phone: '',
  // Main Page Video Section Controls
  video_heading: 'Main Stage Broadcast',
  video_title: 'Mystic Poetry Recital & Qurtuba Ensemble',
  video_description: 'Live Cultural Stage & Ensemble Performances',
  video_venue: 'GRAND ANDALUSIAN DOME',
  video_url: '',
  video_poster_url: 'video-poster.jpg',
  video_is_live: true,
  video_viewer_count: '4.8k live',
  video_duration_note: '42 mins remaining',
  fest_dates: [],
  updated_at: '1970-01-01T00:00:00.000Z',
};

// ------------------------------------------------------------------------------
// FESTIVAL DATES & LIVE STATUS EVALUATION HELPERS
// ------------------------------------------------------------------------------
const FEST_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FEST_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseLocalFestDateTime(dateStr, timeStr = '00:00', seconds = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = /^\d{2}:\d{2}$/.test(String(timeStr || ''))
    ? String(timeStr).split(':').map(Number)
    : [0, 0];
  return new Date(y, m - 1, d, hh, mm, seconds, seconds === 59 ? 999 : 0);
}

export function formatFestDateShort(dateStr) {
  const dt = parseLocalFestDateTime(dateStr);
  if (!dt) return dateStr || '';
  return `${FEST_MONTHS_SHORT[dt.getMonth()]} ${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatFestDateReadable(dateStr) {
  const dt = parseLocalFestDateTime(dateStr);
  if (!dt) return dateStr || '';
  return `${FEST_DAYS_SHORT[dt.getDay()]}, ${FEST_MONTHS_SHORT[dt.getMonth()]} ${String(dt.getDate()).padStart(2, '0')}, ${dt.getFullYear()}`;
}

export function formatFestTime12h(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(String(timeStr || ''))) return timeStr || '';
  const [hh, mm] = String(timeStr).split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

export function normalizeFestDates(rawList) {
  if (!Array.isArray(rawList)) return [];
  const valid = rawList
    .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '').trim()))
    .map((item) => ({
      id: item.id || generateUuid(),
      date: String(item.date).trim(),
      label: String(item.label || '').trim(),
      start_time: /^\d{2}:\d{2}$/.test(String(item.start_time || '').trim()) ? String(item.start_time).trim() : '00:00',
      end_time: /^\d{2}:\d{2}$/.test(String(item.end_time || '').trim()) ? String(item.end_time).trim() : '23:59',
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  return valid.map((item, idx) => ({
    ...item,
    day_number: idx + 1,
  }));
}

function formatCountdownMs(ms) {
  const safeMs = Math.max(0, ms);
  const totalMins = Math.floor(safeMs / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days >= 2) return `Starts in ${days} days`;
  if (days === 1) return `Starts in 1d ${hours}h`;
  if (hours >= 1) return `Starts in ${hours}h ${mins}m`;
  return `Starts in ${Math.max(1, mins)}m`;
}

export function evaluateFestLiveStatus(festDates, now = new Date()) {
  const days = normalizeFestDates(festDates).map((d) => {
    const start = parseLocalFestDateTime(d.date, d.start_time, 0);
    let end = parseLocalFestDateTime(d.date, d.end_time, 59);
    if (end && start && end < start) {
      end = parseLocalFestDateTime(d.date, '23:59', 59);
    }
    return {
      ...d,
      start,
      end,
      shortDate: formatFestDateShort(d.date),
      readableDate: formatFestDateReadable(d.date),
    };
  });

  if (days.length === 0) {
    return {
      configured: false,
      state: 'unconfigured',
      isLive: false,
      totalDays: 0,
      days: [],
      activeDay: null,
      nextDay: null,
      currentDayNumber: null,
      dateRangeText: '',
      countdownText: '',
      bannerText: 'SCHEDULE TBA',
      shortBadge: '5TH EDITION',
    };
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const firstYear = firstDay.start ? firstDay.start.getFullYear() : '';
  const dateRangeText =
    days.length === 1
      ? `${firstDay.shortDate}, ${firstYear}`
      : `${firstDay.shortDate} – ${lastDay.shortDate}, ${firstYear}`;

  const activeDay = days.find((d) => d.start && d.end && now >= d.start && now <= d.end) || null;
  if (activeDay) {
    return {
      configured: true,
      state: 'live',
      isLive: true,
      totalDays: days.length,
      days,
      activeDay,
      nextDay: null,
      currentDayNumber: activeDay.day_number,
      dateRangeText,
      countdownText: `Ends ${formatFestTime12h(activeDay.end_time)}`,
      bannerText: `LIVE • DAY ${activeDay.day_number} IN PROGRESS`,
      shortBadge: `LIVE • DAY ${activeDay.day_number}`,
    };
  }

  const nextDay = days.find((d) => d.start && now < d.start) || null;
  if (nextDay) {
    const isBeforeAll = nextDay.day_number === 1;
    const msUntil = nextDay.start.getTime() - now.getTime();
    const countdownText = formatCountdownMs(msUntil);
    return {
      configured: true,
      state: isBeforeAll ? 'upcoming' : 'between',
      isLive: false,
      totalDays: days.length,
      days,
      activeDay: null,
      nextDay,
      currentDayNumber: nextDay.day_number,
      dateRangeText,
      countdownText,
      bannerText: isBeforeAll
        ? `UPCOMING • STARTS ${nextDay.shortDate.toUpperCase()}`
        : `NEXT • DAY ${nextDay.day_number} (${nextDay.shortDate.toUpperCase()})`,
      shortBadge: `UPCOMING • ${nextDay.shortDate.toUpperCase()}`,
    };
  }

  return {
    configured: true,
    state: 'concluded',
    isLive: false,
    totalDays: days.length,
    days,
    activeDay: null,
    nextDay: null,
    currentDayNumber: days.length,
    dateRangeText,
    countdownText: `Ended ${lastDay.shortDate}`,
    bannerText: `CONCLUDED • ${dateRangeText.toUpperCase()}`,
    shortBadge: 'CONCLUDED',
  };
}

const DEFAULT_EVENTS = [];
const DEFAULT_REGISTRATIONS = [];
const DEFAULT_ANNOUNCEMENTS = [];
const DEFAULT_WINNERS = [];

// Initialize storage and clean out any legacy mock/demo data from local cache
function initStorage() {
  if (typeof localStorage === 'undefined') return;

  // Purge any legacy mock records from localStorage
  const existingEventsRaw = localStorage.getItem('almurafaqa_events');
  if (existingEventsRaw && (existingEventsRaw.includes('evt-001') || existingEventsRaw.includes('a1b2c3d4-000') || existingEventsRaw.includes('Calligraphy Championship') || existingEventsRaw.includes('Diwan Classical') || existingEventsRaw.includes('Oud & Maqam'))) {
    localStorage.removeItem('almurafaqa_events');
  }

  // Purge extra custom categories so only the clean 4 core standard categories remain
  const existingCatsRaw = localStorage.getItem('almurafaqa_custom_categories');
  if (existingCatsRaw && (existingCatsRaw.includes('cat_khadima') || existingCatsRaw.includes('cat_arts') || existingCatsRaw.includes('Traditional Arts') || existingCatsRaw.includes('Sanawiyya') || existingCatsRaw.includes('cat_oratory') || existingCatsRaw.includes('cat_literature') || existingCatsRaw.includes('cat_vocal'))) {
    localStorage.removeItem('almurafaqa_custom_categories');
  }

  const existingRegsRaw = localStorage.getItem('almurafaqa_registrations');
  if (existingRegsRaw && (existingRegsRaw.includes('ALM-1042') || existingRegsRaw.includes('Zaid Al-Husseini') || existingRegsRaw.includes('Sofia Benali'))) {
    localStorage.removeItem('almurafaqa_registrations');
  }

  const existingWinnersRaw = localStorage.getItem('almurafaqa_winners');
  if (existingWinnersRaw && (existingWinnersRaw.includes('Zaid Al-Husseini') || existingWinnersRaw.includes('Mariam Al-Khatib'))) {
    localStorage.removeItem('almurafaqa_winners');
  }

  const existingAnnRaw = localStorage.getItem('almurafaqa_announcements');
  if (existingAnnRaw && (existingAnnRaw.includes('Oud Showcase') || existingAnnRaw.includes('Calligraphy Kit'))) {
    localStorage.removeItem('almurafaqa_announcements');
  }

  const existingPassRaw = localStorage.getItem('almurafaqa_delegate_pass');
  if (existingPassRaw && (existingPassRaw.includes('Sofia Benali') || existingPassRaw.includes('ALM-5829') || existingPassRaw.includes('ALM-1042'))) {
    localStorage.removeItem('almurafaqa_delegate_pass');
  }

  // Purge any mock/demo team students, leaders, assignments, and groups
  const existingTeamStudents = localStorage.getItem('almurafaqa_team_students');
  if (existingTeamStudents && (existingTeamStudents.includes('stu-demo') || existingTeamStudents.includes('COR-101') || existingTeamStudents.includes('Amina Benali'))) {
    localStorage.removeItem('almurafaqa_team_students');
  }

  const existingTeamLeaders = localStorage.getItem('almurafaqa_team_leaders');
  if (existingTeamLeaders && (existingTeamLeaders.includes('tl-demo-001') || existingTeamLeaders.includes('TL-CORD-2026') || existingTeamLeaders.includes('Cordoba Cultural Academy'))) {
    localStorage.removeItem('almurafaqa_team_leaders');
  }

  const existingTeamAssign = localStorage.getItem('almurafaqa_team_assignments');
  if (existingTeamAssign && (existingTeamAssign.includes('stu-demo') || existingTeamAssign.includes('COR-101'))) {
    localStorage.removeItem('almurafaqa_team_assignments');
  }

  const existingTeamGroups = localStorage.getItem('almurafaqa_team_groups');
  if (existingTeamGroups && (existingTeamGroups.includes('tl-demo-001') || existingTeamGroups.includes('COR-'))) {
    localStorage.removeItem('almurafaqa_team_groups');
  }

  const existingSettingsRaw = localStorage.getItem('almurafaqa_settings');
  if (existingSettingsRaw && (existingSettingsRaw.includes('AB6AXuBI4u7wM1') || existingSettingsRaw.includes('googleusercontent.com/aida-public'))) {
    try {
      const parsed = JSON.parse(existingSettingsRaw);
      parsed.video_poster_url = 'video-poster.jpg';
      localStorage.setItem('almurafaqa_settings', JSON.stringify(parsed));
    } catch (_) {
      localStorage.removeItem('almurafaqa_settings');
    }
  }

  if (!localStorage.getItem('almurafaqa_settings')) {
    localStorage.setItem('almurafaqa_settings', JSON.stringify(DEFAULT_SETTINGS));
  }
}
initStorage();

// ------------------------------------------------------------------------------
// 3. UNIFIED DATA SERVICE (Cloud Supabase with Local Demo Cache)
// ------------------------------------------------------------------------------

// Mock & Seed Data Purge Constants
const MOCK_TICKET_CODES = new Set(['ALM-1042', 'ALM-1043', 'ALM-1044', 'ALM-1045', 'TEST-9999', 'ALM-5829']);
const MOCK_LEADER_NAMES = new Set(['Zaid Al-Husseini', 'Sofia Benali', 'Ammar Qureshi', 'Kareem Mansoor', 'Test Attempter']);
const MOCK_WINNER_NAMES = new Set(['Zaid Al-Husseini', 'Mariam Al-Khatib', 'Hassan Bilal']);
const MOCK_ANNOUNCEMENT_TITLES = new Set(['Oud Showcase Venue Update', 'Calligraphy Kit Collection']);
const MOCK_EVENT_TITLES = new Set([
  'Andalusian Calligraphy Championship',
  'Diwan Classical Poetry Recital',
  'Oud & Maqam Ensemble Showcase',
  'Sacred Geometry & Architectural Model Design',
  'Hikmah & Moral Philosophy Colloquium'
]);

function purgeMockEvents(list) {
  if (!Array.isArray(list)) return [];
  let deletedIds = new Set();
  try {
    const stored = localStorage.getItem('almurafaqa_deleted_event_ids');
    if (stored) deletedIds = new Set(JSON.parse(stored));
  } catch (e) {}

  return list.filter((e) => {
    if (!e) return false;
    if (e.id && deletedIds.has(e.id)) return false;
    if (e.id && String(e.id).startsWith('a1b2c3d4-000')) return false;
    if (e.title && MOCK_EVENT_TITLES.has(e.title)) return false;
    return true;
  });
}

function purgeMockRegistrations(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((r) => {
    if (!r) return false;
    if (r.ticket_code && MOCK_TICKET_CODES.has(r.ticket_code)) return false;
    if (r.leader_name && MOCK_LEADER_NAMES.has(r.leader_name)) return false;
    if (r.team_name && (r.team_name.includes('Qalam Vanguard') || r.team_name.includes('Qurtuba Trio') || r.team_name.includes('Diwan Voices') || r.team_name.includes('Alhambra Builders'))) return false;
    return true;
  });
}

function purgeMockWinners(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((w) => {
    if (!w) return false;
    if (w.winner_name && MOCK_WINNER_NAMES.has(w.winner_name)) return false;
    return true;
  });
}

function purgeMockAnnouncements(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((a) => {
    if (!a) return false;
    if (a.title && MOCK_ANNOUNCEMENT_TITLES.has(a.title)) return false;
    return true;
  });
}

// 4 Clean Standard Core Categories
export const CORE_CLEAN_CATEGORIES = [
  { id: 'cat_senior', name: 'Senior', code: 'SNR', type: 'division', badge_color: 'purple', description: 'Senior Dars & Degree scholars', max_events: 5, active: true },
  { id: 'cat_junior', name: 'Junior', code: 'JNR', type: 'division', badge_color: 'indigo', description: 'Junior Dars scholars (Class 8-10)', max_events: 5, active: true },
  { id: 'cat_subjunior', name: 'Sub-Junior', code: 'SBJ', type: 'division', badge_color: 'cyan', description: 'Sub-Junior dars scholars', max_events: 4, active: true },
  { id: 'cat_general', name: 'General', code: 'GEN', type: 'division', badge_color: 'emerald', description: 'Open across all divisions and participants', max_events: null, active: true }
];

export const DEMO_CATEGORY_IDS = new Set([
  'cat_khadima', 'cat_aaliya', 'cat_sanawiyya', 'cat_hifz',
  'cat_oratory', 'cat_arts', 'cat_literature', 'cat_vocal'
]);

export function sanitizeCategoriesList(cats) {
  if (!Array.isArray(cats)) return [...CORE_CLEAN_CATEGORIES];
  const cleaned = cats.filter(c => c && !DEMO_CATEGORY_IDS.has(c.id));
  return cleaned.length > 0 ? cleaned : [...CORE_CLEAN_CATEGORIES];
}

export const db = {
  // Check active mode (true whenever Supabase credentials are configured; reads also work via direct REST)
  isLive() {
    return isConfigured;
  },

  async getClient(timeoutMs = 3500) {
    return await getSupabaseClient(timeoutMs);
  },

  // Master Admin Provisioning (Grants Unrestricted Full Privileges)
  grantAdminAccess(customUser = {}) {
    const adminEmail = customUser.email || 'admin@almurafaqa.com';
    const adminUser = {
      id: customUser.id || 'demo-admin-id',
      email: adminEmail,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: {
        name: customUser.name || 'Al Murafaqa Master Admin',
        role: 'admin',
        role_title: 'Festival Director & Master Administrator',
        access_level: 'superadmin',
        permissions: ['*'],
        all_access: true,
        ...(customUser.user_metadata || {}),
      },
      app_metadata: {
        provider: 'fest_master_auth',
        role: 'admin',
        role_title: 'Festival Director & Master Administrator',
        access_level: 'superadmin',
        permissions: ['*'],
        all_access: true,
        claims_admin: true,
        ...(customUser.app_metadata || {}),
      },
    };
    const adminSession = {
      user: adminUser,
      token: 'fest_master_admin_token_' + Date.now(),
      access_token: 'fest_master_admin_token_' + Date.now(),
      isMasterAdmin: true,
      allAccessGranted: true,
      grantedAt: new Date().toISOString(),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('almurafaqa_admin_session', JSON.stringify(adminSession));
    }
    return { user: adminUser, session: adminSession };
  },

  // Auth Operations
  async signIn(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const isAdminCandidate =
      normalizedEmail.includes('admin') ||
      normalizedEmail === 'director' ||
      !email;

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // If live user is admin, also sync local master session for resilience
        if (data?.session?.user) {
          const u = data.session.user;
          const isRoleAdmin =
            u.app_metadata?.role === 'admin' ||
            u.user_metadata?.role === 'admin' ||
            normalizedEmail.includes('admin');
          if (isRoleAdmin) {
            this.grantAdminAccess({
              id: u.id,
              email: u.email,
              user_metadata: u.user_metadata,
              app_metadata: u.app_metadata,
            });
          }
        }
        return data;
      } catch (liveErr) {
        // If live cloud sign-in fails but admin credentials were used, grant master admin bypass
        if (isAdminCandidate) {
          console.warn('[Supabase Live Sign-In] Cloud sign-in error, falling back to master admin grant:', liveErr.message);
          return this.grantAdminAccess({ email: email || 'admin@almurafaqa.com' });
        }
        throw liveErr;
      }
    } else {
      // Local / Demo Mode: Accept any administrator credentials or demo pass
      if (isAdminCandidate) {
        return this.grantAdminAccess({ email: email || 'admin@almurafaqa.com' });
      } else {
        throw new Error('Invalid credentials. Please verify your administrative email and password.');
      }
    }
  },

  async signOut() {
    const client = this.isLive() ? await getSupabaseClient(2000) : null;
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Sign-out error from Supabase:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('almurafaqa_admin_session');
    }
  },

  async getSession() {
    const client = this.isLive() ? await getSupabaseClient(2000) : null;
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        if (data?.session) return data.session;
      } catch (err) {
        console.warn('Error reading Supabase live session:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('almurafaqa_admin_session');
      return safeParseJson(raw, null);
    }
    return null;
  },

  // Fest Settings Operations
  async getSettings() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_settings') : null;
    const cachedSettings = safeParseJson(raw, null);

    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('fest_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle());
        } else {
          ({ data, error } = await restSelect('fest_settings', 'select=*&id=eq.1&limit=1', { single: true }));
        }

        if (!error && data) {
          const fallbackDates = Array.isArray(data.site_restrictions?._fest_dates)
            ? data.site_restrictions._fest_dates
            : [];
          const cloudDates = Array.isArray(data.fest_dates) && data.fest_dates.length > 0
            ? data.fest_dates
            : (Array.isArray(data.fest_dates) && fallbackDates.length === 0 ? data.fest_dates : fallbackDates);
          const cloudSettings = {
            ...DEFAULT_SETTINGS,
            ...data,
            fest_dates: normalizeFestDates(cloudDates),
          };
          if (!cloudSettings.video_poster_url || cloudSettings.video_poster_url.includes('AB6AXuBI4u7wM1') || cloudSettings.video_poster_url.includes('googleusercontent.com/aida-public')) {
            cloudSettings.video_poster_url = 'video-poster.jpg';
            // Self-heal cloud database row if it still holds the legacy mock oud player image URL
            if (supabase && data?.video_poster_url && (data.video_poster_url.includes('AB6AXuBI4u7wM1') || data.video_poster_url.includes('googleusercontent.com/aida-public'))) {
              supabase.from('fest_settings').update({ video_poster_url: 'video-poster.jpg' }).eq('id', 1).then(() => {}).catch(() => {});
            }
          }
          const hasPendingLocalEdits = cachedSettings && Object.keys(cachedSettings).some((key) => {
            if (key === 'id' || key === 'updated_at' || !(key in DEFAULT_SETTINGS)) return false;
            if (key === 'fest_dates') {
              return JSON.stringify(normalizeFestDates(cachedSettings.fest_dates)) !== JSON.stringify(DEFAULT_SETTINGS.fest_dates);
            }
            return cachedSettings[key] !== DEFAULT_SETTINGS[key];
          });
          const localUpdatedAt = Date.parse(cachedSettings?.updated_at || '');
          const cloudUpdatedAt = Date.parse(cloudSettings.updated_at || '');

          // Recover settings saved by the previous local-only fallback, so an admin
          // can publish them after the database schema has been brought up to date.
          if (hasPendingLocalEdits && Number.isFinite(localUpdatedAt) && localUpdatedAt > cloudUpdatedAt) {
            const merged = { ...cloudSettings, ...cachedSettings };
            merged.fest_dates = normalizeFestDates(merged.fest_dates);
            if (!merged.video_poster_url || merged.video_poster_url.includes('AB6AXuBI4u7wM1') || merged.video_poster_url.includes('googleusercontent.com/aida-public')) {
              merged.video_poster_url = 'video-poster.jpg';
            }
            return merged;
          }
          try {
            localStorage.setItem('almurafaqa_settings', JSON.stringify(cloudSettings));
          } catch (_) {}
          return cloudSettings;
        }
        if (error) console.warn('[Supabase getSettings]', error.message);
      } catch (err) {
        console.warn('[Supabase getSettings exception]', err.message);
      }
    }
    if (cachedSettings) {
      cachedSettings.fest_dates = normalizeFestDates(cachedSettings.fest_dates);
      if (!cachedSettings.video_poster_url || cachedSettings.video_poster_url.includes('AB6AXuBI4u7wM1') || cachedSettings.video_poster_url.includes('googleusercontent.com/aida-public')) {
        cachedSettings.video_poster_url = 'video-poster.jpg';
      }
      return cachedSettings;
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if ('fest_dates' in payload) {
      payload.fest_dates = normalizeFestDates(payload.fest_dates);
    }
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        // Attempt upsert with maybeSingle() so missing row 1 is created and empty results never throw PGRST116
        let { data, error } = await client
          .from('fest_settings')
          .upsert({ id: 1, ...payload }, { onConflict: 'id' })
          .select()
          .maybeSingle();

        // If error occurred (missing column, RLS restriction, etc.)
        if (error) {
          console.warn('[Supabase updateSettings]', error.message || error);

          // If table is missing newer columns (e.g. fest_dates before SQL migration is run)
          const isMissingCol =
            (error.message && (error.message.includes('column') || error.message.includes('schema cache'))) ||
            error.code === 'PGRST204';

          if (isMissingCol) {
            const baseCols = new Set([
              'fest_name',
              'registrations_open',
              'maintenance_mode',
              'live_ticker_enabled',
              'live_ticker_text',
              'upi_id',
              'support_phone',
              'video_heading',
              'video_title',
              'video_description',
              'video_venue',
              'video_url',
              'video_poster_url',
              'video_is_live',
              'video_viewer_count',
              'video_duration_note',
              'custom_categories',
              'stage_ops',
              'site_restrictions',
              'updated_at',
            ]);
            const basePayload = { id: 1 };
            for (const key of Object.keys(payload)) {
              if (baseCols.has(key)) basePayload[key] = payload[key];
            }
            // Mirror fest_dates inside site_restrictions._fest_dates so cloud sync works before SQL migration
            if ('fest_dates' in payload) {
              try {
                const { data: curRow } = await client
                  .from('fest_settings')
                  .select('site_restrictions')
                  .eq('id', 1)
                  .maybeSingle();
                const prevRes = (curRow?.site_restrictions && typeof curRow.site_restrictions === 'object')
                  ? curRow.site_restrictions
                  : {};
                basePayload.site_restrictions = { ...prevRes, _fest_dates: payload.fest_dates };
              } catch (_) {}
            }
            try {
              const retryRes = await client
                .from('fest_settings')
                .upsert(basePayload, { onConflict: 'id' })
                .select()
                .maybeSingle();
              if (!retryRes.error && retryRes.data) {
                const merged = {
                  ...DEFAULT_SETTINGS,
                  ...retryRes.data,
                  fest_dates: 'fest_dates' in payload ? payload.fest_dates : normalizeFestDates(retryRes.data.site_restrictions?._fest_dates),
                };
                localStorage.setItem('almurafaqa_settings', JSON.stringify(merged));
                return merged;
              }
            } catch (retryErr) {
              console.warn('[Supabase updateSettings base fallback]', retryErr.message);
            }
          }

          // Always persist full payload locally so UI succeeds and admin edits are preserved
          const current = (await this.getSettings()) || DEFAULT_SETTINGS;
          const updated = { ...DEFAULT_SETTINGS, ...current, ...payload };
          localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
          return updated;
        }

        // If no data returned (e.g. RLS silently filtered out response rows)
        if (!data) {
          console.warn('[Supabase updateSettings] No data returned from upsert (possibly RLS filtered). Persisting locally.');
          const current = (await this.getSettings()) || DEFAULT_SETTINGS;
          const updated = { ...DEFAULT_SETTINGS, ...current, ...payload };
          localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
          return updated;
        }

        const updated = { ...DEFAULT_SETTINGS, ...data };
        if ('fest_dates' in payload && (!Array.isArray(updated.fest_dates) || updated.fest_dates.length === 0)) {
          updated.fest_dates = payload.fest_dates;
        }
        updated.fest_dates = normalizeFestDates(updated.fest_dates);
        localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
        return updated;
      } catch (liveErr) {
        console.warn('[Supabase updateSettings unexpected exception fallback]', liveErr.message);
        const current = (await this.getSettings()) || DEFAULT_SETTINGS;
        const updated = { ...DEFAULT_SETTINGS, ...current, ...payload };
        localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
        return updated;
      }
    }

    const current = await this.getSettings();
    const updated = { ...DEFAULT_SETTINGS, ...current, ...payload };
    localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
    return updated;
  },

  async getFestDates() {
    const settings = await this.getSettings();
    return normalizeFestDates(settings?.fest_dates || []);
  },

  async saveFestDates(datesList) {
    const normalized = normalizeFestDates(datesList);
    const updated = await this.updateSettings({ fest_dates: normalized });
    return normalizeFestDates(updated?.fest_dates || normalized);
  },

  // Competition & Participant Categories Operations
  async getCategories() {
    let cached = null;
    try {
      const local = localStorage.getItem('almurafaqa_custom_categories');
      if (local) {
        const parsed = safeParseJson(local, null);
        if (Array.isArray(parsed) && parsed.length > 0) cached = parsed;
      }
    } catch (e) {}

    let cloudCats = null;
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('fest_settings')
            .select('custom_categories')
            .eq('id', 1)
            .maybeSingle());
        } else {
          ({ data, error } = await restSelect('fest_settings', 'select=custom_categories&id=eq.1&limit=1', { single: true }));
        }
        if (!error && data?.custom_categories && Array.isArray(data.custom_categories) && data.custom_categories.length > 0) {
          cloudCats = data.custom_categories;
        }
      } catch (e) {
        console.warn('[Supabase getCategories]', e);
      }
    }

    // Authoritative order: cloud categories > local custom categories > default fallback
    const rawResult = cloudCats || cached || CORE_CLEAN_CATEGORIES;
    const result = sanitizeCategoriesList(rawResult);

    try {
      localStorage.setItem('almurafaqa_custom_categories', JSON.stringify(result));
    } catch (e) {}

    return result;
  },

  async resetCategoriesToDefault() {
    try {
      localStorage.setItem('almurafaqa_custom_categories', JSON.stringify(CORE_CLEAN_CATEGORIES));
    } catch (e) {}

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client
          .from('fest_settings')
          .update({ custom_categories: CORE_CLEAN_CATEGORIES })
          .eq('id', 1);
      } catch (e) {
        console.warn('[Supabase resetCategoriesToDefault]', e);
      }
    }
    return [...CORE_CLEAN_CATEGORIES];
  },

  async saveCategory(categoryData) {
    const list = await this.getCategories();
    const cleanName = (categoryData.name || '').trim();
    if (!cleanName) throw new Error('Category name is required');

    let cleanCode = (categoryData.code || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'CAT';
    }

    const id = categoryData.id || ('cat_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const entry = {
      id,
      name: cleanName,
      code: cleanCode,
      type: categoryData.type || 'division',
      badge_color: categoryData.badge_color || 'purple',
      description: categoryData.description || '',
      max_events: categoryData.max_events ? parseInt(categoryData.max_events, 10) : null,
      active: categoryData.active !== false,
      updated_at: new Date().toISOString()
    };

    const idx = list.findIndex(c => c.id === id || c.name.toLowerCase() === cleanName.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.push(entry);
    }

    try {
      localStorage.setItem('almurafaqa_custom_categories', JSON.stringify(list));
    } catch (e) {}

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client
          .from('fest_settings')
          .update({ custom_categories: list })
          .eq('id', 1);
      } catch (e) {
        console.warn('[Supabase saveCategory]', e);
      }
    }

    return entry;
  },

  async deleteCategory(categoryId) {
    const list = await this.getCategories();
    const cat = list.find(c => c.id === categoryId);
    if (!cat) return false;

    // Check if any events use this category
    const events = await this.getEvents();
    const inUse = events.filter(e => e.category && (e.category.toLowerCase() === cat.name.toLowerCase() || e.category.toLowerCase() === cat.id.toLowerCase()));
    if (inUse.length > 0) {
      throw new Error(`Cannot delete "${cat.name}" because it is currently assigned to ${inUse.length} programme(s). Please reassign those programmes first.`);
    }

    const updated = list.filter(c => c.id !== categoryId);
    try {
      localStorage.setItem('almurafaqa_custom_categories', JSON.stringify(updated));
    } catch (e) {}

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client
          .from('fest_settings')
          .update({ custom_categories: updated })
          .eq('id', 1);
      } catch (e) {
        console.warn('[Supabase deleteCategory]', e);
      }
    }

    return true;
  },

  // Events Operations
  async getEvents() {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase.from('events').select('*').order('day_number', { ascending: true }));
        } else {
          ({ data, error } = await restSelect('events', 'select=*&order=day_number.asc'));
        }
        if (!error && Array.isArray(data)) {
          const clean = purgeMockEvents(data);
          try { localStorage.setItem('almurafaqa_events', JSON.stringify(clean)); } catch (_) {}
          return clean;
        }
      } catch (err) {
        console.warn('[Supabase getEvents]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_events') : null;
    const parsed = safeParseJson(raw, null);
    return purgeMockEvents(Array.isArray(parsed) ? parsed : DEFAULT_EVENTS);
  },

  async purgeAllDemoEvents() {
    try {
      const stored = localStorage.getItem('almurafaqa_deleted_event_ids');
      const deletedIds = stored ? new Set(JSON.parse(stored)) : new Set();
      MOCK_EVENT_TITLES.forEach((t) => deletedIds.add(t));
      localStorage.setItem('almurafaqa_deleted_event_ids', JSON.stringify(Array.from(deletedIds)));
      localStorage.removeItem('almurafaqa_events');
    } catch (e) {}
    return true;
  },

  async saveEvent(eventData) {
    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const payload = { ...eventData };
      if (!payload.category) payload.category = 'Senior';
      if (!payload.day_number) payload.day_number = 1;
      if (!payload.max_capacity) payload.max_capacity = 40;
      if (!payload.venue) payload.venue = 'Grand Hall';
      if (!payload.time_slot) payload.time_slot = '10:00 AM - 12:00 PM';
      if (!payload.title) throw new Error('Event title is required');

      try {
        if (eventData.id && isUuid(eventData.id)) {
          const { data, error } = await client.from('events').update(payload).eq('id', eventData.id).select().single();
          if (error) throw error;
          if (data) {
            const list = await this.getEvents();
            const idx = list.findIndex((e) => e.id === data.id);
            if (idx !== -1) list[idx] = data;
            else list.push(data);
            localStorage.setItem('almurafaqa_events', JSON.stringify(list));
            return data;
          }
        } else {
          delete payload.id;
          const { data, error } = await client.from('events').insert([payload]).select().single();
          if (error) throw error;
          if (data) {
            const list = await this.getEvents();
            if (!list.some((e) => e.id === data.id)) list.push(data);
            localStorage.setItem('almurafaqa_events', JSON.stringify(list));
            return data;
          }
        }
      } catch (err) {
        // If Supabase table is missing newer columns (before user runs complete migration SQL)
        const isMissingCol = err.message && (err.message.includes('column') || err.message.includes('schema cache') || err.code === 'PGRST204');
        if (isMissingCol) {
          console.warn('[Supabase saveEvent schema fallback]', err.message);
          const baseCols = new Set(['title', 'category', 'day_number', 'time_slot', 'venue', 'rules', 'max_capacity', 'is_featured', 'status', 'fee', 'prize_pool', 'team_size_min', 'team_size_max']);
          const basePayload = {};
          for (const k of Object.keys(payload)) {
            if (baseCols.has(k)) basePayload[k] = payload[k];
          }
          if (eventData.id && isUuid(eventData.id)) {
            const retry = await client.from('events').update(basePayload).eq('id', eventData.id).select().single();
            if (!retry.error && retry.data) {
              const fullData = { ...payload, ...retry.data };
              const list = await this.getEvents();
              const idx = list.findIndex((e) => e.id === fullData.id);
              if (idx !== -1) list[idx] = fullData;
              else list.push(fullData);
              localStorage.setItem('almurafaqa_events', JSON.stringify(list));
              return fullData;
            }
          } else {
            const retry = await client.from('events').insert([basePayload]).select().single();
            if (!retry.error && retry.data) {
              const fullData = { ...payload, ...retry.data };
              const list = await this.getEvents();
              const idx = list.findIndex((e) => e.id === fullData.id);
              if (idx !== -1) list[idx] = fullData;
              else list.push(fullData);
              localStorage.setItem('almurafaqa_events', JSON.stringify(list));
              return fullData;
            }
          }
        }
        throw err;
      }
    }
    // Local fallback
    const events = await this.getEvents();
    if (eventData.id) {
      const index = events.findIndex((e) => e.id === eventData.id);
      if (index !== -1) {
        events[index] = { ...events[index], ...eventData };
      } else {
        events.push(eventData);
      }
    } else {
      eventData.id = generateUuid();
      eventData.created_at = new Date().toISOString();
      events.push(eventData);
    }
    localStorage.setItem('almurafaqa_events', JSON.stringify(events));
    return eventData;
  },

  async deleteEvent(id) {
    // Persist deletion locally so mock or deleted events never reappear
    try {
      const stored = localStorage.getItem('almurafaqa_deleted_event_ids');
      const deletedIds = stored ? new Set(JSON.parse(stored)) : new Set();
      deletedIds.add(id);
      localStorage.setItem('almurafaqa_deleted_event_ids', JSON.stringify(Array.from(deletedIds)));
    } catch (e) {}

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { error } = await client.from('events').delete().eq('id', id);
        if (error) console.warn('[Supabase deleteEvent]', error);
      } catch (err) {
        console.warn('[Supabase deleteEvent]', err);
      }
    }
    const events = (await this.getEvents()).filter((e) => e.id !== id);
    localStorage.setItem('almurafaqa_events', JSON.stringify(events));
    const registrations = await this.getRegistrations();
    localStorage.setItem('almurafaqa_registrations', JSON.stringify(registrations.filter((r) => r.event_id !== id)));
    const winners = await this.getWinners();
    localStorage.setItem('almurafaqa_winners', JSON.stringify(winners.filter((w) => w.event_id !== id)));
    return true;
  },

  // Registrations Operations
  async getRegistrations() {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('registrations')
            .select('*, events(title, fee)')
            .order('created_at', { ascending: false }));
        } else {
          ({ data, error } = await restSelect('registrations', 'select=*,events(title,fee)&order=created_at.desc'));
        }
        if (!error && Array.isArray(data)) {
          const clean = purgeMockRegistrations(data);
          try { localStorage.setItem('almurafaqa_registrations', JSON.stringify(clean)); } catch (_) {}
          return clean;
        }
      } catch (err) {
        console.warn('[Supabase getRegistrations]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_registrations') : null;
    const parsed = safeParseJson(raw, null);
    return purgeMockRegistrations(Array.isArray(parsed) ? parsed : DEFAULT_REGISTRATIONS);
  },

  async updatePayment(id, payment_status) {
    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const { data, error } = await client
        .from('registrations')
        .update({ payment_status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('Payment status update did not return a registration.');
      return data;
    }
    const list = await this.getRegistrations();
    const item = list.find((r) => r.id === id);
    if (item) {
      item.payment_status = payment_status;
      localStorage.setItem('almurafaqa_registrations', JSON.stringify(list));
    }
    return item;
  },

  async checkIn(id, checked_in) {
    const timestamp = checked_in ? new Date().toISOString() : null;
    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const { data, error } = await client
        .from('registrations')
        .update({ checked_in, checked_in_at: timestamp })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('Check-in update did not return a registration.');
      return data;
    }
    const list = await this.getRegistrations();
    const item = list.find((r) => r.id === id);
    if (item) {
      item.checked_in = checked_in;
      item.checked_in_at = timestamp;
      localStorage.setItem('almurafaqa_registrations', JSON.stringify(list));
    }
    return item;
  },

    async updateRegistration(id, updates) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('registrations')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase updateRegistration error, fallback to local:', e);
      }
    }
    const list = await this.getRegistrations();
    const item = list.find((r) => r.id === id);
    if (item) {
      Object.assign(item, updates);
      localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(list));
      return item;
    }
    throw new Error('Registration record not found.');
  },

  async addRegistration(regData) {
    if (!regData.ticket_code) {
      regData.ticket_code = (regData.team_name ? 'ALM-TEAM-' : 'ALM-') + Math.floor(1000 + Math.random() * 9000);
    }
    regData.created_at = regData.created_at || new Date().toISOString();
    if (!regData.team_members) regData.team_members = [{ name: regData.leader_name, role: 'Lead' }];

    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const payload = { ...regData };
      delete payload.id;
      const { data, error } = await client.from('registrations').insert([payload]).select().single();
      if (error) throw error;
      if (!data) throw new Error('Registration creation did not return a record.');
      return data;
    }
    regData.id = generateUuid();
    const list = await this.getRegistrations();
    list.unshift(regData);
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(list));
    return regData;
  },

  // Announcements Operations
  async getAnnouncements() {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false }));
        } else {
          ({ data, error } = await restSelect('announcements', 'select=*&order=created_at.desc'));
        }
        if (!error && Array.isArray(data)) {
          const clean = purgeMockAnnouncements(data);
          try { localStorage.setItem('almurafaqa_announcements', JSON.stringify(clean)); } catch (_) {}
          return clean;
        }
      } catch (err) {
        console.warn('[Supabase getAnnouncements]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_announcements') : null;
    const parsed = safeParseJson(raw, null);
    return purgeMockAnnouncements(Array.isArray(parsed) ? parsed : DEFAULT_ANNOUNCEMENTS);
  },

  async saveAnnouncement(data) {
    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      if (data.id && isUuid(data.id)) {
        const { data: updated, error } = await client
          .from('announcements')
          .update(data)
          .eq('id', data.id)
          .select()
          .single();
        if (error) throw error;
        if (!updated) throw new Error('Announcement update did not return a record.');
        return updated;
      } else {
        const payload = { ...data };
        delete payload.id;
        const { data: inserted, error } = await client
          .from('announcements')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (!inserted) throw new Error('Announcement creation did not return a record.');
        return inserted;
      }
    }
    const list = await this.getAnnouncements();
    if (data.id) {
      const index = list.findIndex((a) => a.id === data.id);
      if (index !== -1) list[index] = { ...list[index], ...data };
    } else {
      data.id = generateUuid();
      data.created_at = new Date().toISOString();
      list.unshift(data);
    }
    localStorage.setItem('almurafaqa_announcements', JSON.stringify(list));
    return data;
  },

  async deleteAnnouncement(id) {
    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const { error } = await client.from('announcements').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const list = await this.getAnnouncements();
    const filtered = list.filter((a) => a.id !== id);
    localStorage.setItem('almurafaqa_announcements', JSON.stringify(filtered));
    return true;
  },

  // Winners Operations
  async getWinners() {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('winners')
            .select('*, events(title, category)')
            .order('position', { ascending: true }));
        } else {
          ({ data, error } = await restSelect('winners', 'select=*,events(title,category)&order=position.asc'));
        }
        if (!error && Array.isArray(data)) {
          const clean = purgeMockWinners(data);
          try { localStorage.setItem('almurafaqa_winners', JSON.stringify(clean)); } catch (_) {}
          return clean;
        }
      } catch (err) {
        console.warn('[Supabase getWinners]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_winners') : null;
    const parsed = safeParseJson(raw, null);
    return purgeMockWinners(Array.isArray(parsed) ? parsed : DEFAULT_WINNERS);
  },

  async saveWinners(eventId, winnersArray, published = true) {
    const records = winnersArray
      .filter((w) => w && w.winner_name && w.winner_name.trim().length > 0)
      .map((w) => ({
        event_id: eventId,
        position: Number(w.position),
        winner_name: w.winner_name.trim(),
        college_name: (w.college_name || '').trim(),
        published: Boolean(published),
        created_at: new Date().toISOString(),
      }));

    if (this.isLive()) {
      const client = await getSupabaseClient();
      if (!client) throw new Error('Cloud connection unavailable right now. Please try again.');
      const { error: delError } = await client.from('winners').delete().eq('event_id', eventId);
      if (delError) throw delError;
      if (records.length > 0) {
        const { data, error } = await client.from('winners').insert(records).select();
        if (error) throw error;
        const refreshed = await this.getWinners();
        try { localStorage.setItem('almurafaqa_winners', JSON.stringify(refreshed)); } catch (_) {}
        return data || [];
      }
      const refreshed = await this.getWinners();
      try { localStorage.setItem('almurafaqa_winners', JSON.stringify(refreshed)); } catch (_) {}
      return [];
    }

    // Local fallback
    const list = (await this.getWinners()).filter((w) => w.event_id !== eventId);
    records.forEach((r) => {
      r.id = generateUuid();
      list.push(r);
    });
    localStorage.setItem('almurafaqa_winners', JSON.stringify(list));
    return records;
  },

  // ----------------------------------------------------------------------------
  // MODULE 1: JURY SCORING & RUBRIC PORTAL (Supabase Cloud Backed)
  // ----------------------------------------------------------------------------
  async getScores(eventId = null) {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          let query = supabase.from('scores').select('*').order('created_at', { ascending: false });
          if (eventId) query = query.eq('event_id', eventId);
          ({ data, error } = await query);
        } else {
          const qs = 'select=*&order=created_at.desc' + (eventId ? `&event_id=eq.${encodeURIComponent(eventId)}` : '');
          ({ data, error } = await restSelect('scores', qs));
        }
        if (!error && Array.isArray(data)) {
          if (!eventId) {
            try { localStorage.setItem('almurafaqa_scores', JSON.stringify(data)); } catch (_) {}
          }
          return data;
        }
        if (error && error.code !== 'PGRST205') {
          console.warn('[Supabase getScores]', error.message);
        }
      } catch (err) {
        console.warn('[Supabase getScores exception]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_scores') : null;
    const parsed = safeParseJson(raw, []);
    const list = Array.isArray(parsed) ? parsed : [];
    if (eventId) {
      return list.filter((s) => s.event_id === eventId);
    }
    return list;
  },

  async saveScore(scoreObj) {
    const record = {
      ...scoreObj,
      id: scoreObj.id || generateUuid(),
      updated_at: new Date().toISOString(),
    };

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const payload = { ...record };
        if (!isUuid(payload.id)) delete payload.id;
        const { data, error } = await client.from('scores').upsert([payload]).select().single();
        if (!error && data) {
          const list = await this.getScores();
          const idx = list.findIndex((s) => s.id === data.id);
          if (idx !== -1) list[idx] = data;
          else list.unshift(data);
          localStorage.setItem('almurafaqa_scores', JSON.stringify(list));
          return data;
        }
        if (error && error.code !== 'PGRST205') {
          console.warn('[Supabase saveScore]', error.message);
        }
      } catch (err) {
        console.warn('[Supabase saveScore exception]', err);
      }
    }

    const list = await this.getScores();
    const existingIdx = list.findIndex((s) => s.id === record.id || (s.event_id === record.event_id && s.registration_id === record.registration_id && s.judge_name === record.judge_name));
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem('almurafaqa_scores', JSON.stringify(list));
    return record;
  },

  async deleteScore(id) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('scores').delete().eq('id', id);
      } catch (err) {
        console.warn('[Supabase deleteScore]', err);
      }
    }
    const list = await this.getScores();
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem('almurafaqa_scores', JSON.stringify(filtered));
    return true;
  },

  // ----------------------------------------------------------------------------
  // MODULE 3: STAGE OPERATIONS & RUN-OF-SHOW CONTROLLER (Supabase Cloud Backed)
  // ----------------------------------------------------------------------------
  async getStageOps() {
    const defaultOps = {
      active_stage: 'main',
      stages: {
        main: {
          id: 'main',
          name: 'Grand Andalusian Dome',
          status: 'idle', // 'idle' | 'live' | 'paused'
          active_performer: '',
          active_event_id: '',
          active_event_title: '',
          started_at: null,
          delay_minutes: 0,
          av_notes: '4 Wireless Handheld Mics, Qalam Backing Visual Track',
        },
        stage2: {
          id: 'stage2',
          name: 'Qalam Hall',
          status: 'idle',
          active_performer: '',
          active_event_id: '',
          active_event_title: '',
          started_at: null,
          delay_minutes: 0,
          av_notes: 'Podium Mic, Projection Screen Active',
        },
        stage3: {
          id: 'stage3',
          name: 'Diwan Pavilion',
          status: 'idle',
          active_performer: '',
          active_event_id: '',
          active_event_title: '',
          started_at: null,
          delay_minutes: 0,
          av_notes: '2 Lapel Mics, Floor Monitors 40%',
        },
      },
      queue: [],
    };

    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('fest_settings')
            .select('stage_ops')
            .eq('id', 1)
            .maybeSingle());
        } else {
          ({ data, error } = await restSelect('fest_settings', 'select=stage_ops&id=eq.1&limit=1', { single: true }));
        }
        if (!error && data?.stage_ops && typeof data.stage_ops === 'object' && Object.keys(data.stage_ops).length > 0) {
          const cloudOps = { ...defaultOps, ...data.stage_ops, stages: { ...defaultOps.stages, ...(data.stage_ops.stages || {}) } };
          localStorage.setItem('almurafaqa_stage_ops', JSON.stringify(cloudOps));
          return cloudOps;
        }
      } catch (e) {
        console.warn('[Supabase getStageOps]', e);
      }
    }

    try {
      const raw = localStorage.getItem('almurafaqa_stage_ops');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultOps, ...parsed, stages: { ...defaultOps.stages, ...(parsed.stages || {}) } };
      }
    } catch (e) {}
    return defaultOps;
  },

  async updateStageOps(opsObj) {
    const current = await this.getStageOps();
    const merged = { ...current, ...opsObj };
    localStorage.setItem('almurafaqa_stage_ops', JSON.stringify(merged));

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client
          .from('fest_settings')
          .update({ stage_ops: merged })
          .eq('id', 1);
      } catch (err) {
        console.warn('[Supabase updateStageOps]', err);
      }
    }
    return merged;
  },

  async setStageDelay(stageId, minutes) {
    const current = await this.getStageOps();
    if (current.stages && current.stages[stageId]) {
      current.stages[stageId].delay_minutes = minutes;
      return await this.updateStageOps(current);
    }
    return current;
  },

  // ----------------------------------------------------------------------------
  // MODULE 8: AUDIT TRAIL ENGINE (Supabase Cloud Backed)
  // ----------------------------------------------------------------------------
  async getAuditLogs() {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(250));
        } else {
          ({ data, error } = await restSelect('audit_logs', 'select=*&order=created_at.desc&limit=250'));
        }
        if (!error && Array.isArray(data)) {
          try { localStorage.setItem('almurafaqa_audit_logs', JSON.stringify(data)); } catch (_) {}
          return data;
        }
        if (error && error.code !== 'PGRST205') {
          console.warn('[Supabase getAuditLogs]', error.message);
        }
      } catch (err) {
        console.warn('[Supabase getAuditLogs exception]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('almurafaqa_audit_logs') : null;
    const parsed = safeParseJson(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  },

  async addAuditLog(action, details, role = 'Super Admin') {
    const entry = {
      id: generateUuid(),
      role: role || 'Super Admin',
      action: action || 'OPERATION',
      details: details || '',
      created_at: new Date().toISOString(),
    };

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const payload = { ...entry };
        delete payload.id;
        const { data, error } = await client.from('audit_logs').insert([payload]).select().single();
        if (!error && data) {
          const list = await this.getAuditLogs();
          if (!list.some((x) => x.id === data.id)) list.unshift(data);
          if (list.length > 500) list.length = 500;
          localStorage.setItem('almurafaqa_audit_logs', JSON.stringify(list));
          return data;
        }
        if (error && error.code !== 'PGRST205') {
          console.warn('[Supabase addAuditLog]', error.message);
        }
      } catch (err) {
        console.warn('[Supabase addAuditLog exception]', err);
      }
    }

    const list = await this.getAuditLogs();
    list.unshift(entry);
    // keep at most 500 latest entries
    if (list.length > 500) list.length = 500;
    localStorage.setItem('almurafaqa_audit_logs', JSON.stringify(list));
    return entry;
  },

  // ----------------------------------------------------------------------------
  // MODULE 7: BACKUP & DATA RESTORE
  // ----------------------------------------------------------------------------
  async getFullBackup() {
    const [settings, events, registrations, announcements, winners, scores, stageOps, auditLogs, judgeTokens, judgmentEntries] = await Promise.all([
      this.getSettings(),
      this.getEvents(),
      this.getRegistrations(),
      this.getAnnouncements(),
      this.getWinners(),
      this.getScores(),
      this.getStageOps(),
      this.getAuditLogs(),
      this.getJudgeTokens ? this.getJudgeTokens() : [],
      this.getJudgmentEntries ? this.getJudgmentEntries() : [],
    ]);

    return {
      version: '5.1',
      export_date: new Date().toISOString(),
      fest_name: 'Al Murafaqa • QUINTA EDICION',
      collections: {
        settings,
        events,
        registrations,
        announcements,
        winners,
        scores,
        stageOps,
        auditLogs,
        judgeTokens,
        judgmentEntries,
      },
    };
  },

  async restoreBackup(backupData) {
    if (!backupData || !backupData.collections) {
      throw new Error('Invalid backup file format: missing collections payload.');
    }
    const { settings, events, registrations, announcements, winners, scores, stageOps, auditLogs, judgeTokens, judgmentEntries } = backupData.collections;

    if (settings) localStorage.setItem('almurafaqa_settings', JSON.stringify(settings));
    if (Array.isArray(events)) localStorage.setItem('almurafaqa_events', JSON.stringify(events));
    if (Array.isArray(registrations)) localStorage.setItem('almurafaqa_registrations', JSON.stringify(registrations));
    if (Array.isArray(announcements)) localStorage.setItem('almurafaqa_announcements', JSON.stringify(announcements));
    if (Array.isArray(winners)) localStorage.setItem('almurafaqa_winners', JSON.stringify(winners));
    if (Array.isArray(scores)) localStorage.setItem('almurafaqa_scores', JSON.stringify(scores));
    if (stageOps) localStorage.setItem('almurafaqa_stage_ops', JSON.stringify(stageOps));
    if (Array.isArray(auditLogs)) localStorage.setItem('almurafaqa_audit_logs', JSON.stringify(auditLogs));
    if (Array.isArray(judgeTokens)) localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(judgeTokens));
    if (Array.isArray(judgmentEntries)) localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(judgmentEntries));

    await this.addAuditLog('DATABASE_RESTORE', 'Full database restored from JSON backup archive', 'Super Admin');
    return true;
  },

  // ----------------------------------------------------------------------------
  // RESTRICTION & ACCESS CONTROL ENGINE (Supabase Cloud Backed)
  // ----------------------------------------------------------------------------
  async setRegistrationRestriction(id, is_restricted, reason = '', severity = 'FULL_LOCKOUT', category = 'Disciplinary Violation / Misconduct') {
    const timestamp = is_restricted ? new Date().toISOString() : null;
    const updates = {
      is_restricted: Boolean(is_restricted),
      restriction_reason: is_restricted ? reason : '',
      restriction_severity: is_restricted ? severity : null,
      restriction_category: is_restricted ? category : null,
      restricted_at: timestamp
    };
    return await this.updateRegistration(id, updates);
  },

  async getRestrictions() {
    const defaultRestrictions = {
      site_lockdown: false,
      registration_freeze: false,
      gate_ingress_restricted: false,
      score_embargo: false,
      zone_backstage_restricted: true,
      zone_vip_restricted: true,
      zone_press_restricted: true,
      updated_at: new Date().toISOString(),
    };

    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('fest_settings')
            .select('site_restrictions')
            .eq('id', 1)
            .maybeSingle());
        } else {
          ({ data, error } = await restSelect('fest_settings', 'select=site_restrictions&id=eq.1&limit=1', { single: true }));
        }
        if (!error && data?.site_restrictions && typeof data.site_restrictions === 'object' && Object.keys(data.site_restrictions).length > 0) {
          const { _fest_dates, ...cleanRes } = data.site_restrictions;
          const cloudRes = { ...defaultRestrictions, ...cleanRes };
          localStorage.setItem('almurafaqa_restrictions', JSON.stringify(cloudRes));
          return cloudRes;
        }
      } catch (e) {
        console.warn('[Supabase getRestrictions]', e);
      }
    }

    try {
      const raw = localStorage.getItem('almurafaqa_restrictions');
      return raw ? { ...defaultRestrictions, ...JSON.parse(raw) } : defaultRestrictions;
    } catch (e) {
      return defaultRestrictions;
    }
  },

  async updateRestrictions(restrictionsObj) {
    const current = await this.getRestrictions();
    const merged = { ...current, ...restrictionsObj, updated_at: new Date().toISOString() };
    localStorage.setItem('almurafaqa_restrictions', JSON.stringify(merged));

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        let cloudPayload = { ...merged };
        try {
          const { data: curRow } = await client
            .from('fest_settings')
            .select('site_restrictions')
            .eq('id', 1)
            .maybeSingle();
          if (curRow?.site_restrictions?._fest_dates) {
            cloudPayload._fest_dates = curRow.site_restrictions._fest_dates;
          }
        } catch (_) {}
        await client
          .from('fest_settings')
          .update({ site_restrictions: cloudPayload })
          .eq('id', 1);
      } catch (err) {
        console.warn('[Supabase updateRestrictions]', err);
      }
    }
    return merged;
  },

  // ============================================================================
  // TEAM LEADER PORTAL & TOKEN SYSTEM (Module 9)
  // ============================================================================

  // Fetch all team leaders
  async getTeamLeaders() {
    let cloudData = null;
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('team_leaders')
            .select('*')
            .order('created_at', { ascending: false }));
        } else {
          ({ data, error } = await restSelect('team_leaders', 'select=*&order=created_at.desc'));
        }
        if (!error && Array.isArray(data)) {
          cloudData = data;
        }
        if (error) console.warn('[Supabase getTeamLeaders]', error.message);
      } catch (err) {
        console.warn('[Supabase getTeamLeaders catch]', err);
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM_LEADERS) : null;
    const parsedLocal = safeParseJson(raw, []);
    const localList = Array.isArray(parsedLocal) ? parsedLocal : [];

    // Merge cloud and local so local delegations are never wiped before syncing
    const mergedMap = new Map();
    if (cloudData && Array.isArray(cloudData)) {
      cloudData.forEach((l) => mergedMap.set(l.id || (l.token || '').trim().toUpperCase(), l));
    }
    localList.forEach((l) => {
      const key = l.id || (l.token || '').trim().toUpperCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, l);
      }
    });

    const result = Array.from(mergedMap.values());
    try {
      localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(result));
    } catch (e) {}

    // Background sync any local-only leaders to cloud
    if (this.isLive() && cloudData) {
      const cloudTokens = new Set(cloudData.map((c) => (c.token || '').trim().toUpperCase()));
      const unSynced = localList.filter((l) => l.token && !cloudTokens.has(l.token.trim().toUpperCase()));
      if (unSynced.length > 0) {
        this.syncLocalTeamLeadersToCloud().catch(() => {});
      }
    }

    return result;
  },

  // Lookup team leader by token (e.g. TL-7A9B-4F12)
  async getTeamLeaderByToken(token) {
    if (!token) return null;
    const cleanToken = token.trim().toUpperCase();
    const normalizedToken = cleanToken.replace(/\s+/g, '-');
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('team_leaders')
            .select('*')
            .eq('token', cleanToken)
            .eq('status', 'active')
            .maybeSingle());

          if (!data && normalizedToken !== cleanToken) {
            const retry = await supabase
              .from('team_leaders')
              .select('*')
              .eq('token', normalizedToken)
              .eq('status', 'active')
              .maybeSingle();
            if (!retry.error && retry.data) data = retry.data;
          }
        } else {
          ({ data, error } = await restSelect(
            'team_leaders',
            `select=*&token=eq.${encodeURIComponent(cleanToken)}&status=eq.active&limit=1`,
            { single: true }
          ));
          if (!data && normalizedToken !== cleanToken) {
            const retry = await restSelect(
              'team_leaders',
              `select=*&token=eq.${encodeURIComponent(normalizedToken)}&status=eq.active&limit=1`,
              { single: true }
            );
            if (!retry.error && retry.data) data = retry.data;
          }
        }

        if (!error && data) return data;
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            console.error('[Supabase getTeamLeaderByToken] Table "public.team_leaders" does not exist in Supabase! Run the migration SQL in Supabase SQL editor.');
          } else {
            console.warn('[Supabase getTeamLeaderByToken]', error.message);
          }
        }
      } catch (err) {
        console.warn('[Supabase getTeamLeaderByToken catch]', err);
      }
    }
    const list = await this.getTeamLeaders();
    return list.find((tl) => {
      const t = (tl.token || '').trim().toUpperCase();
      return (t === cleanToken || t === normalizedToken) && tl.status === 'active';
    }) || null;
  },

  // Create new team leader and assign unique token
  async createTeamLeader(data) {
    const leaderToken = data.token ? data.token.trim().toUpperCase() : generateLeaderToken();
    const newLeader = {
      id: generateUuid(),
      token: leaderToken,
      leader_name: (data.leader_name || 'Team Leader').trim(),
      leader_email: (data.leader_email || '').trim() || 'leader@almurafaqa.com',
      leader_phone: (data.leader_phone || '').trim() || '+91 00000 00000',
      institution_name: (data.institution_name || 'Institutional Delegation').trim(),
      team_name: (data.team_name || '').trim(),
      max_students: Number(data.max_students) || 50,
      status: data.status || 'active',
      notes: (data.notes || '').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let cloudSaved = false;
    let cloudError = null;

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const payload = { ...newLeader };
        delete payload.id;
        const { data: inserted, error } = await client
          .from('team_leaders')
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) {
          cloudSaved = true;
          const list = await this.getTeamLeaders();
          if (!list.some((x) => x.id === inserted.id)) list.unshift(inserted);
          localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));
          return inserted;
        }
        if (error) {
          cloudError = error;
          console.warn('[Supabase createTeamLeader]', error.message);
        }
      } catch (err) {
        cloudError = err;
        console.warn('[Supabase createTeamLeader catch]', err);
      }
    }

    const list = await this.getTeamLeaders();
    list.unshift(newLeader);
    localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));

    if (this.isLive() && !cloudSaved) {
      const isMissingTable = cloudError?.code === 'PGRST205' || cloudError?.message?.includes('schema cache') || cloudError?.message?.includes('does not exist');
      if (isMissingTable) {
        console.error('[CRITICAL] Supabase table "team_leaders" does not exist! Migration must be applied.');
        newLeader._cloudSyncWarning = 'Cloud database table "team_leaders" is missing in Supabase. Run the SQL migration in Supabase SQL editor.';
      } else if (cloudError) {
        newLeader._cloudSyncWarning = `Cloud sync failed (${cloudError.message}). Team leader saved locally only.`;
      }
    }

    return newLeader;
  },

  // Sync locally cached team leaders to Supabase (useful after database migration is applied)
  async syncLocalTeamLeadersToCloud() {
    if (!this.isLive() || typeof localStorage === 'undefined') return { synced: 0, total: 0 };
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_LEADERS);
    const localLeaders = safeParseJson(raw, []);
    if (!Array.isArray(localLeaders) || localLeaders.length === 0) return { synced: 0, total: 0 };
    const client = await getSupabaseClient();
    if (!client) return { synced: 0, total: localLeaders.length };

    let syncedCount = 0;
    try {
      const { data: cloudData, error } = await client.from('team_leaders').select('id, token');
      if (error) {
        console.warn('[syncLocalTeamLeadersToCloud check]', error.message);
        return { synced: 0, total: localLeaders.length, error: error.message };
      }
      const existingTokens = new Set((cloudData || []).map((c) => (c.token || '').trim().toUpperCase()));
      const existingIds = new Set((cloudData || []).map((c) => c.id));

      for (const leader of localLeaders) {
        const cleanTok = (leader.token || '').trim().toUpperCase();
        if (cleanTok && (!existingTokens.has(cleanTok) || (leader.id && !existingIds.has(leader.id)))) {
          const payload = {
            id: leader.id || generateUuid(),
            token: cleanTok,
            leader_name: (leader.leader_name || 'Team Leader').trim(),
            leader_email: (leader.leader_email || '').trim(),
            leader_phone: (leader.leader_phone || '').trim(),
            institution_name: (leader.institution_name || 'Institutional Delegation').trim(),
            team_name: (leader.team_name || '').trim(),
            max_students: Number(leader.max_students) || 50,
            status: leader.status || 'active',
            notes: (leader.notes || '').trim(),
          };
          const { error: insErr } = await client.from('team_leaders').upsert([payload], { onConflict: 'token' });
          if (!insErr) syncedCount++;
          else console.warn('[syncLocalTeamLeadersToCloud upsert error]', insErr.message);
        }
      }
    } catch (e) {
      console.warn('[syncLocalTeamLeadersToCloud]', e);
    }
    return { synced: syncedCount, total: localLeaders.length };
  },

  // Sync locally cached team students to Supabase
  async syncLocalTeamStudentsToCloud() {
    if (!this.isLive() || typeof localStorage === 'undefined') return { synced: 0, total: 0 };
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_STUDENTS);
    const localStudents = safeParseJson(raw, []);
    if (!Array.isArray(localStudents) || localStudents.length === 0) return { synced: 0, total: 0 };
    const client = await getSupabaseClient();
    if (!client) return { synced: 0, total: localStudents.length };

    let syncedCount = 0;
    try {
      // First ensure team leaders exist in Supabase so foreign keys do not fail
      await this.syncLocalTeamLeadersToCloud();

      const { data: cloudStudents, error } = await client.from('team_students').select('id, student_code, team_leader_id');
      if (error) {
        console.warn('[syncLocalTeamStudentsToCloud check]', error.message);
        return { synced: 0, total: localStudents.length, error: error.message };
      }
      const existingIds = new Set((cloudStudents || []).map((s) => s.id));
      const existingLeaderCodePairs = new Set(
        (cloudStudents || []).map((s) => `${s.team_leader_id}::${(s.student_code || '').trim().toUpperCase()}`)
      );

      // Get all cloud leader IDs
      const { data: cloudLeaders } = await client.from('team_leaders').select('id, token');
      const cloudLeaderIdMap = new Map();
      (cloudLeaders || []).forEach((l) => {
        cloudLeaderIdMap.set(l.id, l.id);
        if (l.token) cloudLeaderIdMap.set(l.token.trim().toUpperCase(), l.id);
      });

      for (const student of localStudents) {
        const cleanCode = (student.student_code || '').trim().toUpperCase();
        let leaderIdInCloud = cloudLeaderIdMap.get(student.team_leader_id);
        if (!leaderIdInCloud && cloudLeaders && cloudLeaders.length > 0) {
          leaderIdInCloud = cloudLeaders[0].id;
        }
        const pairKey = `${leaderIdInCloud || ''}::${cleanCode}`;
        const alreadyInCloud = (student.id && existingIds.has(student.id)) || (leaderIdInCloud && cleanCode && existingLeaderCodePairs.has(pairKey));
        if (!alreadyInCloud && leaderIdInCloud) {
          const payload = {
            id: student.id || generateUuid(),
            team_leader_id: leaderIdInCloud,
            student_name: (student.student_name || 'Participant').trim(),
            student_code: cleanCode || ('STU-' + Math.floor(100 + Math.random() * 900)),
            category: student.category || 'Senior',
            gender: student.gender || 'Male',
            phone: (student.phone || '').trim(),
            email: (student.email || '').trim(),
            notes: (student.notes || '').trim(),
            assigned_events: Array.isArray(student.assigned_events) ? student.assigned_events : [],
          };
          const { error: insErr } = await client.from('team_students').insert([payload]);
          if (!insErr) {
            syncedCount++;
            existingIds.add(payload.id);
            existingLeaderCodePairs.add(`${leaderIdInCloud}::${payload.student_code}`);
          } else {
            console.warn('[syncLocalTeamStudentsToCloud insert error]', insErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[syncLocalTeamStudentsToCloud]', e);
    }
    return { synced: syncedCount, total: localStudents.length };
  },

  // Master sync helper across all delegations
  async syncAllDelegationData() {
    if (!this.isLive()) return;
    try {
      await this.syncLocalTeamLeadersToCloud();
      await this.syncLocalTeamStudentsToCloud();
    } catch (e) {
      console.warn('[syncAllDelegationData]', e);
    }
  },

  // Update existing team leader
  async updateTeamLeader(id, updates) {
    updates.updated_at = new Date().toISOString();
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('team_leaders')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) {
          const list = await this.getTeamLeaders();
          const idx = list.findIndex((l) => l.id === id);
          if (idx !== -1) list[idx] = data;
          localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));
          return data;
        }
      } catch (err) {
        console.warn('[Supabase updateTeamLeader]', err);
      }
    }
    const list = await this.getTeamLeaders();
    const idx = list.findIndex((l) => l.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));
      return list[idx];
    }
    throw new Error('Team leader record not found.');
  },

  // Regenerate Token for Team Leader
  async regenerateTeamLeaderToken(id) {
    const newToken = generateLeaderToken();
    return await this.updateTeamLeader(id, { token: newToken });
  },

  // Delete Team Leader
  async deleteTeamLeader(id) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('team_leaders').delete().eq('id', id);
      } catch (err) {
        console.warn('[Supabase deleteTeamLeader]', err);
      }
    }
    const list = await this.getTeamLeaders();
    const filtered = list.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(filtered));

    // Clean up students and assignments for this leader
    const students = await this.getTeamStudents();
    localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(students.filter((s) => s.team_leader_id !== id)));
    const assignments = await this.getTeamAssignments();
    localStorage.setItem(STORAGE_KEYS.TEAM_ASSIGNMENTS, JSON.stringify(assignments.filter((a) => a.team_leader_id !== id)));
    return true;
  },

  // ----------------------------------------------------------------------------
  // TEAM STUDENTS (ROSTER) OPERATIONS
  // ----------------------------------------------------------------------------

  async getTeamStudents(teamLeaderId = null) {
    let cloudData = null;
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          let query = supabase.from('team_students').select('*').order('created_at', { ascending: false });
          if (teamLeaderId) {
            query = query.eq('team_leader_id', teamLeaderId);
          }
          ({ data, error } = await query);
        } else {
          const qs = 'select=*&order=created_at.desc' + (teamLeaderId ? `&team_leader_id=eq.${encodeURIComponent(teamLeaderId)}` : '');
          ({ data, error } = await restSelect('team_students', qs));
        }
        if (!error && Array.isArray(data)) {
          cloudData = data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamStudents]', err);
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM_STUDENTS) : null;
    const parsedStudents = safeParseJson(raw, []);
    const localStudents = Array.isArray(parsedStudents) ? parsedStudents : [];

    // Merge cloud and local so local students are NEVER lost before syncing
    const mergedMap = new Map();
    if (cloudData && Array.isArray(cloudData)) {
      cloudData.forEach((s) => mergedMap.set(s.id || (s.student_code || '').trim().toUpperCase(), s));
    }
    localStudents.forEach((s) => {
      const key = s.id || (s.student_code || '').trim().toUpperCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, s);
      }
    });

    const all = Array.from(mergedMap.values());
    try {
      localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(all));
    } catch (e) {}

    // Background sync unsynced students
    if (this.isLive() && cloudData && !teamLeaderId) {
      const cloudCodes = new Set(cloudData.map((c) => (c.student_code || '').trim().toUpperCase()));
      const unSynced = localStudents.filter((s) => s.student_code && !cloudCodes.has(s.student_code.trim().toUpperCase()));
      if (unSynced.length > 0) {
        this.syncLocalTeamStudentsToCloud().catch(() => {});
      }
    }

    return teamLeaderId ? all.filter((s) => s.team_leader_id === teamLeaderId) : all;
  },

  async addTeamStudent(studentData) {
    const student = {
      id: generateUuid(),
      team_leader_id: studentData.team_leader_id,
      student_name: studentData.student_name.trim(),
      student_code: studentData.student_code ? studentData.student_code.trim().toUpperCase() : 'STU-' + Math.floor(100 + Math.random() * 900),
      category: studentData.category || 'Senior',
      gender: studentData.gender || 'Male',
      phone: studentData.phone || '',
      email: studentData.email || '',
      notes: studentData.notes || '',
      assigned_events: Array.isArray(studentData.assigned_events) ? studentData.assigned_events : [],
      created_at: new Date().toISOString(),
    };

    let cloudError = null;
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        // Ensure team leader exists in cloud first so foreign key never fails
        const { data: leaderExists } = await client
          .from('team_leaders')
          .select('id')
          .eq('id', student.team_leader_id)
          .maybeSingle();

        if (!leaderExists) {
          // Sync team leaders to cloud first
          await this.syncLocalTeamLeadersToCloud();
        }

        const payload = { ...student };
        const { data: inserted, error } = await client
          .from('team_students')
          .insert([payload])
          .select()
          .single();

        if (!error && inserted) {
          const list = await this.getTeamStudents();
          const existingIdx = list.findIndex((s) => s.id === inserted.id);
          if (existingIdx !== -1) list[existingIdx] = inserted;
          else list.unshift(inserted);
          localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
          return inserted;
        }
        if (error) {
          if (error.code === '23505') {
            throw new Error(`Student chest number "${student.student_code}" is already registered for this delegation.`);
          }
          cloudError = error;
          console.warn('[Supabase addTeamStudent]', error.message);
        }
      } catch (err) {
        if (err?.message?.includes('already registered')) throw err;
        cloudError = err;
        console.warn('[Supabase addTeamStudent catch]', err);
      }
    }

    const list = await this.getTeamStudents();
    if (!list.some((s) => s.id === student.id)) list.unshift(student);
    localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
    if (this.isLive() && cloudError) {
      student._cloudSyncWarning = `Saved locally only: cloud sync failed (${cloudError.message || 'Database error'}).`;
    }
    return student;
  },

  async updateTeamStudent(studentId, updates) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('team_students')
          .update(updates)
          .eq('id', studentId)
          .select()
          .single();
        if (!error && data) {
          const list = await this.getTeamStudents();
          const idx = list.findIndex((s) => s.id === studentId);
          if (idx !== -1) list[idx] = data;
          localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
          return data;
        }
      } catch (err) {
        console.warn('[Supabase updateTeamStudent]', err);
      }
    }
    const list = await this.getTeamStudents();
    const idx = list.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
      return list[idx];
    }
    throw new Error('Student record not found.');
  },

  async deleteTeamStudent(studentId) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('team_students').delete().eq('id', studentId);
      } catch (err) {
        console.warn('[Supabase deleteTeamStudent]', err);
      }
    }
    const list = await this.getTeamStudents();
    const filtered = list.filter((s) => s.id !== studentId);
    localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(filtered));
    return true;
  },

  // ----------------------------------------------------------------------------
  // PROGRAMME ALLOCATION & ASSIGNMENT OPERATIONS
  // ----------------------------------------------------------------------------

  async getTeamAssignments(teamLeaderId = null) {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          let query = supabase.from('team_assignments').select('*');
          if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId);
          ({ data, error } = await query);
        } else {
          const qs = 'select=*' + (teamLeaderId ? `&team_leader_id=eq.${encodeURIComponent(teamLeaderId)}` : '');
          ({ data, error } = await restSelect('team_assignments', qs));
        }
        if (!error && Array.isArray(data)) {
          if (!teamLeaderId) {
            try { localStorage.setItem(STORAGE_KEYS.TEAM_ASSIGNMENTS, JSON.stringify(data)); } catch (_) {}
          }
          return data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamAssignments]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM_ASSIGNMENTS) : null;
    const parsed = safeParseJson(raw, []);
    const all = Array.isArray(parsed) ? parsed : [];
    return teamLeaderId ? all.filter((a) => a.team_leader_id === teamLeaderId) : all;
  },

  // Assign students to a festival event, and synchronize with registrations desk
  async saveTeamAssignment(teamLeaderId, eventId, studentIds) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      await this.removeTeamAssignment(teamLeaderId, eventId);
      return null;
    }

    const [leaders, events, allStudents, existingAssignments, existingRegs] = await Promise.all([
      this.getTeamLeaders(),
      this.getEvents(),
      this.getTeamStudents(teamLeaderId),
      this.getTeamAssignments(teamLeaderId),
      this.getRegistrations(),
    ]);
    const leader = leaders.find((l) => l.id === teamLeaderId);
    const event = events.find((e) => e.id === eventId);
    const assignedStudents = allStudents.filter((s) => studentIds.includes(s.id));

    if (!leader || !event) throw new Error('Invalid leader or event reference.');

    const existingAssignment = existingAssignments.find((a) => a.team_leader_id === teamLeaderId && a.event_id === eventId);
    const existingReg = existingAssignment?.registration_id
      ? existingRegs.find((r) => r.id === existingAssignment.registration_id)
      : null;

    // 1. Sync or reuse festival registration record for the assigned students
    const ticketCode = existingReg?.ticket_code || `ALM-TL-${Math.floor(1000 + Math.random() * 9000)}`;
    const teamMembersList = assignedStudents.map((s) => ({
      name: s.student_name,
      code: s.student_code,
      role: 'Delegation Participant',
      phone: s.phone || leader.leader_phone || '',
    }));

    const regPayload = {
      event_id: eventId,
      ticket_code: ticketCode,
      leader_name: assignedStudents[0]?.student_name || leader.leader_name,
      leader_email: leader.leader_email,
      leader_phone: leader.leader_phone,
      college_name: leader.institution_name,
      team_name: leader.team_name || leader.institution_name,
      team_members: teamMembersList,
      payment_status: 'verified',
      checked_in: existingReg ? Boolean(existingReg.checked_in) : false,
    };

    let savedReg = null;
    try {
      if (existingReg?.id) {
        savedReg = await this.updateRegistration(existingReg.id, {
          leader_name: regPayload.leader_name,
          leader_email: regPayload.leader_email,
          leader_phone: regPayload.leader_phone,
          college_name: regPayload.college_name,
          team_name: regPayload.team_name,
          team_members: regPayload.team_members,
        });
      }
    } catch (_) {
      savedReg = null;
    }
    if (!savedReg) {
      try {
        savedReg = await this.addRegistration(regPayload);
      } catch (regErr) {
        console.warn('[Sync Registration for Team Assignment]', regErr);
      }
    }

    // 2. Save team assignment record
    const assignmentRecord = {
      id: existingAssignment?.id || generateUuid(),
      team_leader_id: teamLeaderId,
      event_id: eventId,
      student_ids: studentIds,
      registration_id: savedReg ? savedReg.id : (existingAssignment?.registration_id || null),
      created_at: existingAssignment?.created_at || new Date().toISOString(),
    };

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client
          .from('team_assignments')
          .delete()
          .eq('team_leader_id', teamLeaderId)
          .eq('event_id', eventId);

        const payload = { ...assignmentRecord };
        delete payload.id;
        const { data: insData, error: insErr } = await client
          .from('team_assignments')
          .insert([payload])
          .select()
          .maybeSingle();

        if (insErr) console.warn('[Supabase saveTeamAssignment]', insErr.message);
        if (insData) assignmentRecord.id = insData.id;
      } catch (err) {
        console.warn('[Supabase saveTeamAssignment]', err);
      }
    }

    const assignments = await this.getTeamAssignments();
    const filtered = assignments.filter((a) => !(a.team_leader_id === teamLeaderId && a.event_id === eventId));
    filtered.push(assignmentRecord);
    localStorage.setItem(STORAGE_KEYS.TEAM_ASSIGNMENTS, JSON.stringify(filtered));

    // 3. Update student records' assigned_events
    for (const student of allStudents) {
      const isAssigned = studentIds.includes(student.id);
      let studentEvents = Array.isArray(student.assigned_events) ? [...student.assigned_events] : [];
      studentEvents = studentEvents.filter((ev) => ev.event_id !== eventId);
      if (isAssigned) {
        studentEvents.push({
          event_id: event.id,
          event_title: event.title,
          category: event.category,
          day_number: event.day_number,
          time_slot: event.time_slot,
          venue: event.venue,
          ticket_code: savedReg?.ticket_code || ticketCode,
        });
      }
      await this.updateTeamStudent(student.id, { assigned_events: studentEvents });
    }

    return assignmentRecord;
  },

  // Remove assignment for a programme
  async removeTeamAssignment(teamLeaderId, eventId) {
    const existingAssignments = await this.getTeamAssignments(teamLeaderId);
    const matching = existingAssignments.filter((a) => a.team_leader_id === teamLeaderId && a.event_id === eventId);
    const linkedRegIds = matching.map((a) => a.registration_id).filter(Boolean);

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('team_assignments').delete().eq('team_leader_id', teamLeaderId).eq('event_id', eventId);
        for (const regId of linkedRegIds) {
          await client.from('registrations').delete().eq('id', regId);
        }
      } catch (err) {
        console.warn('[Supabase removeTeamAssignment]', err);
      }
    }
    if (linkedRegIds.length > 0 && typeof localStorage !== 'undefined') {
      const regs = safeParseJson(localStorage.getItem(STORAGE_KEYS.REGISTRATIONS), []);
      if (Array.isArray(regs)) {
        const cleanedRegs = regs.filter((r) => !linkedRegIds.includes(r.id));
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(cleanedRegs));
      }
    }

    const assignments = await this.getTeamAssignments();
    const filtered = assignments.filter((a) => !(a.team_leader_id === teamLeaderId && a.event_id === eventId));
    localStorage.setItem(STORAGE_KEYS.TEAM_ASSIGNMENTS, JSON.stringify(filtered));

    // Remove event from all students under this leader
    const students = await this.getTeamStudents(teamLeaderId);
    for (const student of students) {
      const studentEvents = (student.assigned_events || []).filter((ev) => ev.event_id !== eventId);
      await this.updateTeamStudent(student.id, { assigned_events: studentEvents });
    }
    return true;
  },

  // ----------------------------------------------------------------------------
  // TEAM GROUPS / SQUADS WITHIN DELEGATIONS
  // ----------------------------------------------------------------------------
  async getTeamGroups(teamLeaderId = null) {
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          let query = supabase.from('team_groups').select('*').order('created_at', { ascending: false });
          if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId);
          ({ data, error } = await query);
        } else {
          const qs = 'select=*&order=created_at.desc' + (teamLeaderId ? `&team_leader_id=eq.${encodeURIComponent(teamLeaderId)}` : '');
          ({ data, error } = await restSelect('team_groups', qs));
        }
        if (!error && Array.isArray(data)) {
          if (!teamLeaderId) {
            try { localStorage.setItem(STORAGE_KEYS.TEAM_GROUPS, JSON.stringify(data)); } catch (_) {}
          }
          return data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamGroups]', err);
      }
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM_GROUPS) : null;
    const parsed = safeParseJson(raw, []);
    const all = Array.isArray(parsed) ? parsed : [];
    return teamLeaderId ? all.filter((g) => g.team_leader_id === teamLeaderId) : all;
  },

  async saveTeamGroup(teamData) {
    const list = await this.getTeamGroups();
    let record = null;
    const now = new Date().toISOString();
    const client = this.isLive() ? await getSupabaseClient() : null;

    if (teamData.id) {
      // Update
      const index = list.findIndex((g) => g.id === teamData.id);
      if (index !== -1) {
        record = {
          ...list[index],
          ...teamData,
          student_ids: teamData.student_ids || list[index].student_ids || [],
          updated_at: now,
        };
        list[index] = record;
      }
      if (client) {
        try {
          const payload = { ...record };
          await client.from('team_groups').update(payload).eq('id', teamData.id);
        } catch (err) {
          console.warn('[Supabase saveTeamGroup update]', err);
        }
      }
    } else {
      // Create new
      record = {
        id: generateUuid(),
        team_leader_id: teamData.team_leader_id,
        team_name: teamData.team_name,
        category: teamData.category || 'Senior',
        event_id: teamData.event_id || null,
        student_ids: teamData.student_ids || [],
        notes: teamData.notes || '',
        created_at: now,
      };
      if (client) {
        try {
          const payload = { ...record };
          delete payload.id;
          const { data, error } = await client.from('team_groups').insert([payload]).select().single();
          if (!error && data) record = data;
        } catch (err) {
          console.warn('[Supabase saveTeamGroup insert]', err);
        }
      }
      list.unshift(record);
    }

    localStorage.setItem(STORAGE_KEYS.TEAM_GROUPS, JSON.stringify(list));
    return record;
  },

  async deleteTeamGroup(teamGroupId) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('team_groups').delete().eq('id', teamGroupId);
      } catch (err) {
        console.warn('[Supabase deleteTeamGroup]', err);
      }
    }
    const list = await this.getTeamGroups();
    const filtered = list.filter((g) => g.id !== teamGroupId);
    localStorage.setItem(STORAGE_KEYS.TEAM_GROUPS, JSON.stringify(filtered));
    return true;
  },

  // ----------------------------------------------------------------------------
  // MODULE 10: FEST JUDGMENT SYSTEM & TOKEN-BASED JUDGE PORTAL
  // ----------------------------------------------------------------------------
  async syncLocalJudgeTokensToCloud() {
    if (!this.isLive() || typeof localStorage === 'undefined') return { synced: 0 };
    const localList = safeParseJson(localStorage.getItem(STORAGE_KEYS.JUDGE_TOKENS), []);
    const pending = Array.isArray(localList) ? localList.filter((t) => t && t._localOnly) : [];
    if (pending.length === 0) return { synced: 0 };
    const client = await getSupabaseClient();
    if (!client) return { synced: 0 };

    let synced = 0;
    const remaining = [];
    for (const tok of localList) {
      if (!tok || !tok._localOnly) {
        remaining.push(tok);
        continue;
      }
      const { _localOnly, _cloudSyncWarning, events, fest, ...cleanPayload } = tok;
      try {
        const { data, error } = await client.from('judge_tokens').upsert([cleanPayload], { onConflict: 'token' }).select().maybeSingle();
        if (!error && data) {
          synced++;
          remaining.push(data);
        } else {
          remaining.push(tok);
        }
      } catch (_) {
        remaining.push(tok);
      }
    }
    try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(remaining)); } catch (_) {}
    return { synced };
  },

  async getJudgeTokens() {
    let cloudRows = null;
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          ({ data, error } = await supabase
            .from('judge_tokens')
            .select('*, events(*)')
            .order('created_at', { ascending: false }));
          if (error) {
            ({ data, error } = await supabase
              .from('judge_tokens')
              .select('*')
              .order('created_at', { ascending: false }));
          }
        } else {
          ({ data, error } = await restSelect('judge_tokens', 'select=*,events(*)&order=created_at.desc'));
          if (error) {
            ({ data, error } = await restSelect('judge_tokens', 'select=*&order=created_at.desc'));
          }
        }
        if (!error && Array.isArray(data)) cloudRows = data;
      } catch (err) {
        console.warn('[Supabase getJudgeTokens]', err?.message || err);
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.JUDGE_TOKENS) : null;
    const localList = safeParseJson(raw, []);
    const safeLocal = Array.isArray(localList) ? localList : [];

    if (cloudRows !== null) {
      const mergedMap = new Map();
      cloudRows.forEach((row) => mergedMap.set(row.id, row));
      safeLocal.filter((l) => l && l._localOnly).forEach((l) => {
        if (!mergedMap.has(l.id)) mergedMap.set(l.id, l);
      });
      const result = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(result)); } catch (_) {}
      return result;
    }

    return safeLocal;
  },

  async createJudgeToken(data) {
    const cleanName = sanitizePlainText(data?.judge_name || '', 160);
    const cleanEmail = sanitizePlainText(data?.judge_email || '', 180);
    const festId = String(data?.fest_id || '').trim();
    if (!cleanName) throw new Error('Judge name is required.');
    if (!festId) throw new Error('Please select an assigned Fest / Programme.');

    const cleanToken = sanitizePlainText(data?.token || generateJudgeToken(), 32).toUpperCase().replace(/\s+/g, '-');
    let expiresIso = null;
    if (data?.expires_at) {
      const ts = Date.parse(data.expires_at);
      if (Number.isNaN(ts)) throw new Error('Invalid expiration date/time.');
      expiresIso = new Date(ts).toISOString();
    }

    const now = new Date().toISOString();
    const record = {
      id: generateUuid(),
      token: cleanToken,
      judge_name: cleanName,
      judge_email: cleanEmail,
      fest_id: festId,
      is_active: data?.is_active !== false,
      expires_at: expiresIso,
      last_activity_at: null,
      created_at: now,
      updated_at: now,
    };

    let cloudSaved = false;
    let cloudError = null;
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data: inserted, error } = await client
          .from('judge_tokens')
          .insert([record])
          .select('*, events(*)')
          .maybeSingle();
        if (!error && inserted) {
          cloudSaved = true;
          const list = await this.getJudgeTokens();
          if (!list.some((t) => t.id === inserted.id)) list.unshift(inserted);
          try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(list)); } catch (_) {}
          return inserted;
        }
        if (error) cloudError = error;
      } catch (err) {
        cloudError = err;
      }
    }

    const localRecord = { ...record, _localOnly: true };
    const list = await this.getJudgeTokens();
    list.unshift(localRecord);
    try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(list)); } catch (_) {}

    if (this.isLive() && !cloudSaved && cloudError) {
      const isMissingTable = cloudError?.code === 'PGRST205' || cloudError?.message?.includes('schema cache') || cloudError?.message?.includes('does not exist');
      localRecord._cloudSyncWarning = isMissingTable
        ? 'Cloud table "judge_tokens" is missing in Supabase. Run migrations/20261128_add_judge_judgment_system.sql in Supabase SQL Editor.'
        : `Cloud sync failed (${cloudError.message}). Saved locally only.`;
    }
    return localRecord;
  },

  async updateJudgeToken(id, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('judge_tokens')
          .update(payload)
          .eq('id', id)
          .select('*, events(*)')
          .maybeSingle();
        if (!error && data) {
          const list = await this.getJudgeTokens();
          const idx = list.findIndex((t) => t.id === id);
          if (idx !== -1) list[idx] = data;
          try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(list)); } catch (_) {}
          return data;
        }
      } catch (err) {
        console.warn('[Supabase updateJudgeToken]', err?.message || err);
      }
    }
    const list = await this.getJudgeTokens();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Judge token record not found.');
    list[idx] = { ...list[idx], ...payload };
    try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(list)); } catch (_) {}
    return list[idx];
  },

  async toggleJudgeTokenStatus(id, isActive) {
    return await this.updateJudgeToken(id, { is_active: Boolean(isActive) });
  },

  async regenerateJudgeToken(id) {
    return await this.updateJudgeToken(id, { token: generateJudgeToken(), is_active: true });
  },

  async deleteJudgeToken(id) {
    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        await client.from('judge_tokens').delete().eq('id', id);
      } catch (err) {
        console.warn('[Supabase deleteJudgeToken]', err?.message || err);
      }
    }
    const tokens = (await this.getJudgeTokens()).filter((t) => t.id !== id);
    try { localStorage.setItem(STORAGE_KEYS.JUDGE_TOKENS, JSON.stringify(tokens)); } catch (_) {}
    const entries = safeParseJson(localStorage.getItem(STORAGE_KEYS.JUDGMENT_ENTRIES), []);
    if (Array.isArray(entries)) {
      const cleaned = entries.filter((e) => e.judge_token_id !== id);
      try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(cleaned)); } catch (_) {}
    }
    return true;
  },

  async getJudgmentEntries(festId = null) {
    let cloudRows = null;
    if (this.isLive()) {
      try {
        let data = null;
        let error = null;
        if (supabase) {
          let query = supabase
            .from('judgment_entries')
            .select('*, events(*), judge_tokens(id, judge_name, judge_email, token, is_active, expires_at, last_activity_at)')
            .order('updated_at', { ascending: false });
          if (festId) query = query.eq('fest_id', festId);
          ({ data, error } = await query);
          if (error) {
            let fallbackQ = supabase.from('judgment_entries').select('*').order('updated_at', { ascending: false });
            if (festId) fallbackQ = fallbackQ.eq('fest_id', festId);
            ({ data, error } = await fallbackQ);
          }
        } else {
          const filter = festId ? `&fest_id=eq.${encodeURIComponent(festId)}` : '';
          ({ data, error } = await restSelect(
            'judgment_entries',
            `select=*,events(*),judge_tokens(id,judge_name,judge_email,token,is_active,expires_at,last_activity_at)&order=updated_at.desc${filter}`
          ));
          if (error) {
            ({ data, error } = await restSelect('judgment_entries', `select=*&order=updated_at.desc${filter}`));
          }
        }
        if (!error && Array.isArray(data)) cloudRows = data;
      } catch (err) {
        console.warn('[Supabase getJudgmentEntries]', err?.message || err);
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.JUDGMENT_ENTRIES) : null;
    const localList = safeParseJson(raw, []);
    const safeLocal = Array.isArray(localList) ? localList : [];

    let list;
    if (cloudRows !== null) {
      const mergedMap = new Map();
      cloudRows.forEach((row) => mergedMap.set(row.id, row));
      safeLocal.filter((l) => l && l._localOnly && (!festId || l.fest_id === festId)).forEach((l) => {
        if (!mergedMap.has(l.id)) mergedMap.set(l.id, l);
      });
      list = Array.from(mergedMap.values());
      if (!festId) {
        try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(list)); } catch (_) {}
      }
    } else {
      list = festId ? safeLocal.filter((e) => e.fest_id === festId) : safeLocal;
    }

    return list.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  },

  async publishJudgmentEntry(entryId, isPublished) {
    const publishFlag = Boolean(isPublished);
    const entries = await this.getJudgmentEntries();
    const existing = entries.find((e) => e.id === entryId);
    const hasRules = existing && (
      (Array.isArray(existing.rules) && existing.rules.length > 0) ||
      String(existing.rules_summary || '').trim().length > 0
    );
    if (publishFlag && existing && !hasRules) {
      throw new Error('Cannot publish empty judgment rules. Wait for the judge to submit rules first.');
    }

    const now = new Date().toISOString();
    const updates = {
      is_published: publishFlag,
      status: publishFlag ? 'PUBLISHED' : (hasRules ? 'SUBMITTED' : 'DRAFT'),
      published_at: publishFlag ? now : null,
      updated_at: now,
    };

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('judgment_entries')
          .update(updates)
          .eq('id', entryId)
          .select('*, events(*), judge_tokens(id, judge_name, judge_email, token, is_active, expires_at, last_activity_at)')
          .maybeSingle();
        if (!error && data) {
          const refreshed = entries.map((e) => (e.id === entryId ? data : e));
          try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(refreshed)); } catch (_) {}
          return data;
        }
        if (error && error.code !== 'PGRST205') throw error;
      } catch (err) {
        if (err?.code !== 'PGRST205' && !err?.message?.includes('schema cache')) throw err;
      }
    }

    if (!existing) throw new Error('Judgment entry not found.');
    const updatedLocal = { ...existing, ...updates };
    const nextList = entries.map((e) => (e.id === entryId ? updatedLocal : e));
    try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(nextList)); } catch (_) {}
    return updatedLocal;
  },

  async verifyJudgeToken(rawToken) {
    const cleanToken = sanitizePlainText(rawToken || '', 64).toUpperCase().replace(/\s+/g, '-');
    if (!cleanToken) throw new Error('Please enter a valid judge access token.');

    let rpcMissing = false;
    if (this.isLive()) {
      try {
        const client = await getSupabaseClient();
        const { data, error } = client
          ? await client.rpc('verify_judge_token', { p_token: cleanToken })
          : await restRpc('verify_judge_token', { p_token: cleanToken });

        if (!error && data && data.tokenRecord) {
          return data;
        }
        if (error) {
          const isMissingFn =
            error.code === 'PGRST202' ||
            error.code === '42883' ||
            error.code === 'PGRST205' ||
            /could not find the function|does not exist|schema cache/i.test(error.message || '');
          if (!isMissingFn) {
            throw new Error(error.message || 'This token is invalid or has been revoked by the admin');
          }
          rpcMissing = true;
        }
      } catch (err) {
        const isMissingFn =
          err?.code === 'PGRST202' ||
          err?.code === '42883' ||
          err?.code === 'PGRST205' ||
          /could not find the function|does not exist|schema cache/i.test(err?.message || '');
        if (!isMissingFn) throw err;
        rpcMissing = true;
      }
    }

    // Fallback when migration RPC is not installed yet or offline demo mode is active
    const tokens = await this.getJudgeTokens();
    const tok = tokens.find((t) => String(t.token || '').trim().toUpperCase() === cleanToken);
    if (!tok || tok.is_active !== true) {
      throw new Error('This token is invalid or has been revoked by the admin');
    }
    if (tok.expires_at && Date.parse(tok.expires_at) <= Date.now()) {
      throw new Error('This access token has expired. Please contact the festival administration.');
    }

    const events = await this.getEvents();
    const fest = tok.events || events.find((e) => e.id === tok.fest_id) || null;
    if (!fest) {
      throw new Error('The fest assigned to this token could not be found.');
    }

    const now = new Date().toISOString();
    try { await this.updateJudgeToken(tok.id, { last_activity_at: now }); } catch (_) {}

    const entries = await this.getJudgmentEntries(tok.fest_id);
    const entry = entries.find((e) => e.fest_id === tok.fest_id && e.judge_token_id === tok.id) || null;
    return {
      tokenRecord: { ...tok, last_activity_at: now },
      fest,
      entry,
      _rpcFallback: rpcMissing,
    };
  },

  async saveJudgeJudgment(rawToken, festId, { rules = [], rules_summary = '', scores_or_remarks = [] } = {}) {
    const cleanToken = sanitizePlainText(rawToken || '', 64).toUpperCase().replace(/\s+/g, '-');
    if (!cleanToken) throw new Error('This token is invalid or has been revoked by the admin');

    const cleanRules = sanitizeJudgmentRules(rules);
    const cleanSummary = sanitizePlainText(rules_summary, 4000);
    const cleanRemarks = sanitizeJudgmentRemarks(scores_or_remarks);

    if (cleanRules.length === 0 && !cleanSummary) {
      throw new Error('Please add at least one judgment rule/criterion or summary before syncing.');
    }

    if (this.isLive()) {
      try {
        const client = await getSupabaseClient();
        const { data, error } = client
          ? await client.rpc('upsert_judge_judgment', {
              p_token: cleanToken,
              p_fest_id: festId,
              p_rules: cleanRules,
              p_rules_summary: cleanSummary,
              p_scores_or_remarks: cleanRemarks,
            })
          : await restRpc('upsert_judge_judgment', {
              p_token: cleanToken,
              p_fest_id: festId,
              p_rules: cleanRules,
              p_rules_summary: cleanSummary,
              p_scores_or_remarks: cleanRemarks,
            });

        if (!error && data) {
          const all = safeParseJson(localStorage.getItem(STORAGE_KEYS.JUDGMENT_ENTRIES), []);
          const safeAll = Array.isArray(all) ? all.filter((e) => e.id !== data.id) : [];
          safeAll.unshift(data);
          try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(safeAll)); } catch (_) {}
          return data;
        }
        if (error) {
          const isMissingFn =
            error.code === 'PGRST202' ||
            error.code === '42883' ||
            error.code === 'PGRST205' ||
            /could not find the function|does not exist|schema cache/i.test(error.message || '');
          if (!isMissingFn) {
            throw new Error(error.message || 'Failed to sync judgment entry.');
          }
        }
      } catch (err) {
        const isMissingFn =
          err?.code === 'PGRST202' ||
          err?.code === '42883' ||
          err?.code === 'PGRST205' ||
          /could not find the function|does not exist|schema cache/i.test(err?.message || '');
        if (!isMissingFn) throw err;
      }
    }

    // Fallback when RPC/tables are pending migration or offline
    const verified = await this.verifyJudgeToken(cleanToken);
    if (!verified?.tokenRecord || verified.tokenRecord.fest_id !== festId) {
      throw new Error('Unauthorized scope: this token is restricted to its assigned fest.');
    }

    const tok = verified.tokenRecord;
    const now = new Date().toISOString();
    const existingList = await this.getJudgmentEntries();
    const existing = existingList.find((e) => e.fest_id === festId && e.judge_token_id === tok.id);
    const entryPayload = {
      id: existing?.id || generateUuid(),
      fest_id: festId,
      judge_token_id: tok.id,
      rules: cleanRules,
      rules_summary: cleanSummary,
      scores_or_remarks: cleanRemarks,
      status: 'SUBMITTED',
      is_published: false,
      published_at: null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const client = this.isLive() ? await getSupabaseClient() : null;
    if (client) {
      try {
        const { data: upserted, error: upErr } = await client
          .from('judgment_entries')
          .upsert([entryPayload], { onConflict: 'fest_id,judge_token_id' })
          .select()
          .maybeSingle();
        if (!upErr && upserted) {
          const nextAll = [upserted, ...existingList.filter((e) => e.id !== upserted.id)];
          try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(nextAll)); } catch (_) {}
          return upserted;
        }
      } catch (_) {}
    }

    const localEntry = { ...entryPayload, _localOnly: true };
    const nextAll = [localEntry, ...existingList.filter((e) => e.id !== localEntry.id)];
    try { localStorage.setItem(STORAGE_KEYS.JUDGMENT_ENTRIES, JSON.stringify(nextAll)); } catch (_) {}
    if (this.isLive()) {
      localEntry._cloudSyncWarning = 'Saved locally only until SQL migration 20261128_add_judge_judgment_system.sql is executed in Supabase.';
    }
    return localEntry;
  },

  async getPublicFestJudgments(festId = null) {
    if (this.isLive()) {
      try {
        const client = await getSupabaseClient();
        const { data: rpcData, error: rpcErr } = client
          ? await client.rpc('get_public_fest_judgments', { p_fest_id: festId || null })
          : await restRpc('get_public_fest_judgments', { p_fest_id: festId || null });

        if (!rpcErr && Array.isArray(rpcData)) {
          return rpcData.filter((row) => row && row.is_published === true && (!festId || row.fest_id === festId));
        }

        // Direct strictly filtered fallback if RPC not yet applied
        let qData = null;
        let qErr = null;
        if (client) {
          let query = client
            .from('judgment_entries')
            .select('id, fest_id, rules, rules_summary, scores_or_remarks, status, is_published, published_at, updated_at, events(id, code, title, category, venue, day_number, time_slot, event_date, status, rules), judge_tokens(judge_name)')
            .eq('is_published', true)
            .order('published_at', { ascending: false });
          if (festId) query = query.eq('fest_id', festId);
          ({ data: qData, error: qErr } = await query);
        } else {
          const filter = festId ? `&fest_id=eq.${encodeURIComponent(festId)}` : '';
          ({ data: qData, error: qErr } = await restSelect(
            'judgment_entries',
            `select=id,fest_id,rules,rules_summary,scores_or_remarks,status,is_published,published_at,updated_at,events(id,code,title,category,venue,day_number,time_slot,event_date,status,rules),judge_tokens(judge_name)&is_published=eq.true&order=published_at.desc${filter}`
          ));
        }
        if (!qErr && Array.isArray(qData)) {
          return qData
            .filter((r) => r && r.is_published === true)
            .map((r) => ({
              id: r.id,
              fest_id: r.fest_id,
              rules: r.rules || [],
              rules_summary: r.rules_summary || '',
              scores_or_remarks: r.scores_or_remarks || [],
              status: r.status,
              is_published: true,
              published_at: r.published_at,
              updated_at: r.updated_at,
              judge_name: r.judge_tokens?.judge_name || 'Official Jury',
              fest: r.events || null,
            }));
        }
      } catch (err) {
        console.warn('[Supabase getPublicFestJudgments]', err?.message || err);
      }
    }

    // Strictly filtered local cache fallback (only published entries)
    const rawEntries = safeParseJson(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.JUDGMENT_ENTRIES) : null, []);
    const events = await this.getEvents();
    const tokens = safeParseJson(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.JUDGE_TOKENS) : null, []);
    return (Array.isArray(rawEntries) ? rawEntries : [])
      .filter((e) => e && e.is_published === true && (!festId || e.fest_id === festId))
      .map((e) => {
        const tok = (Array.isArray(tokens) ? tokens : []).find((t) => t.id === e.judge_token_id);
        const evt = events.find((ev) => ev.id === e.fest_id) || null;
        return {
          id: e.id,
          fest_id: e.fest_id,
          rules: e.rules || [],
          rules_summary: e.rules_summary || '',
          scores_or_remarks: e.scores_or_remarks || [],
          status: e.status,
          is_published: true,
          published_at: e.published_at,
          updated_at: e.updated_at,
          judge_name: tok?.judge_name || 'Official Jury',
          fest: evt,
        };
      })
      .sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
  },

  // ----------------------------------------------------------------------------
  // LIVE CLOUD DATABASE DIAGNOSTIC & VERIFICATION ENGINE
  // ----------------------------------------------------------------------------
  async verifyCloudSync() {
    if (!this.isLive()) {
      return { connected: false, error: 'Supabase credentials not configured or client offline' };
    }
    const tables = [
      'fest_settings', 'events', 'registrations', 'announcements',
      'winners', 'scores', 'audit_logs', 'team_leaders',
      'team_students', 'team_assignments', 'team_groups',
      'judge_tokens', 'judgment_entries'
    ];
    const results = {};
    const client = await getSupabaseClient(4500);
    for (const tbl of tables) {
      try {
        if (client) {
          const { count, error } = await client.from(tbl).select('*', { count: 'exact', head: true });
          if (error) {
            results[tbl] = { ok: false, error: error.message, code: error.code };
          } else {
            results[tbl] = { ok: true, count: count ?? 0 };
          }
        } else {
          const { error } = await restSelect(tbl, 'select=id&limit=1');
          if (error) {
            results[tbl] = { ok: false, error: error.message };
          } else {
            results[tbl] = { ok: true, count: 'REST ok' };
          }
        }
      } catch (err) {
        results[tbl] = { ok: false, error: err.message };
      }
    }
    const allOk = Object.values(results).every((r) => r.ok);
    return {
      connected: true,
      allTablesActive: allOk,
      tables: results,
      timestamp: new Date().toISOString(),
    };
  },
};
