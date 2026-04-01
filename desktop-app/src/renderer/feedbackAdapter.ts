/**
 * Electron Adapter for Feedback Widget
 * Provides native Electron capabilities for screenshot capture and context
 */

import type { WidgetAdapter } from '@sjforge/feedback-widget';

// Extended API interface for feedback widget methods
interface FeedbackApi {
  captureScreenshot: () => Promise<string | null>;
  getAppInfo: () => Promise<{ name: string; version: string; platform: string }>;
  openExternal: (url: string) => Promise<void>;
}

// Get the extended API with feedback methods
const feedbackApi = window.api as typeof window.api & FeedbackApi;

export const ElectronFeedbackAdapter: WidgetAdapter = {
  platform: 'electron',

  async captureScreenshot(): Promise<string | null> {
    try {
      return await feedbackApi.captureScreenshot();
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      return null;
    }
  },

  async getContext(): Promise<Record<string, unknown>> {
    try {
      const appInfo = await feedbackApi.getAppInfo();
      return {
        app_name: appInfo.name,
        app_version: appInfo.version,
        electron_platform: appInfo.platform,
      };
    } catch (error) {
      console.error('Failed to get app info:', error);
      return {};
    }
  },

  openUrl(url: string): void {
    feedbackApi.openExternal(url);
  },
};
