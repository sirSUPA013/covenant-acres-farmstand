export interface BakeSlot {
  id: string;
  date: string; // ISO date string
  locationId: string;
  locationName: string;

  // Capacity
  totalCapacity: number;
  currentOrders: number;
  remainingCapacity: number;

  // Flavor caps for this slot
  flavorCaps: FlavorCap[];

  // Cutoff
  cutoffTime: string; // ISO datetime
  isOpen: boolean; // false if cutoff passed or capacity reached

  // Admin controls
  manuallyClosedBy: string | null;
  manuallyClosedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface FlavorCap {
  flavorId: string;
  flavorName: string;
  maxQuantity: number;
  currentQuantity: number;
  remainingQuantity: number;
}

export interface BakeSlotSummary {
  id: string;
  date: string;
  locationName: string;
  remainingCapacity: number;
  isOpen: boolean;
}
