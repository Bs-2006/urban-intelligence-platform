# Quick Git Setup & Push

## Step 1: Initialize Git
```bash
git init
git add .
git commit -m "Initial commit: Citizen portal redesign"
```

## Step 2: Create GitHub Repo
1. Go to https://github.com/new
2. Name your repo (e.g., `urban-intelligence`)
3. Don't initialize with README
4. Click "Create repository"

## Step 3: Push to GitHub
```bash
# Replace with your repo URL
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

## Common Issues:

### Large Files Error
Already fixed in `.gitignore` - videos, zips, databases excluded

### Check what will be pushed:
```bash
git status
```

Should NOT include:
- node_modules/
- *.db files
- *.log files
- *.mp4 or *.MOV videos
- pothole-ai.zip

### If you see large files:
```bash
# Remove from staging
git rm --cached filename

# Verify .gitignore
cat .gitignore
```

## Need to start over?
```bash
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "Clean initial commit"
```
