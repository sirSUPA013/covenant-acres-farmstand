import React, { useState, useEffect, useRef } from 'react';

interface BakeSlot {
  id: string;
  date: string;
  location_id: string;
  location_name: string;
  total_capacity: number;
  current_orders: number;
}

interface PrepSheetIngredient {
  name: string;
  totalQuantity: number;
  unit: string;
}

interface PrepSheetItem {
  flavorName: string;
  quantity: number;
  baseIngredients: PrepSheetIngredient[];
  foldIngredients: PrepSheetIngredient[];
  laminationIngredients: PrepSheetIngredient[];
  steps: Array<{
    order: number;
    instruction: string;
    duration_minutes?: number;
  }>;
  noRecipe?: boolean;
}

interface PrepSheetResponse {
  bakeSlotId: string;
  date: string;
  location: string;
  generatedAt: string;
  items: PrepSheetItem[];
  totalLoaves: number;
}

interface OpenCapacity {
  totalCapacity: number;
  orderedCount: number;
  extraLoggedCount: number;
  openSlots: number;
}

interface Flavor {
  id: string;
  name: string;
  is_active: number;
}

const DISPOSITIONS = ['sold', 'gifted', 'wasted', 'personal'] as const;
type Disposition = typeof DISPOSITIONS[number];

const DISPOSITION_LABELS: Record<Disposition, string> = {
  sold: 'Sold',
  gifted: 'Gifted',
  wasted: 'Wasted',
  personal: 'Personal',
};

function PrepSheetPage() {
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [prepSheet, setPrepSheet] = useState<PrepSheetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('Bakery');
  const printRef = useRef<HTMLDivElement>(null);

  // Open capacity tracking
  const [openCapacity, setOpenCapacity] = useState<OpenCapacity | null>(null);
  const [flavors, setFlavors] = useState<Flavor[]>([]);

  // Quick-add modal state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddFlavorId, setQuickAddFlavorId] = useState('');
  const [quickAddQuantity, setQuickAddQuantity] = useState(1);
  const [quickAddDisposition, setQuickAddDisposition] = useState<Disposition>('sold');
  const [quickAddSalePrice, setQuickAddSalePrice] = useState(0);
  const [quickAddNotes, setQuickAddNotes] = useState('');

  useEffect(() => {
    loadBakeSlots();
    loadFlavors();
    loadBusinessName();
  }, []);

  async function loadBusinessName() {
    try {
      const settings = await window.api.getPublicSettings();
      if (settings.businessName) {
        setBusinessName(settings.businessName);
      }
    } catch (error) {
      // Use default
    }
  }

  async function loadFlavors() {
    try {
      const data = await window.api.getFlavors();
      setFlavors((data as Flavor[]).filter((f) => f.is_active === 1));
    } catch (error) {
      console.error('Failed to load flavors:', error);
    }
  }

  async function loadOpenCapacity() {
    if (!selectedSlot) {
      setOpenCapacity(null);
      return;
    }
    try {
      const data = await window.api.getOpenCapacity(selectedSlot);
      setOpenCapacity(data as OpenCapacity);
    } catch (error) {
      console.error('Failed to load open capacity:', error);
      setOpenCapacity(null);
    }
  }

  async function loadBakeSlots() {
    try {
      const data = await window.api.getBakeSlots({ upcoming: true });
      setBakeSlots(data as BakeSlot[]);
      // Auto-select first slot if available
      if ((data as BakeSlot[]).length > 0) {
        setSelectedSlot((data as BakeSlot[])[0].id);
      }
    } catch (error) {
      console.error('Failed to load bake slots:', error);
    }
  }

  useEffect(() => {
    if (selectedSlot) {
      loadPrepSheet();
      loadOpenCapacity();
    } else {
      setOpenCapacity(null);
    }
  }, [selectedSlot]);

  async function loadPrepSheet() {
    setLoading(true);
    try {
      const data = await window.api.getPrepSheet(selectedSlot) as PrepSheetResponse;
      setPrepSheet(data.items || []);
    } catch (error) {
      console.error('Failed to load prep sheet:', error);
      setPrepSheet([]);
    }
    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getSelectedSlotInfo() {
    return bakeSlots.find((s) => s.id === selectedSlot);
  }

  function handlePrint() {
    window.print();
  }

  function resetQuickAddForm() {
    setQuickAddFlavorId('');
    setQuickAddQuantity(1);
    setQuickAddDisposition('sold');
    setQuickAddSalePrice(0);
    setQuickAddNotes('');
  }

  function openQuickAddModal() {
    resetQuickAddForm();
    setShowQuickAdd(true);
  }

  async function handleQuickAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !quickAddFlavorId || quickAddQuantity < 1) return;

    const slotInfo = getSelectedSlotInfo();
    if (!slotInfo) return;

    try {
      await window.api.createExtraProduction({
        bake_slot_id: selectedSlot,
        production_date: slotInfo.date,
        flavor_id: quickAddFlavorId,
        quantity: quickAddQuantity,
        disposition: quickAddDisposition,
        sale_price: quickAddDisposition === 'sold' ? quickAddSalePrice : null,
        notes: quickAddNotes || null,
      });

      setShowQuickAdd(false);
      resetQuickAddForm();
      loadOpenCapacity();
    } catch (error) {
      console.error('Failed to log extra production:', error);
    }
  }

  // Calculate total ingredients across all flavors
  function calculateTotalIngredients(): Map<string, { quantity: number; unit: string }> {
    const totals = new Map<string, { quantity: number; unit: string }>();

    prepSheet.forEach((item) => {
      // Combine all ingredient types
      const allIngredients = [
        ...(item.baseIngredients || []),
        ...(item.foldIngredients || []),
        ...(item.laminationIngredients || []),
      ];

      allIngredients.forEach((ing) => {
        const key = `${ing.name}|${ing.unit}`;
        const existing = totals.get(key);

        if (existing) {
          totals.set(key, { quantity: existing.quantity + ing.totalQuantity, unit: ing.unit });
        } else {
          totals.set(key, { quantity: ing.totalQuantity, unit: ing.unit });
        }
      });
    });

    return totals;
  }

  const slotInfo = getSelectedSlotInfo();
  const totalIngredients = calculateTotalIngredients();

  return (
    <div className="prep-sheet-page">
      <div className="page-header no-print">
        <h1 className="page-title">Prep Sheet</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            className="form-select"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            style={{ width: '300px' }}
          >
            <option value="">Select a bake day...</option>
            {bakeSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {formatDate(slot.date)} - {slot.location_name} ({slot.current_orders} orders)
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={prepSheet.length === 0}
          >
            Print Prep Sheet
          </button>
        </div>
      </div>

      {/* Open Capacity Banner */}
      {selectedSlot && openCapacity && openCapacity.openSlots > 0 && (
        <div className="capacity-banner no-print">
          <div className="capacity-info">
            <span className="capacity-icon">🍞</span>
            <span className="capacity-text">
              <strong>{openCapacity.openSlots} open slot{openCapacity.openSlots !== 1 ? 's' : ''}</strong> available
            </span>
            <span className="capacity-detail">
              {openCapacity.orderedCount} ordered
              {openCapacity.extraLoggedCount > 0 && ` + ${openCapacity.extraLoggedCount} extra logged`}
              {' '}of {openCapacity.totalCapacity} capacity
            </span>
          </div>
          <button className="btn btn-secondary" onClick={openQuickAddModal}>
            Log Extra Production
          </button>
        </div>
      )}

      {!selectedSlot ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>Select a bake day to generate a prep sheet</p>
          </div>
        </div>
      ) : loading ? (
        <div className="card">
          <div className="loading">Generating prep sheet...</div>
        </div>
      ) : prepSheet.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No orders for this bake day yet</p>
          </div>
        </div>
      ) : (
        <div ref={printRef} className="prep-sheet-content">
          {/* Header - for print */}
          <div className="print-header print-only">
            <h1>{businessName}</h1>
            <h2>Bake Day Prep Sheet</h2>
            {slotInfo && (
              <p>
                {formatDate(slotInfo.date)} • {slotInfo.location_name} •{' '}
                {slotInfo.current_orders} orders
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Production Summary</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flavor</th>
                  <th className="text-right">Loaves</th>
                </tr>
              </thead>
              <tbody>
                {prepSheet.map((item) => (
                  <tr key={item.flavorName}>
                    <td>{item.flavorName}</td>
                    <td className="text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>
                    {prepSheet.reduce((sum, item) => sum + item.quantity, 0)} loaves
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Total Ingredients */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Total Ingredients Needed</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="text-right">Total Quantity</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(totalIngredients.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([key, value]) => {
                    const name = key.split('|')[0];
                    return (
                      <tr key={key}>
                        <td>{name}</td>
                        <td className="text-right">
                          {value.quantity.toFixed(2)} {value.unit}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Per-Flavor Breakdown */}
          {prepSheet.map((item) => (
            <div key={item.flavorName} className="card page-break-before">
              <div className="card-header">
                <h2 className="card-title">
                  {item.flavorName} × {item.quantity}
                </h2>
              </div>

              {item.noRecipe ? (
                <div className="empty-state">
                  <p>No recipe configured for this flavor</p>
                </div>
              ) : (
                <>
                  {/* Base Ingredients */}
                  {item.baseIngredients && item.baseIngredients.length > 0 && (
                    <>
                      <h3 className="section-title">Base Ingredients (scaled for {item.quantity} loaves)</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th className="text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.baseIngredients.map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td className="text-right">
                                {ing.totalQuantity.toFixed(2)} {ing.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Fold-in Ingredients */}
                  {item.foldIngredients && item.foldIngredients.length > 0 && (
                    <>
                      <h3 className="section-title mt-lg">Fold-in Ingredients</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th className="text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.foldIngredients.map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td className="text-right">
                                {ing.totalQuantity.toFixed(2)} {ing.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Lamination Ingredients */}
                  {item.laminationIngredients && item.laminationIngredients.length > 0 && (
                    <>
                      <h3 className="section-title mt-lg">Lamination Ingredients</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th className="text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.laminationIngredients.map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td className="text-right">
                                {ing.totalQuantity.toFixed(2)} {ing.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Instructions */}
                  {item.steps && item.steps.length > 0 && (
                    <>
                      <h3 className="section-title mt-lg">Instructions</h3>
                      <ol className="prep-instructions">
                        {item.steps.map((step) => (
                          <li key={step.order}>
                            <div className="instruction-text">{step.instruction}</div>
                            {step.duration_minutes && (
                              <div className="instruction-time">{step.duration_minutes} min</div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
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
              <h2 className="modal-title">Log Extra Production</h2>
              <button className="modal-close" onClick={() => setShowQuickAdd(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleQuickAddSubmit}>
              <div className="modal-body">
                {slotInfo && (
                  <div className="form-info-box">
                    Logging for: {formatDate(slotInfo.date)} - {slotInfo.location_name}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Flavor *</label>
                  <select
                    className="form-select"
                    value={quickAddFlavorId}
                    onChange={(e) => setQuickAddFlavorId(e.target.value)}
                    required
                  >
                    <option value="">Select flavor...</option>
                    {flavors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={quickAddQuantity}
                    onChange={(e) => setQuickAddQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Disposition *</label>
                  <div className="disposition-buttons">
                    {DISPOSITIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`disposition-btn ${d} ${quickAddDisposition === d ? 'active' : ''}`}
                        onClick={() => setQuickAddDisposition(d)}
                      >
                        {DISPOSITION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {quickAddDisposition === 'sold' && (
                  <div className="form-group">
                    <label className="form-label">Sale Price (per loaf) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={quickAddSalePrice}
                      onChange={(e) => setQuickAddSalePrice(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={quickAddNotes}
                    onChange={(e) => setQuickAddNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickAdd(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!quickAddFlavorId || quickAddQuantity < 1}
                >
                  Log Production
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .capacity-banner {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid var(--primary-green);
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .capacity-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .capacity-icon {
          font-size: 1.5rem;
        }
        .capacity-text {
          font-size: 1rem;
          color: var(--text-dark);
        }
        .capacity-detail {
          font-size: 0.875rem;
          color: var(--text-gray);
        }
        .form-info-box {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 0.875rem;
          color: #0369a1;
        }
        .disposition-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .disposition-btn {
          padding: 8px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }
        .disposition-btn:hover {
          border-color: #9ca3af;
        }
        .disposition-btn.active {
          border-color: var(--primary-green);
          background: #f0fdf4;
        }
        .disposition-btn.sold.active {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .disposition-btn.gifted.active {
          border-color: #0ea5e9;
          background: #f0f9ff;
        }
        .disposition-btn.wasted.active {
          border-color: #ef4444;
          background: #fef2f2;
        }
        .disposition-btn.personal.active {
          border-color: #8b5cf6;
          background: #faf5ff;
        }
        .section-title {
          font-family: var(--font-heading);
          font-size: 1rem;
          color: var(--primary-green);
          margin-bottom: 12px;
        }
        .prep-instructions {
          padding-left: 20px;
        }
        .prep-instructions li {
          margin-bottom: 16px;
          page-break-inside: avoid;
        }
        .instruction-text {
          line-height: 1.6;
        }
        .instruction-time {
          font-size: 0.875rem;
          color: var(--text-gray);
          margin-top: 4px;
        }

        /* Print styles */
        .print-only {
          display: none;
        }
        .print-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .print-header h1 {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          color: var(--primary-green);
          margin-bottom: 4px;
        }
        .print-header h2 {
          font-size: 1.25rem;
          font-weight: 400;
          margin-bottom: 8px;
        }
        .print-header p {
          color: var(--text-gray);
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block;
          }
          .sidebar {
            display: none !important;
          }
          .main-content {
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          .prep-sheet-page {
            overflow: visible !important;
            height: auto !important;
          }
          .prep-sheet-content {
            overflow: visible !important;
            height: auto !important;
          }
          .card {
            box-shadow: none;
            border: 1px solid #ddd;
            page-break-inside: auto;
            break-inside: auto;
          }
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          body {
            background: white;
            overflow: visible !important;
            height: auto !important;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}

export default PrepSheetPage;
