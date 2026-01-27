import { useState, useEffect, Component, ReactNode } from 'react';

// Error boundary to catch rendering errors
class CustomerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'red' }}>
          <h2>Something went wrong loading Customers</h2>
          <pre style={{ background: '#f5f5f5', padding: '20px', overflow: 'auto' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  credit_balance: number;
  total_orders: number;
  total_spent: number;
  first_order_date: string | null;
  created_at: string;
}

interface Order {
  id: string;
  items: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  bake_date: string | null;
  location_name: string | null;
  created_at: string;
}

interface CreditEntry {
  id: number;
  issued_by: string;
  details: string;
  created_at: string;
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditError, setCreditError] = useState('');
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [search]);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerHistory(selectedCustomer.id);
    } else {
      setOrderHistory([]);
      setCreditHistory([]);
    }
  }, [selectedCustomer]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const filters = search ? { search } : {};
      const data = await window.api.getCustomers(filters);
      if (!Array.isArray(data)) {
        setCustomers([]);
      } else {
        setCustomers(data as Customer[]);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
      setCustomers([]);
    }
    setLoading(false);
  }

  async function loadCustomerHistory(customerId: string) {
    setLoadingHistory(true);
    try {
      const [orders, credits] = await Promise.all([
        window.api.getCustomerOrders(customerId),
        window.api.getCustomerCreditHistory(customerId)
      ]);
      setOrderHistory(orders as Order[]);
      setCreditHistory(credits as CreditEntry[]);
    } catch (error) {
      console.error('Failed to load customer history:', error);
      setOrderHistory([]);
      setCreditHistory([]);
    }
    setLoadingHistory(false);
  }

  async function issueCredit() {
    if (!selectedCustomer || !creditAmount) return;

    // Validate reason
    if (!creditReason || creditReason.trim().length < 3) {
      setCreditError('Reason is required (minimum 3 characters)');
      return;
    }

    setCreditError('');

    try {
      await window.api.issueCredit(
        selectedCustomer.id,
        parseFloat(creditAmount),
        creditReason
      );
      // Refresh data
      loadCustomers();
      loadCustomerHistory(selectedCustomer.id);
      // Update the selected customer's credit balance locally
      setSelectedCustomer({
        ...selectedCustomer,
        credit_balance: Number(selectedCustomer.credit_balance || 0) + parseFloat(creditAmount)
      });
      setCreditAmount('');
      setCreditReason('');
    } catch (error) {
      console.error('Failed to issue credit:', error);
      setCreditError(error instanceof Error ? error.message : 'Failed to issue credit');
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  }

  function parseOrderItems(itemsJson: string): string {
    try {
      const items = JSON.parse(itemsJson);
      if (Array.isArray(items)) {
        return items.map((item: { name?: string; quantity?: number }) =>
          `${item.quantity || 1}x ${item.name || 'Unknown'}`
        ).join(', ');
      }
      return itemsJson;
    } catch {
      return itemsJson;
    }
  }

  function parseCreditDetails(detailsJson: string): { amount: number; reason: string } {
    try {
      return JSON.parse(detailsJson);
    } catch {
      return { amount: 0, reason: detailsJson };
    }
  }

  function closeModal() {
    setSelectedCustomer(null);
    setCreditAmount('');
    setCreditReason('');
    setCreditError('');
  }

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
      </div>

      <div className="filters">
        <div className="filter-group">
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '300px' }}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No customers found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Credit Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    {customer.first_name} {customer.last_name}
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.total_orders || 0}</td>
                  <td>${Number(customer.total_spent || 0).toFixed(2)}</td>
                  <td>
                    {Number(customer.credit_balance || 0) > 0 && (
                      <span style={{ color: 'green', fontWeight: 600 }}>
                        ${Number(customer.credit_balance || 0).toFixed(2)}
                      </span>
                    )}
                    {(!customer.credit_balance || Number(customer.credit_balance) === 0) && '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setSelectedCustomer(customer)}
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

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* Contact Info */}
              <div className="card" style={{ marginBottom: '20px', padding: '16px', background: '#f9f9f9' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: '#666' }}>Contact Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <p style={{ margin: 0 }}>{selectedCustomer.email}</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <p style={{ margin: 0 }}>{selectedCustomer.phone}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="card" style={{ marginBottom: '20px', padding: '16px', background: '#f9f9f9' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: '#666' }}>Customer Stats</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>First Order</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {selectedCustomer.first_order_date ? formatDate(selectedCustomer.first_order_date) :
                        (orderHistory.length > 0 ? formatDate(orderHistory[orderHistory.length - 1]?.created_at) : 'No orders')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Orders</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedCustomer.total_orders || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Spent</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>${Number(selectedCustomer.total_spent || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Credit Balance</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: Number(selectedCustomer.credit_balance || 0) > 0 ? 'green' : 'inherit' }}>
                      ${Number(selectedCustomer.credit_balance || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order History */}
              <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: '#666' }}>Order History</h3>
                {loadingHistory ? (
                  <p>Loading...</p>
                ) : orderHistory.length === 0 ? (
                  <p style={{ color: '#999', fontStyle: 'italic' }}>No orders yet</p>
                ) : (
                  <table className="data-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderHistory.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div>{formatDate(order.bake_date || order.created_at)}</div>
                            {order.location_name && <div style={{ fontSize: '11px', color: '#666' }}>{order.location_name}</div>}
                          </td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {parseOrderItems(order.items)}
                          </td>
                          <td>${Number(order.total_amount || 0).toFixed(2)}</td>
                          <td>
                            <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${order.payment_status?.toLowerCase()}`}>
                              {order.payment_status}
                            </span>
                            {order.payment_method && <div style={{ fontSize: '11px', color: '#666' }}>{order.payment_method}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Credit History */}
              <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: '#666' }}>Credit History</h3>
                {loadingHistory ? (
                  <p>Loading...</p>
                ) : creditHistory.length === 0 ? (
                  <p style={{ color: '#999', fontStyle: 'italic' }}>No credits issued</p>
                ) : (
                  <table className="data-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Reason</th>
                        <th>Issued By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditHistory.map((credit) => {
                        const details = parseCreditDetails(credit.details);
                        return (
                          <tr key={credit.id}>
                            <td>{formatDateTime(credit.created_at)}</td>
                            <td style={{ color: 'green', fontWeight: 600 }}>
                              +${Number(details.amount || 0).toFixed(2)}
                            </td>
                            <td>{details.reason || '-'}</td>
                            <td>{credit.issued_by || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Issue Credit Form */}
              <div className="card" style={{ padding: '16px', background: '#f0f7f0', border: '1px solid #c8e6c9' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', color: '#666' }}>Issue Credit</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">
                      Reason <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-input ${creditError ? 'input-error' : ''}`}
                      value={creditReason}
                      onChange={(e) => {
                        setCreditReason(e.target.value);
                        if (creditError) setCreditError('');
                      }}
                      placeholder="e.g., Order issue, sorry bonus (required)"
                    />
                    {creditError && (
                      <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                        {creditError}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={issueCredit}
                  disabled={!creditAmount}
                >
                  Issue Credit
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomersPageWithErrorBoundary() {
  return (
    <CustomerErrorBoundary>
      <CustomersPage />
    </CustomerErrorBoundary>
  );
}

export default CustomersPageWithErrorBoundary;
