import React, { useState, useEffect } from 'react';

interface Order {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  bake_date: string;
  location_name: string;
  items: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
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
    try {
      const updates: Record<string, string> = { payment_status: newStatus };
      if (method) updates.payment_method = method;
      await window.api.updateOrder(orderId, updates);
      loadOrders();
    } catch (error) {
      console.error('Failed to update payment:', error);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function parseItems(itemsJson: string) {
    try {
      return JSON.parse(itemsJson) as Array<{ flavorName: string; quantity: number }>;
    } catch {
      return [];
    }
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
        <button className="btn btn-primary" onClick={loadOrders}>
          Refresh
        </button>
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
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Order #{selectedOrder.id.split('-')[0].toUpperCase()}
              </h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <p>
                    {selectedOrder.first_name} {selectedOrder.last_name}
                  </p>
                  <p style={{ color: '#666' }}>{selectedOrder.email}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup</label>
                  <p>{formatDate(selectedOrder.bake_date)}</p>
                  <p style={{ color: '#666' }}>{selectedOrder.location_name}</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Items</label>
                {parseItems(selectedOrder.items).map((item, i) => (
                  <p key={i}>
                    {item.flavorName} × {item.quantity}
                  </p>
                ))}
                <p style={{ fontWeight: 600, marginTop: '8px' }}>
                  Total: ${selectedOrder.total_amount.toFixed(2)}
                </p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Order Status</label>
                  <select
                    className="form-select"
                    value={selectedOrder.status}
                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
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
                  <select
                    className="form-select"
                    value={selectedOrder.payment_status}
                    onChange={(e) => updatePaymentStatus(selectedOrder.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                    <option value="credited">Credited</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
