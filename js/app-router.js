function navigateTo(viewId, title) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active-view');
    });
    
    // Show target view or generic empty state
    let target = document.getElementById(viewId);
    if(!target) {
        target = document.getElementById('view-generic-empty');
        if(target && title) {
            document.getElementById('empty-title').textContent = title;
        }
    }
    
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active-view'), 10);
    }

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        a.style.color = 'var(--text-muted)';
        a.style.backgroundColor = 'transparent';
    });
    const activeLink = document.querySelector(`[onclick*="navigateTo('${viewId}')"]`);
    if(activeLink) {
        activeLink.style.color = 'var(--text-primary)';
        activeLink.style.backgroundColor = 'var(--bg-tertiary)';
    }

    // Update URL hash without jumping
    history.pushState(null, null, '#' + viewId);
}

// Handle initial load
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    
    if (role === 'judge') {
        document.querySelectorAll('.nav-item').forEach(item => {
            const span = item.querySelector('span');
            if(span) {
                const text = span.textContent.trim();
                if(['Candidate', 'Programme', 'Schedule', 'Content', 'Analytics', 'Reports', 'Settings'].includes(text)) {
                    item.style.display = 'none';
                }
            }
        });
        navigateTo('view-results', 'Results');
        
        const profile = document.querySelector('.admin-profile span');
        if(profile) profile.textContent = 'Judge Evaluator';
    } else {
        const hash = window.location.hash.replace('#', '') || 'view-dashboard';
        navigateTo(hash);
    }
    
    // Load Candidates from LocalStorage
    const savedCandidates = JSON.parse(localStorage.getItem('compete_candidates') || '[]');
    savedCandidates.forEach(cand => {
        let teamClass = 'badge-neutral';
        if(cand.team.includes('Red')) teamClass = 'badge-red';
        if(cand.team.includes('Blue')) teamClass = 'badge-blue';
        if(cand.team.includes('Green')) teamClass = 'badge-green';
        if(cand.team.includes('Yellow')) teamClass = 'badge-yellow';

        const tbody = document.querySelector('#candidatesTable tbody');
        if(!tbody) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="candidate-info">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cand.name)}&background=random" class="table-avatar" style="width:40px; border-radius:50%;">
                    <div>
                        <div class="candidate-name">${cand.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">ID: NEW</div>
                    </div>
                </div>
            </td>
            <td><span class="badge-status ${teamClass}">${cand.team}</span></td>
            <td>${cand.section}</td>
            <td><span class="badge-status badge-green">Active</span></td>
            <td><button class="btn-text" style="color:var(--accent-blue); padding:0;"><ion-icon name="create-outline" style="font-size:1.2rem;"></ion-icon></button></td>
        `;
        tbody.prepend(tr);
    });
});

// Global Event Delegation for Action Buttons (Edit/Delete)
document.body.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-text');
    if(editBtn && editBtn.querySelector('ion-icon[name="create-outline"]') && !editBtn.hasAttribute('onclick')) {
        const row = editBtn.closest('tr');
        if(!row) return;
        
        const table = row.closest('table');
        if(!table) return;

        const nameCell = row.querySelector('.candidate-name');
        if(!nameCell) {
            window.showToast('Edit mode opened.');
            return;
        }
        
        const name = nameCell.textContent.trim();

        if (table.id === 'candidatesTable') {
            const teamSpan = row.querySelector('.badge-status');
            const team = teamSpan ? teamSpan.textContent.trim() : 'Red Team';
            const sectionCell = row.cells[2];
            const section = sectionCell ? sectionCell.textContent.trim() : 'Senior';
            
            document.getElementById('edit-cand-original-name').value = name;
            document.getElementById('edit-cand-name').value = name;
            document.getElementById('edit-cand-team').value = team;
            
            const secSelect = document.getElementById('edit-cand-section');
            if(secSelect) {
                Array.from(secSelect.options).forEach(opt => {
                    if(opt.value === section) opt.selected = true;
                });
            }
            window.openSlideModal('editCandidateModal');

        } else if (table.id && table.id.startsWith('programmesTable')) {
            const typeCell = row.cells[1];
            const maxCell = row.cells[2];
            
            document.getElementById('edit-prog-original-name').value = name;
            document.getElementById('edit-prog-name').value = name;
            
            const typeSelect = document.getElementById('edit-prog-type');
            const typeText = typeCell ? typeCell.textContent.trim() : 'Individual';
            if(typeSelect) {
                Array.from(typeSelect.options).forEach(opt => {
                    if(opt.value === typeText) opt.selected = true;
                });
            }

            document.getElementById('edit-prog-max').value = maxCell ? parseInt(maxCell.textContent.trim()) : 1;
            
            window.openSlideModal('editProgrammeModal');
        } else {
            window.showToast('Edit mode opening...');
        }
    }
});

// Update Candidate function
window.updateCandidate = function(e) {
    e.preventDefault();
    const originalName = document.getElementById('edit-cand-original-name').value;
    const newName = document.getElementById('edit-cand-name').value;
    const newTeam = document.getElementById('edit-cand-team').value;
    const newSection = document.getElementById('edit-cand-section').value;
    
    // Update LocalStorage
    let savedCandidates = JSON.parse(localStorage.getItem('compete_candidates') || '[]');
    const idx = savedCandidates.findIndex(c => c.name === originalName);
    if(idx !== -1) {
        savedCandidates[idx] = { name: newName, team: newTeam, section: newSection };
        localStorage.setItem('compete_candidates', JSON.stringify(savedCandidates));
    }
    
    window.closeSlideModal('editCandidateModal');
    showToast('Candidate successfully updated!');
    setTimeout(() => window.location.reload(), 1000); // Reload to reflect changes globally
}

// Update Programme function
window.updateProgramme = function(e) {
    e.preventDefault();
    window.closeSlideModal('editProgrammeModal');
    showToast('Programme successfully updated!');
}

// Modal Logic
window.openSlideModal = function(id) {
    document.getElementById(id).classList.add('active');
}
window.closeSlideModal = function(id) {
    document.getElementById(id).classList.remove('active');
}

window.openModal = function(id) {
    const el = document.getElementById(id);
    if(el) el.classList.add('active');
    // Fallback if no active class CSS
    if(el && getComputedStyle(el).display === 'none') el.style.display = 'flex';
}
window.closeModal = function(id) {
    const el = document.getElementById(id);
    if(el) el.classList.remove('active');
    if(el) el.style.display = 'none';
}

window.showToast = function(msg) {
    let t = document.createElement('div');
    t.style.position = 'fixed'; t.style.bottom = '20px'; t.style.right = '20px';
    t.style.background = '#10b981'; t.style.color = '#fff';
    t.style.padding = '12px 24px'; t.style.borderRadius = '8px'; t.style.zIndex = '99999';
    t.style.fontWeight = '600'; t.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// Stub functions for Dashboard Buttons
window.filterCompetitions = function() {}
window.setCategoryFilter = function(cat) { window.showToast('Filtered by ' + cat); }
window.saveCompetition = function(e) {
    e.preventDefault();
    window.closeModal('createCompetitionModal');
    window.showToast('Competition created successfully!');
}
window.openResources = function(name) { window.showToast('Opened resources for ' + name); }

// Submenu Logic
window.toggleSubmenu = function(el) {
    const submenu = el.nextElementSibling;
    if(submenu) {
        submenu.style.display = submenu.style.display === 'none' ? 'flex' : 'none';
        const icon = el.querySelector('ion-icon[name^="chevron"]');
        if(icon) {
            icon.name = submenu.style.display === 'none' ? 'chevron-down-outline' : 'chevron-up-outline';
        }
    }
}

// Data Submission Logic
function submitCandidate(e) {
    e.preventDefault();
    const name = document.getElementById('cand-name').value;
    const team = document.getElementById('cand-team').value;
    const section = document.getElementById('cand-section').value;
    
    let teamClass = 'badge-neutral';
    if(team.includes('Red')) teamClass = 'badge-red';
    if(team.includes('Blue')) teamClass = 'badge-blue';
    if(team.includes('Green')) teamClass = 'badge-green';
    if(team.includes('Yellow')) teamClass = 'badge-yellow';

    // Save to LocalStorage
    let savedCandidates = JSON.parse(localStorage.getItem('compete_candidates') || '[]');
    savedCandidates.push({name, team, section});
    localStorage.setItem('compete_candidates', JSON.stringify(savedCandidates));

    const tbody = document.querySelector('#candidatesTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <div class="candidate-info">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random" class="table-avatar" style="width:40px; border-radius:50%;">
                <div>
                    <div class="candidate-name">${name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">ID: NEW</div>
                </div>
            </div>
        </td>
        <td><span class="badge-status ${teamClass}">${team}</span></td>
        <td>${section}</td>
        <td><span class="badge-status badge-green">Active</span></td>
        <td><button class="btn-text" style="color:var(--accent-blue); padding:0;"><ion-icon name="create-outline" style="font-size:1.2rem;"></ion-icon></button></td>
    `;
    tbody.prepend(tr);
    
    closeSlideModal('candidateModal');
    e.target.reset();
    showToast('Candidate saved securely to LocalStorage!');
}

function submitProgramme(e) {
    e.preventDefault();
    const name = document.getElementById('prog-name').value;
    const cat = document.getElementById('prog-cat').value;
    const type = document.getElementById('prog-type').value;
    const max = document.getElementById('prog-max').value;

    let targetTableId = 'programmesTable-arts';
    if(cat.includes('Sports')) targetTableId = 'programmesTable-sports';
    if(cat.includes('Tech')) targetTableId = 'programmesTable-tech';

    const tbody = document.querySelector('#' + targetTableId + ' tbody');
    if(!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><div class="candidate-name">${name}</div></td>
        <td>${type}</td>
        <td>${max}</td>
        <td><span class="badge-status badge-green">Active</span></td>
        <td><button class="btn-text" style="color:var(--accent-blue); padding:0;"><ion-icon name="create-outline" style="font-size:1.2rem;"></ion-icon></button></td>
    `;
    tbody.prepend(tr);

    closeSlideModal('programmeModal');
    e.target.reset();
    showToast('Programme added successfully!');
}

function submitResult(e) {
    e.preventDefault();
    const candRaw = document.getElementById('res-cand').value;
    const cat = document.getElementById('res-cat').value;
    const prog = document.getElementById('res-prog').value;
    const score = parseInt(document.getElementById('res-score').value);
    
    const parts = candRaw.split('|');
    const candName = parts[0];
    const teamName = parts[1];
    
    let grade = 'C';
    let rank = 'Participant';
    let rankClass = 'badge-neutral';
    
    if (score >= 90) { grade = 'A+'; rank = '1st Place'; rankClass = 'badge-yellow'; }
    else if (score >= 80) { grade = 'A'; rank = '2nd Place'; rankClass = 'badge-blue'; }
    else if (score >= 70) { grade = 'B+'; rank = '3rd Place'; rankClass = 'badge-green'; }
    else if (score >= 60) { grade = 'B'; }

    let targetTableId = 'resultsTable-arts';
    if(cat === 'sports') targetTableId = 'resultsTable-sports';
    if(cat === 'tech') targetTableId = 'resultsTable-tech';

    const tbody = document.querySelector('#' + targetTableId + ' tbody');
    if(!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><div class="candidate-name">${candName}</div><div style="font-size:0.8rem;color:var(--text-muted);">${teamName}</div></td>
        <td>${prog}</td>
        <td>${score} (${grade})</td>
        <td><span class="badge-status ${rankClass}">${rank}</span></td>
    `;
    tbody.prepend(tr);

    closeSlideModal('resultModal');
    e.target.reset();
    showToast('Result added successfully!');
}




// Drag and Drop Logic
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData("text");
    var target = ev.target;
    // Ensure we drop into the body, not into another card
    if(!target.classList.contains('kanban-body')) {
        target = target.closest('.kanban-body');
    }
    if(target) {
        target.appendChild(document.getElementById(data));
        showToast('Schedule updated!');
    }
}

// ID Card Generator
function generateIdCard(name, team) {
    document.getElementById('id-name').textContent = name;
    document.getElementById('id-team').textContent = team;
    document.getElementById('id-photo').src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
    document.getElementById('id-qr').src = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(name + ' - ' + team);
    openSlideModal('idCardModal');
}

// Canvas Certificate Generator
function drawCertificate() {
    const canvas = document.getElementById('certificate-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const name = document.getElementById('cert-name').value;
    const prog = document.getElementById('cert-prog').value;

    // Draw background
    ctx.fillStyle = '#24283b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Draw Title
    ctx.fillStyle = '#8b5cf6';
    ctx.font = 'bold 48px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', canvas.width/2, 120);

    // Draw Subtitle
    ctx.fillStyle = '#a9b1d6';
    ctx.font = '24px Inter';
    ctx.fillText('This is proudly presented to', canvas.width/2, 220);

    // Draw Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic bold 64px serif';
    ctx.fillText(name, canvas.width/2, 320);

    // Draw Programme
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 32px Inter';
    ctx.fillText('For excellence in: ' + prog, canvas.width/2, 420);

    // Draw Footer
    ctx.fillStyle = '#a9b1d6';
    ctx.font = '18px Inter';
    ctx.fillText('Authorized Signature', 600, 520);
    ctx.beginPath();
    ctx.moveTo(500, 500);
    ctx.lineTo(700, 500);
    ctx.stroke();
}

function downloadCertificate() {
    const canvas = document.getElementById('certificate-canvas');
    const link = document.createElement('a');
    link.download = 'Certificate.png';
    link.href = canvas.toDataURL();
    link.click();
}

// Initialize canvas drawing if it exists
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(document.getElementById('certificate-canvas')) {
            drawCertificate();
        }
    }, 500);
});
