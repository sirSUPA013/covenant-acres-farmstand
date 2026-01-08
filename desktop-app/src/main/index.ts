/**
 * Electron Main Process
 * Handles window management, IPC, and system integration
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { initDatabase, isPortable } from './database';
import { initSheetsSync } from './sheets-sync';
import { setupIpcHandlers } from './ipc-handlers';
import { initLogger, log } from './logger';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Single instance lock - focus existing window if already running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    title: 'Covenant Acres Farmstand',
  });

  // Load the app
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  try {
    // Initialize logger
    initLogger();
    log('info', 'Application starting...');

    // Initialize database
    await initDatabase();
    log('info', 'Database initialized');

    // Setup IPC handlers
    setupIpcHandlers();
    log('info', 'IPC handlers registered');

    // Start Google Sheets sync (skip in portable/demo mode)
    if (!isPortable()) {
      initSheetsSync();
      log('info', 'Sheets sync initialized');
    } else {
      log('info', 'Skipping Sheets sync (portable/demo mode)');
    }

    // Create window
    await createWindow();
    log('info', 'Main window created');
  } catch (error) {
    log('error', 'Failed to initialize application', { error });
    app.quit();
  }
}

// App lifecycle
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

