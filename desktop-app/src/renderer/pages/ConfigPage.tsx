import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface BakeSlot {
  id: string;
  date: string;
  location_id: string;
  location_name: string;
  total_capacity: number;
  current_orders: number;
  cutoff_time: string;
  is_open: number;
}

interface FlavorSize {
  name: string;
  price: number;
}

interface Flavor {
  id: string;
  name: string;
  description: string;
  sizes: string;
  recipe_id: string;
  is_active: number;
  season: string;
  sort_order: number;
}

interface Location {
  id: string;
  name: string;
  address: string;
  is_active: number;
}

function ConfigPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'slots' | 'flavors' | 'locations'>('slots');
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode for bake slots
  const [slotsView, setSlotsView] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // New slot form
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: '',
    locationId: '',
    totalCapacity: 24,
    cutoffTime: '',
  });

  // Flavor editing
  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [flavorForm, setFlavorForm] = useState({
    name: '',
    description: '',
    sizes: [{ name: 'Regular', price: 10 }] as FlavorSize[],
    season: 'year_round',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [slotsData, flavorsData, locationsData] = await Promise.all([
        window.api.getBakeSlots({}), // Get all slots for calendar view
        window.api.getFlavors(),
        window.api.getLocations(),
      ]);
      setBakeSlots(slotsData as BakeSlot[]);
      setFlavors(flavorsData as Flavor[]);
      setLocations(locationsData as Location[]);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    setLoading(false);
  }

  async function createBakeSlot() {
    if (!newSlot.date || !newSlot.locationId) return;

    try {
      await window.api.createBakeSlot({
        date: newSlot.date,
        locationId: newSlot.locationId,
        totalCapacity: newSlot.totalCapacity,
        cutoffTime: newSlot.cutoffTime || new Date(new Date(newSlot.date).getTime() - 48 * 60 * 60 * 1000).toISOString(),
      });
      setShowNewSlot(false);
      setNewSlot({ date: '', locationId: '', totalCapacity: 24, cutoffTime: '' });
      loadAll();
    } catch (error) {
      console.error('Failed to create bake slot:', error);
    }
  }

  async function toggleSlot(slotId: string, isOpen: boolean) {
    try {
      await window.api.updateBakeSlot(slotId, { is_open: isOpen ? 1 : 0 });
      loadAll();
    } catch (error) {
      console.error('Failed to update slot:', error);
    }
  }

  async function toggleFlavor(flavorId: string, isActive: boolean) {
    try {
      await window.api.updateFlavor(flavorId, { isActive });
      loadAll();
    } catch (error) {
      console.error('Failed to update flavor:', error);
    }
  }

  function openFlavorModal(flavor?: Flavor) {
    if (flavor) {
      setEditingFlavor(flavor);
      let sizes: FlavorSize[] = [];
      try {
        sizes = JSON.parse(flavor.sizes);
      } catch {
        sizes = [{ name: 'Regular', price: 10 }];
      }
      setFlavorForm({
        name: flavor.name,
        description: flavor.description || '',
        sizes,
        season: flavor.season || 'year_round',
      });
    } else {
      setEditingFlavor(null);
      setFlavorForm({
        name: '',
        description: '',
        sizes: [{ name: 'Regular', price: 10 }],
        season: 'year_round',
      });
    }
    setShowFlavorModal(true);
  }

  function closeFlavorModal() {
    setShowFlavorModal(false);
    setEditingFlavor(null);
  }

  async function saveFlavor() {
    if (!flavorForm.name.trim()) return;

    try {
      if (editingFlavor) {
        await window.api.updateFlavor(editingFlavor.id, {
          name: flavorForm.name,
          description: flavorForm.description,
          sizes: flavorForm.sizes,
          season: flavorForm.season,
        });
      } else {
        await window.api.createFlavor({
          name: flavorForm.name,
          description: flavorForm.description,
          sizes: flavorForm.sizes,
          season: flavorForm.season,
        });
      }
      closeFlavorModal();
      loadAll();
    } catch (error) {
      console.error('Failed to save flavor:', error);
    }
  }

  async function deleteFlavor(flavor: Flavor) {
    if (!confirm(`Delete "${flavor.name}"? This will also delete the associated recipe.`)) return;

    try {
      await window.api.deleteFlavor(flavor.id);
      loadAll();
    } catch (error) {
      console.error('Failed to delete flavor:', error);
    }
  }

  function addSize() {
    setFlavorForm({
      ...flavorForm,
      sizes: [...flavorForm.sizes, { name: '', price: 0 }],
    });
  }

  function removeSize(index: number) {
    if (flavorForm.sizes.length <= 1) return;
    setFlavorForm({
      ...flavorForm,
      sizes: flavorForm.sizes.filter((_, i) => i !== index),
    });
  }

  function updateSize(index: number, field: 'name' | 'price', value: string | number) {
    const newSizes = [...flavorForm.sizes];
    newSizes[index] = { ...newSizes[index], [field]: value };
    setFlavorForm({ ...flavorForm, sizes: newSizes });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  function parseSizes(sizesJson: string) {
    try {
      const sizes = JSON.parse(sizesJson);
      return sizes.map((s: { name: string; price: number }) => `${s.name}: $${s.price}`).join(', ');
    } catch {
      return '-';
    }
  }

  // Calendar helpers
  function getCalendarDays() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the 1st
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }

  function getSlotsForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    return bakeSlots.filter((slot) => slot.date.startsWith(dateStr));
  }

  function formatMonthYear(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function prevMonth() {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  }

  function isToday(date: Date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function openNewSlotForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    setNewSlot({ ...newSlot, date: dateStr });
    setShowNewSlot(true);
  }

  return (
    <div className="config-page">
      <div className="page-header">
        <h1 className="page-title">Configuration</h1>
      </div>

      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('slots')}
          style={{ marginRight: '8px' }}
        >
          Bake Slots
        </button>
        <button
          className={`btn ${activeTab === 'flavors' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('flavors')}
          style={{ marginRight: '8px' }}
        >
          Flavors
        </button>
        <button
          className={`btn ${activeTab === 'locations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('locations')}
        >
          Locations
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* Bake Slots Tab */}
          {activeTab === 'slots' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Bake Slots</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* View Toggle */}
                  <div className="view-toggle" style={{ display: 'flex', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                    <button
                      className={`btn btn-small ${slotsView === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSlotsView('list')}
                      style={{ borderRadius: 0, border: 'none' }}
                    >
                      List
                    </button>
                    <button
                      className={`btn btn-small ${slotsView === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSlotsView('calendar')}
                      style={{ borderRadius: 0, border: 'none' }}
                    >
                      Calendar
                    </button>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowNewSlot(true)}>
                    + Add Bake Slot
                  </button>
                </div>
              </div>

              {/* List View */}
              {slotsView === 'list' && (
                <>
                  {bakeSlots.length === 0 ? (
                    <div className="empty-state">
                      <p>No bake slots configured. Add one to start taking orders!</p>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Location</th>
                          <th>Capacity</th>
                          <th>Orders</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bakeSlots
                          .filter((slot) => new Date(slot.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((slot) => (
                            <tr key={slot.id}>
                              <td>{formatDate(slot.date)}</td>
                              <td>{slot.location_name}</td>
                              <td>{slot.total_capacity}</td>
                              <td>{slot.current_orders}</td>
                              <td>
                                <span
                                  className={`status-badge ${slot.is_open ? 'status-paid' : 'status-canceled'}`}
                                >
                                  {slot.is_open ? 'Open' : 'Closed'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className={`btn btn-small ${slot.is_open ? 'btn-danger' : 'btn-primary'}`}
                                  onClick={() => toggleSlot(slot.id, !slot.is_open)}
                                >
                                  {slot.is_open ? 'Close' : 'Open'}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Calendar View */}
              {slotsView === 'calendar' && (
                <div className="calendar-view">
                  {/* Calendar Header */}
                  <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '8px 0' }}>
                    <button className="btn btn-secondary btn-small" onClick={prevMonth}>
                      ← Prev
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{formatMonthYear(calendarMonth)}</h3>
                    <button className="btn btn-secondary btn-small" onClick={nextMonth}>
                      Next →
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} style={{ padding: '8px', textAlign: 'center', fontWeight: '600', color: '#666', fontSize: '0.85rem' }}>
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {getCalendarDays().map((date, idx) => {
                      if (!date) {
                        return <div key={`empty-${idx}`} style={{ padding: '8px', minHeight: '80px' }} />;
                      }

                      const slots = getSlotsForDate(date);
                      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                      return (
                        <div
                          key={date.toISOString()}
                          className="calendar-day"
                          style={{
                            padding: '8px',
                            minHeight: '80px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            backgroundColor: isToday(date) ? '#fff9e6' : isPast ? '#f5f5f5' : '#fff',
                            cursor: isPast ? 'default' : 'pointer',
                            opacity: isPast ? 0.7 : 1,
                          }}
                          onClick={() => !isPast && openNewSlotForDate(date)}
                        >
                          <div style={{ fontWeight: isToday(date) ? '700' : '500', marginBottom: '4px', color: isToday(date) ? '#8B7355' : '#333' }}>
                            {date.getDate()}
                          </div>
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                padding: '2px 4px',
                                marginBottom: '2px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                backgroundColor: slot.is_open ? '#e8f5e9' : '#ffebee',
                                color: slot.is_open ? '#2e7d32' : '#c62828',
                                border: `1px solid ${slot.is_open ? '#a5d6a7' : '#ef9a9a'}`,
                              }}
                            >
                              <div style={{ fontWeight: '600' }}>{slot.location_name}</div>
                              <div>{slot.current_orders}/{slot.total_capacity} orders</div>
                              <button
                                className={`btn btn-small ${slot.is_open ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => toggleSlot(slot.id, !slot.is_open)}
                                style={{ marginTop: '2px', padding: '1px 4px', fontSize: '0.65rem' }}
                              >
                                {slot.is_open ? 'Close' : 'Open'}
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ marginTop: '12px', color: '#666', fontSize: '0.85rem' }}>
                    Click on a future date to add a new bake slot
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Flavors Tab */}
          {activeTab === 'flavors' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Flavors</h2>
                <button className="btn btn-primary" onClick={() => openFlavorModal()}>
                  + Add Flavor
                </button>
              </div>

              {flavors.length === 0 ? (
                <div className="empty-state">
                  <p>No flavors configured. Add one to start selling!</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Sizes & Prices</th>
                      <th>Season</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flavors.map((flavor) => (
                      <tr key={flavor.id}>
                        <td>{flavor.name}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {flavor.description || '-'}
                        </td>
                        <td>{parseSizes(flavor.sizes)}</td>
                        <td style={{ textTransform: 'capitalize' }}>
                          {flavor.season?.replace('_', ' ') || 'Year Round'}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${flavor.is_active ? 'status-paid' : 'status-canceled'}`}
                          >
                            {flavor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => openFlavorModal(flavor)}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn btn-small ${flavor.is_active ? 'btn-secondary' : 'btn-primary'}`}
                              onClick={() => toggleFlavor(flavor.id, !flavor.is_active)}
                            >
                              {flavor.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => deleteFlavor(flavor)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Locations Tab */}
          {activeTab === 'locations' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Pickup Locations</h2>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td>{location.name}</td>
                      <td>{location.address || '-'}</td>
                      <td>
                        <span
                          className={`status-badge ${location.is_active ? 'status-paid' : 'status-canceled'}`}
                        >
                          {location.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* New Bake Slot Modal */}
      {showNewSlot && (
        <div className="modal-overlay" onClick={() => setShowNewSlot(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Bake Slot</h2>
              <button className="modal-close" onClick={() => setShowNewSlot(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={newSlot.date}
                  onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <select
                  className="form-select"
                  value={newSlot.locationId}
                  onChange={(e) => setNewSlot({ ...newSlot, locationId: e.target.value })}
                >
                  <option value="">Select a location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacity (loaves)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newSlot.totalCapacity}
                  onChange={(e) =>
                    setNewSlot({ ...newSlot, totalCapacity: parseInt(e.target.value) })
                  }
                  min="1"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewSlot(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createBakeSlot}
                disabled={!newSlot.date || !newSlot.locationId}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flavor Modal */}
      {showFlavorModal && (
        <div className="modal-overlay" onClick={closeFlavorModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingFlavor ? 'Edit Flavor' : 'Add Flavor'}</h2>
              <button className="modal-close" onClick={closeFlavorModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={flavorForm.name}
                  onChange={(e) => setFlavorForm({ ...flavorForm, name: e.target.value })}
                  placeholder="e.g., Cinnamon Raisin"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={flavorForm.description}
                  onChange={(e) => setFlavorForm({ ...flavorForm, description: e.target.value })}
                  placeholder="Brief description of the flavor"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Season</label>
                <select
                  className="form-select"
                  value={flavorForm.season}
                  onChange={(e) => setFlavorForm({ ...flavorForm, season: e.target.value })}
                >
                  <option value="year_round">Year Round</option>
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="fall">Fall</option>
                  <option value="winter">Winter</option>
                  <option value="holiday">Holiday Special</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Sizes & Prices</label>
                {flavorForm.sizes.map((size, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={size.name}
                      onChange={(e) => updateSize(index, 'name', e.target.value)}
                      placeholder="Size name"
                      style={{ flex: 2 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <span style={{ marginRight: '4px' }}>$</span>
                      <input
                        type="number"
                        className="form-input"
                        value={size.price}
                        onChange={(e) => updateSize(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {flavorForm.sizes.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => removeSize(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-small btn-secondary" onClick={addSize}>
                  + Add Size
                </button>
              </div>

              {editingFlavor?.recipe_id ? (
                <p style={{ fontSize: '0.85rem', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => {
                      closeFlavorModal();
                      navigate('/recipes');
                    }}
                  >
                    Edit Recipe →
                  </button>
                </p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '12px' }}>
                  A recipe will be automatically created when you save this flavor.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeFlavorModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveFlavor}
                disabled={!flavorForm.name.trim() || flavorForm.sizes.some(s => !s.name.trim())}
              >
                {editingFlavor ? 'Save Changes' : 'Create Flavor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
