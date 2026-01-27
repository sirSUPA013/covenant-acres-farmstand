/// <reference types="vite/client" />

// Window.api types (from Electron preload)
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

    getAuditLog: (filters?: object) => Promise<{ data: unknown[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>;

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
      pending?: { count: number; loaves: number };
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
        steps: Array<{ order: number; instruction: string; duration_minutes?: number }>;
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

// Image imports
declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
