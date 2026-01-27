# Covenant Acres Farmstand - Update Instructions

---

# For Bakery Owners: Installing v1.1.0

## Before You Start

- Close the Farmstand app if it's running
- Make sure you have internet connection
- This update will take about 5-10 minutes

---

## Step 1: Backup Your Database (IMPORTANT)

1. Press `Win + R` on your keyboard
2. Type `%APPDATA%` and press Enter
3. Find the folder named **`covenant acres`**
4. **Right-click** the folder → **Copy**
5. Go to your Desktop → **Right-click** → **Paste**
6. You now have a backup on your Desktop

---

## Step 2: Open Command Prompt

1. Press the **Windows key** on your keyboard
2. Type `cmd`
3. Click on **Command Prompt** to open it

---

## Step 3: Navigate to the App Folder

Copy and paste this command, then press **Enter**:

```
cd C:\Users\Shane\covenant-acres-farmstand\desktop-app
```

> **Note:** If your folder is in a different location, adjust the path accordingly.

---

## Step 4: Download the Update

Copy and paste this command, then press **Enter**:

```
git pull origin master
```

You should see a message showing files being updated.

---

## Step 5: Install Dependencies

Copy and paste this command, then press **Enter**:

```
npm install
```

Wait for it to finish. You'll see text scrolling - this is normal.

---

## Step 6: Build the App

Copy and paste this command, then press **Enter**:

```
npm run build
```

Wait for it to finish (1-2 minutes).

---

## Step 7: Start the App

Copy and paste this command, then press **Enter**:

```
npm start
```

The app will open. The database automatically updates with new features.

---

## What's New in v1.1.0

### Major Features
- **Redesigned Prep Sheet** - Now has draft/complete workflow
- **New Production Tab** - Tracks all loaves after baking
- **Multiple Loaf Sizes** - Customers can choose small or large
- **Customer Profiles** - Click a customer to see full history
- **Help & Guides** - New section in Settings explains everything

### Improvements
- Drag-and-drop to reorder ingredients in recipes
- "Bake Slot" renamed to "Pickup Slot" for clarity
- Better cost calculations with density support

### Bug Fixes
- Payment options now show your configured accounts
- Activity Log no longer causes blank screen
- Adding ingredients no longer freezes the screen

---

## Troubleshooting

### "git is not recognized"
Git isn't installed. Contact Sam for help.

### "npm is not recognized"
Node.js isn't installed. Contact Sam for help.

### Build errors or red text
Try running these commands in order:
```
npm cache clean --force
npm install
npm run build
```

### App won't start
Make sure no other instance is running. Check Task Manager (Ctrl+Shift+Esc) and end any "Covenant Acres" or "Electron" processes.

### Something else went wrong
Take a screenshot of the error and send it to Sam.

---

## Need Help?

Contact Sam if you run into any issues.

---
---

# For Developers: Creating a New Release

### 1. Build the new version
```bash
cd desktop-app
npm run package
```

### 2. Create the zip file
```bash
cd dist-electron
rm -f Covenant-Acres-Farmstand-vX.X.X.zip
cd win-unpacked
powershell Compress-Archive -Path '*' -DestinationPath '../Covenant-Acres-Farmstand-vX.X.X.zip' -Force
```

### 3. Create GitHub release
```bash
gh release create vX.X.X \
  --title "Covenant Acres Farmstand vX.X.X" \
  --notes "Release notes here" \
  desktop-app/dist-electron/Covenant-Acres-Farmstand-vX.X.X.zip
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
