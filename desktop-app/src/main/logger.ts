/**
 * Logging System
 * Handles error logging for troubleshooting
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

let logDir: string;
let currentLogFile: string;

export function initLogger(): void {
  logDir = path.join(app.getPath('userData'), 'logs');

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create log file for today
  const today = new Date().toISOString().split('T')[0];
  currentLogFile = path.join(logDir, `app-${today}.log`);

  // Rotate old logs (keep last 7 days)
  rotateOldLogs();
}

function rotateOldLogs(): void {
  try {
    const files = fs.readdirSync(logDir);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < sevenDaysAgo) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Error rotating logs:', error);
  }
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  // Console output
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, context || '');

  // File output
  try {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(currentLogFile, line);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export function getLogPath(): string {
  return logDir;
}

export function getRecentLogs(lines: number = 100): LogEntry[] {
  try {
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('app-'))
      .sort()
      .reverse();

    const entries: LogEntry[] = [];

    for (const file of files) {
      if (entries.length >= lines) break;

      const content = fs.readFileSync(path.join(logDir, file), 'utf-8');
      const fileLines = content.trim().split('\n').reverse();

      for (const line of fileLines) {
        if (entries.length >= lines) break;
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
    }

    return entries.reverse();
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
}

export function createErrorReport(): { path: string; content: string } {
  const logs = getRecentLogs(500);
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    userDataPath: app.getPath('userData'),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    systemInfo,
    recentLogs: logs,
  };

  const reportPath = path.join(logDir, `error-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return { path: reportPath, content: JSON.stringify(report, null, 2) };
}
