import React, { useState, useEffect } from 'react';

interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  topFlavors: Array<{ name: string; quantity: number; revenue: number }>;
  revenueByPaymentMethod: Record<string, number>;
  ordersByStatus: Record<string, number>;
}

interface DateRange {
  label: string;
  startDate: Date;
  endDate: Date;
}

function AnalyticsPage() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30days');

  const dateRanges: Record<string, DateRange> = {
    '7days': {
      label: 'Last 7 Days',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
    '30days': {
      label: 'Last 30 Days',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
    '90days': {
      label: 'Last 90 Days',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
    year: {
      label: 'This Year',
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(),
    },
    all: {
      label: 'All Time',
      startDate: new Date(2020, 0, 1),
      endDate: new Date(),
    },
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const range = dateRanges[dateRange];
      const data = await window.api.getAnalytics({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      });
      setSummary(data as SalesSummary);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
    setLoading(false);
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function formatPaymentMethod(method: string): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      venmo: 'Venmo',
      cashapp: 'Cash App',
      zelle: 'Zelle',
      credit: 'Store Credit',
    };
    return labels[method] || method;
  }

  function formatStatus(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <select
          className="form-select"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{ width: '180px' }}
        >
          {Object.entries(dateRanges).map(([key, range]) => (
            <option key={key} value={key}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading">Loading analytics...</div>
        </div>
      ) : !summary ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <p>No data available for this period</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{summary.totalOrders}</div>
              <div className="stat-label">Total Orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatCurrency(summary.totalRevenue)}</div>
              <div className="stat-label">Total Revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatCurrency(summary.averageOrderValue)}</div>
              <div className="stat-label">Avg Order Value</div>
            </div>
          </div>

          <div className="analytics-grid">
            {/* Top Flavors */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Top Flavors</h2>
              </div>
              {summary.topFlavors.length === 0 ? (
                <p className="text-gray">No sales data yet</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Flavor</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topFlavors.map((flavor, i) => (
                      <tr key={i}>
                        <td>
                          <span className="rank-badge">{i + 1}</span>
                          {flavor.name}
                        </td>
                        <td className="text-right">{flavor.quantity}</td>
                        <td className="text-right">{formatCurrency(flavor.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Revenue by Payment Method */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Revenue by Payment Method</h2>
              </div>
              {Object.keys(summary.revenueByPaymentMethod).length === 0 ? (
                <p className="text-gray">No payment data yet</p>
              ) : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.revenueByPaymentMethod)
                        .sort((a, b) => b[1] - a[1])
                        .map(([method, amount]) => (
                          <tr key={method}>
                            <td>{formatPaymentMethod(method)}</td>
                            <td className="text-right">{formatCurrency(amount)}</td>
                            <td className="text-right">
                              {((amount / summary.totalRevenue) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="payment-bars mt-lg">
                    {Object.entries(summary.revenueByPaymentMethod)
                      .sort((a, b) => b[1] - a[1])
                      .map(([method, amount]) => (
                        <div key={method} className="payment-bar-row">
                          <div className="payment-bar-label">{formatPaymentMethod(method)}</div>
                          <div className="payment-bar-track">
                            <div
                              className="payment-bar-fill"
                              style={{
                                width: `${(amount / summary.totalRevenue) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Orders by Status */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Orders by Status</h2>
              </div>
              {Object.keys(summary.ordersByStatus).length === 0 ? (
                <p className="text-gray">No order data yet</p>
              ) : (
                <div className="status-breakdown">
                  {Object.entries(summary.ordersByStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="status-row">
                        <span className={`status-badge status-${status}`}>
                          {formatStatus(status)}
                        </span>
                        <span className="status-count">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: var(--white);
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-value {
          font-family: var(--font-heading);
          font-size: 2rem;
          color: var(--primary-green);
          margin-bottom: 8px;
        }
        .stat-label {
          color: var(--text-gray);
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 16px;
        }
        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: var(--primary-green);
          color: white;
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: 600;
          margin-right: 8px;
        }
        .text-gray {
          color: var(--text-gray);
          padding: 16px 0;
        }
        .payment-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .payment-bar-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .payment-bar-label {
          width: 80px;
          font-size: 0.875rem;
          color: var(--text-gray);
        }
        .payment-bar-track {
          flex: 1;
          height: 8px;
          background: var(--light-gray);
          border-radius: 4px;
          overflow: hidden;
        }
        .payment-bar-fill {
          height: 100%;
          background: var(--primary-green);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .status-breakdown {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .status-count {
          font-weight: 600;
          color: var(--dark-gray);
        }
      `}</style>
    </div>
  );
}

export default AnalyticsPage;
