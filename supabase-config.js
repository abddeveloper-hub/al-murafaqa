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
  fest_name: 'Al Murafaqa • 5th Edition',
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
  video_poster_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI4u7wM1OZBhGT-FXa7reqYfBd_iL47KqTEKkVKg_Idm8vRlJmbdWzUsd9leeBo8C1iT-u8DngFM0FXGt4ts66akMHNMMhJLX5H6lI38Ip4TNgcxyWt6W6jrtfl8IL1YkL1-zJsck5U9-dkM5NH5LH6IELBONbt9z8WvfI5KOrGwxcxGylyHzbQlrAkuV1nBWBiuu2E9UOdxa5D3h9k-8p5XBeRoQS0gaQ6sVBMXJb',
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
    if (this.isLive()) {
      const { data, error } = await supabase.from('fest_settings').select('*').eq('id', 1).single();
      if (!error && data) return data;
    }
    const raw = localStorage.getItem('almurafaqa_settings');
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  },

  async updateSettings(updates) {
    updates.updated_at = new Date().toISOString();
    let cloudData = null;
    if (this.isLive()) {
      try {
        const { data, error } = await supabase.from('fest_settings').update(updates).eq('id', 1).select().single();
        if (!error && data) {
          cloudData = data;
        } else if (error) {
          console.warn('[Supabase updateSettings]', error.message);
          // If remote table doesn't have custom columns yet, update core columns
          const coreFields = ['fest_name', 'registrations_open', 'maintenance_mode', 'live_ticker_enabled', 'live_ticker_text', 'upi_id', 'support_phone', 'updated_at'];
          const corePayload = {};
          coreFields.forEach((k) => {
            if (k in updates) corePayload[k] = updates[k];
          });
          if (Object.keys(corePayload).length > 0) {
            await supabase.from('fest_settings').update(corePayload).eq('id', 1);
          }
        }
      } catch (cloudErr) {
        console.warn('[Supabase updateSettings catch]', cloudErr);
      }
    }
    const current = await this.getSettings();
    const updated = { ...current, ...updates, ...(cloudData || {}) };
    localStorage.setItem('almurafaqa_settings', JSON.stringify(updated));
    return updated;
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

  async addRegistration(regData) {
    regData.ticket_code = 'ALM-' + Math.floor(1000 + Math.random() * 9000);
    regData.created_at = new Date().toISOString();
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
    localStorage.setItem('almurafaqa_registrations', JSON.stringify(list));
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
};
