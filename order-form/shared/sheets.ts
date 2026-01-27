/**
 * Google Sheets Client - Shared module outside api folder
 */

// Sheet names
export const SHEETS = {
  // Core sheets (used by order form)
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  BAKE_SLOTS: 'BakeSlots',
  FLAVORS: 'Flavors',
  LOCATIONS: 'Locations',
  // Backup sheets (pushed from desktop app)
  EXTRA_PRODUCTION: 'ExtraProduction',
  FLAVOR_CAPS: 'FlavorCaps',
  BAKE_SLOT_LOCATIONS: 'BakeSlotLocations',
  RECIPES: 'Recipes',
  INGREDIENTS: 'Ingredients',
  RECIPE_INGREDIENTS: 'RecipeIngredients',
  OVERHEAD_SETTINGS: 'OverheadSettings',
  PUBLIC_SETTINGS: 'PublicSettings',
} as const;
