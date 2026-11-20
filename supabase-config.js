// ==============================================================================
// AL MURAFAQA • SUPABASE CLIENT & HYBRID DATA ENGINE
// Supports live Supabase cloud connectivity with automatic localStorage fallback
// ==============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ------------------------------------------------------------------------------
// 1. SUPABASE CREDENTIALS (PASTE YOUR SUPABASE DETAILS HERE)
// ------------------------------------------------------------------------------
export const SUPABASE_CONFIG = {
  // Replace these with your actual Supabase project URL and anon public key
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
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
// 2. DEFAULT SEED DATA (For Local Storage Fallback & Offline Demo)
// ------------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  id: 1,
  fest_name: 'Al Murafaqa • 5th Edition',
  registrations_open: true,
  maintenance_mode: false,
  live_ticker_enabled: true,
  live_ticker_text: '✨ Welcome to Al Murafaqa 5th Edition • Live Cultural Gathering • Registrations Closing Soon for Stage Events • Grand Finale on Day 3',
  upi_id: 'almurafaqa@upi',
  support_phone: '+91 98765 43210',
  updated_at: new Date().toISOString(),
};

const DEFAULT_EVENTS = [
  {
    id: 'evt-001',
    title: 'Andalusian Calligraphy Championship',
    category: 'Calligraphy',
    fee: 150,
    prize_pool: 15000,
    team_size_min: 1,
    team_size_max: 1,
    max_capacity: 30,
    status: 'open',
    day_number: 1,
    time_slot: '10:00 AM – 01:00 PM',
    venue: 'Hall of Scribes (North Wing)',
    rules: 'Traditional Qalam & ink only. Handmade A3 parchment provided on spot. 3 hours total duration.',
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'evt-002',
    title: 'Diwan Classical Poetry Recital',
    category: 'Poetry',
    fee: 100,
    prize_pool: 12000,
    team_size_min: 1,
    team_size_max: 1,
    max_capacity: 25,
    status: 'closing_soon',
    day_number: 1,
    time_slot: '02:30 PM – 05:30 PM',
    venue: 'Grand Andalusian Dome',
    rules: 'Recital in Arabic, Urdu, or Persian classical meter. 5 minutes max per contestant.',
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'evt-003',
    title: 'Oud & Maqam Ensemble Showcase',
    category: 'Music',
    fee: 300,
    prize_pool: 25000,
    team_size_min: 2,
    team_size_max: 5,
    max_capacity: 15,
    status: 'open',
    day_number: 2,
    time_slot: '06:00 PM – 09:30 PM',
    venue: 'Central Courtyard Amphitheatre',
    rules: 'Acoustic instruments only (Oud, Ney, Daf, Riq, Qanun). 12-minute performance.',
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'evt-004',
    title: 'Sacred Geometry & Architectural Model Design',
    category: 'Architecture',
    fee: 250,
    prize_pool: 20000,
    team_size_min: 2,
    team_size_max: 4,
    max_capacity: 20,
    status: 'open',
    day_number: 2,
    time_slot: '10:00 AM – 03:00 PM',
    venue: 'Design Studio B',
    rules: 'Recreate traditional Moorish arches or muqarnas dome structures using wood and plaster.',
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-005',
    title: 'Hikmah & Moral Philosophy Colloquium',
    category: 'Philosophy',
    fee: 100,
    prize_pool: 10000,
    team_size_min: 1,
    team_size_max: 2,
    max_capacity: 40,
    status: 'open',
    day_number: 3,
    time_slot: '11:00 AM – 02:00 PM',
    venue: 'Ibn Rushd Lecture Hall',
    rules: 'Paper presentation and defense on Islamic epistemological traditions and classical ethics.',
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const DEFAULT_REGISTRATIONS = [
  {
    id: 'reg-001',
    ticket_code: 'ALM-1042',
    event_id: 'evt-001',
    team_name: 'Qalam Vanguard',
    leader_name: 'Zaid Al-Husseini',
    leader_email: 'zaid@example.com',
    leader_phone: '+91 98765 11223',
    college_name: 'Faculty of Fine Arts & Design',
    team_members: [{ name: 'Zaid Al-Husseini', role: 'Lead Scribe' }],
    payment_status: 'verified',
    transaction_id: 'UPI20261120019234',
    checked_in: true,
    checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'reg-002',
    ticket_code: 'ALM-1043',
    event_id: 'evt-003',
    team_name: 'Qurtuba Trio',
    leader_name: 'Sofia Benali',
    leader_email: 'sofia.b@example.com',
    leader_phone: '+91 98451 99881',
    college_name: 'National Conservatory of Music',
    team_members: [
      { name: 'Sofia Benali', role: 'Lead Oud' },
      { name: 'Farhan Mir', role: 'Percussion / Riq' },
      { name: 'Laila Tazi', role: 'Ney Flute' },
    ],
    payment_status: 'verified',
    transaction_id: 'UPI20261120028741',
    checked_in: false,
    checked_in_at: null,
    created_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
  },
  {
    id: 'reg-003',
    ticket_code: 'ALM-1044',
    event_id: 'evt-002',
    team_name: 'Diwan Soloist',
    leader_name: 'Ammar Qureshi',
    leader_email: 'ammar.q@example.com',
    leader_phone: '+91 97112 33445',
    college_name: 'Department of Classical Literature',
    team_members: [{ name: 'Ammar Qureshi', role: 'Poet / Soloist' }],
    payment_status: 'pending',
    transaction_id: 'UPI20261120034112',
    checked_in: false,
    checked_in_at: null,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'reg-004',
    ticket_code: 'ALM-1045',
    event_id: 'evt-004',
    team_name: 'Alhambra Builders',
    leader_name: 'Kareem Mansoor',
    leader_email: 'kareem@example.com',
    leader_phone: '+91 99001 22334',
    college_name: 'Institute of Architecture & Heritage',
    team_members: [
      { name: 'Kareem Mansoor', role: 'Architect' },
      { name: 'Bilal Nazeer', role: 'Modeler' },
    ],
    payment_status: 'rejected',
    transaction_id: 'INV_REF_99182',
    checked_in: false,
    checked_in_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'reg-005',
    ticket_code: 'ALM-1046',
    event_id: 'evt-005',
    team_name: 'Hikmah Dialogue',
    leader_name: 'Dr. Tariq Jamil',
    leader_email: 'tariq.j@example.com',
    leader_phone: '+91 98877 66554',
    college_name: 'Center for Islamic Studies',
    team_members: [{ name: 'Dr. Tariq Jamil', role: 'Speaker' }],
    payment_status: 'verified',
    transaction_id: 'UPI20261120094821',
    checked_in: true,
    checked_in_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'anc-001',
    title: 'Oud Showcase Venue & Soundcheck Update',
    message: 'The Oud & Maqam Ensemble showcase soundcheck will begin promptly at 04:30 PM at the Central Amphitheatre.',
    is_urgent: false,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'anc-002',
    title: 'Calligraphy Handmade Paper Distribution',
    message: 'Registered scribes can collect their handmade Andalusian parchment kits from Helpdesk Counter 2 starting at 08:30 AM.',
    is_urgent: true,
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

const DEFAULT_WINNERS = [
  {
    id: 'win-001',
    event_id: 'evt-001',
    position: 1,
    winner_name: 'Zaid Al-Husseini',
    college_name: 'Faculty of Fine Arts & Design',
    published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'win-002',
    event_id: 'evt-001',
    position: 2,
    winner_name: 'Mariam Al-Khatib',
    college_name: 'School of Traditional Arts',
    published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'win-003',
    event_id: 'evt-001',
    position: 3,
    winner_name: 'Hassan Bilal',
    college_name: 'Andalusian Arts Guild',
    published: true,
    created_at: new Date().toISOString(),
  },
];

// Initialize localStorage cache if empty
function initStorage() {
  if (!localStorage.getItem('almurafaqa_settings')) {
    localStorage.setItem('almurafaqa_settings', JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem('almurafaqa_events')) {
    localStorage.setItem('almurafaqa_events', JSON.stringify(DEFAULT_EVENTS));
  }
  if (!localStorage.getItem('almurafaqa_registrations')) {
    localStorage.setItem('almurafaqa_registrations', JSON.stringify(DEFAULT_REGISTRATIONS));
  }
  if (!localStorage.getItem('almurafaqa_announcements')) {
    localStorage.setItem('almurafaqa_announcements', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
  }
  if (!localStorage.getItem('almurafaqa_winners')) {
    localStorage.setItem('almurafaqa_winners', JSON.stringify(DEFAULT_WINNERS));
  }
}
initStorage();

// ------------------------------------------------------------------------------
// 3. UNIFIED DATA SERVICE (Cloud Supabase with Offline LocalStorage Fallback)
// ------------------------------------------------------------------------------
export const db = {
  // Check active mode
  isLive() {
    return isConfigured && supabase !== null;
  },

  // Auth Operations
  async signIn(email, password) {
    if (this.isLive()) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } else {
      // Demo authentication: Accept demo credentials
      if (email === 'admin@almurafaqa.com' && password === 'admin123') {
        const demoUser = {
          id: 'demo-admin-id',
          email: 'admin@almurafaqa.com',
          user_metadata: { name: 'Al Murafaqa Director', role: 'admin' },
        };
        const demoSession = { user: demoUser, token: 'demo-token-xyz' };
        localStorage.setItem('almurafaqa_admin_session', JSON.stringify(demoSession));
        return { user: demoUser, session: demoSession };
      } else {
        throw new Error('Invalid credentials. Use demo: admin@almurafaqa.com / admin123');
      }
    }
  },

  async signOut() {
    if (this.isLive()) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('almurafaqa_admin_session');
  },

  async getSession() {
    if (this.isLive()) {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } else {
      const raw = localStorage.getItem('almurafaqa_admin_session');
      return raw ? JSON.parse(raw) : null;
    }
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
    if (this.isLive()) {
      const { data, error } = await supabase.from('fest_settings').update(updates).eq('id', 1).select().single();
      if (!error && data) {
        localStorage.setItem('almurafaqa_settings', JSON.stringify(data));
        return data;
      }
    }
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
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
      if (eventData.id && !eventData.id.startsWith('evt-')) {
        const { data, error } = await supabase.from('events').update(eventData).eq('id', eventData.id).select().single();
        if (!error && data) return data;
      } else {
        const payload = { ...eventData };
        delete payload.id;
        const { data, error } = await supabase.from('events').insert([payload]).select().single();
        if (!error && data) return data;
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
      eventData.id = 'evt-' + Date.now().toString(36);
      eventData.created_at = new Date().toISOString();
      events.push(eventData);
    }
    localStorage.setItem('almurafaqa_events', JSON.stringify(events));
    return eventData;
  },

  async deleteEvent(id) {
    if (this.isLive()) {
      await supabase.from('events').delete().eq('id', id);
    }
    const events = await this.getEvents();
    const filtered = events.filter((e) => e.id !== id);
    localStorage.setItem('almurafaqa_events', JSON.stringify(filtered));
    return true;
  },

  // Registrations Operations
  async getRegistrations() {
    if (this.isLive()) {
      const { data, error } = await supabase
        .from('registrations')
        .select('*, events(title, fee)')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    const raw = localStorage.getItem('almurafaqa_registrations');
    return raw ? JSON.parse(raw) : DEFAULT_REGISTRATIONS;
  },

  async updatePayment(id, payment_status) {
    if (this.isLive()) {
      const { data, error } = await supabase
        .from('registrations')
        .update({ payment_status })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data;
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
      if (!error && data) return data;
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
      const { data, error } = await supabase.from('registrations').insert([regData]).select().single();
      if (!error && data) return data;
    }
    regData.id = 'reg-' + Date.now().toString(36);
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
      if (!error && data) return data;
    }
    const raw = localStorage.getItem('almurafaqa_announcements');
    return raw ? JSON.parse(raw) : DEFAULT_ANNOUNCEMENTS;
  },

  async saveAnnouncement(data) {
    if (this.isLive()) {
      if (data.id && !data.id.startsWith('anc-')) {
        const { data: updated, error } = await supabase
          .from('announcements')
          .update(data)
          .eq('id', data.id)
          .select()
          .single();
        if (!error && updated) return updated;
      } else {
        const payload = { ...data };
        delete payload.id;
        const { data: inserted, error } = await supabase
          .from('announcements')
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) return inserted;
      }
    }
    const list = await this.getAnnouncements();
    if (data.id) {
      const index = list.findIndex((a) => a.id === data.id);
      if (index !== -1) list[index] = { ...list[index], ...data };
    } else {
      data.id = 'anc-' + Date.now().toString(36);
      data.created_at = new Date().toISOString();
      list.unshift(data);
    }
    localStorage.setItem('almurafaqa_announcements', JSON.stringify(list));
    return data;
  },

  async deleteAnnouncement(id) {
    if (this.isLive()) {
      await supabase.from('announcements').delete().eq('id', id);
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
      if (!error && data) return data;
    }
    const raw = localStorage.getItem('almurafaqa_winners');
    return raw ? JSON.parse(raw) : DEFAULT_WINNERS;
  },

  async saveWinners(eventId, winnersArray, published = true) {
    const records = winnersArray.map((w) => ({
      event_id: eventId,
      position: w.position,
      winner_name: w.winner_name,
      college_name: w.college_name,
      published,
      created_at: new Date().toISOString(),
    }));

    if (this.isLive()) {
      // Upsert into supabase
      await supabase.from('winners').delete().eq('event_id', eventId);
      const { data, error } = await supabase.from('winners').insert(records).select();
      if (!error && data) return data;
    }

    // Local fallback
    const list = (await this.getWinners()).filter((w) => w.event_id !== eventId);
    records.forEach((r, idx) => {
      r.id = 'win-' + Date.now().toString(36) + '-' + idx;
      list.push(r);
    });
    localStorage.setItem('almurafaqa_winners', JSON.stringify(list));
    return records;
  },
};
