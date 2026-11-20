import os

def create_skeleton(title, header, subheader, icon, empty_text, filename):
    # Read the base from competitions.html
    with open('competitions.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # We want to keep everything from <!DOCTYPE to <div class="dashboard-content">
    # And then add the new header and empty state
    
    start_content = html.split('<div class="dashboard-content">')[0] + '<div class="dashboard-content">\n'
    
    new_content = f"""
                <div class="header-title" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <h1>{header}</h1>
                        <p>{subheader}</p>
                    </div>
                    <button class="btn-primary">+ Add {title}</button>
                </div>

                <div class="glass-card" style="padding: 40px;">
                    <div class="empty-state">
                        <ion-icon name="{icon}"></ion-icon>
                        <p>{empty_text}</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</body>
</html>
    """
    
    final_html = start_content + new_content
    # Replace title
    final_html = final_html.replace('<title>Manage Competitions | abdsite</title>', f'<title>{title} | abdsite</title>')
    
    # Un-active Programme and set active appropriately
    final_html = final_html.replace('class="active" style="color: var(--text-primary); background-color: var(--bg-tertiary);"', '')
    # Just a basic skeleton, no need to perfectly active the sidebar for now.
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(final_html)

create_skeleton('Candidates', 'Candidates', 'Manage all candidates and their profiles', 'people-circle-outline', 'No candidates found', 'candidates.html')
create_skeleton('Programmes', 'Programmes', 'Manage your programs', 'grid-outline', 'No programs found', 'programmes.html')
create_skeleton('Results', 'Results', 'Manage competition results', 'podium-outline', 'No program results available yet', 'results.html')
create_skeleton('Settings', 'Settings', 'Manage general and profile settings', 'settings-outline', 'Settings will appear here', 'admin-settings.html')

print("Skeletons created.")
