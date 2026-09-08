# Add files to git in batches, excluding problematic ones

Write-Host "Adding documentation files..."
git add *.md

Write-Host "Adding source code - frontend..."
git add frontend/src frontend/public frontend/*.json frontend/*.ts frontend/*.js frontend/*.html 2>$null

Write-Host "Adding source code - backend..."
git add backend/app backend/*.py backend/requirements.txt 2>$null

Write-Host "Adding agent code..."
git add agent 2>$null

Write-Host "Adding simulator code..."
git add simulator/*.py simulator/*.json simulator/requirements.txt 2>$null

Write-Host "Checking status..."
git status --short | Select-Object -First 20

Write-Host "`nDone! Review the status above, then run:"
Write-Host "git commit -m 'Initial commit: Citizen portal redesign'"
