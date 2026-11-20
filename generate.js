const fs = require('fs');

let html = fs.readFileSync('competitions.html', 'utf-8');
let start = html.split('<div class="dashboard-content">')[0] + '<div class="dashboard-content">\n';

function createSkeleton(title, header, subheader, icon, empty, filename) {
    let newContent = `
                <div class="header-title" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <h1>${header}</h1>
                        <p>${subheader}</p>
                    </div>
                    <button class="btn-primary">+ Add ${title}</button>
                </div>

                <div class="glass-card" style="padding: 40px;">
                    <div class="empty-state">
                        <ion-icon name="${icon}"></ion-icon>
                        <p>${empty}</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</body>
</html>`;
    let finalHtml = start + newContent;
    finalHtml = finalHtml.replace('<title>Manage Competitions | abdsite</title>', `<title>${title} | abdsite</title>`);
    finalHtml = finalHtml.replace('class="active" style="color: var(--text-primary); background-color: var(--bg-tertiary);"', '');
    fs.writeFileSync(filename, finalHtml);
}

createSkeleton('Candidates', 'Candidates', 'Manage all candidates and their profiles', 'people-circle-outline', 'No candidates found', 'candidates.html');
createSkeleton('Programmes', 'Programmes', 'Manage your programs', 'grid-outline', 'No programs found', 'programmes.html');
createSkeleton('Results', 'Results', 'Manage competition results', 'podium-outline', 'No program results available yet', 'results.html');
createSkeleton('Settings', 'Settings', 'Manage general and profile settings', 'settings-outline', 'Settings will appear here', 'admin-settings.html');
