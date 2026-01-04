import React, { useState, useEffect } from 'react';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  credit_balance: number;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [search]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const filters = search ? { search } : {};
      const data = await window.api.getCustomers(filters);
      setCustomers(data as Customer[]);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
    setLoading(false);
  }

  async function issueCredit() {
    if (!selectedCustomer || !creditAmount) return;

    try {
      await window.api.issueCredit(
        selectedCustomer.id,
        parseFloat(creditAmount),
        creditReason
      );
      loadCustomers();
      setCreditAmount('');
      setCreditReason('');
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Failed to issue credit:', error);
    }
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
                  <td>{customer.total_orders}</td>
                  <td>${customer.total_spent.toFixed(2)}</td>
                  <td>
                    {customer.credit_balance > 0 && (
                      <span style={{ color: 'green', fontWeight: 600 }}>
                        ${customer.credit_balance.toFixed(2)}
                      </span>
                    )}
                    {customer.credit_balance === 0 && '-'}
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

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </h2>
              <button className="modal-close" onClick={() => setSelectedCustomer(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <p>{selectedCustomer.email}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <p>{selectedCustomer.phone}</p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Orders</label>
                  <p>{selectedCustomer.total_orders}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Spent</label>
                  <p>${selectedCustomer.total_spent.toFixed(2)}</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Credit Balance: ${selectedCustomer.credit_balance.toFixed(2)}
                </label>
              </div>

              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

              <h3 style={{ marginBottom: '16px' }}>Issue Credit</h3>
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
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g., Order issue, sorry bonus"
                  />
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
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
