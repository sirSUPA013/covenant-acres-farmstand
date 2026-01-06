# Installation Guide

## For Shane & Stephanie

This guide walks you through installing and setting up your Covenant Acres Farmstand order management system.

---

## Part 1: Desktop App Installation

### What You'll Need
- Windows 10 or 11
- The installer file (provided on flash drive)

### Steps

1. **Insert the flash drive** and open it in File Explorer

2. **Run the installer**
   - Double-click `Covenant Acres Farmstand Setup.exe`
   - If Windows asks "Do you want to allow this app to make changes?", click **Yes**

3. **Follow the installation wizard**
   - Click **Next** on the welcome screen
   - Choose where to install (default is fine)
   - Click **Install**
   - Wait for installation to complete
   - Click **Finish**

4. **Launch the app**
   - Find "Covenant Acres Farmstand" in your Start menu
   - Or use the desktop shortcut (if you selected that option)

---

## Part 2: First-Time Setup

### Connect to Google Sheets

1. Open the app and go to **Settings** (gear icon at bottom of sidebar)

2. In the **Integrations** section:
   - Paste your **Google Sheets ID** (provided separately)
   - Paste your **Service Account Credentials** (the JSON file contents)

3. Click **Test Connection** to verify it works

4. Click **Save Changes**

### Set Up Your Business Info

1. In **Settings** > **General**:
   - Verify your business name
   - Enter your email address
   - Enter your phone number
   - Set your default order cutoff (how many hours before bake day orders close)

2. Click **Save Changes**

### Add Your Locations

1. Go to **Configure** > **Locations** tab

2. Your pickup locations should sync from Google Sheets
   - If not, add them manually with the **+ Add Location** button

### Add Your Flavors

1. Go to **Configure** > **Flavors** tab

2. For each bread flavor:
   - Click **+ Add Flavor** (if not synced from Sheets)
   - Enter the name, sizes, and prices
   - Mark seasonal items appropriately

### Add Your Recipes

1. Go to **Recipes**

2. For each flavor, click the card and then **Edit Recipe**:
   - Add ingredients with quantities and costs
   - Add your step-by-step instructions
   - This enables the prep sheet feature

---

## Part 3: Daily Operations

### Creating Bake Slots

Before customers can order, you need to create bake slots:

1. Go to **Configure** > **Bake Slots** tab
2. Click **+ Add Bake Slot**
3. Select the date and pickup location
4. Set the capacity (maximum loaves)
5. Click **Create**

The slot will automatically be available on your order form.

### Managing Orders

1. Go to **Orders** to see all incoming orders

2. Orders automatically sync from Google Sheets every few minutes

3. Change order status as you work:
   - **Submitted** → **Cutoff Passed** (automatic at cutoff time)
   - **Cutoff Passed** → **In Production** (when you start baking)
   - **In Production** → **Ready** (when bread is ready for pickup)
   - **Ready** → **Picked Up** (when customer picks up)

4. Mark payment when received:
   - Click **View** on an order
   - Change payment status to **Paid**
   - Select payment method (Cash, Venmo, etc.)

### Prep Sheets

1. Go to **Prep Sheet**
2. Select the bake day you're preparing for
3. Click **Print Prep Sheet**

This shows you:
- Total loaves by flavor
- All ingredients needed (scaled for your orders)
- Step-by-step instructions for each bread type

### Working Offline

The app stores all data locally, so you can:
- View orders even without internet
- Make changes while offline
- Changes sync automatically when you're back online

Look at the sync status in the bottom-left corner:
- 🟢 **Online** - Connected and syncing
- 🟡 **Pending (X)** - Changes waiting to sync
- 🔴 **Offline** - No internet connection

---

## Troubleshooting

### App won't start
- Try restarting your computer
- Reinstall from the flash drive

### Orders aren't syncing
- Check your internet connection
- Go to Settings and click **Sync Now**
- Verify your Google Sheets credentials are correct

### Google connection fails
- Make sure the Sheets ID is correct
- Verify the service account JSON is complete
- Check that the service account has access to your spreadsheet

### Need help?
Contact Sam for technical support.

---

## Quick Reference

| Task | Where to Go |
|------|-------------|
| View/manage orders | Orders (first sidebar item) |
| Look up a customer | Customers |
| Create bake slots | Configure → Bake Slots |
| Edit flavors/prices | Configure → Flavors |
| Print prep sheet | Prep Sheet |
| View sales data | Analytics |
| App settings | Settings (bottom of sidebar) |

---

*Guide version 1.0 - January 2026*
