# ============================================================
#  CompeteX — File Reorganisation Script
#  Run this from the project root:
#  cd "C:\Users\ABDUL WAHID\OneDrive\Desktop\al murafaqa"
#  .\reorganise.ps1
# ============================================================

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---- 1. Create folder structure ------------------------------------------------
$folders = @(
    "pages\admin",
    "pages\super-admin",
    "pages\team-leader",
    "pages\judge"
)
foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path (Join-Path $root $f) | Out-Null
}
Write-Host "[1/4] Folders created." -ForegroundColor Cyan

# ---- 2. Move files -------------------------------------------------------------
$moves = @{
    # Admin
    "admin.html"              = "pages\admin\admin.html"
    "competitions.html"       = "pages\admin\competitions.html"
    "teams.html"              = "pages\admin\teams.html"
    "participants.html"       = "pages\admin\participants.html"
    "results.html"            = "pages\admin\results.html"
    "settings.html"           = "pages\admin\settings.html"
    # Super Admin
    "super-admin.html"        = "pages\super-admin\super-admin.html"
    "admin-management.html"   = "pages\super-admin\admin-management.html"
    "system-logs.html"        = "pages\super-admin\system-logs.html"
    "global-settings.html"    = "pages\super-admin\global-settings.html"
    # Team Leader
    "team-leader.html"        = "pages\team-leader\team-leader.html"
    "tl-team.html"            = "pages\team-leader\tl-team.html"
    "tl-participants.html"    = "pages\team-leader\tl-participants.html"
    "tl-competitions.html"    = "pages\team-leader\tl-competitions.html"
    "tl-results.html"         = "pages\team-leader\tl-results.html"
    "tl-profile.html"         = "pages\team-leader\tl-profile.html"
    # Judge
    "judge.html"              = "pages\judge\judge.html"
    "judge-assignments.html"  = "pages\judge\judge-assignments.html"
    "judge-scoring.html"      = "pages\judge\judge-scoring.html"
    "judge-results.html"      = "pages\judge\judge-results.html"
    "judge-profile.html"      = "pages\judge\judge-profile.html"
}
foreach ($src in $moves.Keys) {
    $srcPath = Join-Path $root $src
    $dstPath = Join-Path $root $moves[$src]
    if (Test-Path $srcPath) {
        Move-Item -Force $srcPath $dstPath
        Write-Host "  Moved: $src -> $($moves[$src])" -ForegroundColor Gray
    } else {
        Write-Host "  SKIP (not found): $src" -ForegroundColor Yellow
    }
}
Write-Host "[2/4] Files moved." -ForegroundColor Cyan

# ---- 3. Fix internal paths in moved files --------------------------------------
# Helper: replace text in a file
function Update-File($filePath, $replacements) {
    if (-not (Test-Path $filePath)) { return }
    $content = Get-Content $filePath -Raw -Encoding UTF8
    foreach ($pair in $replacements) {
        $content = $content -replace [regex]::Escape($pair[0]), $pair[1]
    }
    Set-Content $filePath $content -Encoding UTF8
}

$commonReplacements = @(
    ,@('href="css/styles.css"',           'href="../../css/styles.css"')
    ,@("href='css/styles.css'",           "href='../../css/styles.css'")
    ,@('href="css/super-styles.css"',     'href="../../css/super-styles.css"')
    ,@('src="js/main.js"',               'src="../../js/main.js"')
    ,@('src="js/super-main.js"',         'src="../../js/super-main.js"')
    ,@("window.location.href='login.html'",    "window.location.href='../../login.html'")
    ,@('window.location.href = "login.html"',  "window.location.href = '../../login.html'")
    ,@("window.location.href = 'login.html'",  "window.location.href = '../../login.html'")
    ,@('onclick="window.location.href=''login.html''"', "onclick=`"window.location.href='../../login.html'`"")
)

# Admin pages (pages/admin/)
$adminFiles = Get-ChildItem (Join-Path $root "pages\admin") -Filter "*.html"
foreach ($f in $adminFiles) {
    Update-File $f.FullName $commonReplacements
    # Also fix the back-to-public link if any
    $c = Get-Content $f.FullName -Raw -Encoding UTF8
    $c = $c -replace [regex]::Escape('href="public.html"'), 'href="../../public.html"'
    $c = $c -replace [regex]::Escape("href='public.html'"), "href='../../public.html'"
    Set-Content $f.FullName $c -Encoding UTF8
}

# Super-admin pages (pages/super-admin/)
$saFiles = Get-ChildItem (Join-Path $root "pages\super-admin") -Filter "*.html"
foreach ($f in $saFiles) {
    Update-File $f.FullName $commonReplacements
    $c = Get-Content $f.FullName -Raw -Encoding UTF8
    $c = $c -replace [regex]::Escape('href="public.html"'), 'href="../../public.html"'
    Set-Content $f.FullName $c -Encoding UTF8
}

# Team-leader pages (pages/team-leader/)
$tlFiles = Get-ChildItem (Join-Path $root "pages\team-leader") -Filter "*.html"
foreach ($f in $tlFiles) {
    Update-File $f.FullName $commonReplacements
}

# Judge pages (pages/judge/)
$judgeFiles = Get-ChildItem (Join-Path $root "pages\judge") -Filter "*.html"
foreach ($f in $judgeFiles) {
    Update-File $f.FullName $commonReplacements
}

Write-Host "[3/4] Internal paths fixed in all moved files." -ForegroundColor Cyan

# ---- 4. Update login.html (stays at root) --------------------------------------
$loginPath = Join-Path $root "login.html"
if (Test-Path $loginPath) {
    $login = Get-Content $loginPath -Raw -Encoding UTF8
    $login = $login -replace [regex]::Escape("window.location.href = 'admin.html'"),        "window.location.href = 'pages/admin/admin.html'"
    $login = $login -replace [regex]::Escape("window.location.href = 'super-admin.html'"),  "window.location.href = 'pages/super-admin/super-admin.html'"
    $login = $login -replace [regex]::Escape("window.location.href = 'team-leader.html'"),  "window.location.href = 'pages/team-leader/team-leader.html'"
    $login = $login -replace [regex]::Escape("window.location.href = 'judge.html'"),        "window.location.href = 'pages/judge/judge.html'"
    Set-Content $loginPath $login -Encoding UTF8
    Write-Host "[4/4] login.html updated." -ForegroundColor Cyan
}

# ---- Done ----------------------------------------------------------------------
Write-Host ""
Write-Host "Done! Project structure:" -ForegroundColor Green
Write-Host "  public.html      (root)" -ForegroundColor White
Write-Host "  login.html       (root)" -ForegroundColor White
Write-Host "  pages/admin/     → 5 files" -ForegroundColor White
Write-Host "  pages/super-admin/ → 4 files" -ForegroundColor White
Write-Host "  pages/team-leader/ → 6 files" -ForegroundColor White
Write-Host "  pages/judge/     → 5 files" -ForegroundColor White
Write-Host ""
Write-Host "All paths (CSS, JS, login links) have been updated automatically." -ForegroundColor Green
