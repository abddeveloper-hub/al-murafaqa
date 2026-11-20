// ==========================================================================
// 🌌 Al Murafaqa / abdsite - Central System Engine & Core Script
// ==========================================================================

// Global Toast System
window.showToast = function(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'information-circle-outline';
    if (type === 'success') iconName = 'checkmark-circle-outline';
    else if (type === 'error') iconName = 'close-circle-outline';
    else if (type === 'warning') iconName = 'warning-outline';

    toast.innerHTML = `
        <ion-icon name="${iconName}"></ion-icon>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

// Global System Logging
window.logSystemActivity = function(message, type = 'info') {
    const key = 'compete_notifications';
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date().toLocaleString();

    list.unshift({
        id: Date.now(),
        message: message,
        type: type,
        time: timestamp
    });
    if (list.length > 8) list.pop();
    localStorage.setItem(key, JSON.stringify(list));

    const auditKey = 'compete_audit_trail';
    let auditList = JSON.parse(localStorage.getItem(auditKey) || '[]');
    const loggedUser = JSON.parse(localStorage.getItem('compete_logged_in_user') || '{"name":"System Admin"}');
    auditList.unshift({
        id: Date.now(),
        timestamp: fullDate,
        type: type,
        message: message,
        user: loggedUser.name || 'Admin'
    });
    if (auditList.length > 500) auditList.pop();
    localStorage.setItem(auditKey, JSON.stringify(auditList));

    let unread = parseInt(localStorage.getItem('compete_unread_notifications') || '0', 10);
    localStorage.setItem('compete_unread_notifications', (unread + 1).toString());

    document.querySelectorAll('.notification-btn .badge').forEach(badge => {
        badge.textContent = unread + 1;
        badge.style.display = 'flex';
    });
};

// Global Data Store & Sync Engine
window.initCompeteSystem = function() {
    // 1. Competitions & Programmes Synchronization
    let comps = JSON.parse(localStorage.getItem('compete_competitions') || '[]');
    let progs = JSON.parse(localStorage.getItem('compete_programmes') || '[]');
    if (comps.length === 0 && progs.length === 0) {
        comps = [
            { name: "Annual Hackathon 2026", category: "tech", location: "Main Tech Auditorium", date: "2026-10-15", slots: 100, filled: 45, organizer: "Engineering Council", status: "live", desc: "48-hour coding marathon. Build innovative solutions and win prizes." },
            { name: "Campus Sports Meet", category: "sports", location: "Grand Stadium Arena", date: "2026-11-05", slots: 120, filled: 90, organizer: "Athletics Directorate", status: "upcoming", desc: "Track, basketball, football tournaments, and athletics." },
            { name: "Fine Arts Showcase", category: "arts", location: "Creative Exhibition Gallery", date: "2026-12-12", slots: 80, filled: 35, organizer: "Art & Culture Dept", status: "upcoming", desc: "Exhibition of calligraphy, paintings, digital art, and craftsmanship." },
            { name: "Qira'at & Nasheed", category: "arts", location: "Islamic Cultural Hall", date: "2026-12-20", slots: 60, filled: 25, organizer: "Literary Guild", status: "upcoming", desc: "Melodious Quranic recitation and vocal nasheed performances." }
        ];
    } else if (comps.length === 0 && progs.length > 0) {
        comps = progs;
    }
    localStorage.setItem('compete_competitions', JSON.stringify(comps));
    localStorage.setItem('compete_programmes', JSON.stringify(comps));

    // 2. Sections
    let sections = JSON.parse(localStorage.getItem('compete_sections') || '[]');
    if (sections.length === 0) {
        sections = ['Madaneeyam', 'Mubbashara', 'Musharrafa', 'Old Students'];
        localStorage.setItem('compete_sections', JSON.stringify(sections));
    }

    // 3. Teams (Total 3 Teams)
    let teams = JSON.parse(localStorage.getItem('compete_teams') || '[]');
    if (teams.length === 0) {
        teams = [
            { name: "Red Team", leader: "Ahmed Hassan", members: 18, dept: "Computer Science" },
            { name: "Blue Team", leader: "Sarah Miller", members: 18, dept: "Business & Management" },
            { name: "Green Team", leader: "Raj Kumar", members: 16, dept: "Physical Sciences" }
        ];
        localStorage.setItem('compete_teams', JSON.stringify(teams));
    }

    // 4. Managers
    let managers = JSON.parse(localStorage.getItem('compete_managers') || '[]');
    if (managers.length === 0) {
        managers = [
            { name: "Ahmed Hassan", team: "Red Team", email: "manager@abdsite.com", phone: "+91 98765 43210", level: "Senior", status: "Active" },
            { name: "Sarah Miller", team: "Blue Team", email: "sarah@abdsite.com", phone: "+91 98765 43211", level: "Senior", status: "Active" }
        ];
        localStorage.setItem('compete_managers', JSON.stringify(managers));
    }

    // 5. Judges
    let judges = JSON.parse(localStorage.getItem('compete_judges') || '[]');
    if (judges.length === 0) {
        judges = [
            { name: "Dr. Khalid Omar", email: "judge@abdsite.com", assignments: ["Annual Hackathon 2026", "Campus Sports Meet", "Fine Arts Showcase"] }
        ];
        localStorage.setItem('compete_judges', JSON.stringify(judges));
    }

    // 6. Unified Participants & Candidates
    let parts = JSON.parse(localStorage.getItem('compete_participants') || '[]');
    let cands = JSON.parse(localStorage.getItem('compete_candidates') || '[]');
    if (parts.length === 0 && cands.length === 0) {
        parts = [
            { name: "John Doe", email: "john.doe@example.com", section: "Madaneeyam", team: "Red Team", comp: "Annual Hackathon 2026", points: 94, status: "Approved" },
            { name: "Alice Smith", email: "alice.s@example.com", section: "Mubbashara", team: "Blue Team", comp: "Campus Sports Meet", points: 88, status: "Approved" },
            { name: "Mohamed Ali", email: "mohamed.ali@example.com", section: "Musharrafa", team: "Green Team", comp: "Campus Sports Meet", points: 90, status: "Approved" },
            { name: "Sara Ahmed", email: "sara.a@example.com", section: "Old Students", team: "Yellow Team", comp: "Fine Arts Showcase", points: 78, status: "Approved" },
            { name: "Ahmed Raza", email: "ahmed.raza@example.com", section: "Madaneeyam", team: "Red Team", comp: "Qira'at & Nasheed", points: 95, status: "Approved" },
            { name: "Sarah Khan", email: "sarah.k@example.com", section: "Mubbashara", team: "Blue Team", comp: "Campus Sports Meet", points: 82, status: "Approved" }
        ];
    } else if (parts.length === 0 && cands.length > 0) {
        parts = cands.map(c => ({
            name: c.name,
            email: c.email || `${c.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            section: c.section || 'Madaneeyam',
            team: c.team || 'Red Team',
            comp: c.comp || c.assignment || 'Annual Hackathon 2026',
            points: c.score || c.points || 85,
            status: c.status || 'Approved'
        }));
    }
    localStorage.setItem('compete_participants', JSON.stringify(parts));
    localStorage.setItem('compete_candidates', JSON.stringify(parts));

    // 7. Results & Published Standings
    let results = JSON.parse(localStorage.getItem('compete_results') || '[]');
    if (results.length === 0) {
        results = [
            { name: "Ahmed Raza", prog: "Qira'at & Nasheed", team: "Red Team", section: "Madaneeyam", score: 95, grade: "A+" },
            { name: "John Doe", prog: "Annual Hackathon 2026", team: "Red Team", section: "Madaneeyam", score: 94, grade: "A+" },
            { name: "Mohamed Ali", prog: "Campus Sports Meet", team: "Green Team", section: "Musharrafa", score: 90, grade: "A+" },
            { name: "Alice Smith", prog: "Campus Sports Meet", team: "Blue Team", section: "Mubbashara", score: 88, grade: "A" },
            { name: "Sarah Khan", prog: "Campus Sports Meet", team: "Blue Team", section: "Mubbashara", score: 82, grade: "A" },
            { name: "Sara Ahmed", prog: "Fine Arts Showcase", team: "Yellow Team", section: "Old Students", score: 78, grade: "B+" }
        ];
        localStorage.setItem('compete_results', JSON.stringify(results));
    }
    window.syncPublishedResults(results);

    // 8. Announcements
    let announcements = JSON.parse(localStorage.getItem('compete_announcements') || '[]');
    if (announcements.length === 0) {
        announcements = [
            { id: 1, message: "🚀 Al Murafaqa 2026 Season is officially LIVE!", priority: "high", timestamp: "Just now", date: "Today" },
            { id: 2, message: "🏆 Current Leader: Section Madaneeyam", priority: "normal", timestamp: "1h ago", date: "Today" },
            { id: 3, message: "📅 Next Event: Annual Hackathon & Campus Sports Meet ongoing", priority: "normal", timestamp: "2h ago", date: "Today" }
        ];
        localStorage.setItem('compete_announcements', JSON.stringify(announcements));
    }
};

window.syncParticipants = function(list) {
    localStorage.setItem('compete_participants', JSON.stringify(list));
    localStorage.setItem('compete_candidates', JSON.stringify(list));
};

window.syncCompetitions = function(list) {
    localStorage.setItem('compete_competitions', JSON.stringify(list));
    localStorage.setItem('compete_programmes', JSON.stringify(list));
};

window.syncPublishedResults = function(resultsList) {
    if (!resultsList) resultsList = JSON.parse(localStorage.getItem('compete_results') || '[]');
    const grouped = {};
    resultsList.forEach(r => {
        const comp = r.prog || r.comp || 'General Event';
        if (!grouped[comp]) {
            grouped[comp] = { publishedAt: new Date().toISOString(), allScores: [] };
        }
        grouped[comp].allScores.push({
            name: r.name,
            section: r.section || 'General',
            team: r.team || 'Unassigned',
            score: r.score,
            grade: r.grade,
            comp: comp
        });
    });
    localStorage.setItem('compete_published_results', JSON.stringify(grouped));
};

window.getManagerTeam = function(email) {
    const managers = JSON.parse(localStorage.getItem('compete_managers') || '[]');
    const manager = managers.find(m => m.email === email);
    return manager ? manager.team : "Red Team";
};

window.getTeamMembers = function(teamName) {
    const candidates = JSON.parse(localStorage.getItem('compete_candidates') || '[]');
    return candidates.filter(c => c.team === teamName);
};

window.publishAnnouncement = function(msg, priority = 'normal') {
    const key = 'compete_announcements';
    let announcements = JSON.parse(localStorage.getItem(key) || '[]');
    announcements.unshift({
        id: Date.now(),
        message: msg,
        priority: priority,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString()
    });
    localStorage.setItem(key, JSON.stringify(announcements));
    window.logSystemActivity(`📢 New announcement: "${msg.substring(0, 35)}..."`, 'info');
};

// Apply Global Personalization Theme Engine
function applySystemTheme() {
    const activeTheme = localStorage.getItem('compete_theme') || 'light';
    document.documentElement.setAttribute('data-theme', activeTheme);

    // Dynamic Role Detection
    let role = 'admin';
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/super-admin/')) role = 'super-admin';
    else if (path.includes('/team-manager/')) role = 'manager';
    else if (path.includes('/team-leader/')) role = 'leader';
    else if (path.includes('/judge/')) role = 'judge';
    else if (path.includes('/public.html') || path.includes('/index.html') || path.endsWith('/') || path.endsWith('\\')) role = 'public';
    else if (path.includes('/login.html')) role = 'admin';

    const user = JSON.parse(localStorage.getItem('compete_logged_in_user') || '{}');
    if (user.role && !role) role = user.role;

    document.documentElement.setAttribute('data-role', role);
}

// Theme Toggle Helper
window.toggleDarkMode = function() {
    const current = localStorage.getItem('compete_theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('compete_theme', next);
    applySystemTheme();
    window.showToast(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
};

// Initialize system state immediately
window.initCompeteSystem();
applySystemTheme();
window.addEventListener('DOMContentLoaded', applySystemTheme);

// DOM Ready Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Sidebar Brand Update
    const savedBrandName = localStorage.getItem('compete_platform_name') || 'abdsite';
    document.querySelectorAll('.sidebar-brand h2').forEach(brand => {
        if (brand.textContent.trim().toLowerCase().includes('hub')) {
            brand.textContent = savedBrandName + ' Hub';
        } else {
            brand.textContent = savedBrandName;
        }
    });

    // --- Festie-style Real-time Simulation ---
    const trafficBars = document.querySelectorAll('.traffic-bar');
    if (trafficBars.length > 0) {
        setInterval(() => {
            trafficBars.forEach(bar => {
                const h = Math.floor(Math.random() * 60) + 40;
                bar.style.height = `${h}%`;
            });
        }, 2500);
    }

    // Live Feed Updates
    const feed = document.getElementById('live-activity-feed');
    if (feed) {
        const users = ['Ahmed Hassan', 'Sarah Miller', 'Kevin Vance', 'Lina Q.', 'Judge Khalid'];
        const actions = ['scored a participant', 'uploaded media', 'registered for event', 'submitted evaluation score', 'joined competition roster'];

        setInterval(() => {
            if (Math.random() > 0.6) {
                const user = users[Math.floor(Math.random() * users.length)];
                const action = actions[Math.floor(Math.random() * actions.length)];
                const item = document.createElement('div');
                item.className = 'animate-in';
                item.style.cssText = 'padding:12px; background:var(--bg-tertiary); border-radius:12px; margin-bottom:10px; font-size:0.85rem; border:1px solid var(--border-color);';
                item.innerHTML = `<strong>${user}</strong> ${action} <span style="float:right; opacity:0.6; font-size:0.75rem;">Just now</span>`;
                feed.prepend(item);
                if (feed.children.length > 8) feed.lastChild.remove();
            }
        }, 4000);
    }

    // --- Chart Initializations ---
    if (typeof Chart !== 'undefined') {
        const roleAccent = getComputedStyle(document.documentElement).getPropertyValue('--role-accent').trim() || '#7c3aed';

        // 1. participationChart
        const partCtx = document.getElementById('participationChart');
        if (partCtx) {
            try {
                const gradient = partCtx.getContext('2d').createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, `${roleAccent}44`);
                gradient.addColorStop(1, `${roleAccent}00`);

                new Chart(partCtx, {
                    type: 'line',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Registrations',
                            data: [420, 580, 510, 720, 840, 690, 950],
                            borderColor: roleAccent,
                            backgroundColor: gradient,
                            borderWidth: 4,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: roleAccent,
                            pointBorderWidth: 3,
                            pointRadius: 5,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#64748b' } },
                            y: { grid: { color: 'rgba(15, 23, 42, 0.05)' }, ticks: { color: '#64748b' } }
                        }
                    }
                });
            } catch (err) {
                console.error('Error initializing participationChart:', err);
            }
        }

        // 2. powerRadarChart
        const radarCtx = document.getElementById('powerRadarChart');
        if (radarCtx) {
            try {
                new Chart(radarCtx, {
                    type: 'radar',
                    data: {
                        labels: ['Skill', 'Speed', 'Accuracy', 'Innovation', 'Teamwork', 'Consistency'],
                        datasets: [{
                            label: 'Section A (Madaneeyam)',
                            data: [85, 90, 78, 92, 88, 82],
                            borderColor: roleAccent,
                            backgroundColor: `${roleAccent}22`,
                            borderWidth: 2,
                            pointRadius: 4
                        }, {
                            label: 'Section B (Mubbashara)',
                            data: [70, 82, 95, 75, 80, 90],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            borderWidth: 2,
                            pointRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { font: { family: "'Plus Jakarta Sans'", weight: '600' }, padding: 15 }
                            }
                        },
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(15, 23, 42, 0.1)' },
                                grid: { color: 'rgba(15, 23, 42, 0.1)' },
                                pointLabels: { font: { size: 11, weight: '600' }, color: '#64748b' },
                                ticks: { display: false }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('Error initializing powerRadarChart:', err);
            }
        }

        // 3. mainDashboardChart (Admin Overview)
        const mainDashCtx = document.getElementById('mainDashboardChart');
        if (mainDashCtx) {
            try {
                const gradient = mainDashCtx.getContext('2d').createLinearGradient(0, 0, 0, 350);
                gradient.addColorStop(0, `${roleAccent}55`);
                gradient.addColorStop(1, `${roleAccent}00`);

                new Chart(mainDashCtx, {
                    type: 'line',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                        datasets: [{
                            label: 'Tournament Points',
                            data: [1200, 1950, 2400, 3100, 3850, 4600],
                            borderColor: roleAccent,
                            backgroundColor: gradient,
                            borderWidth: 3,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: roleAccent,
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                padding: 12,
                                cornerRadius: 8
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#64748b' } },
                            y: { grid: { color: 'rgba(15, 23, 42, 0.05)' }, ticks: { color: '#64748b' } }
                        }
                    }
                });
            } catch (err) {
                console.error('Error initializing mainDashboardChart:', err);
            }
        }
    }

    // --- Robust Multi-Page Logout Handling ---
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.showToast('Logging out...', 'info');
            const path = window.location.pathname.toLowerCase();
            const inSub = path.includes('/admin/') || path.includes('/judge/') ||
                          path.includes('/super-admin/') || path.includes('/team-leader/') ||
                          path.includes('/team-manager/');
            const dest = inSub ? '../login.html' : 'login.html';
            setTimeout(() => {
                window.location.href = dest;
            }, 500);
        });
    });

    // --- Search Bar Generic Handler ---
    const searchBarInput = document.querySelector('.search-bar input');
    if (searchBarInput && !searchBarInput.hasAttribute('onkeyup') && !searchBarInput.hasAttribute('oninput')) {
        searchBarInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchBarInput.value.trim() !== '') {
                window.showToast(`Filter applied: ${searchBarInput.value}`, 'info');
            }
        });
    }

    // --- Modal Management ---
    document.querySelectorAll('[data-modal-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal-target');
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('active');
        });
    });

    document.querySelectorAll('.btn-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // Publish Results Button
    const publishBtn = document.getElementById('publish-results-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
            window.syncPublishedResults();
            window.showToast('Results compiled and published to Public Leaderboards!', 'success');
            window.logSystemActivity('🏆 Results published to Public Portal & Team Dashboards.', 'success');
        });
    }

    // Notification Dropdown
    initNotificationDropdown();

    // Floating Action Button (Only on Admin pages)
    initQuickAction();
});

// Notification Dropdown Component
function initNotificationDropdown() {
    const notifyBtn = document.querySelector('.notification-btn');
    if (!notifyBtn) return;

    let badge = notifyBtn.querySelector('.badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        notifyBtn.appendChild(badge);
    }

    const parent = notifyBtn.parentElement;
    if (parent) parent.style.position = 'relative';

    let dropdown = document.querySelector('.notification-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown glass-card';
        dropdown.style.cssText = `
            position: absolute; top: 50px; right: 0; width: 320px; max-height: 400px;
            overflow-y: auto; border-radius: 16px; padding: 16px; background: var(--bg-secondary);
            border: 1px solid var(--border-color); box-shadow: var(--shadow-lg); z-index: 1000;
            display: none; flex-direction: column; gap: 12px;
        `;
        if (parent) parent.appendChild(dropdown);
    }

    notifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = dropdown.style.display === 'none' || dropdown.style.display === '';
        document.querySelectorAll('.notification-dropdown').forEach(d => d.style.display = 'none');

        if (isClosed) {
            renderNotifications(dropdown);
            dropdown.style.display = 'flex';
            localStorage.setItem('compete_unread_notifications', '0');
            badge.style.display = 'none';
        } else {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });

    if (dropdown) dropdown.addEventListener('click', e => e.stopPropagation());

    const unread = parseInt(localStorage.getItem('compete_unread_notifications') || '2', 10);
    if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderNotifications(dropdown) {
    const key = 'compete_notifications';
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.length === 0) {
        list = [
            { id: 1, message: "🏆 Scored Ahmed Raza: 95 pts recorded!", type: "success", time: "10:30 AM" },
            { id: 2, message: "⚙️ Tournament brackets updated.", type: "info", time: "09:15 AM" },
            { id: 3, message: "🏫 System audit check passed.", type: "info", time: "Yesterday" }
        ];
        localStorage.setItem(key, JSON.stringify(list));
    }

    dropdown.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
            <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">Recent System Logs</span>
            <button id="clear-notifications-btn" style="background:none; border:none; color:var(--accent-purple); font-size:0.75rem; font-weight:700; cursor:pointer;">Clear All</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;" id="notifications-list-container">
            ${list.map(item => `
                <div style="display:flex; align-items:flex-start; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                    <div style="width:8px; height:8px; border-radius:50%; background:${item.type === 'success' ? '#10b981' : item.type === 'error' ? '#ef4444' : 'var(--accent-purple)'}; margin-top:6px; flex-shrink:0;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <p style="font-size:0.8rem; color:var(--text-primary); line-height:1.3; font-weight:500;">${item.message}</p>
                        <span style="font-size:0.7rem; color:var(--text-muted);">${item.time}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const clearBtn = dropdown.querySelector('#clear-notifications-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.setItem(key, '[]');
            localStorage.setItem('compete_unread_notifications', '0');
            dropdown.querySelector('#notifications-list-container').innerHTML = `
                <div style="text-align:center; padding:20px 0; color:var(--text-muted); font-size:0.8rem;">
                    <span>No unread notifications.</span>
                </div>
            `;
            const badge = document.querySelector('.notification-btn .badge');
            if (badge) badge.style.display = 'none';
        });
    }
}

// Role-aware Quick Action Floating Button (Only for Admin)
function initQuickAction() {
    const path = window.location.pathname.toLowerCase();
    // Only render on admin pages
    if (!path.includes('/admin/')) return;

    if (document.querySelector('.quick-action-fab')) return;

    const fab = document.createElement('div');
    fab.className = 'quick-action-fab';
    fab.innerHTML = `
        <button class="fab-btn" title="Quick Actions">
            <ion-icon name="add-outline"></ion-icon>
        </button>
        <div class="fab-menu">
            <button title="New Competition" onclick="window.location.href='competitions.html'"><ion-icon name="trophy-outline"></ion-icon></button>
            <button title="Add Participant" onclick="window.location.href='participants.html'"><ion-icon name="person-add-outline"></ion-icon></button>
            <button title="Settings" onclick="window.location.href='settings.html'"><ion-icon name="settings-outline"></ion-icon></button>
        </div>
    `;

    if (!document.getElementById('fab-styles')) {
        const style = document.createElement('style');
        style.id = 'fab-styles';
        style.textContent = `
            .quick-action-fab { position: fixed; bottom: 30px; right: 30px; z-index: 999; }
            .fab-btn {
                width: 56px; height: 56px; border-radius: 50%;
                background: var(--role-gradient); color: white; border: none;
                font-size: 1.5rem; cursor: pointer; box-shadow: var(--shadow-glow);
                display: flex; align-items: center; justify-content: center;
                transition: all 0.3s ease;
            }
            .fab-btn:hover { transform: rotate(90deg) scale(1.08); }
            .fab-menu {
                position: absolute; bottom: 70px; right: 0;
                display: flex; flex-direction: column; gap: 12px;
                opacity: 0; pointer-events: none; transform: translateY(20px);
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            .quick-action-fab:hover .fab-menu { opacity: 1; pointer-events: all; transform: translateY(0); }
            .fab-menu button {
                width: 45px; height: 45px; border-radius: 50%;
                background: var(--bg-secondary); color: var(--text-primary);
                border: 1px solid var(--border-color); display: flex;
                align-items: center; justify-content: center; font-size: 1.2rem;
                cursor: pointer; box-shadow: var(--shadow-sm); transition: all 0.2s ease;
            }
            .fab-menu button:hover { background: var(--bg-tertiary); color: var(--role-accent); transform: scale(1.1); }
        `;
        document.head.appendChild(style);
    }
    document.body.appendChild(fab);
}
