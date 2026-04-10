$targetDist = "d:\EVN\KHTC\khtc-frontend\dist\khtc-frontend\browser"

# Copy web.config to dist if it exists in public
if (Test-Path "d:\EVN\KHTC\khtc-frontend\public\web.config") {
    Copy-Item "d:\EVN\KHTC\khtc-frontend\public\web.config" -Destination "$targetDist\web.config" -Force
}

# 1. Enable IIS features
Write-Host "Enabling IIS features. This may take a minute..."
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-StaticContent, IIS-DefaultDocument, IIS-DirectoryBrowsing, IIS-HttpErrors, IIS-ManagementConsole -All -NoRestart

# 2. Stop Default Web Site 
Write-Host "Stopping Default Web Site to free up port 80..."
Import-Module WebAdministration
if (Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue) {
    Stop-Website -Name "Default Web Site"
}

# 3. Create the KHTC Frontend Website
$siteName = "KHTC-Frontend"
$port = 80
$physicalPath = $targetDist

# Check if site exists and remove it
$site = Get-Website | Where-Object { $_.name -eq $siteName }
if ($site) {
    Remove-Website -Name $siteName
}

Write-Host "Creating $siteName website at $physicalPath on Port $port..."
New-Website -Name $siteName -Port $port -PhysicalPath $physicalPath -ApplicationPool "DefaultAppPool" -Force

Write-Host "Starting the new website..."
Start-Website -Name $siteName

Write-Host "========================================"
Write-Host "IIS Setup Completed Successfully!"
Write-Host "You can now access the frontend at: http://localhost/"
Write-Host "========================================"
Read-Host "Press Enter to exit..."
