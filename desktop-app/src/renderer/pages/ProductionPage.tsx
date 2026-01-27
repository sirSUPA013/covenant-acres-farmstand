import { useState, useEffect } from 'react';

interface ProductionRecord {
  id: string;
  prep_sheet_id: string;
  order_id: string | null;
  flavor_id: string;
  flavor_name: string;
  quantity: number;
  status: 'pending' | 'picked_up' | 'sold' | 'wasted' | 'personal' | 'gifted';
  sale_price: number | null;
  notes: string | null;
  bake_date: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  payment_status?: string;
  payment_method?: string;
  total_amount?: number;
}

interface Flavor {
  id: string;
  name: string;
  is_active: number;
}

interface GroupedOrder {
  orderId: string;
  customerName: string;
  email: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: number;
  items: ProductionRecord[];
}

const STATUS_OPTIONS = ['pending', 'picked_up', 'sold', 'wasted', 'personal', 'gifted'] as const;
type ProductionStatus = typeof STATUS_OPTIONS[number];

const STATUS_LABELS: Record<ProductionStatus, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  sold: 'Sold',
  wasted: 'Wasted',
  personal: 'Personal',
  gifted: 'Gifted',
};

const STATUS_COLORS: Record<ProductionStatus, string> = {
  pending: '#f57c00',
  picked_up: '#2e7d32',
  sold: '#1565c0',
  wasted: '#c62828',
  personal: '#7b1fa2',
  gifted: '#00838f',
};

const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'voided'] as const;
const PAYMENT_METHODS = ['cash', 'venmo', 'cashapp', 'zelle', 'credit', 'other'] as const;

function ProductionPage() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFlavor, setFilterFlavor] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Reference data
  const [flavors, setFlavors] = useState<Flavor[]>([]);

  // Edit status modal
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null);
  const [editStatus, setEditStatus] = useState<ProductionStatus>('pending');
  const [editSalePrice, setEditSalePrice] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Split modal
  const [splittingRecord, setSplittingRecord] = useState<ProductionRecord | null>(null);
  const [splitQuantity, setSplitQuantity] = useState(1);
  const [splitStatus, setSplitStatus] = useState<ProductionStatus>('sold');

  // Payment edit modal
  const [editingPayment, setEditingPayment] = useState<GroupedOrder | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    loadData();
    loadFlavors();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, filterStatus, filterFlavor]);

  function getDateFilters() {
    const today = new Date();
    let dateFrom = '';
    const dateTo = today.toISOString().split('T')[0];

    switch (dateRange) {
      case '7days':
        dateFrom = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '30days':
        dateFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '90days':
        dateFrom = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'year':
        dateFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
      default:
        dateFrom = '';
    }

    return { dateFrom, dateTo };
  }

  async function loadData() {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDateFilters();
      const filters: Record<string, string> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (filterStatus) filters.status = filterStatus;
      if (filterFlavor) filters.flavorId = filterFlavor;

      const data = await window.api.getProduction(filters);
      setRecords(data as ProductionRecord[]);
    } catch (error) {
      console.error('Failed to load production data:', error);
    }
    setLoading(false);
  }

  async function loadFlavors() {
    try {
      const data = await window.api.getFlavors();
      setFlavors(data as Flavor[]);
    } catch (error) {
      console.error('Failed to load flavors:', error);
    }
  }

  // Group records by order (for pre-ordered) or by bake_date (for extras)
  function groupRecords(): { orders: GroupedOrder[]; extras: Map<string, ProductionRecord[]> } {
    const orderMap = new Map<string, ProductionRecord[]>();
    const extrasByDate = new Map<string, ProductionRecord[]>();

    records.forEach(record => {
      if (record.order_id) {
        const existing = orderMap.get(record.order_id) || [];
        existing.push(record);
        orderMap.set(record.order_id, existing);
      } else {
        const existing = extrasByDate.get(record.bake_date) || [];
        existing.push(record);
        extrasByDate.set(record.bake_date, existing);
      }
    });

    const orders: GroupedOrder[] = [];
    orderMap.forEach((items, orderId) => {
      const firstItem = items[0];
      orders.push({
        orderId,
        customerName: `${firstItem.first_name || ''} ${firstItem.last_name || ''}`.trim() || 'Unknown',
        email: firstItem.email || '',
        paymentStatus: firstItem.payment_status || 'pending',
        paymentMethod: firstItem.payment_method || null,
        totalAmount: firstItem.total_amount || 0,
        items,
      });
    });

    // Sort orders by customer name
    orders.sort((a, b) => a.customerName.localeCompare(b.customerName));

    return { orders, extras: extrasByDate };
  }

  function openEditModal(record: ProductionRecord) {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditSalePrice(record.sale_price || 0);
    setEditNotes(record.notes || '');
  }

  async function handleSaveEdit() {
    if (!editingRecord) return;
    try {
      await window.api.updateProduction(editingRecord.id, {
        status: editStatus,
        salePrice: editStatus === 'sold' ? editSalePrice : null,
        notes: editNotes || null,
      });
      setEditingRecord(null);
      loadData();
    } catch (error) {
      console.error('Failed to update record:', error);
      alert('Failed to update record');
    }
  }

  function openSplitModal(record: ProductionRecord) {
    if (record.quantity < 2) {
      alert('Cannot split a single loaf');
      return;
    }
    setSplittingRecord(record);
    setSplitQuantity(1);
    setSplitStatus('sold');
  }

  async function handleSplit() {
    if (!splittingRecord || splitQuantity < 1 || splitQuantity >= splittingRecord.quantity) return;
    try {
      await window.api.splitProduction(splittingRecord.id, splitQuantity, splitStatus);
      setSplittingRecord(null);
      loadData();
    } catch (error) {
      console.error('Failed to split record:', error);
      alert('Failed to split record: ' + (error as Error).message);
    }
  }

  function openPaymentModal(order: GroupedOrder) {
    setEditingPayment(order);
    setPaymentStatus(order.paymentStatus);
    setPaymentMethod(order.paymentMethod || '');
  }

  async function handleSavePayment() {
    if (!editingPayment) return;
    try {
      await window.api.updateOrderPaymentFromProduction(
        editingPayment.orderId,
        paymentStatus,
        paymentMethod || undefined
      );
      setEditingPayment(null);
      loadData();
    } catch (error) {
      console.error('Failed to update payment:', error);
      alert('Failed to update payment');
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  function getTotalLoaves(): number {
    return records.reduce((sum, r) => sum + r.quantity, 0);
  }

  function getStatusSummary(): Record<ProductionStatus, number> {
    const summary: Record<ProductionStatus, number> = {
      pending: 0,
      picked_up: 0,
      sold: 0,
      wasted: 0,
      personal: 0,
      gifted: 0,
    };
    records.forEach(r => {
      summary[r.status] += r.quantity;
    });
    return summary;
  }

  const { orders, extras } = groupRecords();
  const statusSummary = getStatusSummary();

  return (
    <div className="production-page">
      <div className="page-header">
        <h1 className="page-title">Production</h1>
        <div className="header-actions">
          <select
            className="form-select"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
              onClick={() => setViewMode('grouped')}
            >
              Grouped
            </button>
            <button
              className={`toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
              onClick={() => setViewMode('flat')}
            >
              Flat
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{getTotalLoaves()}</div>
          <div className="stat-label">Total Loaves</div>
        </div>
        {STATUS_OPTIONS.map(status => (
          <div key={status} className="stat-card">
            <div className="stat-value" style={{ color: STATUS_COLORS[status] }}>
              {statusSummary[status]}
            </div>
            <div className="stat-label">{STATUS_LABELS[status]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card filters-card">
        <div className="filters-row">
          <div className="filter-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="form-label">Flavor</label>
            <select
              className="form-select"
              value={filterFlavor}
              onChange={e => setFilterFlavor(e.target.value)}
            >
              <option value="">All Flavors</option>
              {flavors.filter(f => f.is_active).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card">
          <div className="loading">Loading production data...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>No production records yet.</p>
            <p className="empty-hint">Complete a prep sheet to create production records.</p>
          </div>
        </div>
      ) : viewMode === 'grouped' ? (
        <>
          {/* Grouped by Order */}
          {orders.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Pre-Ordered</h2>
              </div>
              <div className="order-groups">
                {orders.map(order => (
                  <div key={order.orderId} className="order-group">
                    <div className="order-group-header">
                      <div className="order-info">
                        <strong>{order.customerName}</strong>
                        <span className="order-email">{order.email}</span>
                      </div>
                      <div className="order-payment">
                        <span className={`payment-badge ${order.paymentStatus}`}>
                          {order.paymentStatus}
                        </span>
                        {order.paymentMethod && (
                          <span className="payment-method">{order.paymentMethod}</span>
                        )}
                        <span className="order-total">{formatCurrency(order.totalAmount)}</span>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openPaymentModal(order)}
                        >
                          Edit Payment
                        </button>
                      </div>
                    </div>
                    <table className="data-table nested-table">
                      <thead>
                        <tr>
                          <th>Flavor</th>
                          <th className="text-center">Qty</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map(item => (
                          <tr key={item.id}>
                            <td>{item.flavor_name}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td>
                              <select
                                className="form-select inline-select"
                                value={item.status}
                                onChange={async e => {
                                  try {
                                    await window.api.updateProduction(item.id, {
                                      status: e.target.value,
                                    });
                                    loadData();
                                  } catch (error) {
                                    console.error('Failed to update:', error);
                                  }
                                }}
                              >
                                {STATUS_OPTIONS.map(s => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </button>
                              {item.quantity > 1 && (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => openSplitModal(item)}
                                  style={{ marginLeft: '4px' }}
                                >
                                  Split
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extras by Bake Date */}
          {extras.size > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Extras (Not Pre-Ordered)</h2>
              </div>
              {Array.from(extras.entries()).map(([bakeDate, items]) => (
                <div key={bakeDate} className="extras-section">
                  <h3 className="section-date">{formatDate(bakeDate)}</h3>
                  <table className="data-table nested-table">
                    <thead>
                      <tr>
                        <th>Flavor</th>
                        <th className="text-center">Qty</th>
                        <th>Status</th>
                        <th>Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td>{item.flavor_name}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td>
                            <select
                              className="form-select inline-select"
                              value={item.status}
                              onChange={async e => {
                                try {
                                  await window.api.updateProduction(item.id, {
                                    status: e.target.value,
                                  });
                                  loadData();
                                } catch (error) {
                                  console.error('Failed to update:', error);
                                }
                              }}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {item.status === 'sold' && item.sale_price
                              ? formatCurrency(item.sale_price * item.quantity)
                              : '-'}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => openEditModal(item)}
                            >
                              Edit
                            </button>
                            {item.quantity > 1 && (
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => openSplitModal(item)}
                                style={{ marginLeft: '4px' }}
                              >
                                Split
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Flat View */
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer/Type</th>
                <th>Flavor</th>
                <th className="text-center">Qty</th>
                <th>Status</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{formatDate(record.bake_date)}</td>
                  <td>
                    {record.order_id
                      ? `${record.first_name} ${record.last_name}`
                      : <span className="extra-label">Extra</span>}
                  </td>
                  <td>{record.flavor_name}</td>
                  <td className="text-center">{record.quantity}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: `${STATUS_COLORS[record.status]}20`,
                        color: STATUS_COLORS[record.status],
                      }}
                    >
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td>
                    {record.status === 'sold' && record.sale_price
                      ? formatCurrency(record.sale_price * record.quantity)
                      : '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => openEditModal(record)}
                    >
                      Edit
                    </button>
                    {record.quantity > 1 && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openSplitModal(record)}
                        style={{ marginLeft: '4px' }}
                      >
                        Split
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingRecord && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit Production Record</h2>
              <button className="modal-close" onClick={() => setEditingRecord(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-info">
                <strong>{editingRecord.flavor_name}</strong> × {editingRecord.quantity}
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <div className="status-buttons">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`status-btn ${editStatus === s ? 'active' : ''}`}
                      style={{
                        borderColor: STATUS_COLORS[s],
                        background: editStatus === s ? STATUS_COLORS[s] : 'transparent',
                        color: editStatus === s ? '#fff' : STATUS_COLORS[s],
                      }}
                      onClick={() => setEditStatus(s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {editStatus === 'sold' && (
                <div className="form-group">
                  <label className="form-label">Sale Price (per loaf)</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      className="form-input"
                      value={editSalePrice}
                      onChange={e => setEditSalePrice(parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <p className="form-hint">
                    Total: {formatCurrency(editingRecord.quantity * editSalePrice)}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingRecord(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {splittingRecord && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Split Production Record</h2>
              <button className="modal-close" onClick={() => setSplittingRecord(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-info">
                Splitting <strong>{splittingRecord.flavor_name}</strong> ({splittingRecord.quantity} loaves)
              </div>

              <div className="form-group">
                <label className="form-label">Split off how many loaves?</label>
                <input
                  type="number"
                  className="form-input"
                  value={splitQuantity}
                  onChange={e => setSplitQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  max={splittingRecord.quantity - 1}
                />
                <p className="form-hint">
                  Will create: {splittingRecord.quantity - splitQuantity} loaves (original) + {splitQuantity} loaves (new)
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Status for split-off loaves</label>
                <select
                  className="form-select"
                  value={splitStatus}
                  onChange={e => setSplitStatus(e.target.value as ProductionStatus)}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSplittingRecord(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSplit}
                disabled={splitQuantity < 1 || splitQuantity >= splittingRecord.quantity}
              >
                Split Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Edit Modal */}
      {editingPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit Payment</h2>
              <button className="modal-close" onClick={() => setEditingPayment(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-info">
                <strong>{editingPayment.customerName}</strong>
                <br />
                Order Total: {formatCurrency(editingPayment.totalAmount)}
              </div>

              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select
                  className="form-select"
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                >
                  {PAYMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="">Not specified</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingPayment(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSavePayment}>
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .production-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .view-toggle {
          display: flex;
          border: 1px solid var(--medium-gray);
          border-radius: 6px;
          overflow: hidden;
        }
        .toggle-btn {
          padding: 8px 16px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .toggle-btn.active {
          background: var(--primary-green);
          color: white;
        }
        .toggle-btn:not(:last-child) {
          border-right: 1px solid var(--medium-gray);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
        }
        .stat-label {
          font-size: 0.75rem;
          color: var(--text-gray);
          margin-top: 4px;
        }
        .filters-card {
          margin-bottom: 16px;
        }
        .filters-row {
          display: flex;
          gap: 16px;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .filter-group .form-label {
          font-size: 0.75rem;
          color: var(--text-gray);
        }
        .order-groups {
          display: flex;
          flex-direction: column;
        }
        .order-group {
          border-bottom: 1px solid #e5e7eb;
          padding: 16px;
        }
        .order-group:last-child {
          border-bottom: none;
        }
        .order-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .order-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .order-email {
          font-size: 0.75rem;
          color: var(--text-gray);
        }
        .order-payment {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .payment-badge {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        .payment-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }
        .payment-badge.paid {
          background: #d1fae5;
          color: #065f46;
        }
        .payment-badge.refunded {
          background: #fee2e2;
          color: #991b1b;
        }
        .payment-badge.voided {
          background: #f3f4f6;
          color: #6b7280;
        }
        .payment-method {
          font-size: 0.75rem;
          color: var(--text-gray);
        }
        .order-total {
          font-weight: 600;
        }
        .nested-table {
          margin: 0;
        }
        .inline-select {
          padding: 4px 8px;
          font-size: 0.875rem;
          min-width: 120px;
        }
        .extras-section {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        .extras-section:last-child {
          border-bottom: none;
        }
        .section-date {
          font-size: 0.875rem;
          color: var(--primary-green);
          margin-bottom: 12px;
        }
        .extra-label {
          background: #f3f4f6;
          color: #6b7280;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .edit-info {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
        }
        .status-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .status-btn {
          padding: 8px 16px;
          border: 2px solid;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.15s;
        }
        .input-with-prefix {
          display: flex;
          align-items: center;
        }
        .input-prefix {
          padding: 8px 12px;
          background: var(--light-gray);
          border: 1px solid var(--medium-gray);
          border-right: none;
          border-radius: 6px 0 0 6px;
          color: var(--text-gray);
        }
        .input-with-prefix .form-input {
          border-radius: 0 6px 6px 0;
        }
        .form-hint {
          font-size: 0.8rem;
          color: var(--text-gray);
          margin-top: 4px;
        }
        .empty-hint {
          font-size: 0.875rem;
          color: var(--text-gray);
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

export default ProductionPage;
