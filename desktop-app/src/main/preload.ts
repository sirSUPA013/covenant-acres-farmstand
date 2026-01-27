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
  bulkUpdateOrders: (ids: string[], data: object) => ipcRenderer.invoke('orders:bulkUpdate', ids, data),
  deleteOrder: (id: string) => ipcRenderer.invoke('orders:delete', id),

  // Customers
  getCustomers: (filters?: object) => ipcRenderer.invoke('customers:getAll', filters),
  getCustomer: (id: string) => ipcRenderer.invoke('customers:get', id),
  updateCustomer: (id: string, data: object) => ipcRenderer.invoke('customers:update', id, data),
  issueCredit: (id: string, amount: number, reason: string) =>
    ipcRenderer.invoke('customers:issueCredit', id, amount, reason),
  getCustomerOrders: (customerId: string) => ipcRenderer.invoke('customers:getOrders', customerId),
  getCustomerCreditHistory: (customerId: string) => ipcRenderer.invoke('customers:getCreditHistory', customerId),

  // Bake Slots
  getBakeSlots: (filters?: object) => ipcRenderer.invoke('bakeSlots:getAll', filters),
  getBakeSlotsByLocation: (locationId: string) => ipcRenderer.invoke('bakeSlots:getByLocation', locationId),
  createBakeSlot: (data: object) => ipcRenderer.invoke('bakeSlots:create', data),
  updateBakeSlot: (id: string, data: object) => ipcRenderer.invoke('bakeSlots:update', id, data),
  deleteBakeSlot: (id: string) => ipcRenderer.invoke('bakeSlots:delete', id),

  // Flavors
  getFlavors: () => ipcRenderer.invoke('flavors:getAll'),
  createFlavor: (data: object) => ipcRenderer.invoke('flavors:create', data),
  updateFlavor: (id: string, data: object) => ipcRenderer.invoke('flavors:update', id, data),
  deleteFlavor: (id: string) => ipcRenderer.invoke('flavors:delete', id),
  duplicateFlavor: (id: string) => ipcRenderer.invoke('flavors:duplicate', id),

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

  // Overhead Settings
  getOverhead: () => ipcRenderer.invoke('overhead:get'),
  updateOverhead: (data: object) => ipcRenderer.invoke('overhead:update', data),

  // Ingredients Library
  getIngredients: () => ipcRenderer.invoke('ingredients:getAll'),
  getIngredient: (id: string) => ipcRenderer.invoke('ingredients:get', id),
  createIngredient: (data: object) => ipcRenderer.invoke('ingredients:create', data),
  updateIngredient: (id: string, data: object) => ipcRenderer.invoke('ingredients:update', id, data),
  deleteIngredient: (id: string) => ipcRenderer.invoke('ingredients:delete', id),

  // Prep Sheets
  getPrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:generate', bakeSlotId),
  generatePrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:generate', bakeSlotId),
  printPrepSheet: (bakeSlotId: string) => ipcRenderer.invoke('prepSheet:print', bakeSlotId),

  // Analytics
  getAnalytics: (dateRange: object) => ipcRenderer.invoke('analytics:summary', dateRange),
  getSalesStats: (dateRange: object) => ipcRenderer.invoke('analytics:sales', dateRange),
  getFlavorStats: (dateRange: object) => ipcRenderer.invoke('analytics:flavors', dateRange),
  getCustomerStats: () => ipcRenderer.invoke('analytics:customers'),
  getProfitByFlavor: () => ipcRenderer.invoke('analytics:profitByFlavor'),
  getProfitByBakeSlot: (filters?: object) => ipcRenderer.invoke('analytics:profitByBakeSlot', filters),
  getProfitPerHour: (filters?: object) => ipcRenderer.invoke('analytics:profitPerHour', filters),

  // Notifications
  sendNotification: (type: string, recipientId: string, data: object) =>
    ipcRenderer.invoke('notifications:send', type, recipientId, data),
  broadcastMessage: (message: string, filters: object) =>
    ipcRenderer.invoke('notifications:broadcast', message, filters),

  // Sync
  syncNow: () => ipcRenderer.invoke('sync:now'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),

  // Settings/Config
  getPublicSettings: () => ipcRenderer.invoke('settings:getPublic'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (data: object) => ipcRenderer.invoke('settings:save', data),
  testGoogleConnection: () => ipcRenderer.invoke('settings:testGoogle'),
  triggerSync: () => ipcRenderer.invoke('sync:now'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (data: object) => ipcRenderer.invoke('config:update', data),

  // Auth (Google Sheets)
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  configureGoogleSheets: (credentials: object, spreadsheetId: string) =>
    ipcRenderer.invoke('auth:configure', credentials, spreadsheetId),

  // Admin Auth
  checkAdminSetup: () => ipcRenderer.invoke('admin:checkSetup'),
  setupDeveloper: (name: string, pin: string, secret: string) =>
    ipcRenderer.invoke('admin:setupDeveloper', name, pin, secret),
  setupOwner: (name: string, pin: string) => ipcRenderer.invoke('admin:setupOwner', name, pin),
  adminLogin: (pin: string) => ipcRenderer.invoke('admin:login', pin),
  adminLogout: () => ipcRenderer.invoke('admin:logout'),
  getCurrentUser: () => ipcRenderer.invoke('admin:getCurrentUser'),
  getAdminUsers: () => ipcRenderer.invoke('admin:getUsers'),
  createAdminUser: (data: { name: string; pin: string; role: string; permissions?: object }) =>
    ipcRenderer.invoke('admin:createUser', data),
  updateAdminUser: (id: string, data: object) => ipcRenderer.invoke('admin:updateUser', id, data),
  deleteAdminUser: (id: string) => ipcRenderer.invoke('admin:deleteUser', id),

  // Audit Log
  getAuditLog: (filters?: object) => ipcRenderer.invoke('audit:getLog', filters),

  // Extra Production (legacy - kept for backwards compatibility)
  getExtraProduction: (filters?: object) => ipcRenderer.invoke('extraProduction:getAll', filters),
  createExtraProduction: (data: object) => ipcRenderer.invoke('extraProduction:create', data),
  updateExtraProduction: (id: string, data: object) => ipcRenderer.invoke('extraProduction:update', id, data),
  deleteExtraProduction: (id: string) => ipcRenderer.invoke('extraProduction:delete', id),
  getOpenCapacity: (bakeSlotId: string) => ipcRenderer.invoke('extraProduction:getOpenCapacity', bakeSlotId),
  getExtraProductionAnalytics: (filters?: object) => ipcRenderer.invoke('extraProduction:getAnalytics', filters),

  // Prep Sheets (new workflow)
  getPrepSheets: (filters?: object) => ipcRenderer.invoke('prepSheets:getAll', filters),
  getPrepSheet2: (id: string) => ipcRenderer.invoke('prepSheets:get', id),
  createPrepSheet: (data: object) => ipcRenderer.invoke('prepSheets:create', data),
  updatePrepSheet: (id: string, data: object) => ipcRenderer.invoke('prepSheets:update', id, data),
  deletePrepSheet: (id: string) => ipcRenderer.invoke('prepSheets:delete', id),
  addOrderToPrepSheet: (prepSheetId: string, orderId: string) =>
    ipcRenderer.invoke('prepSheets:addOrder', prepSheetId, orderId),
  removeOrderFromPrepSheet: (prepSheetId: string, orderId: string) =>
    ipcRenderer.invoke('prepSheets:removeOrder', prepSheetId, orderId),
  addExtraToPrepSheet: (prepSheetId: string, flavorId: string, quantity: number) =>
    ipcRenderer.invoke('prepSheets:addExtra', prepSheetId, flavorId, quantity),
  removeExtraFromPrepSheet: (itemId: string) =>
    ipcRenderer.invoke('prepSheets:removeExtra', itemId),
  updateExtraOnPrepSheet: (itemId: string, quantity: number) =>
    ipcRenderer.invoke('prepSheets:updateExtra', itemId, quantity),
  getAvailableOrdersForPrepSheet: (bakeDate: string) =>
    ipcRenderer.invoke('prepSheets:getAvailableOrders', bakeDate),
  completePrepSheet: (prepSheetId: string, actualQuantities?: object) =>
    ipcRenderer.invoke('prepSheets:complete', prepSheetId, actualQuantities),
  generatePrepSheetData: (prepSheetId: string) =>
    ipcRenderer.invoke('prepSheets:generateData', prepSheetId),

  // Production (loaf tracking after baking)
  getProduction: (filters?: object) => ipcRenderer.invoke('production:getAll', filters),
  getProductionRecord: (id: string) => ipcRenderer.invoke('production:get', id),
  updateProduction: (id: string, data: object) => ipcRenderer.invoke('production:update', id, data),
  splitProduction: (id: string, splitQuantity: number, newStatus: string) =>
    ipcRenderer.invoke('production:split', id, splitQuantity, newStatus),
  updateOrderPaymentFromProduction: (orderId: string, paymentStatus: string, paymentMethod?: string) =>
    ipcRenderer.invoke('production:updateOrderPayment', orderId, paymentStatus, paymentMethod),
  getProductionAnalytics: (filters?: object) => ipcRenderer.invoke('production:getAnalytics', filters),

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
      bulkUpdateOrders: (ids: string[], data: object) => Promise<void>;
      deleteOrder: (id: string) => Promise<void>;

      getCustomers: (filters?: object) => Promise<unknown[]>;
      getCustomer: (id: string) => Promise<unknown>;
      updateCustomer: (id: string, data: object) => Promise<void>;
      issueCredit: (id: string, amount: number, reason: string) => Promise<void>;
      getCustomerOrders: (customerId: string) => Promise<unknown[]>;
      getCustomerCreditHistory: (customerId: string) => Promise<unknown[]>;

      getBakeSlots: (filters?: object) => Promise<unknown[]>;
      getBakeSlotsByLocation: (locationId: string) => Promise<unknown[]>;
      createBakeSlot: (data: object) => Promise<string>;
      updateBakeSlot: (id: string, data: object) => Promise<void>;
      deleteBakeSlot: (id: string) => Promise<void>;

      getFlavors: () => Promise<unknown[]>;
      createFlavor: (data: object) => Promise<string>;
      updateFlavor: (id: string, data: object) => Promise<void>;
      deleteFlavor: (id: string) => Promise<void>;
      duplicateFlavor: (id: string) => Promise<{ success: boolean; id?: string; name?: string; error?: string }>;

      getLocations: () => Promise<unknown[]>;
      createLocation: (data: object) => Promise<string>;
      updateLocation: (id: string, data: object) => Promise<void>;
      deleteLocation: (id: string) => Promise<void>;

      getRecipes: () => Promise<unknown[]>;
      getRecipe: (id: string) => Promise<unknown>;
      createRecipe: (data: object) => Promise<string>;
      updateRecipe: (id: string, data: object) => Promise<void>;
      deleteRecipe: (id: string) => Promise<void>;

      getOverhead: () => Promise<{ packaging_per_loaf: number; utilities_per_loaf: number }>;
      updateOverhead: (data: object) => Promise<void>;

      getIngredients: () => Promise<unknown[]>;
      getIngredient: (id: string) => Promise<unknown>;
      createIngredient: (data: object) => Promise<{ id: string }>;
      updateIngredient: (id: string, data: object) => Promise<void>;
      deleteIngredient: (id: string) => Promise<void>;

      getPrepSheet: (bakeSlotId: string) => Promise<unknown>;
      generatePrepSheet: (bakeSlotId: string) => Promise<unknown>;
      printPrepSheet: (bakeSlotId: string) => Promise<void>;

      getAnalytics: (dateRange: object) => Promise<unknown>;
      getSalesStats: (dateRange: object) => Promise<unknown>;
      getFlavorStats: (dateRange: object) => Promise<unknown>;
      getCustomerStats: () => Promise<unknown>;
      getProfitByFlavor: () => Promise<Array<{ id: string; name: string; price: number; cost: number; profit: number; margin: number }>>;
      getProfitByBakeSlot: (filters?: object) => Promise<Array<{ id: string; date: string; locationName: string; loaves: number; revenue: number; cogs: number; profit: number }>>;
      getProfitPerHour: (filters?: object) => Promise<{
        bakeSlots: { count: number; loaves: number; revenue: number; cogs: number; profit: number; timeMinutes: number };
        extraProduction: { loaves: number; revenue: number; cogs: number; profit: number; timeMinutes: number };
        totals: { loaves: number; revenue: number; cogs: number; profit: number; timeMinutes: number; timeHours: number; profitPerHour: number };
        timeSettings: { bakeDaySetupMinutes: number; bakeDayPerLoafMinutes: number; bakeDayCleanupMinutes: number; miscProductionPerLoafMinutes: number };
      }>;

      sendNotification: (type: string, recipientId: string, data: object) => Promise<void>;
      broadcastMessage: (message: string, filters: object) => Promise<void>;

      syncNow: () => Promise<void>;
      getSyncStatus: () => Promise<object>;

      getPublicSettings: () => Promise<{ businessName: string; isPortable: boolean }>;
      getSettings: () => Promise<object>;
      saveSettings: (data: object) => Promise<void>;
      testGoogleConnection: () => Promise<boolean>;
      triggerSync: () => Promise<void>;
      getConfig: () => Promise<object>;
      updateConfig: (data: object) => Promise<void>;

      signIn: () => Promise<void>;
      signOut: () => Promise<void>;
      getAuthStatus: () => Promise<{ isSignedIn: boolean; email?: string }>;
      configureGoogleSheets: (credentials: object, spreadsheetId: string) => Promise<{ success: boolean; error?: string }>;

      checkAdminSetup: () => Promise<{ needsSetup: boolean }>;
      setupDeveloper: (name: string, pin: string, secret: string) =>
        Promise<{ success: boolean; user?: object; error?: string }>;
      setupOwner: (name: string, pin: string) => Promise<{ success: boolean; user?: object }>;
      adminLogin: (pin: string) => Promise<{ success: boolean; user?: object; error?: string }>;
      adminLogout: () => Promise<{ success: boolean }>;
      getCurrentUser: () => Promise<{
        id: string;
        name: string;
        role: string;
        isDeveloper: boolean;
        isOwner: boolean;
        permissions: object;
      } | null>;
      getAdminUsers: () => Promise<unknown[]>;
      createAdminUser: (data: { name: string; pin: string; role: string; permissions?: object }) =>
        Promise<{ success: boolean; id?: string; error?: string }>;
      updateAdminUser: (id: string, data: object) => Promise<{ success: boolean; error?: string }>;
      deleteAdminUser: (id: string) => Promise<{ success: boolean; error?: string }>;

      getAuditLog: (filters?: object) => Promise<unknown[]>;

      getExtraProduction: (filters?: object) => Promise<unknown[]>;
      createExtraProduction: (data: object) => Promise<{ success: boolean; id?: string }>;
      updateExtraProduction: (id: string, data: object) => Promise<{ success: boolean }>;
      deleteExtraProduction: (id: string) => Promise<{ success: boolean }>;
      getOpenCapacity: (bakeSlotId: string) => Promise<{
        totalCapacity: number;
        orderedCount: number;
        extraLoggedCount: number;
        openSlots: number;
      } | null>;
      getExtraProductionAnalytics: (filters?: object) => Promise<{
        sold: { count: number; loaves: number; revenue: number };
        gifted: { count: number; loaves: number; cost: number };
        wasted: { count: number; loaves: number; cost: number };
        personal: { count: number; loaves: number };
      }>;

      // Prep Sheets (new workflow)
      getPrepSheets: (filters?: object) => Promise<unknown[]>;
      getPrepSheet2: (id: string) => Promise<{
        id: string;
        bake_date: string;
        status: string;
        notes: string | null;
        completed_at: string | null;
        completed_by_name: string | null;
        items: Array<{
          id: string;
          order_id: string | null;
          flavor_id: string;
          flavor_name: string;
          planned_quantity: number;
          actual_quantity: number | null;
          first_name?: string;
          last_name?: string;
          email?: string;
        }>;
      } | null>;
      createPrepSheet: (data: object) => Promise<{ id: string }>;
      updatePrepSheet: (id: string, data: object) => Promise<void>;
      deletePrepSheet: (id: string) => Promise<{ success: boolean }>;
      addOrderToPrepSheet: (prepSheetId: string, orderId: string) => Promise<void>;
      removeOrderFromPrepSheet: (prepSheetId: string, orderId: string) => Promise<void>;
      addExtraToPrepSheet: (prepSheetId: string, flavorId: string, quantity: number) => Promise<{ id: string }>;
      removeExtraFromPrepSheet: (itemId: string) => Promise<void>;
      updateExtraOnPrepSheet: (itemId: string, quantity: number) => Promise<void>;
      getAvailableOrdersForPrepSheet: (bakeDate: string) => Promise<unknown[]>;
      completePrepSheet: (prepSheetId: string, actualQuantities?: object) => Promise<{ success: boolean }>;
      generatePrepSheetData: (prepSheetId: string) => Promise<{
        prepSheetId: string;
        bakeDate: string;
        status: string;
        generatedAt: string;
        items: Array<{
          flavorId: string;
          flavorName: string;
          quantity: number;
          baseIngredients: Array<{ name: string; totalQuantity: number; unit: string }>;
          foldIngredients: Array<{ name: string; totalQuantity: number; unit: string }>;
          laminationIngredients: Array<{ name: string; totalQuantity: number; unit: string }>;
          steps: string[];
          prepInstructions?: string;
          bakeInstructions?: string;
          bakeTemp?: string;
          prepTimeMinutes?: number;
          bakeTimeMinutes?: number;
          noRecipe?: boolean;
        }>;
        totalLoaves: number;
      }>;

      // Production (loaf tracking after baking)
      getProduction: (filters?: object) => Promise<Array<{
        id: string;
        prep_sheet_id: string;
        order_id: string | null;
        flavor_id: string;
        flavor_name: string;
        quantity: number;
        status: string;
        sale_price: number | null;
        notes: string | null;
        bake_date: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        payment_status?: string;
        payment_method?: string;
        total_amount?: number;
      }>>;
      getProductionRecord: (id: string) => Promise<unknown>;
      updateProduction: (id: string, data: object) => Promise<void>;
      splitProduction: (id: string, splitQuantity: number, newStatus: string) => Promise<{
        newId: string;
        originalQuantity: number;
      }>;
      updateOrderPaymentFromProduction: (orderId: string, paymentStatus: string, paymentMethod?: string) => Promise<void>;
      getProductionAnalytics: (filters?: object) => Promise<{
        byStatus: Array<{ status: string; record_count: number; total_loaves: number; revenue: number }>;
        bySource: Array<{ source: string; total_loaves: number }>;
      }>;

      sendErrorReport: () => Promise<void>;
      getAppVersion: () => Promise<string>;
      openExternal: (url: string) => Promise<void>;

      onSyncUpdate: (callback: (status: object) => void) => () => void;
      onNewOrder: (callback: (order: object) => void) => () => void;
    };
  }
}
