<#
.SYNOPSIS
    Woodly developer helper: set up, get the latest code, install updates, run, build and test.

.DESCRIPTION
    Run from the repository folder:

        .\woodly.ps1 <command> [options]

    Or, if PowerShell blocks scripts on your machine, use the wrapper:

        .\woodly.cmd <command> [options]

    Commands:
        help      Show this help (default).
        setup     Check prerequisites (Git, Node.js, Rust, C++ build tools, WebView2) and install
                  npm packages. Add -InstallMissing to install missing tools with winget.
        update    Get the latest code for the current branch (fast-forward only) and install any
                  dependency changes.
        run       Start the desktop app in development mode (hot reload).
        start     update, then run.
        web       Start the browser-only dev server at http://localhost:1420 (no Rust needed).
        build     Build a release installer for this computer.
        test      Run the TypeScript and Rust tests.
        status    Show branch, pending updates and tool versions.
        clean     Delete node_modules, dist and Rust build output (asks first).
        install   Get the latest code, build the app, and add a Woodly icon to your Desktop and
                  Start menu (Windows). Run it again any time to update the installed app.
        uninstall Remove the Desktop and Start menu icons (your projects are kept).

.EXAMPLE
    .\woodly.ps1 setup -InstallMissing
.EXAMPLE
    .\woodly.ps1 start
.EXAMPLE
    .\woodly.ps1 install
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'setup', 'update', 'run', 'start', 'web', 'build', 'test', 'status', 'clean', 'install', 'uninstall')]
    [string]$Command = 'help',

    # setup: install missing prerequisites with winget (Windows only).
    [switch]$InstallMissing,

    # install: build from the code you have, without pulling the latest first.
    [switch]$NoUpdate,

    # update: also pull when you have uncommitted changes (git refuses if they would be overwritten).
    # clean: don't ask for confirmation.
    [switch]$Force
)

# Note: this file is plain ASCII on purpose. Windows PowerShell 5.1 misreads
# non-ASCII characters in scripts saved without a byte-order mark.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$RepoRoot = $PSScriptRoot
$OnWindows = ($env:OS -eq 'Windows_NT')
# On Windows, call npm.cmd directly: npm.ps1 can be blocked by the execution policy.
$Npm = 'npm'
if ($OnWindows) { $Npm = 'npm.cmd' }
$MinNodeMajor = 20

# ---------------------------------------------------------------- helpers

function Write-Title([string]$Text) { Write-Host ""; Write-Host "== $Text ==" -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "  [ok]   $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "  [warn] $Text" -ForegroundColor Yellow }
function Write-Bad([string]$Text) { Write-Host "  [miss] $Text" -ForegroundColor Red }
function Write-Info([string]$Text) { Write-Host "  $Text" }

function Test-Command([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Run a native program and stop if it fails. ($ErrorActionPreference does not
# apply to exit codes of external programs, so we check $LASTEXITCODE.)
function Invoke-Native {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    Write-Host "  > $Exe $($Arguments -join ' ')" -ForegroundColor DarkGray
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Arguments -join ' ')' failed with exit code $LASTEXITCODE." }
}

# Run a native program and return its trimmed output, or $null if it fails.
function Get-NativeOutput {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    # In Windows PowerShell 5.1, redirected stderr under 'Stop' becomes an
    # exception even for harmless messages, so relax it for this call only.
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @Arguments 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String).Trim())
    } catch { return $null }
}

# Re-read PATH from the registry so tools installed by winget are found
# without opening a new terminal.
function Update-SessionPath {
    if (-not $OnWindows) { return }
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    $env:Path = ($machine, $user, $cargoBin) -join ';'
}

function Get-FileHashOrNull([string]$Path) {
    if (Test-Path $Path) { return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash }
    return $null
}

function Assert-Command([string]$Name, [string]$Why) {
    if (-not (Test-Command $Name)) { throw "$Name was not found. $Why Run '.\woodly.ps1 setup' to check your setup." }
}

# ---------------------------------------------------------------- prerequisites

function Get-NodeMajor {
    $v = Get-NativeOutput 'node' @('--version')
    if (-not $v) { return 0 }
    return [int]($v.TrimStart('v').Split('.')[0])
}

function Test-MsvcBuildTools {
    if (-not $OnWindows) { return $true }
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path $vswhere)) { return $false }
    $path = Get-NativeOutput $vswhere @('-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath')
    return [bool]$path
}

function Test-WebView2 {
    if (-not $OnWindows) { return $true }
    $id = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    foreach ($key in @("HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$id", "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$id", "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$id")) {
        if (Test-Path $key) { return $true }
    }
    return $false
}

# Each check: name, test, winget package, extra winget arguments, manual hint.
function Get-Prerequisites {
    return @(
        @{ Name = 'Git'; Ok = { Test-Command 'git' }; Winget = 'Git.Git'; Extra = @(); Hint = 'https://git-scm.com/downloads' },
        @{ Name = "Node.js $MinNodeMajor+"; Ok = { (Get-NodeMajor) -ge $MinNodeMajor }; Winget = 'OpenJS.NodeJS.LTS'; Extra = @(); Hint = 'https://nodejs.org (LTS)' },
        @{ Name = 'Rust (rustup)'; Ok = { (Test-Command 'cargo') -and (Test-Command 'rustc') }; Winget = 'Rustlang.Rustup'; Extra = @(); Hint = 'https://rustup.rs' },
        @{ Name = 'C++ build tools (MSVC)'; Ok = { Test-MsvcBuildTools }; Winget = 'Microsoft.VisualStudio.2022.BuildTools';
           Extra = @('--override', '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'); Hint = 'Visual Studio Build Tools, "Desktop development with C++"' },
        @{ Name = 'WebView2 runtime'; Ok = { Test-WebView2 }; Winget = 'Microsoft.EdgeWebView2Runtime'; Extra = @(); Hint = 'Included with Windows 11; https://developer.microsoft.com/microsoft-edge/webview2/' }
    )
}

function Invoke-Setup {
    Write-Title 'Checking prerequisites'
    if (-not $OnWindows) {
        Write-Warn 'Not on Windows: also install the Tauri system dependencies for your OS: https://tauri.app/start/prerequisites/'
    }
    $missing = @()
    foreach ($p in Get-Prerequisites) {
        if (& $p.Ok) { Write-Ok $p.Name } else { Write-Bad "$($p.Name)  ($($p.Hint))"; $missing += $p }
    }

    if ($missing.Count -gt 0) {
        if ($InstallMissing -and $OnWindows -and (Test-Command 'winget')) {
            Write-Title 'Installing missing tools with winget'
            foreach ($p in $missing) {
                $wingetArgs = @('install', '--id', $p.Winget, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements') + $p.Extra
                Invoke-Native 'winget' $wingetArgs
            }
            Update-SessionPath
            if ((Test-Command 'rustup') -and -not (Test-Command 'rustc')) { Invoke-Native 'rustup' @('default', 'stable') }
            $still = @($missing | Where-Object { -not (& $_.Ok) })
            if ($still.Count -gt 0) {
                Write-Warn ("Still missing: " + (($still | ForEach-Object { $_.Name }) -join ', ') + '. Open a new terminal (or restart) and run setup again.')
                return
            }
        } elseif ($InstallMissing) {
            throw 'Automatic install needs Windows with winget (App Installer from the Microsoft Store). Install the tools above manually.'
        } else {
            Write-Info ''
            Write-Info 'Install them manually, or run:  .\woodly.ps1 setup -InstallMissing'
            Write-Info '(You can still use ".\woodly.ps1 web" with only Git and Node.js.)'
            if (-not ((Test-Command 'git') -and ((Get-NodeMajor) -ge $MinNodeMajor))) { return }
        }
    }

    Install-NpmPackages -Reason 'initial setup'
    Write-Title 'Setup complete'
    Write-Info 'Next:  .\woodly.ps1 run    (desktop app)   or   .\woodly.ps1 web   (browser)'
}

# ---------------------------------------------------------------- dependencies

# npm ci installs exactly what package-lock.json says (reproducible), unlike
# npm install / npm update, which may change versions.
function Install-NpmPackages([string]$Reason) {
    Assert-Command 'node' 'Node.js is required.'
    Write-Title "Installing npm packages ($Reason)"
    Invoke-Native $Npm @('ci', '--no-audit', '--no-fund')
}

function Test-NodeModulesCurrent {
    # npm writes this file on every install; if the lockfile is newer, packages are stale.
    $marker = Join-Path $RepoRoot 'node_modules\.package-lock.json'
    $lock = Join-Path $RepoRoot 'package-lock.json'
    if (-not (Test-Path $marker)) { return $false }
    return ((Get-Item $marker).LastWriteTimeUtc -ge (Get-Item $lock).LastWriteTimeUtc)
}

function Confirm-Dependencies {
    if (-not (Test-NodeModulesCurrent)) { Install-NpmPackages -Reason 'packages missing or out of date' }
}

# ---------------------------------------------------------------- git

function Get-CurrentBranch { return Get-NativeOutput 'git' @('rev-parse', '--abbrev-ref', 'HEAD') }
function Get-Upstream { return Get-NativeOutput 'git' @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}') }

function Invoke-Update {
    Assert-Command 'git' 'Git is required.'
    Write-Title 'Getting the latest code'
    $branch = Get-CurrentBranch
    if (-not $branch -or $branch -eq 'HEAD') { throw 'You are not on a branch (detached HEAD). Check out a branch first, e.g. git switch main' }
    $upstream = Get-Upstream
    if (-not $upstream) { throw "Branch '$branch' has no remote tracking branch. Set one with: git branch --set-upstream-to=origin/$branch" }

    $dirty = Get-NativeOutput 'git' @('status', '--porcelain')
    if ($dirty -and -not $Force) {
        Write-Warn 'You have uncommitted changes:'
        Write-Host $dirty
        throw 'Commit or stash them first (git stash), or re-run with -Force to try anyway.'
    }

    $lockBefore = Get-FileHashOrNull (Join-Path $RepoRoot 'package-lock.json')
    $cargoBefore = Get-FileHashOrNull (Join-Path $RepoRoot 'src-tauri\Cargo.lock')
    $before = Get-NativeOutput 'git' @('rev-parse', 'HEAD')

    Invoke-Native 'git' @('fetch', '--prune')
    # Fast-forward only: never creates a merge commit or rewrites your work.
    Invoke-Native 'git' @('pull', '--ff-only')

    $after = Get-NativeOutput 'git' @('rev-parse', 'HEAD')
    if ($before -eq $after) {
        Write-Ok "Already up to date ($branch)."
    } else {
        Write-Ok "Updated $branch. New commits:"
        Invoke-Native 'git' @('log', '--oneline', '--no-decorate', "$before..$after")
    }

    if ($lockBefore -ne (Get-FileHashOrNull (Join-Path $RepoRoot 'package-lock.json')) -or -not (Test-NodeModulesCurrent)) {
        Install-NpmPackages -Reason 'package-lock.json changed'
    } else {
        Write-Ok 'npm packages are current.'
    }
    if ($cargoBefore -ne (Get-FileHashOrNull (Join-Path $RepoRoot 'src-tauri\Cargo.lock'))) {
        if (Test-Command 'cargo') {
            Write-Title 'Downloading updated Rust crates'
            Push-Location (Join-Path $RepoRoot 'src-tauri')
            try { Invoke-Native 'cargo' @('fetch') } finally { Pop-Location }
        } else {
            Write-Warn 'Rust dependencies changed but cargo is not installed (only needed for the desktop app).'
        }
    }
}

# ---------------------------------------------------------------- run / build / test

function Assert-DesktopTools {
    Assert-Command 'cargo' 'Rust is required for the desktop app (or use ".\woodly.ps1 web").'
    if ($OnWindows -and -not (Test-MsvcBuildTools)) { throw 'C++ build tools not found. Run ".\woodly.ps1 setup -InstallMissing".' }
}

function Invoke-Run {
    Confirm-Dependencies
    Assert-DesktopTools
    Write-Title 'Starting Woodly (desktop, dev mode)'
    Write-Info 'The first start compiles the Rust code and can take several minutes. Press Ctrl+C to stop.'
    Invoke-Native $Npm @('run', 'tauri', '--', 'dev')
}

function Invoke-Web {
    Confirm-Dependencies
    Write-Title 'Starting Woodly in the browser'
    Write-Info 'Open http://localhost:1420 . Browser mode uses local storage and keeps API keys only for the tab session. Press Ctrl+C to stop.'
    Invoke-Native $Npm @('run', 'dev')
}

function Invoke-Build {
    Confirm-Dependencies
    Assert-DesktopTools
    Write-Title 'Building a release installer'
    Invoke-Native $Npm @('run', 'tauri', '--', 'build')
    Write-Ok ("Installers are in " + (Join-Path $RepoRoot 'src-tauri\target\release\bundle'))
}

function Invoke-Test {
    Confirm-Dependencies
    Write-Title 'TypeScript: type check'
    Invoke-Native $Npm @('run', 'typecheck')
    Write-Title 'TypeScript: tests'
    Invoke-Native $Npm @('test')
    if (Test-Command 'cargo') {
        Write-Title 'Rust: tests'
        Push-Location (Join-Path $RepoRoot 'src-tauri')
        try { Invoke-Native 'cargo' @('test') } finally { Pop-Location }
    } else {
        Write-Warn 'cargo not found: skipped Rust tests.'
    }
    Write-Ok 'All tests passed.'
}

function Invoke-Status {
    Write-Title 'Repository'
    if (Test-Command 'git') {
        $branch = Get-CurrentBranch
        Write-Info "Branch:      $branch"
        Write-Info ("Last commit: " + (Get-NativeOutput 'git' @('log', '-1', '--format=%h %s (%cr)')))
        $upstream = Get-Upstream
        if ($upstream) {
            Invoke-Native 'git' @('fetch', '--quiet')
            $counts = Get-NativeOutput 'git' @('rev-list', '--left-right', '--count', "HEAD...$upstream")
            if ($counts) {
                $parts = $counts -split '\s+'
                Write-Info "Remote:      $upstream ($($parts[1]) new commit(s) to pull, $($parts[0]) local commit(s) not pushed)"
            }
        } else { Write-Info 'Remote:      no tracking branch' }
        if (Get-NativeOutput 'git' @('status', '--porcelain')) { Write-Warn 'Uncommitted changes present.' }
    }
    Write-Title 'Tools'
    foreach ($t in @(@('git', '--version'), @('node', '--version'), @($Npm, '--version'), @('rustc', '--version'), @('cargo', '--version'))) {
        $v = Get-NativeOutput $t[0] @($t[1])
        if ($v) { Write-Ok "$($t[0]): $v" } else { Write-Bad "$($t[0]): not found" }
    }
    if (Test-NodeModulesCurrent) { Write-Ok 'npm packages installed and current' } else { Write-Warn 'npm packages missing or stale (run update or setup)' }
}

function Invoke-Clean {
    $targets = @('node_modules', 'dist', 'src-tauri\target') | ForEach-Object { Join-Path $RepoRoot $_ } | Where-Object { Test-Path $_ }
    if (-not $targets) { Write-Ok 'Nothing to clean.'; return }
    Write-Title 'This will delete:'
    $targets | ForEach-Object { Write-Info $_ }
    if ($OnWindows -and (Get-ShortcutPaths | Where-Object { Test-Path $_ })) {
        Write-Warn 'This also deletes the installed app, so the Woodly icon will stop working until you run install again.'
    }
    if (-not $Force) {
        $answer = Read-Host 'Continue? (y/N)'
        if ($answer -notmatch '^(y|yes)$') { Write-Info 'Cancelled.'; return }
    }
    foreach ($t in $targets) { Remove-Item -Recurse -Force $t }
    Write-Ok 'Cleaned. Run ".\woodly.ps1 setup" to reinstall packages.'
}

# ---------------------------------------------------------------- install (icon)

$ShortcutName = 'Woodly.lnk'
function Get-ShortcutPaths {
    return @(
        (Join-Path ([Environment]::GetFolderPath('Desktop')) $ShortcutName),
        (Join-Path ([Environment]::GetFolderPath('Programs')) $ShortcutName)
    )
}

# The release build (not dev mode): one self-contained .exe with the UI built in.
function Find-ReleaseExe {
    foreach ($name in @('woodly.exe', 'Woodly.exe')) {
        $p = Join-Path $RepoRoot "src-tauri\target\release\$name"
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Invoke-Install {
    if (-not $OnWindows) { throw 'install creates Windows shortcuts. On macOS/Linux use ".\woodly.ps1 build" and open the installer it creates.' }

    # Windows locks a running .exe, so the rebuild would fail.
    if (Get-Process -Name 'woodly' -ErrorAction SilentlyContinue) {
        throw 'Woodly is running. Close it first, then run install again.'
    }

    if (-not $NoUpdate) { Invoke-Update }
    Confirm-Dependencies
    Assert-DesktopTools

    Write-Title 'Building the Woodly app (release)'
    Write-Info 'The first build can take 5-10 minutes; later builds are much faster.'
    # --no-bundle: just the app .exe, no installer package needed for a local install.
    Invoke-Native $Npm @('run', 'tauri', '--', 'build', '--no-bundle')

    $exe = Find-ReleaseExe
    if (-not $exe) { throw 'The build finished but woodly.exe was not found in src-tauri\target\release.' }

    Write-Title 'Adding Woodly icons'
    $icon = Join-Path $RepoRoot 'src-tauri\icons\icon.ico'
    $shell = New-Object -ComObject WScript.Shell
    foreach ($path in Get-ShortcutPaths) {
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = $exe
        $lnk.WorkingDirectory = Split-Path $exe
        $lnk.IconLocation = "$icon,0"
        $lnk.Description = 'Woodly - Imagine it. Design it. Build it.'
        $lnk.Save()
        Write-Ok $path
    }
    Write-Host ''
    Write-Ok 'Done. Double-click the Woodly icon on your Desktop, or find Woodly in the Start menu.'
    Write-Info 'To update later: close Woodly and run  .\woodly.cmd install  again. Your projects are kept.'
}

function Invoke-Uninstall {
    if (-not $OnWindows) { throw 'uninstall only removes Windows shortcuts.' }
    foreach ($path in Get-ShortcutPaths) {
        if (Test-Path $path) { Remove-Item -Force $path; Write-Ok "Removed $path" }
    }
    Write-Info 'Icons removed. Your projects and settings were not touched.'
}

# ---------------------------------------------------------------- main

Push-Location $RepoRoot
try {
    switch ($Command) {
        'help' { Get-Help $PSCommandPath -Detailed | Out-Host }
        'setup' { Invoke-Setup }
        'update' { Invoke-Update }
        'run' { Invoke-Run }
        'start' { Invoke-Update; Invoke-Run }
        'web' { Invoke-Web }
        'build' { Invoke-Build }
        'test' { Invoke-Test }
        'status' { Invoke-Status }
        'clean' { Invoke-Clean }
        'install' { Invoke-Install }
        'uninstall' { Invoke-Uninstall }
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
