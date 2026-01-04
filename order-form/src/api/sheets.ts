/**
 * Google Sheets API Integration
 *
 * This module handles all communication with Google Sheets.
 * In production, this uses a serverless function to securely access Sheets.
 * For development, it uses mock data.
 */

import type { BakeSlotSummary, FlavorSummary, Order } from '../types';

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_API_URL;

// Mock data for development
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
   * Get available bake slots
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
};
