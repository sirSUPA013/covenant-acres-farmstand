import React, { useState, useEffect } from 'react';

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

interface Flavor {
  id: string;
  name: string;
  sizes: string;
  is_active: number;
  sort_order: number;
}

interface Location {
  id: string;
  name: string;
  address: string;
  is_active: number;
}

function ConfigPage() {
  const [activeTab, setActiveTab] = useState<'slots' | 'flavors' | 'locations'>('slots');
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // New slot form
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: '',
    locationId: '',
    totalCapacity: 24,
    cutoffTime: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [slotsData, flavorsData, locationsData] = await Promise.all([
        window.api.getBakeSlots({ upcoming: true }),
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
                <h2 className="card-title">Upcoming Bake Slots</h2>
                <button className="btn btn-primary" onClick={() => setShowNewSlot(true)}>
                  + Add Bake Slot
                </button>
              </div>

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
                    {bakeSlots.map((slot) => (
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
            </div>
          )}

          {/* Flavors Tab */}
          {activeTab === 'flavors' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Flavors</h2>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sizes & Prices</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flavors.map((flavor) => (
                    <tr key={flavor.id}>
                      <td>{flavor.name}</td>
                      <td>{parseSizes(flavor.sizes)}</td>
                      <td>
                        <span
                          className={`status-badge ${flavor.is_active ? 'status-paid' : 'status-canceled'}`}
                        >
                          {flavor.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-small ${flavor.is_active ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => toggleFlavor(flavor.id, !flavor.is_active)}
                        >
                          {flavor.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    </div>
  );
}

export default ConfigPage;
