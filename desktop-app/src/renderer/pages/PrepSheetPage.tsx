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

function PrepSheetPage() {
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [prepSheet, setPrepSheet] = useState<PrepSheetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBakeSlots();
  }, []);

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
            <h1>Covenant Acres Farmstand</h1>
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

      <style>{`
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
          }
          .card {
            box-shadow: none;
            border: 1px solid #ddd;
            page-break-inside: avoid;
          }
          .page-break-before {
            page-break-before: auto;
          }
          body {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}

export default PrepSheetPage;
