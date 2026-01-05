/**
 * Google Sheets API Integration
 *
 * This module handles all communication with Google Sheets.
 * In production, this uses a serverless function to securely access Sheets.
 * For development, it uses mock data.
 */

import type { BakeSlotSummary, FlavorSummary, Order, LocationSummary } from '../types';

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_API_URL;

// Mock data for development
const mockLocations: LocationSummary[] = [
  { id: 'loc-001', name: "Farmer's Market", address: '123 Market St, Town' },
  { id: 'loc-002', name: 'Farm Pickup', address: '456 Farm Rd, Country' },
];

const mockBakeSlots: BakeSlotSummary[] = [
  {
    id: 'slot-001',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    locationName: "Farmer's Market",
    spotsRemaining: 18,
    isOpen: true,
  },
  {
    id: 'slot-002',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    locationName: 'Farm Pickup',
    spotsRemaining: 24,
    isOpen: true,
  },
  {
    id: 'slot-003',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    locationName: "Farmer's Market",
    spotsRemaining: 3,
    isOpen: true,
  },
  {
    id: 'slot-004',
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    locationName: 'Farm Pickup',
    spotsRemaining: 0,
    isOpen: false,
  },
];

// Mock: which locations have which bake slots
const mockSlotLocations: Record<string, string[]> = {
  'slot-001': ['loc-001'],
  'slot-002': ['loc-002'],
  'slot-003': ['loc-001', 'loc-002'], // Available at both locations
  'slot-004': ['loc-002'],
};

const mockFlavors: FlavorSummary[] = [
  { id: 'plain', name: 'Plain Sourdough', sizes: [{ name: 'Regular', price: 8.0 }] },
  { id: 'garlic-cheddar', name: 'Garlic Cheddar', sizes: [{ name: 'Regular', price: 10.0 }] },
  { id: 'jalapeno-cheddar', name: 'Jalapeño Cheddar', sizes: [{ name: 'Regular', price: 10.0 }] },
  { id: 'cinnamon-raisin', name: 'Cinnamon Raisin', sizes: [{ name: 'Regular', price: 10.0 }] },
  { id: 'double-chocolate', name: 'Double Chocolate', sizes: [{ name: 'Regular', price: 12.0 }] },
  { id: 'pumpkin-spice', name: 'Pumpkin Spice', sizes: [{ name: 'Regular', price: 12.0 }] },
];

// Track which flavors are available (for mock purposes)
const unavailableFlavors: Record<string, string[]> = {
  'slot-003': ['cinnamon-raisin'],
};

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  notificationPref: 'email' | 'sms' | 'both';
  smsOptIn: boolean;
  createAccount: boolean;
}

export const sheetsApi = {
  /**
   * Get available pickup locations
   */
  async getLocations(): Promise<LocationSummary[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockLocations;
    }

    const response = await fetch(`${API_BASE}/locations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch locations: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get available bake slots for a specific location
   */
  async getBakeSlotsByLocation(locationId: string): Promise<BakeSlotSummary[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Filter slots that include this location
      return mockBakeSlots.filter((slot) => {
        const slotLocationIds = mockSlotLocations[slot.id] || [];
        return slot.isOpen && slotLocationIds.includes(locationId);
      });
    }

    const response = await fetch(`${API_BASE}/bake-slots?locationId=${encodeURIComponent(locationId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch bake slots: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get available bake slots (all)
   */
  async getBakeSlots(): Promise<BakeSlotSummary[]> {
    if (USE_MOCK) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      return mockBakeSlots.filter((slot) => slot.isOpen);
    }

    const response = await fetch(`${API_BASE}/bake-slots`);
    if (!response.ok) {
      throw new Error(`Failed to fetch bake slots: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get available flavors for a specific bake slot
   */
  async getFlavorsForSlot(_slotId: string): Promise<FlavorSummary[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Filter out unavailable flavors for this slot
      const unavailable = unavailableFlavors[_slotId] || [];
      return mockFlavors.filter((f) => !unavailable.includes(f.id));
    }

    // Flavors are the same for all slots (filtered by season on server)
    const response = await fetch(`${API_BASE}/flavors`);
    if (!response.ok) {
      throw new Error(`Failed to fetch flavors: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Submit an order
   */
  async submitOrder(order: Order, customer: CustomerData): Promise<{ orderId: string }> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log('Mock order submitted:', { order, customer });
      return { orderId: order.id };
    }

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order, customer }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText, code: 'ORD-001' }));
      const err = new Error(error.error || 'Failed to submit order');
      (err as Error & { code?: string }).code = error.code || 'ORD-001';
      throw err;
    }

    return response.json();
  },

  /**
   * Check if customer exists (for account lookup)
   */
  async checkCustomer(email: string): Promise<{ exists: boolean; customerId?: string }> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { exists: false };
    }

    const response = await fetch(`${API_BASE}/customers/check?email=${encodeURIComponent(email)}`);
    if (!response.ok) {
      throw new Error('Failed to check customer');
    }
    return response.json();
  },

  /**
   * Get customer history by email (for returning customers)
   */
  async getCustomerHistory(email: string): Promise<{
    found: boolean;
    customer: { firstName: string; lastName: string; phone: string } | null;
    orders: Array<{
      id: string;
      date: string;
      location: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      status: string;
    }>;
  }> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Mock returning customer
      if (email === 'returning@test.com') {
        return {
          found: true,
          customer: { firstName: 'Jane', lastName: 'Doe', phone: '555-123-4567' },
          orders: [
            {
              id: 'ord-001',
              date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              location: "Farmer's Market",
              items: [
                { name: 'Plain Sourdough', quantity: 2, price: 16 },
                { name: 'Garlic Cheddar', quantity: 1, price: 10 },
              ],
              total: 26,
              status: 'picked_up',
            },
          ],
        };
      }
      return { found: false, customer: null, orders: [] };
    }

    try {
      const response = await fetch(`${API_BASE}/customer-history?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        return { found: false, customer: null, orders: [] };
      }
      return response.json();
    } catch {
      return { found: false, customer: null, orders: [] };
    }
  },

  /**
   * Get payment options for prepayment
   */
  async getPaymentOptions(): Promise<{
    enabled: boolean;
    options: Array<{
      type: 'venmo' | 'cashapp' | 'paypal' | 'zelle';
      label: string;
      value: string;
      link?: string;
    }>;
  }> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        enabled: true,
        options: [
          { type: 'venmo', label: 'Venmo', value: '@CovenantAcres', link: 'https://venmo.com/CovenantAcres' },
          { type: 'cashapp', label: 'Cash App', value: '$CovenantAcres', link: 'https://cash.app/$CovenantAcres' },
          { type: 'zelle', label: 'Zelle', value: 'pay@covenantacresin.com' },
        ],
      };
    }

    try {
      const response = await fetch(`${API_BASE}/payment-options`);
      if (!response.ok) {
        return { enabled: false, options: [] };
      }
      return response.json();
    } catch {
      return { enabled: false, options: [] };
    }
  },
};
