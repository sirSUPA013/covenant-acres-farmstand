import React, { useState, useEffect } from 'react';

interface Order {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bake_date: string;
  bake_slot_id: string;
  location_name: string;
  pickup_location_id: string;
  items: string;
  total_amount: number;
  status: string;
  payment_status: string;
  admin_notes: string;
  created_at: string;
}

interface OrderItem {
  flavorId: string;
  flavorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Flavor {
  id: string;
  name: string;
  sizes: string;
  is_active: number;
}

interface BakeSlot {
  id: string;
  date: string;
  total_capacity: number;
  current_orders: number;
  locations: Array<{ id: string; name: string }>;
  location_name: string;
}

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPayment, setBulkPayment] = useState('');
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('');
  const [requirePaymentMethod, setRequirePaymentMethod] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editBakeSlotId, setEditBakeSlotId] = useState('');
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [saving, setSaving] = useState(false);

  // Payment method state for modal
  const [pendingPaymentStatus, setPendingPaymentStatus] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  useEffect(() => {
    loadOrders();
    loadSettings();

    // Listen for new orders
    const unsubscribe = window.api.onNewOrder(() => {
      loadOrders();
    });

    return unsubscribe;
  }, [statusFilter]);

  async function loadSettings() {
    try {
      const settings = await window.api.getSettings();
      setRequirePaymentMethod(settings.requirePaymentMethod || false);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function loadOrders() {
    setLoading(true);
    try {
      const filters = statusFilter ? { status: statusFilter } : {};
      const data = await window.api.getOrders(filters);
      setOrders(data as Order[]);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
    setLoading(false);
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      await window.api.updateOrder(orderId, { status: newStatus });
      loadOrders();
      setSelectedOrder(null);
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  }

  async function updatePaymentStatus(orderId: string, newStatus: string, method?: string) {
    // If changing to "paid" and payment method is required, show the method selector first
    if (newStatus === 'paid' && requirePaymentMethod && !method) {
      setPendingPaymentStatus('paid');
      return;
    }

    try {
      const updates: Record<string, string> = { payment_status: newStatus };
      if (method) updates.payment_method = method;
      await window.api.updateOrder(orderId, updates);
      loadOrders();
      // Reset pending state
      setPendingPaymentStatus('');
      setSelectedPaymentMethod('');
    } catch (error) {
      console.error('Failed to update payment:', error);
    }
  }

  function confirmPaymentWithMethod() {
    if (!selectedOrder || !selectedPaymentMethod) return;
    updatePaymentStatus(selectedOrder.id, 'paid', selectedPaymentMethod);
  }

  function cancelPaymentChange() {
    setPendingPaymentStatus('');
    setSelectedPaymentMethod('');
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function parseItems(itemsJson: string): OrderItem[] {
    try {
      return JSON.parse(itemsJson) as OrderItem[];
    } catch {
      return [];
    }
  }

  async function startEditing(order: Order) {
    setIsEditing(true);
    setEditItems(parseItems(order.items));
    setEditNotes(order.admin_notes || '');
    setEditBakeSlotId(order.bake_slot_id);

    // Load flavors and bake slots for editing
    try {
      const [flavorsData, slotsData] = await Promise.all([
        window.api.getFlavors(),
        window.api.getBakeSlots({ upcoming: true }),
      ]);
      setFlavors(flavorsData as Flavor[]);
      setBakeSlots(slotsData as BakeSlot[]);
    } catch (error) {
      console.error('Failed to load edit data:', error);
    }
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditItems([]);
    setEditNotes('');
    setEditBakeSlotId('');
  }

  function updateItemQuantity(index: number, delta: number) {
    setEditItems((prev) => {
      const updated = [...prev];
      const newQty = Math.max(0, updated[index].quantity + delta);
      if (newQty === 0) {
        // Remove item if quantity is 0
        updated.splice(index, 1);
      } else {
        updated[index] = {
          ...updated[index],
          quantity: newQty,
          totalPrice: newQty * updated[index].unitPrice,
        };
      }
      return updated;
    });
  }

  function addItemToOrder(flavorId: string) {
    const flavor = flavors.find((f) => f.id === flavorId);
    if (!flavor) return;

    const sizes = JSON.parse(flavor.sizes || '[]') as Array<{ name: string; price: number }>;
    const defaultSize = sizes[0] || { name: 'Regular', price: 10 };

    // Check if flavor already exists in order
    const existingIndex = editItems.findIndex((item) => item.flavorId === flavorId);
    if (existingIndex >= 0) {
      updateItemQuantity(existingIndex, 1);
      return;
    }

    setEditItems((prev) => [
      ...prev,
      {
        flavorId: flavor.id,
        flavorName: flavor.name,
        size: defaultSize.name,
        quantity: 1,
        unitPrice: defaultSize.price,
        totalPrice: defaultSize.price,
      },
    ]);
  }

  function calculateEditTotal(): number {
    return editItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  async function saveOrderChanges() {
    if (!selectedOrder) return;
    if (editItems.length === 0) {
      alert('Order must have at least one item');
      return;
    }

    setSaving(true);
    try {
      const newTotal = calculateEditTotal();
      const updates: Record<string, unknown> = {
        items: JSON.stringify(editItems),
        total_amount: newTotal,
        admin_notes: editNotes,
      };

      // If bake slot changed, update it
      if (editBakeSlotId !== selectedOrder.bake_slot_id) {
        updates.bake_slot_id = editBakeSlotId;
      }

      await window.api.updateOrder(selectedOrder.id, updates);
      await loadOrders();
      setIsEditing(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Failed to save order:', error);
      alert('Failed to save changes');
    }
    setSaving(false);
  }

  function exportToCSV() {
    if (orders.length === 0) {
      alert('No orders to export');
      return;
    }

    // Build CSV content
    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Email',
      'Phone',
      'Pickup Date',
      'Location',
      'Items',
      'Total',
      'Status',
      'Payment Status',
      'Notes',
    ];

    const rows = orders.map((order) => {
      const items = parseItems(order.items)
        .map((i) => `${i.flavorName} x${i.quantity}`)
        .join('; ');

      return [
        order.id.split('-')[0].toUpperCase(),
        new Date(order.created_at).toLocaleDateString(),
        `${order.first_name} ${order.last_name}`,
        order.email,
        order.phone || '',
        formatDate(order.bake_date),
        order.location_name,
        items,
        `$${order.total_amount.toFixed(2)}`,
        order.status,
        order.payment_status,
        (order.admin_notes || '').replace(/"/g, '""'),
      ];
    });

    // Escape values and build CSV string
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    // Download the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toggleSelection(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkStatus('');
    setBulkPayment('');
    setBulkPaymentMethod('');
  }

  async function applyBulkUpdate() {
    if (selectedIds.size === 0) return;

    // Validate payment method requirement
    if (requirePaymentMethod && bulkPayment === 'paid' && !bulkPaymentMethod) {
      alert('Please select a payment method when marking orders as paid.');
      return;
    }

    const updates: Record<string, string> = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkPayment) updates.payment_status = bulkPayment;
    if (bulkPaymentMethod) updates.payment_method = bulkPaymentMethod;

    if (Object.keys(updates).length === 0) return;

    try {
      await window.api.bulkUpdateOrders(Array.from(selectedIds), updates);
      loadOrders();
      clearSelection();
    } catch (error) {
      console.error('Bulk update failed:', error);
    }
  }

  const statusOptions = [
    { value: '', label: 'All Orders' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'cutoff_passed', label: 'Cutoff Passed' },
    { value: 'in_production', label: 'In Production' },
    { value: 'ready', label: 'Ready' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'no_show', label: 'No Show' },
  ];

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={exportToCSV}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={loadOrders}>
            Refresh
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label className="filter-label">Status:</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.size} order{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="bulk-actions">
            <select
              className="form-select bulk-select"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
            >
              <option value="">Set Status...</option>
              {statusOptions.slice(1).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="form-select bulk-select"
              value={bulkPayment}
              onChange={(e) => {
                setBulkPayment(e.target.value);
                if (e.target.value !== 'paid') setBulkPaymentMethod('');
              }}
            >
              <option value="">Set Payment...</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
              <option value="credited">Credited</option>
              <option value="void">Void</option>
            </select>
            {bulkPayment === 'paid' && (
              <select
                className="form-select bulk-select"
                value={bulkPaymentMethod}
                onChange={(e) => setBulkPaymentMethod(e.target.value)}
              >
                <option value="">Payment Method{requirePaymentMethod ? '*' : ''}...</option>
                <option value="cash">Cash</option>
                <option value="venmo">Venmo</option>
                <option value="paypal">PayPal</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={applyBulkUpdate}
              disabled={!bulkStatus && !bulkPayment}
            >
              Apply
            </button>
            <button className="btn btn-secondary" onClick={clearSelection}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No orders found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Order #</th>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={selectedIds.has(order.id) ? 'selected-row' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleSelection(order.id)}
                    />
                  </td>
                  <td>{order.id.split('-')[0].toUpperCase()}</td>
                  <td>
                    {order.first_name} {order.last_name}
                    <br />
                    <small style={{ color: '#666' }}>{order.email}</small>
                  </td>
                  <td>
                    {formatDate(order.bake_date)}
                    <br />
                    <small style={{ color: '#666' }}>{order.location_name}</small>
                  </td>
                  <td>
                    {parseItems(order.items).map((item, i) => (
                      <div key={i}>
                        {item.flavorName} × {item.quantity}
                      </div>
                    ))}
                  </td>
                  <td>${order.total_amount.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${order.payment_status}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setSelectedOrder(order)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => { if (!isEditing) { setSelectedOrder(null); cancelPaymentChange(); } }}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Order #{selectedOrder.id.split('-')[0].toUpperCase()}
                {isEditing && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(Editing)</span>}
              </h2>
              <button className="modal-close" onClick={() => { cancelEditing(); cancelPaymentChange(); setSelectedOrder(null); }}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* Customer Info - Read Only */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <p>
                    {selectedOrder.first_name} {selectedOrder.last_name}
                  </p>
                  <p style={{ color: '#666' }}>{selectedOrder.email}</p>
                  {selectedOrder.phone && <p style={{ color: '#666' }}>{selectedOrder.phone}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup</label>
                  {isEditing ? (
                    <select
                      className="form-select"
                      value={editBakeSlotId}
                      onChange={(e) => setEditBakeSlotId(e.target.value)}
                    >
                      {bakeSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {formatDate(slot.date)} - {slot.location_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <p>{formatDate(selectedOrder.bake_date)}</p>
                      <p style={{ color: '#666' }}>{selectedOrder.location_name}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="form-group">
                <label className="form-label">Items</label>
                {isEditing ? (
                  <div className="edit-items-section">
                    {editItems.map((item, i) => (
                      <div key={i} className="edit-item-row">
                        <span className="item-name">{item.flavorName}</span>
                        <div className="quantity-controls">
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => updateItemQuantity(i, -1)}
                          >
                            −
                          </button>
                          <span className="quantity-value">{item.quantity}</span>
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => updateItemQuantity(i, 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="item-price">${item.totalPrice.toFixed(2)}</span>
                      </div>
                    ))}

                    {/* Add Item Dropdown */}
                    <div className="add-item-row">
                      <select
                        className="form-select"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addItemToOrder(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">+ Add item...</option>
                        {flavors
                          .filter((f) => f.is_active)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="edit-total">
                      <strong>New Total: ${calculateEditTotal().toFixed(2)}</strong>
                      {calculateEditTotal() !== selectedOrder.total_amount && (
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          (was ${selectedOrder.total_amount.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {parseItems(selectedOrder.items).map((item, i) => (
                      <p key={i}>
                        {item.flavorName} × {item.quantity}
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          ${item.totalPrice?.toFixed(2) || (item.quantity * (item.unitPrice || 0)).toFixed(2)}
                        </span>
                      </p>
                    ))}
                    <p style={{ fontWeight: 600, marginTop: '8px' }}>
                      Total: ${selectedOrder.total_amount.toFixed(2)}
                    </p>
                  </>
                )}
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes</label>
                {isEditing ? (
                  <textarea
                    className="form-textarea"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Order notes..."
                  />
                ) : (
                  <p style={{ color: selectedOrder.notes ? '#333' : '#999' }}>
                    {selectedOrder.notes || 'No notes'}
                  </p>
                )}
              </div>

              {/* Status Controls */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Order Status</label>
                  <select
                    className="form-select"
                    value={selectedOrder.status}
                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                    disabled={isEditing}
                  >
                    {statusOptions.slice(1).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  {pendingPaymentStatus === 'paid' ? (
                    <div className="payment-method-prompt">
                      <p style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Select payment method:</p>
                      <select
                        className="form-select"
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        autoFocus
                      >
                        <option value="">Choose method...</option>
                        <option value="cash">Cash</option>
                        <option value="venmo">Venmo</option>
                        <option value="cashapp">Cash App</option>
                        <option value="zelle">Zelle</option>
                        <option value="paypal">PayPal</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={confirmPaymentWithMethod}
                          disabled={!selectedPaymentMethod}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={cancelPaymentChange}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={selectedOrder.payment_status}
                      onChange={(e) => updatePaymentStatus(selectedOrder.id, e.target.value)}
                      disabled={isEditing}
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                      <option value="credited">Credited</option>
                      <option value="void">Void</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {isEditing ? (
                <>
                  <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={saveOrderChanges} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => { cancelPaymentChange(); setSelectedOrder(null); }}>
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={() => startEditing(selectedOrder)}>
                    Edit Order
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
