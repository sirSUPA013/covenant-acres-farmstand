/**
 * Covenant Acres Farmstand - Order Form
 * Main application logic
 */

import { OrderItem, BakeSlotSummary, FlavorSummary, LocationSummary } from './types';
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
  selectedLocation: LocationSummary | null;
  selectedSlot: BakeSlotSummary | null;
  availableLocations: LocationSummary[];
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
  selectedLocation: null,
  selectedSlot: null,
  availableLocations: [],
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
    await loadLocations();
    setupEventListeners();
  } catch (error) {
    showError('Failed to load order form. Please try again.', 'INIT-001');
  }
});

// API calls
async function loadLocations(): Promise<void> {
  const locationsContainer = document.getElementById('locations');
  if (!locationsContainer) return;

  try {
    state.availableLocations = await sheetsApi.getLocations();

    if (state.availableLocations.length === 0) {
      locationsContainer.innerHTML = `
        <div class="no-slots">
          <p>No pickup locations are currently available.</p>
          <p>Check back soon or follow us on social media for updates!</p>
        </div>
      `;
      return;
    }

    locationsContainer.innerHTML = state.availableLocations
      .map((location) => `
        <div class="bake-slot-card"
             data-location-id="${location.id}"
             tabindex="0">
          <div class="bake-slot-date">${location.name}</div>
          ${location.address ? `<div class="bake-slot-location">${location.address}</div>` : ''}
        </div>
      `)
      .join('');

    // Add click handlers
    locationsContainer.querySelectorAll('.bake-slot-card').forEach((card) => {
      card.addEventListener('click', () => selectLocation(card as HTMLElement));
      card.addEventListener('keypress', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          selectLocation(card as HTMLElement);
        }
      });
    });
  } catch (error) {
    locationsContainer.innerHTML = `
      <div class="error-loading">
        <p>Unable to load pickup locations. Please refresh the page.</p>
      </div>
    `;
    console.error('Failed to load locations:', error);
  }
}

async function selectLocation(card: HTMLElement): Promise<void> {
  const locationId = card.dataset.locationId;
  if (!locationId) return;

  // Update UI
  document.querySelectorAll('#locations .bake-slot-card').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');

  // Update state
  state.selectedLocation = state.availableLocations.find((l) => l.id === locationId) || null;

  // Load bake slots for this location
  await loadBakeSlots();
  goToStep(2);
}

async function loadBakeSlots(): Promise<void> {
  const slotsContainer = document.getElementById('bake-slots');
  if (!slotsContainer || !state.selectedLocation) return;

  // Update location name in UI
  const locationNameEl = document.getElementById('selected-location-name');
  if (locationNameEl) {
    locationNameEl.textContent = state.selectedLocation.name;
  }

  try {
    state.availableSlots = await sheetsApi.getBakeSlotsByLocation(state.selectedLocation.id);

    if (state.availableSlots.length === 0) {
      slotsContainer.innerHTML = `
        <div class="no-slots">
          <p>No bake days are currently available at ${state.selectedLocation.name}.</p>
          <p>Check back soon or try a different location!</p>
        </div>
      `;
      return;
    }

    slotsContainer.innerHTML = state.availableSlots
      .map((slot) => {
        const availabilityClass =
          slot.spotsRemaining <= 0
            ? 'sold-out'
            : slot.spotsRemaining <= 5
              ? 'low'
              : '';

        const availabilityText =
          slot.spotsRemaining <= 0
            ? 'Sold Out'
            : `${slot.spotsRemaining} spots left`;

        return `
        <div class="bake-slot-card ${slot.spotsRemaining <= 0 ? 'sold-out' : ''}"
             data-slot-id="${slot.id}"
             ${slot.spotsRemaining <= 0 ? '' : 'tabindex="0"'}>
          <div class="bake-slot-date">${formatDate(slot.date)}</div>
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
  document.querySelectorAll('#bake-slots .bake-slot-card').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');

  // Update state
  state.selectedSlot = state.availableSlots.find((s) => s.id === slotId) || null;

  // Load flavors for this slot
  try {
    state.availableFlavors = await sheetsApi.getFlavorsForSlot(slotId);
    state.orderItems.clear();
    renderFlavors();
    goToStep(3);
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
      const price = flavor.sizes[0]?.price || 0;

      return `
      <div class="flavor-card" data-flavor-id="${flavor.id}">
        <div class="flavor-name">${flavor.name}</div>
        <div class="flavor-price">$${price.toFixed(2)}</div>
        <div class="flavor-quantity">
          <button class="qty-btn" data-action="decrease" ${currentQty === 0 ? 'disabled' : ''}>−</button>
          <span class="qty-value">${currentQty}</span>
          <button class="qty-btn" data-action="increase">+</button>
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

function getTotalLoaves(): number {
  return Array.from(state.orderItems.values()).reduce((sum, item) => sum + item.quantity, 0);
}

function getRemainingSpots(): number {
  if (!state.selectedSlot) return 0;
  return state.selectedSlot.spotsRemaining - getTotalLoaves();
}

function updateQuantity(flavorId: string, delta: number): void {
  const flavor = state.availableFlavors.find((f) => f.id === flavorId);
  if (!flavor) return;

  const price = flavor.sizes[0]?.price || 0;
  const currentItem = state.orderItems.get(flavorId);
  const currentQty = currentItem?.quantity || 0;
  const newQty = Math.max(0, currentQty + delta);

  // Check capacity when increasing
  if (delta > 0 && getRemainingSpots() <= 0) {
    alert(`Only ${state.selectedSlot?.spotsRemaining} loaves available for this date. You've reached the limit.`);
    return;
  }

  if (newQty === 0) {
    state.orderItems.delete(flavorId);
  } else {
    state.orderItems.set(flavorId, {
      flavorId,
      flavorName: flavor.name,
      size: flavor.sizes[0]?.name || 'Regular',
      quantity: newQty,
      unitPrice: price,
      totalPrice: newQty * price,
    });
  }

  renderFlavors();
  updateOrderSummary();
}

function updateOrderSummary(): void {
  const itemsContainer = document.getElementById('order-items');
  const totalElement = document.getElementById('order-total-amount');
  const continueBtn = document.getElementById('to-step-4') as HTMLButtonElement;

  if (!itemsContainer || !totalElement || !continueBtn) return;

  const items = Array.from(state.orderItems.values());

  if (items.length === 0) {
    itemsContainer.innerHTML = '<p class="empty-order">No items selected yet</p>';
    totalElement.textContent = '$0.00';
    continueBtn.disabled = true;
    return;
  }

  const remaining = getRemainingSpots();
  const totalLoaves = getTotalLoaves();

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

  // Add capacity indicator
  const capacityIndicator = document.getElementById('capacity-indicator');
  if (capacityIndicator) {
    const isLow = remaining <= 3 && remaining > 0;
    const isAtLimit = remaining <= 0;
    capacityIndicator.innerHTML = `
      <span class="capacity-text ${isAtLimit ? 'at-limit' : isLow ? 'low' : ''}">
        ${totalLoaves} of ${state.selectedSlot?.spotsRemaining || 0} loaves
        ${isAtLimit ? '(limit reached)' : isLow ? '(almost full)' : ''}
      </span>
    `;
    capacityIndicator.style.display = 'block';
  }

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
  if (step === 5) {
    prepareConfirmation();
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep(): boolean {
  switch (state.currentStep) {
    case 1:
      if (!state.selectedLocation) {
        alert('Please select a pickup location.');
        return false;
      }
      return true;

    case 2:
      if (!state.selectedSlot) {
        alert('Please select a pickup date.');
        return false;
      }
      return true;

    case 3:
      if (state.orderItems.size === 0) {
        alert('Please add at least one item to your order.');
        return false;
      }
      return true;

    case 4:
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

  // Save to state (notification preferences not currently used)
  state.customer = {
    firstName,
    lastName,
    email,
    phone: normalizePhone(phone),
    notes,
    notificationPref: 'email',
    smsOptIn: false,
    createAccount: false,
  };

  return true;
}

function prepareConfirmation(): void {
  // Pickup details
  const pickupEl = document.getElementById('confirm-pickup');
  if (pickupEl && state.selectedSlot && state.selectedLocation) {
    pickupEl.innerHTML = `
      <strong>${formatDate(state.selectedSlot.date)}</strong><br />
      ${state.selectedLocation.name}
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

async function loadPaymentOptions(total: number, orderId: string): Promise<void> {
  try {
    const paymentData = await sheetsApi.getPaymentOptions();

    if (!paymentData.enabled || paymentData.options.length === 0) {
      return;
    }

    const paymentOptionsEl = document.getElementById('payment-options');
    const paymentTotalEl = document.getElementById('payment-total');
    const paymentLinksEl = document.getElementById('payment-links');

    if (!paymentOptionsEl || !paymentLinksEl) return;

    // Show the payment section
    paymentOptionsEl.style.display = 'block';

    // Set the total
    if (paymentTotalEl) {
      paymentTotalEl.textContent = `$${total.toFixed(2)}`;
    }

    // Build payment links
    const orderNum = orderId.split('-')[0].toUpperCase();
    paymentLinksEl.innerHTML = paymentData.options
      .map((option) => {
        const icon = getPaymentIcon(option.type);
        if (option.link) {
          // Add amount to link where supported
          let link = option.link;
          if (option.type === 'venmo') {
            link = `${option.link}?txn=pay&amount=${total.toFixed(2)}&note=Order%20${orderNum}`;
          } else if (option.type === 'paypal') {
            link = `${option.link}/${total.toFixed(2)}`;
          } else if (option.type === 'cashapp') {
            link = `${option.link}/${total.toFixed(2)}`;
          }
          return `
            <a href="${link}" target="_blank" rel="noopener" class="payment-link">
              <span class="payment-icon">${icon}</span>
              <span class="payment-label">${option.label}</span>
              <span class="payment-value">${option.value}</span>
            </a>
          `;
        } else {
          // No link (like Zelle) - just show the info
          return `
            <div class="payment-link payment-link-static">
              <span class="payment-icon">${icon}</span>
              <span class="payment-label">${option.label}</span>
              <span class="payment-value">${option.value}</span>
            </div>
          `;
        }
      })
      .join('');
  } catch (error) {
    console.error('Failed to load payment options:', error);
    // Silently fail - payment options are optional
  }
}

function getPaymentIcon(type: string): string {
  switch (type) {
    case 'venmo':
      return '💳';
    case 'cashapp':
      return '💵';
    case 'paypal':
      return '🅿️';
    case 'zelle':
      return '🏦';
    default:
      return '💰';
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
      pickupLocationId: state.selectedLocation!.id,
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
        <p>Pickup: ${formatDate(state.selectedSlot!.date)} at ${state.selectedLocation!.name}</p>
      `;
    }

    // Load and display payment options
    loadPaymentOptions(total, order.id);
  } catch (error) {
    console.error('Order submission failed:', error);
    const err = error as Error & { code?: string };
    const code = err.code || 'ORD-001';

    // User-friendly messages based on error code
    const messages: Record<string, string> = {
      'ORD-106': 'Not enough spots available for this order size. Please reduce quantity or choose a different date.',
      'ORD-SLOT_CLOSED': 'This pickup date is no longer available. Please select a different date.',
      'DATA-403': 'Please check your information and try again.',
    };

    const message = messages[code] || 'Failed to place your order. Please try again or contact us directly.';
    showError(message, code);
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
  state.selectedLocation = null;
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
  loadLocations();
}

async function checkReturningCustomer(email: string): Promise<void> {
  if (!validateEmail(email)) return;

  try {
    const history = await sheetsApi.getCustomerHistory(email);

    const historyContainer = document.getElementById('order-history');
    const customerNameEl = document.getElementById('returning-customer-name');
    const historyListEl = document.getElementById('history-list');

    if (!historyContainer || !customerNameEl || !historyListEl) return;

    if (history.found && history.customer) {
      // Pre-fill customer info
      const firstNameInput = document.getElementById('firstName') as HTMLInputElement;
      const lastNameInput = document.getElementById('lastName') as HTMLInputElement;
      const phoneInput = document.getElementById('phone') as HTMLInputElement;

      if (firstNameInput && !firstNameInput.value) {
        firstNameInput.value = history.customer.firstName;
      }
      if (lastNameInput && !lastNameInput.value) {
        lastNameInput.value = history.customer.lastName;
      }
      if (phoneInput && !phoneInput.value) {
        phoneInput.value = formatPhone(history.customer.phone);
      }

      // Show welcome message
      customerNameEl.textContent = history.customer.firstName;
      historyContainer.style.display = 'block';

      // Populate order history
      if (history.orders.length > 0) {
        historyListEl.innerHTML = history.orders
          .map((order) => {
            const itemsText = order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ');
            return `
              <div class="history-order">
                <div class="history-order-header">
                  <span class="history-order-date">${formatDate(order.date)}</span>
                  <span class="history-order-total">$${order.total.toFixed(2)}</span>
                </div>
                <div class="history-order-items">${itemsText}</div>
                <div class="history-order-location">📍 ${order.location}</div>
              </div>
            `;
          })
          .join('');
      } else {
        historyListEl.innerHTML = '<p>No previous orders found.</p>';
      }
    } else {
      historyContainer.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking customer history:', error);
    // Silently fail - not critical
  }
}

function setupEventListeners(): void {
  // Phone formatting
  const phoneInput = document.getElementById('phone') as HTMLInputElement;
  if (phoneInput) {
    phoneInput.addEventListener('blur', () => {
      if (validatePhone(phoneInput.value)) {
        phoneInput.value = formatPhone(phoneInput.value);
      }
    });
  }

  // Email lookup for returning customers
  const emailInput = document.getElementById('email') as HTMLInputElement;
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      if (emailInput.value) {
        checkReturningCustomer(emailInput.value);
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
