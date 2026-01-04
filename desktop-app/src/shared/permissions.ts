/**
 * Permission types for admin portal access control
 *
 * Role Hierarchy:
 * - Developer: Full access, can manage owners, access dangerous operations
 * - Owner: Can manage admins, access most settings, run the business
 * - Admin: Limited access based on assigned permissions
 */

// User role type
export type UserRole = 'developer' | 'owner' | 'admin';

// Pages in the admin portal
export type PageKey =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'bakeSlots'
  | 'flavors'
  | 'config'
  | 'analytics'
  | 'settings';

// Permission levels
export type PermissionLevel = 'none' | 'read' | 'write';

// Full permissions object
export interface UserPermissions {
  dashboard: PermissionLevel;
  orders: PermissionLevel;
  customers: PermissionLevel;
  bakeSlots: PermissionLevel;
  flavors: PermissionLevel;
  config: PermissionLevel;
  analytics: PermissionLevel;
  settings: PermissionLevel;
}

// Determine user role from flags
export function getUserRole(isDeveloper: boolean, isOwner: boolean): UserRole {
  if (isDeveloper) return 'developer';
  if (isOwner) return 'owner';
  return 'admin';
}

// Page metadata for UI
export const PAGE_INFO: Record<PageKey, { label: string; description: string }> = {
  dashboard: { label: 'Dashboard', description: 'Overview and quick actions' },
  orders: { label: 'Orders', description: 'View and manage orders' },
  customers: { label: 'Customers', description: 'Customer database' },
  bakeSlots: { label: 'Bake Slots', description: 'Schedule and capacity' },
  flavors: { label: 'Flavors', description: 'Product catalog' },
  config: { label: 'Config', description: 'Locations and recipes' },
  analytics: { label: 'Analytics', description: 'Reports and insights' },
  settings: { label: 'Settings', description: 'App configuration' },
};

// Default permissions for new non-owner users
export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: 'read',
  orders: 'read',
  customers: 'read',
  bakeSlots: 'read',
  flavors: 'read',
  config: 'read',
  analytics: 'read',
  settings: 'none',
};

// Full permissions (for owners)
export const FULL_PERMISSIONS: UserPermissions = {
  dashboard: 'write',
  orders: 'write',
  customers: 'write',
  bakeSlots: 'write',
  flavors: 'write',
  config: 'write',
  analytics: 'write',
  settings: 'write',
};

// Check if user can access a page
export function canAccess(permissions: UserPermissions | null, page: PageKey): boolean {
  if (!permissions) return false;
  return permissions[page] !== 'none';
}

// Check if user can write to a page
export function canWrite(permissions: UserPermissions | null, page: PageKey): boolean {
  if (!permissions) return false;
  return permissions[page] === 'write';
}

// Parse permissions from JSON string (with fallback)
export function parsePermissions(json: string | null, role: UserRole): UserPermissions {
  // Developers and owners get full permissions
  if (role === 'developer' || role === 'owner') return FULL_PERMISSIONS;
  if (!json) return DEFAULT_PERMISSIONS;
  try {
    return JSON.parse(json) as UserPermissions;
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}
