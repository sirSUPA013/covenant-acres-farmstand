/**
 * Preload Script
 * Exposes safe IPC methods to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('api', {
  // Orders
  getOrders: (filters?: object) => ipcRenderer.invoke('orders:getAll', filters),
  getOrder: (id: string) => ipcRenderer.invoke('orders:get', id),
  updateOrder: (id: string, data: object) => ipcRenderer.invoke('orders:update', id, data),
  deleteOrder: (id: string) => ipcRenderer.invoke('orders:delete', id),

  // Customers
  getCustomers: (filters?: object) => ipcRenderer.invoke('customers:getAll', filters),
  getCustomer: (id: string) => ipcRenderer.invoke('customers:get', id),
  updateCustomer: (id: string, data: object) => ipcRenderer.invoke('customers:update', id, data),
  issueCredit: (id: string, amount: number, reason: string) =>
    ipcRenderer.invoke('customers:issueCredit', id, amount, reason),

  // Bake Slots
  getBakeSlots: (filters?: object) => ipcRenderer.invoke('bakeSlots:getAll', filters),
  createBakeSlot: (data: object) => ipcRenderer.invoke('bakeSlots:create', data),
  updateBakeSlot: (id: string, data: object) => ipcRenderer.invoke('bakeSlots:update', id, data),
  deleteBakeSlot: (id: string) => ipcRenderer.invoke('bakeSlots:delete', id),

  // Flavors
  getFlavors: () => ipcRenderer.invoke('flavors:getAll'),
  createFlavor: (data: object) => ipcRenderer.invoke('flavors:create', data),
  updateFlavor: (id: string, data: object) => ipcRenderer.invoke('flavors:update', id, data),
  deleteFlavor: (id: string) => ipcRenderer.invoke('flavors:delete', id),

  // Locations
  getLocations: () => ipcRenderer.invoke('locations:getAll'),
  createLocation: (data: object) => ipcRenderer.invoke('locations:create', data),
  updateLocation: (id: string, data: object) => ipcRenderer.invoke('locations:update', id, data),
  deleteLocation: (id: string) => ipcRenderer.invoke('locations:delete', id),

  // Recipes
  getRecipes: () => ipcRenderer.invoke('recipes:getAll'),
  getRecipe: (id: string) => ipcRenderer.invoke('recipes:get', id),
  createRecipe: (data: object) => ipcRenderer.invoke('recipes:create', data),
  updateRecipe: (id: string, data: object) => ipcRenderer.invoke('recipes:update', id, data),
  deleteRecipe: (id: string) => ipcRenderer.invoke('recipes:delete', id),

  // Prep Sheets
  getPrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:generate', bakeSlotId),
  generatePrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:generate', bakeSlotId),
  printPrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:print', bakeSlotId),

  // Analytics
  getAnalytics: (dateRange: object) => ipcRenderer.invoke('analytics:summary', dateRange),
  getSalesStats: (dateRange: object) => ipcRenderer.invoke('analytics:sales', dateRange),
  getFlavorStats: (dateRange: object) => ipcRenderer.invoke('analytics:flavors', dateRange),
  getCustomerStats: () => ipcRenderer.invoke('analytics:customers'),

  // Notifications
  sendNotification: (type: string, recipientId: string, data: object) =>
    ipcRenderer.invoke('notifications:send', type, recipientId, data),
  broadcastMessage: (message: string, filters: object) =>
    ipcRenderer.invoke('notifications:broadcast', message, filters),

  // Sync
  syncNow: () => ipcRenderer.invoke('sync:now'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),

  // Settings/Config
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (data: object) => ipcRenderer.invoke('settings:save', data),
  testGoogleConnection: () => ipcRenderer.invoke('settings:testGoogle'),
  triggerSync: () => ipcRenderer.invoke('sync:now'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (data: object) => ipcRenderer.invoke('config:update', data),

  // Auth
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),

  // System
  sendErrorReport: () => ipcRenderer.invoke('system:sendErrorReport'),
  getAppVersion: () => ipcRenderer.invoke('system:version'),
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),

  // Event listeners
  onSyncUpdate: (callback: (status: object) => void) => {
    const subscription = (_event: unknown, status: object) => callback(status);
    ipcRenderer.on('sync:update', subscription);
    return () => ipcRenderer.removeListener('sync:update', subscription);
  },

  onNewOrder: (callback: (order: object) => void) => {
    const subscription = (_event: unknown, order: object) => callback(order);
    ipcRenderer.on('orders:new', subscription);
    return () => ipcRenderer.removeListener('orders:new', subscription);
  },
});

// Type definitions for renderer
declare global {
  interface Window {
    api: {
      getOrders: (filters?: object) => Promise<unknown[]>;
      getOrder: (id: string) => Promise<unknown>;
      updateOrder: (id: string, data: object) => Promise<void>;
      deleteOrder: (id: string) => Promise<void>;

      getCustomers: (filters?: object) => Promise<unknown[]>;
      getCustomer: (id: string) => Promise<unknown>;
      updateCustomer: (id: string, data: object) => Promise<void>;
      issueCredit: (id: string, amount: number, reason: string) => Promise<void>;

      getBakeSlots: (filters?: object) => Promise<unknown[]>;
      createBakeSlot: (data: object) => Promise<string>;
      updateBakeSlot: (id: string, data: object) => Promise<void>;
      deleteBakeSlot: (id: string) => Promise<void>;

      getFlavors: () => Promise<unknown[]>;
      createFlavor: (data: object) => Promise<string>;
      updateFlavor: (id: string, data: object) => Promise<void>;
      deleteFlavor: (id: string) => Promise<void>;

      getLocations: () => Promise<unknown[]>;
      createLocation: (data: object) => Promise<string>;
      updateLocation: (id: string, data: object) => Promise<void>;
      deleteLocation: (id: string) => Promise<void>;

      getRecipes: () => Promise<unknown[]>;
      getRecipe: (id: string) => Promise<unknown>;
      createRecipe: (data: object) => Promise<string>;
      updateRecipe: (id: string, data: object) => Promise<void>;
      deleteRecipe: (id: string) => Promise<void>;

      getPrepSheet: (bakeSlotId: string) => Promise<unknown>;
      generatePrepSheet: (bakeSlotId: string) => Promise<unknown>;
      printPrepSheet: (bakeSlotId: string) => Promise<void>;

      getAnalytics: (dateRange: object) => Promise<unknown>;
      getSalesStats: (dateRange: object) => Promise<unknown>;
      getFlavorStats: (dateRange: object) => Promise<unknown>;
      getCustomerStats: () => Promise<unknown>;

      sendNotification: (type: string, recipientId: string, data: object) => Promise<void>;
      broadcastMessage: (message: string, filters: object) => Promise<void>;

      syncNow: () => Promise<void>;
      getSyncStatus: () => Promise<object>;

      getSettings: () => Promise<object>;
      saveSettings: (data: object) => Promise<void>;
      testGoogleConnection: () => Promise<boolean>;
      triggerSync: () => Promise<void>;
      getConfig: () => Promise<object>;
      updateConfig: (data: object) => Promise<void>;

      signIn: () => Promise<void>;
      signOut: () => Promise<void>;
      getAuthStatus: () => Promise<{ isSignedIn: boolean; email?: string }>;

      sendErrorReport: () => Promise<void>;
      getAppVersion: () => Promise<string>;
      openExternal: (url: string) => Promise<void>;

      onSyncUpdate: (callback: (status: object) => void) => () => void;
      onNewOrder: (callback: (order: object) => void) => () => void;
    };
  }
}
