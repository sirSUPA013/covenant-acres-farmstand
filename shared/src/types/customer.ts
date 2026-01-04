export type NotificationPreference = 'email' | 'sms' | 'both' | 'none';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Preferences
  notificationPreference: NotificationPreference;
  smsOptIn: boolean;
  smsOptInDate: string | null;

  // Account (optional)
  hasAccount: boolean;
  passwordHash: string | null;

  // Credits
  creditBalance: number;

  // Stats
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  totalOrders: number;
  creditBalance: number;
}
