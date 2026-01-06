import React, { useState, useEffect } from 'react';

interface ExtraProduction {
  id: string;
  bake_slot_id: string | null;
  production_date: string;
  flavor_id: string;
  flavor_name: string;
  quantity: number;
  disposition: 'sold' | 'gifted' | 'wasted' | 'personal' | 'pending';
  sale_price: number | null;
  total_revenue: number | null;
  notes: string | null;
  created_at: string;
  bake_date: string | null;
  location_name: string | null;
}

interface Flavor {
  id: string;
  name: string;
  is_active: number;
}

interface BakeSlot {
  id: string;
  date: string;
  location_name: string;
}

interface ProductionAnalytics {
  sold: { count: number; loaves: number; revenue: number };
  gifted: { count: number; loaves: number; cost: number };
  wasted: { count: number; loaves: number; cost: number };
  personal: { count: number; loaves: number };
  pending: { count: number; loaves: number };
}

const DISPOSITIONS = ['sold', 'pending', 'gifted', 'wasted', 'personal'] as const;
type Disposition = typeof DISPOSITIONS[number];

const DISPOSITION_LABELS: Record<Disposition, string> = {
  sold: 'Sold',
  pending: 'Pending',
  gifted: 'Gifted',
  wasted: 'Wasted',
  personal: 'Personal',
};

const DISPOSITION_COLORS: Record<Disposition, string> = {
  sold: '#2e7d32',
  pending: '#f57c00', // Orange for pending/unsold
  gifted: '#1565c0',
  wasted: '#c62828',
  personal: '#7b1fa2',
};

function ProductionPage() {
  const [entries, setEntries] = useState<ExtraProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ProductionAnalytics | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [filterFlavor, setFilterFlavor] = useState('');
  const [filterDisposition, setFilterDisposition] = useState('');

  // Reference data
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExtraProduction | null>(null);

  // Form state
  const [formLinkType, setFormLinkType] = useState<'slot' | 'date'>('date');
  const [formBakeSlotId, setFormBakeSlotId] = useState('');
  const [formProductionDate, setFormProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFlavorId, setFormFlavorId] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formDisposition, setFormDisposition] = useState<Disposition>('sold');
  const [formSalePrice, setFormSalePrice] = useState(0);
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    loadData();
    loadFlavors();
    loadBakeSlots();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, filterFlavor, filterDisposition]);

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
      if (filterFlavor) filters.flavorId = filterFlavor;
      if (filterDisposition) filters.disposition = filterDisposition;

      const [entriesData, analyticsData] = await Promise.all([
        window.api.getExtraProduction(filters),
        window.api.getExtraProductionAnalytics(filters),
      ]);

      setEntries(entriesData as ExtraProduction[]);
      setAnalytics(analyticsData);
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

  async function loadBakeSlots() {
    try {
      // Get past bake slots only (can't log production for future dates)
      const today = new Date().toISOString().split('T')[0];
      const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = await window.api.getBakeSlots({ dateFrom, dateTo: today });
      setBakeSlots(data as BakeSlot[]);
    } catch (error) {
      console.error('Failed to load bake slots:', error);
    }
  }

  function openCreateModal() {
    setEditingEntry(null);
    setFormLinkType('date');
    setFormBakeSlotId('');
    setFormProductionDate(new Date().toISOString().split('T')[0]);
    setFormFlavorId(flavors[0]?.id || '');
    setFormQuantity(1);
    setFormDisposition('sold');
    setFormSalePrice(0);
    setFormNotes('');
    setShowModal(true);
  }

  function openEditModal(entry: ExtraProduction) {
    setEditingEntry(entry);
    setFormLinkType(entry.bake_slot_id ? 'slot' : 'date');
    setFormBakeSlotId(entry.bake_slot_id || '');
    setFormProductionDate(entry.production_date);
    setFormFlavorId(entry.flavor_id);
    setFormQuantity(entry.quantity);
    setFormDisposition(entry.disposition);
    setFormSalePrice(entry.sale_price || 0);
    setFormNotes(entry.notes || '');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Get production date from bake slot if linked
    let productionDate = formProductionDate;
    if (formLinkType === 'slot' && formBakeSlotId) {
      const slot = bakeSlots.find((s) => s.id === formBakeSlotId);
      if (slot) {
        productionDate = slot.date;
      }
    }

    const data = {
      bakeSlotId: formLinkType === 'slot' ? formBakeSlotId : null,
      productionDate,
      flavorId: formFlavorId,
      quantity: formQuantity,
      disposition: formDisposition,
      salePrice: formDisposition === 'sold' ? formSalePrice : null,
      notes: formNotes || null,
    };

    try {
      if (editingEntry) {
        await window.api.updateExtraProduction(editingEntry.id, data);
      } else {
        await window.api.createExtraProduction(data);
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await window.api.deleteExtraProduction(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  return (
    <div className="production-page">
      <div className="page-header">
        <h1 className="page-title">Production Log</h1>
        <div className="header-actions">
          <select
            className="form-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + Log Production
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {analytics && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: DISPOSITION_COLORS.sold }}>
              {formatCurrency(analytics.sold.revenue)}
            </div>
            <div className="stat-label">Walk-in Sales ({analytics.sold.loaves} loaves)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: DISPOSITION_COLORS.pending }}>
              {analytics.pending.loaves}
            </div>
            <div className="stat-label">Pending (unsold)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: DISPOSITION_COLORS.gifted }}>
              {analytics.gifted.loaves}
            </div>
            <div className="stat-label">Gifted (${analytics.gifted.cost.toFixed(2)} value)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: DISPOSITION_COLORS.wasted }}>
              {analytics.wasted.loaves}
            </div>
            <div className="stat-label">Wasted (${analytics.wasted.cost.toFixed(2)} loss)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: DISPOSITION_COLORS.personal }}>
              {analytics.personal.loaves}
            </div>
            <div className="stat-label">Personal Use</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="filters-row">
          <div className="filter-group">
            <label className="form-label">Flavor</label>
            <select
              className="form-select"
              value={filterFlavor}
              onChange={(e) => setFilterFlavor(e.target.value)}
            >
              <option value="">All Flavors</option>
              {flavors.filter((f) => f.is_active).map((flavor) => (
                <option key={flavor.id} value={flavor.id}>
                  {flavor.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="form-label">Disposition</label>
            <select
              className="form-select"
              value={filterDisposition}
              onChange={(e) => setFilterDisposition(e.target.value)}
            >
              <option value="">All Types</option>
              {DISPOSITIONS.map((d) => (
                <option key={d} value={d}>
                  {DISPOSITION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading production log...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>No extra production logged yet.</p>
            <button className="btn btn-primary" onClick={openCreateModal}>
              Log Your First Entry
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Flavor</th>
                <th>Qty</th>
                <th>Disposition</th>
                <th>Revenue</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {formatDate(entry.production_date)}
                    {entry.location_name && (
                      <span className="sub-text"> @ {entry.location_name}</span>
                    )}
                  </td>
                  <td>{entry.flavor_name}</td>
                  <td>{entry.quantity}</td>
                  <td>
                    <span
                      className="disposition-badge"
                      style={{
                        background: `${DISPOSITION_COLORS[entry.disposition]}20`,
                        color: DISPOSITION_COLORS[entry.disposition],
                      }}
                    >
                      {DISPOSITION_LABELS[entry.disposition]}
                    </span>
                  </td>
                  <td>
                    {entry.disposition === 'sold' && entry.total_revenue
                      ? formatCurrency(entry.total_revenue)
                      : '-'}
                  </td>
                  <td className="notes-cell">{entry.notes || '-'}</td>
                  <td>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => openEditModal(entry)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-small"
                      style={{ marginLeft: '4px', color: '#c62828' }}
                      onClick={() => handleDelete(entry.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editingEntry ? 'Edit Entry' : 'Log Extra Production'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Link Type */}
                <div className="form-group">
                  <label className="form-label">Link to</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        checked={formLinkType === 'slot'}
                        onChange={() => setFormLinkType('slot')}
                      />
                      Bake Slot
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        checked={formLinkType === 'date'}
                        onChange={() => setFormLinkType('date')}
                      />
                      Standalone Date
                    </label>
                  </div>
                </div>

                {/* Bake Slot or Date */}
                {formLinkType === 'slot' ? (
                  <div className="form-group">
                    <label className="form-label">Bake Slot</label>
                    <select
                      className="form-select"
                      value={formBakeSlotId}
                      onChange={(e) => setFormBakeSlotId(e.target.value)}
                      required
                    >
                      <option value="">Select a bake slot...</option>
                      {bakeSlots
                        .filter((slot) => slot.date <= new Date().toISOString().split('T')[0])
                        .map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {formatDate(slot.date)} - {slot.location_name}
                          </option>
                        ))}
                    </select>
                    <p className="form-hint">Only past and today's bake slots are available.</p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Production Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formProductionDate}
                      onChange={(e) => {
                        const today = new Date().toISOString().split('T')[0];
                        if (e.target.value > today) {
                          setFormProductionDate(today);
                        } else {
                          setFormProductionDate(e.target.value);
                        }
                      }}
                      max={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <p className="form-hint">Cannot log production for future dates.</p>
                  </div>
                )}

                {/* Flavor */}
                <div className="form-group">
                  <label className="form-label">Flavor</label>
                  <select
                    className="form-select"
                    value={formFlavorId}
                    onChange={(e) => setFormFlavorId(e.target.value)}
                    required
                  >
                    <option value="">Select a flavor...</option>
                    {flavors.filter((f) => f.is_active).map((flavor) => (
                      <option key={flavor.id} value={flavor.id}>
                        {flavor.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="form-group">
                  <label className="form-label">Quantity (loaves)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                    min={1}
                    required
                  />
                </div>

                {/* Disposition */}
                <div className="form-group">
                  <label className="form-label">Disposition</label>
                  <div className="disposition-buttons">
                    {DISPOSITIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`disposition-btn ${formDisposition === d ? 'active' : ''}`}
                        style={{
                          borderColor: DISPOSITION_COLORS[d],
                          background: formDisposition === d ? DISPOSITION_COLORS[d] : 'transparent',
                          color: formDisposition === d ? '#fff' : DISPOSITION_COLORS[d],
                        }}
                        onClick={() => setFormDisposition(d)}
                      >
                        {DISPOSITION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sale Price (only for sold) */}
                {formDisposition === 'sold' && (
                  <div className="form-group">
                    <label className="form-label">Sale Price (per loaf)</label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">$</span>
                      <input
                        type="number"
                        className="form-input"
                        value={formSalePrice}
                        onChange={(e) => setFormSalePrice(parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min={0}
                      />
                    </div>
                    <p className="form-hint">
                      Total: {formatCurrency(formQuantity * formSalePrice)}
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-textarea"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={
                      formDisposition === 'gifted'
                        ? 'e.g., Given to neighbor'
                        : formDisposition === 'wasted'
                          ? 'e.g., Over-proofed'
                          : ''
                    }
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEntry ? 'Save Changes' : 'Log Entry'}
                </button>
              </div>
            </form>
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
        .production-page .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: var(--white);
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 600;
          font-family: var(--font-heading);
        }
        .stat-label {
          font-size: 0.875rem;
          color: var(--text-gray);
          margin-top: 4px;
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
        .disposition-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .sub-text {
          font-size: 0.75rem;
          color: var(--text-gray);
          display: block;
        }
        .notes-cell {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .radio-group {
          display: flex;
          gap: 20px;
        }
        .radio-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .disposition-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .disposition-btn {
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
      `}</style>
    </div>
  );
}

export default ProductionPage;
