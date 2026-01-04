/**
 * Covenant Acres Farmstand - Order Form
 * Main application logic
 */

import { OrderItem, BakeSlotSummary, FlavorSummary } from './types';
import { sheetsApi } from './api/sheets';
import {
  validateEmail,
  validatePhone,
  normalizePhone,
  formatPhone,
  generateId,
} from './utils/validation';
import { formatDate } from './utils/dates';

// State
interface AppState {
  currentStep: number;
  selectedSlot: BakeSlotSummary | null;
  availableSlots: BakeSlotSummary[];
  availableFlavors: FlavorSummary[];
  orderItems: Map<string, OrderItem>;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notes: string;
    notificationPref: 'email' | 'sms' | 'both';
    smsOptIn: boolean;
    createAccount: boolean;
  };
}

const state: AppState = {
  currentStep: 1,
  selectedSlot: null,
  availableSlots: [],
  availableFlavors: [],
  orderItems: new Map(),
  customer: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    notificationPref: 'email',
    smsOptIn: false,
    createAccount: false,
  },
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadBakeSlots();
    setupEventListeners();
  } catch (error) {
    showError('Failed to load order form. Please try again.', 'INIT-001');
  }
});

// API calls
async function loadBakeSlots(): Promise<void> {
  const slotsContainer = document.getElementById('bake-slots');
  if (!slotsContainer) return;

  try {
    state.availableSlots = await sheetsApi.getBakeSlots();

    if (state.availableSlots.length === 0) {
      slotsContainer.innerHTML = `
        <div class="no-slots">
          <p>No bake days are currently available.</p>
          <p>Check back soon or follow us on social media for updates!</p>
        </div>
      `;
      return;
    }

    slotsContainer.innerHTML = state.availableSlots
      .map((slot) => {
        const availabilityClass =
          slot.remainingCapacity <= 0
            ? 'sold-out'
            : slot.remainingCapacity <= 5
              ? 'low'
              : '';

        const availabilityText =
          slot.remainingCapacity <= 0
            ? 'Sold Out'
            : `${slot.remainingCapacity} spots left`;

        return `
        <div class="bake-slot-card ${slot.remainingCapacity <= 0 ? 'sold-out' : ''}"
             data-slot-id="${slot.id}"
             ${slot.remainingCapacity <= 0 ? '' : 'tabindex="0"'}>
          <div class="bake-slot-date">${formatDate(slot.date)}</div>
          <div class="bake-slot-location">${slot.locationName}</div>
          <div class="bake-slot-availability ${availabilityClass}">${availabilityText}</div>
        </div>
      `;
      })
      .join('');

    // Add click handlers
    slotsContainer.querySelectorAll('.bake-slot-card:not(.sold-out)').forEach((card) => {
      card.addEventListener('click', () => selectBakeSlot(card as HTMLElement));
      card.addEventListener('keypress', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          selectBakeSlot(card as HTMLElement);
        }
      });
    });
  } catch (error) {
    slotsContainer.innerHTML = `
      <div class="error-loading">
        <p>Unable to load available dates. Please refresh the page.</p>
      </div>
    `;
    console.error('Failed to load bake slots:', error);
  }
}

async function selectBakeSlot(card: HTMLElement): Promise<void> {
  const slotId = card.dataset.slotId;
  if (!slotId) return;

  // Update UI
  document.querySelectorAll('.bake-slot-card').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');

  // Update state
  state.selectedSlot = state.availableSlots.find((s) => s.id === slotId) || null;

  // Load flavors for this slot
  try {
    state.availableFlavors = await sheetsApi.getFlavorsForSlot(slotId);
    state.orderItems.clear();
    renderFlavors();
    goToStep(2);
  } catch (error) {
    showError('Failed to load menu. Please try again.', 'LOAD-002');
  }
}

function renderFlavors(): void {
  const container = document.getElementById('flavors');
  if (!container) return;

  container.innerHTML = state.availableFlavors
    .map((flavor) => {
      const currentQty = state.orderItems.get(flavor.id)?.quantity || 0;
      const isUnavailable = flavor.isActive === false;

      return `
      <div class="flavor-card ${isUnavailable ? 'unavailable' : ''}" data-flavor-id="${flavor.id}">
        <div class="flavor-name">${flavor.name}</div>
        <div class="flavor-price">$${flavor.basePrice.toFixed(2)}</div>
        ${isUnavailable ? '<div class="flavor-availability sold-out">Sold out</div>' : ''}
        <div class="flavor-quantity">
          <button class="qty-btn" data-action="decrease" ${currentQty === 0 || isUnavailable ? 'disabled' : ''}>−</button>
          <span class="qty-value">${currentQty}</span>
          <button class="qty-btn" data-action="increase" ${isUnavailable ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
    })
    .join('');

  // Add quantity handlers
  container.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.flavor-card') as HTMLElement;
      const flavorId = card.dataset.flavorId;
      const action = (e.target as HTMLElement).dataset.action;

      if (flavorId && action) {
        updateQuantity(flavorId, action === 'increase' ? 1 : -1);
      }
    });
  });

  updateOrderSummary();
}

function updateQuantity(flavorId: string, delta: number): void {
  const flavor = state.availableFlavors.find((f) => f.id === flavorId);
  if (!flavor) return;

  const currentItem = state.orderItems.get(flavorId);
  const currentQty = currentItem?.quantity || 0;
  const newQty = Math.max(0, currentQty + delta);

  if (newQty === 0) {
    state.orderItems.delete(flavorId);
  } else {
    state.orderItems.set(flavorId, {
      flavorId,
      flavorName: flavor.name,
      size: 'Regular',
      quantity: newQty,
      unitPrice: flavor.basePrice,
      totalPrice: newQty * flavor.basePrice,
    });
  }

  renderFlavors();
  updateOrderSummary();
}

function updateOrderSummary(): void {
  const itemsContainer = document.getElementById('order-items');
  const totalElement = document.getElementById('order-total-amount');
  const continueBtn = document.getElementById('to-step-3') as HTMLButtonElement;

  if (!itemsContainer || !totalElement || !continueBtn) return;

  const items = Array.from(state.orderItems.values());

  if (items.length === 0) {
    itemsContainer.innerHTML = '<p class="empty-order">No items selected yet</p>';
    totalElement.textContent = '$0.00';
    continueBtn.disabled = true;
    return;
  }

  itemsContainer.innerHTML = items
    .map(
      (item) => `
      <div class="order-item">
        <span>${item.flavorName} × ${item.quantity}</span>
        <span>$${item.totalPrice.toFixed(2)}</span>
      </div>
    `
    )
    .join('');

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  totalElement.textContent = `$${total.toFixed(2)}`;
  continueBtn.disabled = false;
}

// Step navigation
function goToStep(step: number): void {
  // Validate current step before proceeding
  if (step > state.currentStep) {
    if (!validateCurrentStep()) return;
  }

  state.currentStep = step;

  // Update step indicators
  document.querySelectorAll('.step').forEach((el, index) => {
    el.classList.remove('active', 'completed');
    if (index + 1 < step) el.classList.add('completed');
    if (index + 1 === step) el.classList.add('active');
  });

  // Show current step content
  document.querySelectorAll('.step-content').forEach((el) => el.classList.remove('active'));
  const stepContent = document.getElementById(`step-${step}`);
  if (stepContent) stepContent.classList.add('active');

  // Prepare step content
  if (step === 4) {
    prepareConfirmation();
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep(): boolean {
  switch (state.currentStep) {
    case 1:
      if (!state.selectedSlot) {
        alert('Please select a pickup date.');
        return false;
      }
      return true;

    case 2:
      if (state.orderItems.size === 0) {
        alert('Please add at least one item to your order.');
        return false;
      }
      return true;

    case 3:
      return validateCustomerForm();

    default:
      return true;
  }
}

function validateCustomerForm(): boolean {
  const form = document.getElementById('customer-form') as HTMLFormElement;
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }

  // Get form values
  const firstName = (document.getElementById('firstName') as HTMLInputElement).value.trim();
  const lastName = (document.getElementById('lastName') as HTMLInputElement).value.trim();
  const email = (document.getElementById('email') as HTMLInputElement).value.trim();
  const phone = (document.getElementById('phone') as HTMLInputElement).value.trim();
  const notes = (document.getElementById('notes') as HTMLTextAreaElement).value.trim();
  const notificationPref = (
    document.querySelector('input[name="notificationPref"]:checked') as HTMLInputElement
  )?.value as 'email' | 'sms' | 'both';
  const smsOptIn = (document.getElementById('smsOptIn') as HTMLInputElement).checked;
  const createAccount = (document.getElementById('createAccount') as HTMLInputElement).checked;

  // Validate email
  if (!validateEmail(email)) {
    alert('Please enter a valid email address.');
    return false;
  }

  // Validate phone
  if (!validatePhone(phone)) {
    alert('Please enter a valid phone number.');
    return false;
  }

  // Check SMS opt-in if SMS notifications selected
  if ((notificationPref === 'sms' || notificationPref === 'both') && !smsOptIn) {
    alert('Please agree to receive text messages to use SMS notifications.');
    return false;
  }

  // Save to state
  state.customer = {
    firstName,
    lastName,
    email,
    phone: normalizePhone(phone),
    notes,
    notificationPref,
    smsOptIn,
    createAccount,
  };

  return true;
}

function prepareConfirmation(): void {
  // Pickup details
  const pickupEl = document.getElementById('confirm-pickup');
  if (pickupEl && state.selectedSlot) {
    pickupEl.innerHTML = `
      <strong>${formatDate(state.selectedSlot.date)}</strong><br />
      ${state.selectedSlot.locationName}
    `;
  }

  // Order items
  const itemsEl = document.getElementById('confirm-items');
  const totalEl = document.getElementById('confirm-total');
  if (itemsEl && totalEl) {
    const items = Array.from(state.orderItems.values());
    itemsEl.innerHTML = items
      .map(
        (item) => `
        <div class="order-item">
          <span>${item.flavorName} × ${item.quantity}</span>
          <span>$${item.totalPrice.toFixed(2)}</span>
        </div>
      `
      )
      .join('');

    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    totalEl.textContent = `$${total.toFixed(2)}`;
  }

  // Customer info
  const customerEl = document.getElementById('confirm-customer');
  if (customerEl) {
    customerEl.innerHTML = `
      <strong>${state.customer.firstName} ${state.customer.lastName}</strong><br />
      ${state.customer.email}<br />
      ${formatPhone(state.customer.phone)}
    `;
  }
}

async function submitOrder(): Promise<void> {
  const submitBtn = document.getElementById('submit-order') as HTMLButtonElement;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order...';

  try {
    const items = Array.from(state.orderItems.values());
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

    const order = {
      id: generateId(),
      customerId: generateId(),
      bakeSlotId: state.selectedSlot!.id,
      items,
      totalAmount: total,
      status: 'submitted' as const,
      paymentMethod: null,
      paymentStatus: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cutoffAt: '', // Will be set by API
      customerNotes: state.customer.notes,
      adminNotes: '',
      creditApplied: 0,
      adjustmentReason: '',
    };

    await sheetsApi.submitOrder(order, state.customer);

    // Show success
    document.querySelectorAll('.step-content').forEach((el) => el.classList.remove('active'));
    document.getElementById('step-success')?.classList.add('active');

    const successDetails = document.getElementById('success-details');
    if (successDetails) {
      successDetails.innerHTML = `
        <p><strong>Order #${order.id.split('-')[0].toUpperCase()}</strong></p>
        <p>Pickup: ${formatDate(state.selectedSlot!.date)} at ${state.selectedSlot!.locationName}</p>
      `;
    }
  } catch (error) {
    console.error('Order submission failed:', error);
    showError(
      'Failed to place your order. Please try again or contact us directly.',
      'ORD-001'
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

function showError(message: string, code: string): void {
  document.querySelectorAll('.step-content').forEach((el) => el.classList.remove('active'));
  document.getElementById('step-error')?.classList.add('active');

  const errorText = document.getElementById('error-text');
  const errorCode = document.getElementById('error-code');

  if (errorText) errorText.textContent = message;
  if (errorCode) errorCode.textContent = `Error Code: ${code}`;
}

function startNewOrder(): void {
  // Reset state
  state.currentStep = 1;
  state.selectedSlot = null;
  state.orderItems.clear();
  state.customer = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    notificationPref: 'email',
    smsOptIn: false,
    createAccount: false,
  };

  // Reset UI
  document.querySelectorAll('.step').forEach((el, index) => {
    el.classList.remove('active', 'completed');
    if (index === 0) el.classList.add('active');
  });

  document.querySelectorAll('.step-content').forEach((el) => el.classList.remove('active'));
  document.getElementById('step-1')?.classList.add('active');

  // Reload data
  loadBakeSlots();
}

function setupEventListeners(): void {
  // SMS consent visibility
  document.querySelectorAll('input[name="notificationPref"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const smsConsent = document.getElementById('sms-consent');
      if (smsConsent) {
        smsConsent.style.display = value === 'sms' || value === 'both' ? 'block' : 'none';
      }
    });
  });

  // Phone formatting
  const phoneInput = document.getElementById('phone') as HTMLInputElement;
  if (phoneInput) {
    phoneInput.addEventListener('blur', () => {
      if (validatePhone(phoneInput.value)) {
        phoneInput.value = formatPhone(phoneInput.value);
      }
    });
  }
}

// Expose functions to window for inline handlers
declare global {
  interface Window {
    goToStep: typeof goToStep;
    submitOrder: typeof submitOrder;
    startNewOrder: typeof startNewOrder;
  }
}

window.goToStep = goToStep;
window.submitOrder = submitOrder;
window.startNewOrder = startNewOrder;
