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

  // Order details
  items: OrderItem[];
  totalAmount: number;

  // Status tracking
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  cutoffAt: string;

  // Notes
  customerNotes: string;
  adminNotes: string;

  // Credits/adjustments
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
