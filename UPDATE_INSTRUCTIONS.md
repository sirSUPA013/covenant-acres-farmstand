# Update Instructions for Covenant Acres Farmstand

## For Developers: Creating a New Release

### 1. Build the new version
```bash
cd desktop-app
npm run package
```

### 2. Create the zip file
```bash
cd dist-electron
rm -f Covenant-Acres-Farmstand-v1.0.X.zip
cd win-unpacked
powershell Compress-Archive -Path '*' -DestinationPath '../Covenant-Acres-Farmstand-v1.0.X.zip' -Force
```

### 3. Create GitHub release
```bash
gh release create v1.0.X \
  --title "Covenant Acres Farmstand v1.0.X" \
  --notes "Release notes here" \
  desktop-app/dist-electron/Covenant-Acres-Farmstand-v1.0.X.zip
```

### 4. Make repo public temporarily (if private)
```bash
gh repo edit --visibility public --accept-visibility-change-consequences
```

### 5. After they download, make it private again
```bash
gh repo edit --visibility private --accept-visibility-change-consequences
```

---

## For Bakery Owners: Installing an Update

### Part 1: Backup Your Current Version (DO THIS FIRST)

**Step 1: Backup the database**
1. Press `Win + R` on your keyboard
2. Type `%APPDATA%` and press Enter
3. Find the folder named **`covenant acres`**
   - To confirm it's the right folder, open it and look for `covenant-acres.db`
4. **Right-click** the folder → **Copy**
5. Go to your Desktop → **Right-click** → **Paste**
6. You now have a backup on your Desktop

**Step 2: Keep your current app folder**
- Don't delete your current app folder (e.g., `C:\Covenant Acres Bakery\`)
- Just leave it alone - we're installing the new version in a different location

---

### Part 2: Download the New Version

1. Go to the releases page (URL will be provided)
2. Click the `.zip` file to download (e.g., `Covenant-Acres-Farmstand-v1.0.X.zip`)
3. Create a new folder: `C:\Covenant Acres Bakery vX.X.X\`
4. Extract the zip contents into that new folder
5. Run **Covenant Acres Farmstand.exe** from the new folder

---

### Part 3: Verify Your Data

When you open the new version, check that:
- [ ] Your orders are still there
- [ ] Your customers are still there
- [ ] Your flavors and recipes are still there
- [ ] Your production logs are still there
- [ ] Your locations are there

**If everything looks good:** You can delete the old app folder and desktop backup.

**If anything is missing:** Close the new version and contact support. Your old version and backup are untouched.

---

## Technical Notes

### Where data is stored
- **Database**: `%APPDATA%\covenant acres\covenant-acres.db`
- **Google config**: `%APPDATA%\covenant acres\google-config.json`

### Why both versions share the same database
The database location is determined by the app name, not the install folder. Both old and new versions point to the same `%APPDATA%` location. This means:
- Updates automatically see existing data
- No migration needed
- Backup is essential before updating (in case new code has issues)

### Portable mode (alternative)
If a `data` folder exists next to the .exe, the app uses that instead of AppData. This could be used for isolated testing:
1. Create `data` folder in new app directory
2. Copy `covenant-acres.db` into it
3. New version uses local copy, old version uses AppData (completely isolated)
