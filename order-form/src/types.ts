// Types for order form (inlined from shared)

export type OrderStatus =
  | 'submitted'
  | 'cutoff_passed'
  | 'in_production'
  | 'ready'
  | 'picked_up'
  | 'canceled'
  | 'no_show';

export type PaymentMethod = 'cash' | 'venmo' | 'cashapp' | 'zelle' | 'credit';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'credited';

export interface OrderItem {
  flavorId: string;
  flavorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  bakeSlotId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  cutoffAt: string;
  customerNotes: string;
  adminNotes: string;
  creditApplied: number;
  adjustmentReason: string;
}

export interface OrderSummary {
  id: string;
  customerName: string;
  bakeSlotDate: string;
  bakeSlotLocation: string;
  itemCount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

export type NotificationPreference = 'email' | 'sms' | 'both' | 'none';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notificationPreference: NotificationPreference;
  smsOptIn: boolean;
  smsOptInDate: string | null;
  hasAccount: boolean;
  creditBalance: number;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  totalSpent: number;
}

export interface BakeSlot {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  totalCapacity: number;
  currentOrders: number;
  cutoffTime: string;
  isOpen: boolean;
  flavorCaps: FlavorCap[];
}

export interface BakeSlotSummary {
  id: string;
  date: string;
  locationName: string;
  spotsRemaining: number;
  isOpen: boolean;
}

export interface FlavorCap {
  flavorId: string;
  maxQuantity: number;
  currentQuantity: number;
}

export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'year_round';

export interface FlavorSize {
  name: string;
  price: number;
}

export interface Flavor {
  id: string;
  name: string;
  description: string;
  sizes: FlavorSize[];
  isActive: boolean;
  season: Season;
  sortOrder: number;
  imageUrl: string | null;
  estimatedCost: number | null;
}

export interface FlavorSummary {
  id: string;
  name: string;
  sizes: FlavorSize[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}
