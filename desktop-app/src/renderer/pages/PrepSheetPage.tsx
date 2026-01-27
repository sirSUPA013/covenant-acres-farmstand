import { useState, useEffect, useRef } from 'react';

interface PrepSheet {
  id: string;
  bake_date: string;
  status: 'draft' | 'completed';
  notes: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  order_count: number;
  extra_count: number;
  total_loaves: number;
}

interface PrepSheetItem {
  id: string;
  order_id: string | null;
  flavor_id: string;
  flavor_name: string;
  planned_quantity: number;
  actual_quantity: number | null;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface PrepSheetDetail extends PrepSheet {
  items: PrepSheetItem[];
}

interface Order {
  id: string;
  items: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bake_date: string;
  location_name: string;
}

interface Flavor {
  id: string;
  name: string;
  is_active: number;
}

interface PrepSheetIngredient {
  name: string;
  totalQuantity: number;
  unit: string;
}

interface GeneratedPrepData {
  prepSheetId: string;
  bakeDate: string;
  status: string;
  generatedAt: string;
  items: Array<{
    flavorId: string;
    flavorName: string;
    quantity: number;
    baseIngredients: PrepSheetIngredient[];
    foldIngredients: PrepSheetIngredient[];
    laminationIngredients: PrepSheetIngredient[];
    steps: Array<{ order: number; instruction: string; duration_minutes?: number }>;
    prepInstructions?: string;
    bakeInstructions?: string;
    bakeTemp?: string;
    prepTimeMinutes?: number;
    bakeTimeMinutes?: number;
    noRecipe?: boolean;
  }>;
  totalLoaves: number;
}

function PrepSheetPage() {
  // List view state
  const [prepSheets, setPrepSheets] = useState<PrepSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'completed'>('all');

  // Detail view state
  const [selectedPrepSheet, setSelectedPrepSheet] = useState<PrepSheetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create new prep sheet modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBakeDate, setNewBakeDate] = useState(getDefaultDate());

  // Add order modal
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Add extra modal
  const [showAddExtraModal, setShowAddExtraModal] = useState(false);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [extraFlavorId, setExtraFlavorId] = useState('');
  const [extraQuantity, setExtraQuantity] = useState(1);

  // Complete prep sheet modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [actualQuantities, setActualQuantities] = useState<Record<string, number>>({});

  // View ingredients/instructions
  const [showPrepData, setShowPrepData] = useState(false);
  const [prepData, setPrepData] = useState<GeneratedPrepData | null>(null);
  const [prepDataLoading, setPrepDataLoading] = useState(false);

  const [businessName, setBusinessName] = useState('Bakery');
  const printRef = useRef<HTMLDivElement>(null);

  function getDefaultDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  useEffect(() => {
    loadPrepSheets();
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
      setFlavors((data as Flavor[]).filter(f => f.is_active === 1));
    } catch (error) {
      console.error('Failed to load flavors:', error);
    }
  }

  async function loadPrepSheets() {
    setLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await window.api.getPrepSheets(filters);
      setPrepSheets(data as PrepSheet[]);
    } catch (error) {
      console.error('Failed to load prep sheets:', error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPrepSheets();
  }, [statusFilter]);

  async function loadPrepSheetDetail(id: string) {
    setDetailLoading(true);
    try {
      const data = await window.api.getPrepSheet2(id);
      setSelectedPrepSheet(data as PrepSheetDetail);
    } catch (error) {
      console.error('Failed to load prep sheet:', error);
    }
    setDetailLoading(false);
  }

  async function handleCreatePrepSheet(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await window.api.createPrepSheet({ bakeDate: newBakeDate });
      setShowCreateModal(false);
      setNewBakeDate(getDefaultDate());
      loadPrepSheets();
      loadPrepSheetDetail(result.id);
    } catch (error) {
      console.error('Failed to create prep sheet:', error);
      alert('Failed to create prep sheet');
    }
  }

  async function handleDeletePrepSheet() {
    if (!selectedPrepSheet) return;
    if (!confirm('Are you sure you want to delete this prep sheet? Orders will be returned to "submitted" status.')) return;

    try {
      await window.api.deletePrepSheet(selectedPrepSheet.id);
      setSelectedPrepSheet(null);
      loadPrepSheets();
    } catch (error) {
      console.error('Failed to delete prep sheet:', error);
      alert('Failed to delete prep sheet: ' + (error as Error).message);
    }
  }

  async function openAddOrderModal() {
    if (!selectedPrepSheet) return;
    setOrdersLoading(true);
    setShowAddOrderModal(true);
    try {
      const orders = await window.api.getAvailableOrdersForPrepSheet(selectedPrepSheet.bake_date);
      setAvailableOrders(orders as Order[]);
    } catch (error) {
      console.error('Failed to load available orders:', error);
    }
    setOrdersLoading(false);
  }

  async function handleAddOrder(orderId: string) {
    if (!selectedPrepSheet) return;
    try {
      await window.api.addOrderToPrepSheet(selectedPrepSheet.id, orderId);
      loadPrepSheetDetail(selectedPrepSheet.id);
      // Remove from available list
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      loadPrepSheets(); // Update counts in list
    } catch (error) {
      console.error('Failed to add order:', error);
      alert('Failed to add order');
    }
  }

  async function handleRemoveOrder(orderId: string) {
    if (!selectedPrepSheet) return;
    if (!confirm('Remove this order from the prep sheet?')) return;
    try {
      await window.api.removeOrderFromPrepSheet(selectedPrepSheet.id, orderId);
      loadPrepSheetDetail(selectedPrepSheet.id);
      loadPrepSheets();
    } catch (error) {
      console.error('Failed to remove order:', error);
    }
  }

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrepSheet || !extraFlavorId || extraQuantity < 1) return;
    try {
      await window.api.addExtraToPrepSheet(selectedPrepSheet.id, extraFlavorId, extraQuantity);
      setShowAddExtraModal(false);
      setExtraFlavorId('');
      setExtraQuantity(1);
      loadPrepSheetDetail(selectedPrepSheet.id);
      loadPrepSheets();
    } catch (error) {
      console.error('Failed to add extra:', error);
      alert('Failed to add extra loaves');
    }
  }

  async function handleRemoveExtra(itemId: string) {
    if (!selectedPrepSheet) return;
    if (!confirm('Remove this extra from the prep sheet?')) return;
    try {
      await window.api.removeExtraFromPrepSheet(itemId);
      loadPrepSheetDetail(selectedPrepSheet.id);
      loadPrepSheets();
    } catch (error) {
      console.error('Failed to remove extra:', error);
    }
  }

  function openCompleteModal() {
    if (!selectedPrepSheet) return;
    // Initialize actual quantities from planned
    const initial: Record<string, number> = {};
    selectedPrepSheet.items.forEach(item => {
      initial[item.id] = item.planned_quantity;
    });
    setActualQuantities(initial);
    setShowCompleteModal(true);
  }

  async function handleCompletePrepSheet() {
    if (!selectedPrepSheet) return;
    try {
      await window.api.completePrepSheet(selectedPrepSheet.id, actualQuantities);
      setShowCompleteModal(false);
      loadPrepSheetDetail(selectedPrepSheet.id);
      loadPrepSheets();
    } catch (error) {
      console.error('Failed to complete prep sheet:', error);
      alert('Failed to complete prep sheet: ' + (error as Error).message);
    }
  }

  async function loadPrepData() {
    if (!selectedPrepSheet) return;
    setPrepDataLoading(true);
    try {
      const data = await window.api.generatePrepSheetData(selectedPrepSheet.id);
      setPrepData(data);
      setShowPrepData(true);
    } catch (error) {
      console.error('Failed to generate prep data:', error);
    }
    setPrepDataLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Group items by order for display
  function groupItemsByOrder(items: PrepSheetItem[]) {
    const orderItems: Record<string, PrepSheetItem[]> = {};
    const extras: PrepSheetItem[] = [];

    items.forEach(item => {
      if (item.order_id) {
        if (!orderItems[item.order_id]) {
          orderItems[item.order_id] = [];
        }
        orderItems[item.order_id].push(item);
      } else {
        extras.push(item);
      }
    });

    return { orderItems, extras };
  }

  function getOrderTotal(items: PrepSheetItem[]): number {
    return items.reduce((sum, item) => sum + item.planned_quantity, 0);
  }

  // Calculate total ingredients for print view
  function calculateTotalIngredients(): Map<string, { quantity: number; unit: string }> {
    if (!prepData) return new Map();
    const totals = new Map<string, { quantity: number; unit: string }>();

    prepData.items.forEach(item => {
      const allIngredients = [
        ...(item.baseIngredients || []),
        ...(item.foldIngredients || []),
        ...(item.laminationIngredients || []),
      ];

      allIngredients.forEach(ing => {
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

  const grouped = selectedPrepSheet ? groupItemsByOrder(selectedPrepSheet.items) : null;
  const totalIngredients = calculateTotalIngredients();

  // List View
  if (!selectedPrepSheet && !showPrepData) {
    return (
      <div className="prep-sheet-page">
        <div className="page-header">
          <h1 className="page-title">Prep Sheets</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | 'draft' | 'completed')}
              style={{ width: '150px' }}
            >
              <option value="all">All Status</option>
              <option value="draft">Drafts</option>
              <option value="completed">Completed</option>
            </select>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + New Prep Sheet
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="loading">Loading prep sheets...</div>
          </div>
        ) : prepSheets.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No prep sheets yet</p>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                Create First Prep Sheet
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bake Date</th>
                  <th>Status</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Extras</th>
                  <th className="text-right">Total Loaves</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prepSheets.map(ps => (
                  <tr key={ps.id} className="clickable-row" onClick={() => loadPrepSheetDetail(ps.id)}>
                    <td>{formatDate(ps.bake_date)}</td>
                    <td>
                      <span className={`status-badge ${ps.status}`}>
                        {ps.status === 'draft' ? 'Draft' : 'Completed'}
                      </span>
                    </td>
                    <td className="text-right">{ps.order_count}</td>
                    <td className="text-right">{ps.extra_count}</td>
                    <td className="text-right">{ps.total_loaves || 0}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={e => {
                          e.stopPropagation();
                          loadPrepSheetDetail(ps.id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">New Prep Sheet</h2>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                  &times;
                </button>
              </div>
              <form onSubmit={handleCreatePrepSheet}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Bake Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newBakeDate}
                      onChange={e => setNewBakeDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Prep Sheet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <style>{prepSheetStyles}</style>
      </div>
    );
  }

  // Prep Data View (ingredients and instructions)
  if (showPrepData && prepData) {
    return (
      <div className="prep-sheet-page">
        <div className="page-header no-print">
          <h1 className="page-title">Prep Sheet - {formatDate(prepData.bakeDate)}</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setShowPrepData(false)}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>

        <div ref={printRef} className="prep-sheet-content">
          {/* Header - for print */}
          <div className="print-header print-only">
            <h1>{businessName}</h1>
            <h2>Bake Day Prep Sheet</h2>
            <p>{formatDate(prepData.bakeDate)} • {prepData.totalLoaves} loaves</p>
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
                {prepData.items.map(item => (
                  <tr key={item.flavorId}>
                    <td>{item.flavorName}</td>
                    <td className="text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>
                    {prepData.totalLoaves} loaves
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
          {prepData.items.map(item => (
            <div key={item.flavorId} className="card page-break-before">
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
                  {item.baseIngredients.length > 0 && (
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

                  {item.foldIngredients.length > 0 && (
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

                  {item.laminationIngredients.length > 0 && (
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

                  {item.steps.length > 0 && (
                    <>
                      <h3 className="section-title mt-lg">Instructions</h3>
                      <ol className="prep-instructions">
                        {item.steps.map(step => (
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

        <style>{prepSheetStyles}</style>
      </div>
    );
  }

  // Detail View
  return (
    <div className="prep-sheet-page">
      <div className="page-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedPrepSheet(null)}>
            ← Back
          </button>
          <h1 className="page-title">
            Prep Sheet: {selectedPrepSheet ? formatDate(selectedPrepSheet.bake_date) : ''}
          </h1>
          {selectedPrepSheet && (
            <span className={`status-badge ${selectedPrepSheet.status}`}>
              {selectedPrepSheet.status === 'draft' ? 'Draft' : 'Completed'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {selectedPrepSheet?.status === 'draft' && (
            <>
              <button
                className="btn btn-danger-outline"
                onClick={handleDeletePrepSheet}
              >
                Delete
              </button>
              <button
                className="btn btn-primary"
                onClick={openCompleteModal}
                disabled={!selectedPrepSheet.items.length}
              >
                Mark Complete
              </button>
            </>
          )}
          <button
            className="btn btn-secondary"
            onClick={loadPrepData}
            disabled={prepDataLoading || !selectedPrepSheet?.items.length}
          >
            {prepDataLoading ? 'Loading...' : 'View Ingredients & Instructions'}
          </button>
        </div>
      </div>

      {detailLoading ? (
        <div className="card">
          <div className="loading">Loading prep sheet...</div>
        </div>
      ) : selectedPrepSheet && grouped ? (
        <>
          {/* Completed Info */}
          {selectedPrepSheet.status === 'completed' && (
            <div className="completed-info">
              Completed {selectedPrepSheet.completed_at ? formatDateTime(selectedPrepSheet.completed_at) : ''}
              {selectedPrepSheet.completed_by_name && ` by ${selectedPrepSheet.completed_by_name}`}
            </div>
          )}

          {/* Orders Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Orders</h2>
              {selectedPrepSheet.status === 'draft' && (
                <button className="btn btn-sm btn-secondary" onClick={openAddOrderModal}>
                  + Add Order
                </button>
              )}
            </div>
            {Object.keys(grouped.orderItems).length === 0 ? (
              <div className="empty-state small">
                <p>No orders added yet</p>
              </div>
            ) : (
              <div className="order-list">
                {Object.entries(grouped.orderItems).map(([orderId, items]) => {
                  const firstItem = items[0];
                  return (
                    <div key={orderId} className="order-card">
                      <div className="order-header">
                        <div className="order-customer">
                          <strong>{firstItem.first_name} {firstItem.last_name}</strong>
                          <span className="order-email">{firstItem.email}</span>
                        </div>
                        <div className="order-meta">
                          <span className="order-total">{getOrderTotal(items)} loaves</span>
                          {selectedPrepSheet.status === 'draft' && (
                            <button
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleRemoveOrder(orderId)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="order-items">
                        {items.map(item => (
                          <div key={item.id} className="order-item">
                            <span className="flavor-name">{item.flavor_name}</span>
                            <span className="flavor-qty">×{item.planned_quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Extras Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Extra Loaves (not pre-ordered)</h2>
              {selectedPrepSheet.status === 'draft' && (
                <button className="btn btn-sm btn-secondary" onClick={() => setShowAddExtraModal(true)}>
                  + Add Extra
                </button>
              )}
            </div>
            {grouped.extras.length === 0 ? (
              <div className="empty-state small">
                <p>No extra loaves planned</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Flavor</th>
                    <th className="text-right">Quantity</th>
                    {selectedPrepSheet.status === 'draft' && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {grouped.extras.map(item => (
                    <tr key={item.id}>
                      <td>{item.flavor_name}</td>
                      <td className="text-right">{item.planned_quantity}</td>
                      {selectedPrepSheet.status === 'draft' && (
                        <td className="text-right">
                          <button
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => handleRemoveExtra(item.id)}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Production Summary */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Production Summary</h2>
            </div>
            {(() => {
              const summary = new Map<string, number>();
              selectedPrepSheet.items.forEach(item => {
                const current = summary.get(item.flavor_name) || 0;
                summary.set(item.flavor_name, current + item.planned_quantity);
              });
              return (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Flavor</th>
                      <th className="text-right">Total Loaves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(summary.entries()).map(([flavor, qty]) => (
                      <tr key={flavor}>
                        <td>{flavor}</td>
                        <td className="text-right">{qty}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Total</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {selectedPrepSheet.items.reduce((sum, i) => sum + i.planned_quantity, 0)} loaves
                      </td>
                    </tr>
                  </tfoot>
                </table>
              );
            })()}
          </div>
        </>
      ) : null}

      {/* Add Order Modal */}
      {showAddOrderModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Add Orders to Prep Sheet</h2>
              <button className="modal-close" onClick={() => setShowAddOrderModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {ordersLoading ? (
                <div className="loading">Loading available orders...</div>
              ) : availableOrders.length === 0 ? (
                <div className="empty-state small">
                  <p>No orders available for this bake date</p>
                </div>
              ) : (
                <div className="available-orders">
                  {availableOrders.map(order => {
                    const items = JSON.parse(order.items) as Array<{ flavorName: string; quantity: number }>;
                    return (
                      <div key={order.id} className="available-order">
                        <div className="order-info">
                          <div className="order-customer">
                            <strong>{order.first_name} {order.last_name}</strong>
                          </div>
                          <div className="order-details">
                            {items.map((item, i) => (
                              <span key={i} className="item-chip">
                                {item.flavorName} ×{item.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleAddOrder(order.id)}
                        >
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddOrderModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Modal */}
      {showAddExtraModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Extra Loaves</h2>
              <button className="modal-close" onClick={() => setShowAddExtraModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAddExtra}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Flavor *</label>
                  <select
                    className="form-select"
                    value={extraFlavorId}
                    onChange={e => setExtraFlavorId(e.target.value)}
                    required
                  >
                    <option value="">Select flavor...</option>
                    {flavors.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={extraQuantity}
                    onChange={e => setExtraQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddExtraModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!extraFlavorId}>
                  Add Extra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Prep Sheet Modal */}
      {showCompleteModal && selectedPrepSheet && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Complete Prep Sheet</h2>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Confirm the actual quantities baked. This will create production records and update order statuses to "baked".
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Flavor</th>
                    <th className="text-right">Planned</th>
                    <th className="text-right">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrepSheet.items.map(item => (
                    <tr key={item.id}>
                      <td>
                        {item.order_id
                          ? `${item.first_name} ${item.last_name}`
                          : 'Extra'}
                      </td>
                      <td>{item.flavor_name}</td>
                      <td className="text-right">{item.planned_quantity}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          className="form-input inline-input"
                          value={actualQuantities[item.id] || 0}
                          onChange={e => setActualQuantities(prev => ({
                            ...prev,
                            [item.id]: parseInt(e.target.value) || 0
                          }))}
                          min="0"
                          style={{ width: '80px', textAlign: 'right' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCompletePrepSheet}>
                Complete & Create Production Records
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{prepSheetStyles}</style>
    </div>
  );
}

const prepSheetStyles = `
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  .status-badge.draft {
    background: #fef3c7;
    color: #92400e;
  }
  .status-badge.completed {
    background: #d1fae5;
    color: #065f46;
  }
  .clickable-row {
    cursor: pointer;
    transition: background 0.15s;
  }
  .clickable-row:hover {
    background: #f9fafb;
  }
  .completed-info {
    background: #d1fae5;
    border: 1px solid #10b981;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    color: #065f46;
    font-size: 0.875rem;
  }
  .order-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .order-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    background: #fafafa;
  }
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .order-customer {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .order-email {
    font-size: 0.75rem;
    color: var(--text-gray);
  }
  .order-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .order-total {
    font-size: 0.875rem;
    color: var(--text-gray);
  }
  .order-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .order-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.75rem;
  }
  .flavor-name {
    margin-right: 4px;
  }
  .flavor-qty {
    color: var(--text-gray);
  }
  .empty-state.small {
    padding: 24px;
  }
  .empty-state.small p {
    font-size: 0.875rem;
  }
  .modal-lg {
    max-width: 700px;
    width: 90%;
  }
  .modal-description {
    margin-bottom: 16px;
    color: var(--text-gray);
  }
  .available-orders {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }
  .available-order {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fafafa;
  }
  .order-details {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .item-chip {
    background: #e5e7eb;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.75rem;
  }
  .inline-input {
    display: inline-block;
  }
  .btn-danger-outline {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  .btn-danger-outline:hover {
    background: #fef2f2;
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
`;

export default PrepSheetPage;
