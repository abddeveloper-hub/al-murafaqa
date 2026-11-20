// Apply Global Personalization Theme Engine
function applySystemTheme() {
    const activeTheme = localStorage.getItem('compete_theme') || 'classic';
    const root = document.documentElement;

    // Reset default themes first
    root.style.removeProperty('--bg-primary');
    root.style.removeProperty('--bg-secondary');
    root.style.removeProperty('--bg-tertiary');
    root.style.removeProperty('--text-primary');
    root.style.removeProperty('--text-secondary');
    root.style.removeProperty('--text-muted');
    root.style.removeProperty('--border-color');
    root.style.removeProperty('--glass-bg');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--accent-purple');
    root.style.removeProperty('--gradient-primary');
    root.style.removeProperty('--shadow-glow');
    document.body?.classList.remove('dark-theme-active');

    if (activeTheme === 'sapphire') {
        root.style.setProperty('--accent-purple', '#0284c7');
        root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #0284c7, #06b6d4)');
        root.style.setProperty('--shadow-glow', '0 8px 25px rgba(2, 132, 199, 0.15)');
    } else if (activeTheme === 'emerald') {
        root.style.setProperty('--accent-purple', '#059669');
        root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #059669, #10b981)');
        root.style.setProperty('--shadow-glow', '0 8px 25px rgba(5, 150, 105, 0.15)');
    } else if (activeTheme === 'ruby') {
        root.style.setProperty('--accent-purple', '#dc2626');
        root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #dc2626, #f97316)');
        root.style.setProperty('--shadow-glow', '0 8px 25px rgba(220, 38, 38, 0.15)');
    } else if (activeTheme === 'dark') {
        root.style.setProperty('--bg-primary', '#0f172a');
        root.style.setProperty('--bg-secondary', '#1e293b');
        root.style.setProperty('--bg-tertiary', 'rgba(30, 41, 59, 0.8)');
        root.style.setProperty('--text-primary', '#f8fafc');
        root.style.setProperty('--text-secondary', '#cbd5e1');
        root.style.setProperty('--text-muted', '#94a3b8');
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
        root.style.setProperty('--glass-bg', 'rgba(30, 41, 59, 0.7)');
        root.style.setProperty('--glass-border', '1px solid rgba(255, 255, 255, 0.1)');
        document.body?.classList.add('dark-theme-active');
    }
}
applySystemTheme();
window.addEventListener('DOMContentLoaded', applySystemTheme);

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Chart.js for Super Admin
    const ctx = document.getElementById('systemUsageChart');

    if (ctx) {
        // Gradient for chart fill (Gold)
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.5)'); // Gold
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
                datasets: [{
                    label: 'Total Platform Activity',
                    data: [1200, 1900, 2500, 2200, 3100],
                    borderColor: '#f59e0b', // var(--accent-blue)
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#0a0b10', // var(--bg-primary)
                    pointBorderColor: '#fcd34d',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4 // Smooth curves
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#12141d',
                        titleColor: '#f8f9fa',
                        bodyColor: '#adb5bd',
                        borderColor: 'rgba(245, 158, 11, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#6c757d',
                            font: {
                                family: "'Inter', sans-serif"
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(245, 158, 11, 0.05)',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#6c757d',
                            font: {
                                family: "'Inter', sans-serif"
                            },
                            stepSize: 500
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
            }
        });
    }

    // Add staggered animation to summary cards on load
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 * index);
    });

    // --- Toast Notification System ---
    function showToast(message, type = 'info') {
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
        if (type === 'error') iconName = 'close-circle-outline';

        toast.innerHTML = `
            <ion-icon name="${iconName}"></ion-icon>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Button Interactions ---
    
    // Search Bar Logic
    const searchBarInput = document.querySelector('.search-bar input');
    if (searchBarInput) {
        searchBarInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchBarInput.value.trim() !== '') {
                showToast(`Searching for: ${searchBarInput.value}`, 'info');
                searchBarInput.value = '';
            }
        });
    }

    // Log Out Button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showToast('Logging out of Command Center...', 'info');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        });
    }

    // Notifications & View All
    initNotificationDropdown();

    const viewAllBtns = document.querySelectorAll('.btn-text');
    viewAllBtns.forEach(btn => {
        btn.addEventListener('click', () => showToast('Loading all logs...', 'info'));
    });

    // --- Interactive Notification Dropdown System ---
    function initNotificationDropdown() {
        const notifyBtn = document.querySelector('.notification-btn');
        if (!notifyBtn) return;

        // Remove any default hardcoded badge count and set it dynamically
        let badge = notifyBtn.querySelector('.badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            notifyBtn.appendChild(badge);
        }

        // Add inline styles for parent header action so dropdown positions perfectly
        const parent = notifyBtn.parentElement;
        if (parent) {
            parent.style.position = 'relative';
        }

        // Create dropdown element
        let dropdown = document.querySelector('.notification-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'notification-dropdown glass-card';
            dropdown.style.cssText = `
                position: absolute;
                top: 50px;
                right: 0;
                width: 320px;
                max-height: 400px;
                overflow-y: auto;
                border-radius: 16px;
                padding: 16px;
                background: var(--glass-bg);
                border: var(--glass-border);
                backdrop-filter: var(--glass-blur);
                box-shadow: var(--shadow-lg);
                z-index: 1000;
                display: none;
                flex-direction: column;
                gap: 12px;
                animation: slideDown 0.3s ease;
            `;
            
            // Inject slideDown animation keyframes dynamically if not present
            if (!document.getElementById('notify-anim')) {
                const style = document.createElement('style');
                style.id = 'notify-anim';
                style.textContent = `
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .notify-item {
                        display: flex;
                        align-items: flex-start;
                        gap: 10px;
                        padding: 8px 0;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .notify-item:last-child {
                        border-bottom: none;
                    }
                    .notify-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: var(--accent-purple);
                        margin-top: 6px;
                        flex-shrink: 0;
                    }
                `;
                document.head.appendChild(style);
            }
            
            parent.appendChild(dropdown);
        }

        // Toggle dropdown visibility
        notifyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isClosed = dropdown.style.display === 'none';
            
            // Close other dropdowns if any
            document.querySelectorAll('.notification-dropdown').forEach(d => d.style.display = 'none');
            
            if (isClosed) {
                renderNotifications(dropdown);
                dropdown.style.display = 'flex';
                
                // Reset badge to 0 or remove it
                localStorage.setItem('compete_unread_notifications', '0');
                badge.style.display = 'none';
            } else {
                dropdown.style.display = 'none';
            }
        });

        // Close dropdown on clicking outside
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
        
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        updateNotificationBadge(badge);
    }

    function updateNotificationBadge(badge) {
        if (!badge) {
            const notifyBtn = document.querySelector('.notification-btn');
            if (notifyBtn) badge = notifyBtn.querySelector('.badge');
        }
        if (!badge) return;

        const unread = parseInt(localStorage.getItem('compete_unread_notifications') || '3', 10);
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
            // Initialize default mock dynamic notifications if empty
            list = [
                { id: 1, message: "🏆 Scored Jane Doe: +50 championship points added!", type: "success", time: "10:30 AM" },
                { id: 2, message: "⚙️ Custom section 'Madaneeyam' registered successfully.", type: "info", time: "09:15 AM" },
                { id: 3, message: "🏫 Institution settings identity updated.", type: "info", time: "Yesterday" }
            ];
            localStorage.setItem(key, JSON.stringify(list));
        }

        dropdown.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">Recent System Logs</span>
                <button id="clear-notifications" style="background:none; border:none; color:var(--accent-purple); font-size:0.75rem; font-weight:700; cursor:pointer;">Clear All</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; max-height:280px; overflow-y:auto;" id="notifications-list-container">
                ${list.map(item => `
                    <div class="notify-item">
                        <div class="notify-dot" style="background: ${item.type === 'success' ? 'var(--accent-green, #10b981)' : item.type === 'error' ? 'var(--accent-red, #ef4444)' : 'var(--accent-purple)'};"></div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <p style="font-size:0.8rem; color:var(--text-primary); line-height:1.3; font-weight:500;">${item.message}</p>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${item.time}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Clear notifications listener
        const clearBtn = dropdown.querySelector('#clear-notifications');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                localStorage.setItem(key, '[]');
                localStorage.setItem('compete_unread_notifications', '0');
                dropdown.querySelector('#notifications-list-container').innerHTML = `
                    <div style="text-align:center; padding:24px 0; color:var(--text-muted); font-size:0.8rem; display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <ion-icon name="notifications-off-outline" style="font-size:2rem;"></ion-icon>
                        <span>All logs cleared. System Idle.</span>
                    </div>
                `;
                const badge = document.querySelector('.notification-btn .badge');
                if (badge) badge.style.display = 'none';
            });
        }
    }
});

// Global logging helper accessible from other components
window.logSystemActivity = function(message, type = 'info') {
    const key = 'compete_notifications';
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({
        id: Date.now(),
        message: message,
        type: type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (list.length > 6) list.pop(); // Cap at 6 items
    localStorage.setItem(key, JSON.stringify(list));
    
    // Increment unread count
    let unread = parseInt(localStorage.getItem('compete_unread_notifications') || '0', 10);
    localStorage.setItem('compete_unread_notifications', (unread + 1).toString());
    
    const badge = document.querySelector('.notification-btn .badge');
    if (badge) {
        badge.textContent = unread + 1;
        badge.style.display = 'flex';
    }
};
