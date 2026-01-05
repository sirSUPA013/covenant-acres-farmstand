/**
 * Demo Order Form Application
 * Standalone demonstration version - no backend required
 */

// State
const state = {
  currentStep: 1,
  selectedLocation: null,
  selectedSlot: null,
  order: {},
  customer: {},
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderLocations();
});

// Navigation
function goToStep(step) {
  // Validate before moving forward
  if (step > state.currentStep) {
    if (!validateStep(state.currentStep)) return;
  }

  // Hide all steps
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active', 'completed'));

  // Show target step
  document.getElementById(`step-${step}`).classList.add('active');

  // Update step indicators
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.querySelector(`.step[data-step="${i}"]`);
    if (i < step) stepEl.classList.add('completed');
    if (i === step) stepEl.classList.add('active');
  }

  state.currentStep = step;

  // Load step content
  if (step === 2) renderBakeSlots();
  if (step === 3) renderFlavors();
  if (step === 5) renderConfirmation();
}

function validateStep(step) {
  if (step === 1) return !!state.selectedLocation;
  if (step === 2) return !!state.selectedSlot;
  if (step === 3) return Object.keys(state.order).length > 0;
  if (step === 4) {
    const form = document.getElementById('customer-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    state.customer = {
      email: document.getElementById('email').value,
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      phone: document.getElementById('phone').value,
      notes: document.getElementById('notes').value,
    };
    return true;
  }
  return true;
}

// Step 1: Locations
function renderLocations() {
  const container = document.getElementById('locations');
  container.innerHTML = DEMO_LOCATIONS.map(loc => `
    <div class="bake-slot-card" onclick="selectLocation('${loc.id}')">
      <div class="slot-date">${loc.name}</div>
      <div class="slot-location">${loc.address}</div>
    </div>
  `).join('');
}

function selectLocation(locationId) {
  state.selectedLocation = DEMO_LOCATIONS.find(l => l.id === locationId);
  document.getElementById('selected-location-name').textContent = state.selectedLocation.name;

  // Highlight selected
  document.querySelectorAll('#locations .bake-slot-card').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  // Auto-advance after brief delay
  setTimeout(() => goToStep(2), 300);
}

// Step 2: Bake Slots
function renderBakeSlots() {
  const container = document.getElementById('bake-slots');

  // Filter slots for selected location
  const availableSlots = DEMO_BAKE_SLOTS.filter(slot =>
    slot.locationIds.includes(state.selectedLocation.id) && slot.isOpen
  );

  if (availableSlots.length === 0) {
    container.innerHTML = '<p class="empty-message">No available dates for this location.</p>';
    return;
  }

  container.innerHTML = availableSlots.map(slot => {
    const date = new Date(slot.date);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return `
      <div class="bake-slot-card ${slot.spotsRemaining < 5 ? 'low-spots' : ''}"
           onclick="selectSlot('${slot.id}')">
        <div class="slot-date">${dateStr}</div>
        <div class="slot-spots">${slot.spotsRemaining} spots remaining</div>
      </div>
    `;
  }).join('');
}

function selectSlot(slotId) {
  state.selectedSlot = DEMO_BAKE_SLOTS.find(s => s.id === slotId);

  // Highlight selected
  document.querySelectorAll('#bake-slots .bake-slot-card').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  // Auto-advance
  setTimeout(() => goToStep(3), 300);
}

// Step 3: Flavors
function renderFlavors() {
  const container = document.getElementById('flavors');
  container.innerHTML = DEMO_FLAVORS.map(flavor => {
    const price = flavor.sizes[0].price;
    const qty = state.order[flavor.id]?.quantity || 0;

    return `
      <div class="flavor-card">
        <div class="flavor-info">
          <h3 class="flavor-name">${flavor.name}</h3>
          <p class="flavor-description">${flavor.description}</p>
          <p class="flavor-price">$${price.toFixed(2)}</p>
        </div>
        <div class="flavor-controls">
          <button class="qty-btn" onclick="updateQuantity('${flavor.id}', -1)" ${qty === 0 ? 'disabled' : ''}>−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" onclick="updateQuantity('${flavor.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  updateOrderSummary();
}

function updateQuantity(flavorId, delta) {
  const flavor = DEMO_FLAVORS.find(f => f.id === flavorId);
  const current = state.order[flavorId]?.quantity || 0;
  const newQty = Math.max(0, current + delta);

  if (newQty === 0) {
    delete state.order[flavorId];
  } else {
    state.order[flavorId] = {
      flavorId,
      flavorName: flavor.name,
      size: flavor.sizes[0].name,
      quantity: newQty,
      unitPrice: flavor.sizes[0].price,
      totalPrice: newQty * flavor.sizes[0].price,
    };
  }

  renderFlavors();
}

function updateOrderSummary() {
  const itemsContainer = document.getElementById('order-items');
  const totalEl = document.getElementById('order-total-amount');
  const continueBtn = document.getElementById('to-step-4');

  const items = Object.values(state.order);

  if (items.length === 0) {
    itemsContainer.innerHTML = '<p class="empty-order">No items selected</p>';
    totalEl.textContent = '$0.00';
    continueBtn.disabled = true;
    return;
  }

  itemsContainer.innerHTML = items.map(item => `
    <div class="order-item">
      <span>${item.flavorName} × ${item.quantity}</span>
      <span>$${item.totalPrice.toFixed(2)}</span>
    </div>
  `).join('');

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  totalEl.textContent = `$${total.toFixed(2)}`;
  continueBtn.disabled = false;
}

// Step 5: Confirmation
function renderConfirmation() {
  // Pickup details
  const date = new Date(state.selectedSlot.date);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  document.getElementById('confirm-pickup').innerHTML = `
    <strong>${dateStr}</strong><br>
    ${state.selectedLocation.name}<br>
    <span style="color: #666">${state.selectedLocation.address}</span>
  `;

  // Order items
  const items = Object.values(state.order);
  document.getElementById('confirm-items').innerHTML = items.map(item => `
    <div class="order-item">
      <span>${item.flavorName} × ${item.quantity}</span>
      <span>$${item.totalPrice.toFixed(2)}</span>
    </div>
  `).join('');

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  document.getElementById('confirm-total').textContent = `$${total.toFixed(2)}`;

  // Customer info
  document.getElementById('confirm-customer').innerHTML = `
    <strong>${state.customer.firstName} ${state.customer.lastName}</strong><br>
    ${state.customer.email}<br>
    ${state.customer.phone}
    ${state.customer.notes ? `<br><em>Notes: ${state.customer.notes}</em>` : ''}
  `;
}

// Submit Order (Demo)
function submitOrder() {
  const btn = document.getElementById('submit-order');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  // Simulate API call
  setTimeout(() => {
    // Generate fake order ID
    const orderId = 'DEMO-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Show success
    const date = new Date(state.selectedSlot.date);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const items = Object.values(state.order);
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

    document.getElementById('success-details').innerHTML = `
      <div class="success-details">
        <p><strong>Order #:</strong> ${orderId}</p>
        <p><strong>Pickup:</strong> ${dateStr}</p>
        <p><strong>Location:</strong> ${state.selectedLocation.name}</p>
        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
      </div>
    `;

    // Hide all steps and show success
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step').forEach(el => el.classList.add('completed'));
    document.getElementById('step-success').classList.add('active');

    btn.disabled = false;
    btn.textContent = 'Place Order (Demo)';
  }, 1500);
}

// Start New Order
function startNewOrder() {
  state.currentStep = 1;
  state.selectedLocation = null;
  state.selectedSlot = null;
  state.order = {};
  state.customer = {};

  // Reset form
  document.getElementById('customer-form').reset();

  // Reset step indicators
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active', 'completed'));
  document.querySelector('.step[data-step="1"]').classList.add('active');

  // Show step 1
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');

  renderLocations();
}
