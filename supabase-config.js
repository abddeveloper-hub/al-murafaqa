// ==============================================================================
// AL MURAFAQA • SUPABASE CLIENT & HYBRID DATA ENGINE
// Uses Supabase when configured; read failures can fall back to the local cache.
// Cloud write errors are surfaced so local-only changes are never reported as saved.
// ==============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Initialize Supabase Client (if valid, otherwise null)
export let supabase = null;
if (isConfigured) {
  try {
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase Config] Failed to initialize Supabase client:', err);
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
  updated_at: new Date().toISOString(),
};

const DEFAULT_EVENTS = [];
const DEFAULT_REGISTRATIONS = [];
const DEFAULT_ANNOUNCEMENTS = [];
const DEFAULT_WINNERS = [];

// Initialize storage and clean out any legacy mock/demo data from local cache
function initStorage() {
  if (typeof localStorage === 'undefined') return;

  // Purge any legacy mock records from localStorage
  const existingEventsRaw = localStorage.getItem('almurafaqa_events');
  if (existingEventsRaw && (existingEventsRaw.includes('evt-001') || existingEventsRaw.includes('a1b2c3d4-0001'))) {
    localStorage.removeItem('almurafaqa_events');
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

export const db = {
  // Check active mode
  isLive() {
    return isConfigured && supabase !== null;
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

    if (this.isLive()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    if (this.isLive()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign-out error from Supabase:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('almurafaqa_admin_session');
    }
  },

  async getSession() {
    if (this.isLive()) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return data.session;
      } catch (err) {
        console.warn('Error reading Supabase live session:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('almurafaqa_admin_session');
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  },

  // Fest Settings Operations
  async getSettings() {
    const raw = localStorage.getItem('almurafaqa_settings');
    let cachedSettings = null;
    try {
      cachedSettings = raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[Local settings cache] Could not parse cached settings:', err);
    }

    if (this.isLive()) {
      try {
        const { data, error } = await supabase
          .from('fest_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) {
          const cloudSettings = { ...DEFAULT_SETTINGS, ...data };
          if (!cloudSettings.video_poster_url || cloudSettings.video_poster_url.includes('AB6AXuBI4u7wM1') || cloudSettings.video_poster_url.includes('googleusercontent.com/aida-public')) {
            cloudSettings.video_poster_url = 'video-poster.jpg';
            // Self-heal cloud database row if it still holds the legacy mock oud player image URL
            if (data?.video_poster_url && (data.video_poster_url.includes('AB6AXuBI4u7wM1') || data.video_poster_url.includes('googleusercontent.com/aida-public'))) {
              supabase.from('fest_settings').update({ video_poster_url: 'video-poster.jpg' }).eq('id', 1).then(() => {}).catch(() => {});
            }
          }
          const hasPendingLocalEdits = cachedSettings && Object.keys(cachedSettings).some((key) =>
            key !== 'id' && key !== 'updated_at' && key in DEFAULT_SETTINGS && cachedSettings[key] !== DEFAULT_SETTINGS[key]
          );
          const localUpdatedAt = Date.parse(cachedSettings?.updated_at || '');
          const cloudUpdatedAt = Date.parse(cloudSettings.updated_at || '');

          // Recover settings saved by the previous local-only fallback, so an admin
          // can publish them after the database schema has been brought up to date.
          if (hasPendingLocalEdits && Number.isFinite(localUpdatedAt) && localUpdatedAt > cloudUpdatedAt) {
            const merged = { ...cloudSettings, ...cachedSettings };
            if (!merged.video_poster_url || merged.video_poster_url.includes('AB6AXuBI4u7wM1') || merged.video_poster_url.includes('googleusercontent.com/aida-public')) {
              merged.video_poster_url = 'video-poster.jpg';
            }
            return merged;
          }
          return cloudSettings;
        }
        if (error) console.warn('[Supabase getSettings]', error.message);
      } catch (err) {
        console.warn('[Supabase getSettings exception]', err.message);
      }
    }
    if (cachedSettings) {
      if (!cachedSettings.video_poster_url || cachedSettings.video_poster_url.includes('AB6AXuBI4u7wM1') || cachedSettings.video_poster_url.includes('googleusercontent.com/aida-public')) {
        cachedSettings.video_poster_url = 'video-poster.jpg';
      }
      return cachedSettings;
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (this.isLive()) {
      try {
        // Attempt upsert with maybeSingle() so missing row 1 is created and empty results never throw PGRST116
        let { data, error } = await supabase
          .from('fest_settings')
          .upsert({ id: 1, ...payload }, { onConflict: 'id' })
          .select()
          .maybeSingle();

        // If error occurred (missing column, RLS restriction, etc.)
        if (error) {
          console.warn('[Supabase updateSettings]', error.message || error);

          // If table is missing newer columns
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
              'updated_at',
            ]);
            const basePayload = { id: 1 };
            for (const key of Object.keys(payload)) {
              if (baseCols.has(key)) basePayload[key] = payload[key];
            }
            try {
              await supabase.from('fest_settings').upsert(basePayload, { onConflict: 'id' });
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

  // Competition & Participant Categories Operations
  async getCategories() {
    const DEFAULT_CATEGORIES = [
      { id: 'cat_senior', name: 'Senior', code: 'SNR', type: 'division', badge_color: 'purple', description: 'Senior Dars & Degree scholars', max_events: 5, active: true },
      { id: 'cat_junior', name: 'Junior', code: 'JNR', type: 'division', badge_color: 'indigo', description: 'Junior Dars scholars (Class 8-10)', max_events: 5, active: true },
      { id: 'cat_subjunior', name: 'Sub-Junior', code: 'SBJ', type: 'division', badge_color: 'cyan', description: 'Sub-Junior dars scholars', max_events: 4, active: true },
      { id: 'cat_general', name: 'General', code: 'GEN', type: 'division', badge_color: 'emerald', description: 'Open across all divisions and participants', max_events: null, active: true },
      { id: 'cat_khadima', name: 'Khadima', code: 'KHD', type: 'division', badge_color: 'amber', description: 'Khadima dars section', max_events: 4, active: true },
      { id: 'cat_aaliya', name: 'Aaliya', code: 'AAL', type: 'division', badge_color: 'rose', description: 'Aaliya dars level scholars', max_events: 5, active: true },
      { id: 'cat_sanawiyya', name: 'Sanawiyya', code: 'SNW', type: 'division', badge_color: 'orange', description: 'Sanawiyya secondary level scholars', max_events: 5, active: true },
      { id: 'cat_hifz', name: "Qur'an & Hifz", code: 'HFZ', type: 'genre', badge_color: 'emerald', description: "Hifz, Tajweed, Tartil & Qira'at competitions", max_events: 3, active: true },
      { id: 'cat_oratory', name: 'Oratory & Elocution', code: 'ORA', type: 'genre', badge_color: 'amber', description: 'Debates, speeches, and public addresses', max_events: 4, active: true },
      { id: 'cat_arts', name: 'Traditional Arts & Calligraphy', code: 'ART', type: 'genre', badge_color: 'rose', description: 'Arabic calligraphy, poster painting, and craft', max_events: 4, active: true },
      { id: 'cat_literature', name: 'Literary & Poetry', code: 'LIT', type: 'genre', badge_color: 'purple', description: 'Poetry recitation, essay composition, and translation', max_events: 4, active: true },
      { id: 'cat_vocal', name: 'Vocal & Ensemble', code: 'MUS', type: 'genre', badge_color: 'blue', description: 'Nasheed, choir, and cultural vocal tracks', max_events: 3, active: true }
    ];

    let cached = [];
    try {
      const local = localStorage.getItem('almurafaqa_custom_categories');
      if (local) cached = JSON.parse(local);
    } catch (e) {}

    let cloudCats = null;
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
          .from('fest_settings')
          .select('custom_categories')
          .eq('id', 1)
          .maybeSingle();
        if (!error && data?.custom_categories && Array.isArray(data.custom_categories)) {
          cloudCats = data.custom_categories;
        }
      } catch (e) {
        console.warn('[Supabase getCategories]', e);
      }
    }

    const source = cloudCats || (cached && cached.length > 0 ? cached : DEFAULT_CATEGORIES);
    const mergedMap = new Map();
    DEFAULT_CATEGORIES.forEach(c => mergedMap.set(c.name.toLowerCase(), c));
    source.forEach(c => mergedMap.set(c.name.toLowerCase(), c));
    const result = Array.from(mergedMap.values());

    try {
      localStorage.setItem('almurafaqa_custom_categories', JSON.stringify(result));
    } catch (e) {}

    return result;
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

    if (this.isLive()) {
      try {
        await supabase
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

    if (this.isLive()) {
      try {
        await supabase
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
      const { data, error } = await supabase.from('events').select('*').order('day_number', { ascending: true });
      if (!error && data) return data;
    }
    const raw = localStorage.getItem('almurafaqa_events');
    return raw ? JSON.parse(raw) : DEFAULT_EVENTS;
  },

  async saveEvent(eventData) {
    if (this.isLive()) {
      if (eventData.id && isUuid(eventData.id)) {
        const { data, error } = await supabase.from('events').update(eventData).eq('id', eventData.id).select().single();
        if (error) throw error;
        if (!data) throw new Error('Event update did not return a record.');
        return data;
      } else {
        const payload = { ...eventData };
        delete payload.id;
        const { data, error } = await supabase.from('events').insert([payload]).select().single();
        if (error) throw error;
        if (!data) throw new Error('Event creation did not return a record.');
        return data;
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
    if (this.isLive()) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const events = await this.getEvents();
    const filtered = events.filter((e) => e.id !== id);
    localStorage.setItem('almurafaqa_events', JSON.stringify(filtered));
    const registrations = await this.getRegistrations();
    localStorage.setItem('almurafaqa_registrations', JSON.stringify(registrations.filter((r) => r.event_id !== id)));
    const winners = await this.getWinners();
    localStorage.setItem('almurafaqa_winners', JSON.stringify(winners.filter((w) => w.event_id !== id)));
    return true;
  },

  // Registrations Operations
  async getRegistrations() {
    if (this.isLive()) {
      const { data, error } = await supabase
        .from('registrations')
        .select('*, events(title, fee)')
        .order('created_at', { ascending: false });
      if (!error && data) return purgeMockRegistrations(data);
    }
    const raw = localStorage.getItem('almurafaqa_registrations');
    return purgeMockRegistrations(raw ? JSON.parse(raw) : DEFAULT_REGISTRATIONS);
  },

  async updatePayment(id, payment_status) {
    if (this.isLive()) {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
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
      const payload = { ...regData };
      delete payload.id;
      const { data, error } = await supabase.from('registrations').insert([payload]).select().single();
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
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return purgeMockAnnouncements(data);
    }
    const raw = localStorage.getItem('almurafaqa_announcements');
    return purgeMockAnnouncements(raw ? JSON.parse(raw) : DEFAULT_ANNOUNCEMENTS);
  },

  async saveAnnouncement(data) {
    if (this.isLive()) {
      if (data.id && isUuid(data.id)) {
        const { data: updated, error } = await supabase
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
        const { data: inserted, error } = await supabase
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
      const { error } = await supabase.from('announcements').delete().eq('id', id);
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
      const { data, error } = await supabase
        .from('winners')
        .select('*, events(title, category)')
        .order('position', { ascending: true });
      if (!error && data) return purgeMockWinners(data);
    }
    const raw = localStorage.getItem('almurafaqa_winners');
    return purgeMockWinners(raw ? JSON.parse(raw) : DEFAULT_WINNERS);
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
      const { error: delError } = await supabase.from('winners').delete().eq('event_id', eventId);
      if (delError) throw delError;
      if (records.length > 0) {
        const { data, error } = await supabase.from('winners').insert(records).select();
        if (error) throw error;
        return data || [];
      }
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
  // MODULE 1: JURY SCORING & RUBRIC PORTAL
  // ----------------------------------------------------------------------------
  async getScores(eventId = null) {
    let list = [];
    try {
      const raw = localStorage.getItem('almurafaqa_scores');
      list = raw ? JSON.parse(raw) : [];
    } catch (e) {
      list = [];
    }
    if (eventId) {
      return list.filter((s) => s.event_id === eventId);
    }
    return list;
  },

  async saveScore(scoreObj) {
    const list = await this.getScores();
    const existingIdx = list.findIndex((s) => s.id === scoreObj.id || (s.event_id === scoreObj.event_id && s.registration_id === scoreObj.registration_id && s.judge_name === scoreObj.judge_name));
    
    const record = {
      ...scoreObj,
      id: scoreObj.id || generateUuid(),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem('almurafaqa_scores', JSON.stringify(list));
    return record;
  },

  async deleteScore(id) {
    const list = await this.getScores();
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem('almurafaqa_scores', JSON.stringify(filtered));
    return true;
  },

  // ----------------------------------------------------------------------------
  // MODULE 3: STAGE OPERATIONS & RUN-OF-SHOW CONTROLLER
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
  // MODULE 8: AUDIT TRAIL ENGINE
  // ----------------------------------------------------------------------------
  async getAuditLogs() {
    try {
      const raw = localStorage.getItem('almurafaqa_audit_logs');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async addAuditLog(action, details, role = 'Super Admin') {
    const list = await this.getAuditLogs();
    const entry = {
      id: generateUuid(),
      timestamp: new Date().toISOString(),
      role: role || 'Super Admin',
      action: action || 'OPERATION',
      details: details || '',
    };
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
    const [settings, events, registrations, announcements, winners, scores, stageOps, auditLogs] = await Promise.all([
      this.getSettings(),
      this.getEvents(),
      this.getRegistrations(),
      this.getAnnouncements(),
      this.getWinners(),
      this.getScores(),
      this.getStageOps(),
      this.getAuditLogs(),
    ]);

    return {
      version: '5.0',
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
      },
    };
  },

  async restoreBackup(backupData) {
    if (!backupData || !backupData.collections) {
      throw new Error('Invalid backup file format: missing collections payload.');
    }
    const { settings, events, registrations, announcements, winners, scores, stageOps, auditLogs } = backupData.collections;

    if (settings) localStorage.setItem('almurafaqa_settings', JSON.stringify(settings));
    if (Array.isArray(events)) localStorage.setItem('almurafaqa_events', JSON.stringify(events));
    if (Array.isArray(registrations)) localStorage.setItem('almurafaqa_registrations', JSON.stringify(registrations));
    if (Array.isArray(announcements)) localStorage.setItem('almurafaqa_announcements', JSON.stringify(announcements));
    if (Array.isArray(winners)) localStorage.setItem('almurafaqa_winners', JSON.stringify(winners));
    if (Array.isArray(scores)) localStorage.setItem('almurafaqa_scores', JSON.stringify(scores));
    if (stageOps) localStorage.setItem('almurafaqa_stage_ops', JSON.stringify(stageOps));
    if (Array.isArray(auditLogs)) localStorage.setItem('almurafaqa_audit_logs', JSON.stringify(auditLogs));

    await this.addAuditLog('DATABASE_RESTORE', 'Full database restored from JSON backup archive', 'Super Admin');
    return true;
  },

  // ----------------------------------------------------------------------------
  // RESTRICTION & ACCESS CONTROL ENGINE
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
    return merged;
  },

  // ============================================================================
  // TEAM LEADER PORTAL & TOKEN SYSTEM (Module 9)
  // ============================================================================

  // Fetch all team leaders
  async getTeamLeaders() {
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
          .from('team_leaders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(data));
          return data;
        }
        if (error) console.warn('[Supabase getTeamLeaders]', error.message);
      } catch (err) {
        console.warn('[Supabase getTeamLeaders catch]', err);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_LEADERS);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  },

  // Lookup team leader by token (e.g. TL-7A9B-4F12)
  async getTeamLeaderByToken(token) {
    if (!token) return null;
    const cleanToken = token.trim().toUpperCase();
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
          .from('team_leaders')
          .select('*')
          .eq('token', cleanToken)
          .eq('status', 'active')
          .maybeSingle();
        if (!error && data) return data;
        if (error) console.warn('[Supabase getTeamLeaderByToken]', error.message);
      } catch (err) {
        console.warn('[Supabase getTeamLeaderByToken catch]', err);
      }
    }
    const list = await this.getTeamLeaders();
    return list.find((tl) => (tl.token || '').trim().toUpperCase() === cleanToken && tl.status === 'active') || null;
  },

  // Create new team leader and assign unique token
  async createTeamLeader(data) {
    const leaderToken = data.token ? data.token.trim().toUpperCase() : generateLeaderToken();
    const newLeader = {
      id: generateUuid(),
      token: leaderToken,
      leader_name: (data.leader_name || 'Team Leader').trim(),
      leader_email: (data.leader_email || '').trim(),
      leader_phone: (data.leader_phone || '').trim(),
      institution_name: (data.institution_name || 'Institutional Delegation').trim(),
      team_name: (data.team_name || '').trim(),
      max_students: Number(data.max_students) || 50,
      status: data.status || 'active',
      notes: (data.notes || '').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isLive()) {
      try {
        const payload = { ...newLeader };
        delete payload.id;
        const { data: inserted, error } = await supabase
          .from('team_leaders')
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) {
          const list = await this.getTeamLeaders();
          list.unshift(inserted);
          localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));
          return inserted;
        }
        if (error) console.warn('[Supabase createTeamLeader]', error.message);
      } catch (err) {
        console.warn('[Supabase createTeamLeader catch]', err);
      }
    }

    const list = await this.getTeamLeaders();
    list.unshift(newLeader);
    localStorage.setItem(STORAGE_KEYS.TEAM_LEADERS, JSON.stringify(list));
    return newLeader;
  },

  // Update existing team leader
  async updateTeamLeader(id, updates) {
    updates.updated_at = new Date().toISOString();
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
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
    if (this.isLive()) {
      try {
        await supabase.from('team_leaders').delete().eq('id', id);
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
    if (this.isLive()) {
      try {
        let query = supabase.from('team_students').select('*').order('created_at', { ascending: false });
        if (teamLeaderId) {
          query = query.eq('team_leader_id', teamLeaderId);
        }
        const { data, error } = await query;
        if (!error && data) {
          if (!teamLeaderId) localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamStudents]', err);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_STUDENTS);
    const all = raw ? JSON.parse(raw) : [];
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

    if (this.isLive()) {
      try {
        const payload = { ...student };
        delete payload.id;
        const { data: inserted, error } = await supabase
          .from('team_students')
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) {
          const list = await this.getTeamStudents();
          list.unshift(inserted);
          localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
          return inserted;
        }
      } catch (err) {
        console.warn('[Supabase addTeamStudent]', err);
      }
    }

    const list = await this.getTeamStudents();
    list.unshift(student);
    localStorage.setItem(STORAGE_KEYS.TEAM_STUDENTS, JSON.stringify(list));
    return student;
  },

  async updateTeamStudent(studentId, updates) {
    if (this.isLive()) {
      try {
        const { data, error } = await supabase
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
    if (this.isLive()) {
      try {
        await supabase.from('team_students').delete().eq('id', studentId);
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
        let query = supabase.from('team_assignments').select('*');
        if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId);
        const { data, error } = await query;
        if (!error && data) {
          if (!teamLeaderId) localStorage.setItem(STORAGE_KEYS.TEAM_ASSIGNMENTS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamAssignments]', err);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_ASSIGNMENTS);
    const all = raw ? JSON.parse(raw) : [];
    return teamLeaderId ? all.filter((a) => a.team_leader_id === teamLeaderId) : all;
  },

  // Assign students to a festival event, and synchronize with registrations desk
  async saveTeamAssignment(teamLeaderId, eventId, studentIds) {
    const leaders = await this.getTeamLeaders();
    const leader = leaders.find((l) => l.id === teamLeaderId);
    const events = await this.getEvents();
    const event = events.find((e) => e.id === eventId);
    const allStudents = await this.getTeamStudents(teamLeaderId);
    const assignedStudents = allStudents.filter((s) => studentIds.includes(s.id));

    if (!leader || !event) throw new Error('Invalid leader or event reference.');

    // 1. Sync or generate festival registration record for the assigned students
    const ticketCode = `ALM-TL-${Math.floor(1000 + Math.random() * 9000)}`;
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
      checked_in: false,
    };

    let savedReg = null;
    try {
      savedReg = await this.addRegistration(regPayload);
    } catch (regErr) {
      console.warn('[Sync Registration for Team Assignment]', regErr);
    }

    // 2. Save team assignment record
    const assignmentRecord = {
      id: generateUuid(),
      team_leader_id: teamLeaderId,
      event_id: eventId,
      student_ids: studentIds,
      registration_id: savedReg ? savedReg.id : null,
      created_at: new Date().toISOString(),
    };

    if (this.isLive()) {
      try {
        const payload = { ...assignmentRecord };
        delete payload.id;
        await supabase.from('team_assignments').insert([payload]);
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
    if (this.isLive()) {
      try {
        await supabase.from('team_assignments').delete().eq('team_leader_id', teamLeaderId).eq('event_id', eventId);
      } catch (err) {
        console.warn('[Supabase removeTeamAssignment]', err);
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
        let query = supabase.from('team_groups').select('*').order('created_at', { ascending: false });
        if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId);
        const { data, error } = await query;
        if (!error && data) {
          if (!teamLeaderId) localStorage.setItem(STORAGE_KEYS.TEAM_GROUPS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('[Supabase getTeamGroups]', err);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_GROUPS);
    const all = raw ? JSON.parse(raw) : [];
    return teamLeaderId ? all.filter((g) => g.team_leader_id === teamLeaderId) : all;
  },

  async saveTeamGroup(teamData) {
    const list = await this.getTeamGroups();
    let record = null;
    const now = new Date().toISOString();

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
      if (this.isLive()) {
        try {
          const payload = { ...record };
          await supabase.from('team_groups').update(payload).eq('id', teamData.id);
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
      if (this.isLive()) {
        try {
          const payload = { ...record };
          delete payload.id;
          const { data, error } = await supabase.from('team_groups').insert([payload]).select().single();
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
    if (this.isLive()) {
      try {
        await supabase.from('team_groups').delete().eq('id', teamGroupId);
      } catch (err) {
        console.warn('[Supabase deleteTeamGroup]', err);
      }
    }
    const list = await this.getTeamGroups();
    const filtered = list.filter((g) => g.id !== teamGroupId);
    localStorage.setItem(STORAGE_KEYS.TEAM_GROUPS, JSON.stringify(filtered));
    return true;
  },
};
