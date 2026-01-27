import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BakeSlot {
  id: string;
  date: string;
  location_id: string;
  location_name: string;
  locations: Array<{ id: string; name: string }>;
  total_capacity: number;
  current_orders: number;
  cutoff_time: string;
  is_open: number;
}

interface FlavorSize {
  name: string;
  price: number;
  is_active: boolean;
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

interface OverheadSettings {
  packaging_per_loaf: number;
  utilities_per_loaf: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  package_price: number;
  package_size: number;
  package_unit: string;
  contents_size: number;
  cost_per_unit: number;
  vendor: string;
  category: string;
  density_g_per_ml?: number;
}

function ConfigPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive active tab from URL path
  const getActiveTab = (): 'slots' | 'flavors' | 'locations' | 'costs' | 'ingredients' => {
    const path = location.pathname;
    if (path.includes('/flavors')) return 'flavors';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/costs')) return 'costs';
    if (path.includes('/ingredients')) return 'ingredients';
    return 'slots'; // default
  };
  const activeTab = getActiveTab();
  const [bakeSlots, setBakeSlots] = useState<BakeSlot[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Overhead/cost settings
  const [overhead, setOverhead] = useState<OverheadSettings>({ packaging_per_loaf: 0.50, utilities_per_loaf: 0.12 });
  const [overheadForm, setOverheadForm] = useState<OverheadSettings>({ packaging_per_loaf: 0.50, utilities_per_loaf: 0.12 });
  const [savingOverhead, setSavingOverhead] = useState(false);

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientFilter, setIngredientFilter] = useState<string>('all');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    unit: 'g',
    package_price: 0,
    package_size: 0,
    package_unit: '',
    contents_size: 0, // Amount in each package (for package types like can, jar)
    vendor: '',
    category: 'base',
    density_grams: null as number | null, // For weight↔volume conversion
    density_measure: 'tsp' as 'tsp' | 'tbsp' | 'cup', // Which volume measure they used
  });

  // Package types that require contents fields
  const PACKAGE_TYPES = ['can', 'jar', 'bag', 'box', 'bottle', 'pack', 'each'];
  const isPackageType = PACKAGE_TYPES.includes(ingredientForm.package_unit);
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientSuccess, setIngredientSuccess] = useState<string | null>(null);

  // Location editing
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
  });

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
    locationIds: [] as string[],
    totalCapacity: 24,
    cutoffTime: '',
  });

  // Flavor editing
  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [flavorForm, setFlavorForm] = useState({
    name: '',
    description: '',
    sizes: [{ name: 'Regular', price: 10, is_active: true }] as FlavorSize[],
    season: 'year_round',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [slotsData, flavorsData, locationsData, overheadData, ingredientsData] = await Promise.all([
        window.api.getBakeSlots({}), // Get all slots for calendar view
        window.api.getFlavors(),
        window.api.getLocations(),
        window.api.getOverhead(),
        window.api.getIngredients(),
      ]);
      setBakeSlots(slotsData as BakeSlot[]);
      setFlavors(flavorsData as Flavor[]);
      setLocations(locationsData as Location[]);
      if (overheadData) {
        setOverhead(overheadData);
        setOverheadForm(overheadData);
      }
      setIngredients(ingredientsData as Ingredient[]);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    setLoading(false);
  }

  async function saveOverhead() {
    setSavingOverhead(true);
    try {
      await window.api.updateOverhead({
        packaging_per_loaf: overheadForm.packaging_per_loaf,
        utilities_per_loaf: overheadForm.utilities_per_loaf,
      });
      setOverhead(overheadForm);
    } catch (error) {
      console.error('Failed to save overhead settings:', error);
    }
    setSavingOverhead(false);
  }

  function resetOverheadForm() {
    setOverheadForm(overhead);
  }

  const overheadChanged = overhead.packaging_per_loaf !== overheadForm.packaging_per_loaf ||
    overhead.utilities_per_loaf !== overheadForm.utilities_per_loaf;

  // Ingredient functions
  function openIngredientModal(ingredient?: Ingredient) {
    if (ingredient) {
      setEditingIngredient(ingredient);
      // Convert density (g/ml) back to grams per teaspoon for display
      // 1 tsp = 4.92892 ml, so g/ml × 4.92892 = g/tsp
      const gramsPerTsp = ingredient.density_g_per_ml
        ? ingredient.density_g_per_ml * 4.92892
        : null;
      setIngredientForm({
        name: ingredient.name,
        unit: ingredient.unit,
        package_price: ingredient.package_price,
        package_size: ingredient.package_size,
        package_unit: ingredient.package_unit || '',
        contents_size: ingredient.contents_size || 0,
        vendor: ingredient.vendor || '',
        category: ingredient.category || 'base',
        density_grams: gramsPerTsp ? Math.round(gramsPerTsp * 10) / 10 : null, // Round to 1 decimal
        density_measure: 'tsp', // Default to tsp when editing
      });
    } else {
      setEditingIngredient(null);
      setIngredientForm({
        name: '',
        unit: 'g',
        package_price: 0,
        package_size: 0,
        package_unit: '',
        contents_size: 0,
        vendor: '',
        category: 'base',
        density_grams: null,
        density_measure: 'tsp',
      });
    }
    setShowIngredientModal(true);
  }

  function closeIngredientModal() {
    setShowIngredientModal(false);
    setEditingIngredient(null);
    setIngredientSuccess(null);
    setIngredientSaving(false);
  }

  async function saveIngredient() {
    // Validate required fields with user feedback
    if (!ingredientForm.name.trim()) {
      setIngredientSuccess('Please enter an ingredient name.');
      return;
    }
    if (ingredientForm.package_size <= 0) {
      setIngredientSuccess('Please enter a valid package size (greater than 0).');
      return;
    }
    if (ingredientForm.package_price <= 0) {
      setIngredientSuccess('Please enter a valid package price (greater than 0).');
      return;
    }
    // If package type selected, contents_size is required
    if (isPackageType && ingredientForm.contents_size <= 0) {
      setIngredientSuccess('Please enter the contents amount (e.g., how many oz in each can).');
      return;
    }

    setIngredientSaving(true);
    setIngredientSuccess(null);

    // For weight/volume packages, auto-set unit to match package_unit
    const effectiveUnit = isPackageType ? ingredientForm.unit : ingredientForm.package_unit;

    // Convert grams per measure to density (g/ml)
    // 1 tsp = 4.92892 ml, 1 tbsp = 14.7868 ml, 1 cup = 236.588 ml
    const mlPerMeasure: Record<string, number> = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588 };
    const density = ingredientForm.density_grams
      ? ingredientForm.density_grams / mlPerMeasure[ingredientForm.density_measure]
      : null;

    try {
      if (editingIngredient) {
        await window.api.updateIngredient(editingIngredient.id, {
          name: ingredientForm.name,
          unit: effectiveUnit,
          packagePrice: ingredientForm.package_price,
          packageSize: ingredientForm.package_size,
          packageUnit: ingredientForm.package_unit,
          contentsSize: isPackageType ? ingredientForm.contents_size : 0,
          vendor: ingredientForm.vendor,
          category: ingredientForm.category,
          density: density,
        });
        setIngredientSuccess(`"${ingredientForm.name}" has been updated.`);
      } else {
        await window.api.createIngredient({
          name: ingredientForm.name,
          unit: effectiveUnit,
          packagePrice: ingredientForm.package_price,
          packageSize: ingredientForm.package_size,
          packageUnit: ingredientForm.package_unit,
          contentsSize: isPackageType ? ingredientForm.contents_size : 0,
          vendor: ingredientForm.vendor,
          category: ingredientForm.category,
          density: density,
        });
        setIngredientSuccess(`"${ingredientForm.name}" has been added to your ingredient library.`);
      }
      // Auto-close after showing success briefly
      setTimeout(() => {
        closeIngredientModal();
        setIngredientSuccess(null);
        loadAll();
      }, 1500);
    } catch (error) {
      console.error('Failed to save ingredient:', error);
      setIngredientSuccess(`Failed to save: $\{error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIngredientSaving(false);
    }
  }

  async function deleteIngredient(ingredient: Ingredient) {
    if (!confirm(`Delete "${ingredient.name}"? This cannot be undone.`)) return;

    try {
      await window.api.deleteIngredient(ingredient.id);
      loadAll();
    } catch (error) {
      console.error('Failed to delete ingredient:', error);
    }
  }

  // Filter and search ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesFilter = ingredientFilter === 'all' || ing.category === ingredientFilter;
    const matchesSearch = ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()) ||
      (ing.vendor && ing.vendor.toLowerCase().includes(ingredientSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Location functions
  function openLocationModal(location?: Location) {
    if (location) {
      setEditingLocation(location);
      setLocationForm({
        name: location.name,
        address: location.address || '',
      });
    } else {
      setEditingLocation(null);
      setLocationForm({
        name: '',
        address: '',
      });
    }
    setShowLocationModal(true);
  }

  function closeLocationModal() {
    setShowLocationModal(false);
    setEditingLocation(null);
  }

  async function saveLocation() {
    if (!locationForm.name.trim()) return;

    try {
      if (editingLocation) {
        await window.api.updateLocation(editingLocation.id, {
          name: locationForm.name,
          address: locationForm.address,
        });
      } else {
        await window.api.createLocation({
          name: locationForm.name,
          address: locationForm.address,
        });
      }
      closeLocationModal();
      loadAll();
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  }

  async function toggleLocation(locationId: string, isActive: boolean) {
    try {
      await window.api.updateLocation(locationId, { is_active: isActive ? 1 : 0 });
      loadAll();
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }

  async function deleteLocation(location: Location) {
    if (!confirm(`Delete "${location.name}"? This cannot be undone.`)) return;

    try {
      await window.api.deleteLocation(location.id);
      loadAll();
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  }

  // Format cost per unit for display
  function formatCostPerUnit(cost: number, unit: string) {
    // Always show 4 decimal places for small costs, 2 for larger
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}/${unit}`;
    } else {
      return `$${cost.toFixed(2)}/${unit}`;
    }
  }

  async function createBakeSlot() {
    if (!newSlot.date || newSlot.locationIds.length === 0) return;

    try {
      await window.api.createBakeSlot({
        date: newSlot.date,
        locationIds: newSlot.locationIds,
        totalCapacity: newSlot.totalCapacity,
        cutoffTime: newSlot.cutoffTime || new Date(new Date(newSlot.date).getTime() - 48 * 60 * 60 * 1000).toISOString(),
      });
      setShowNewSlot(false);
      setNewSlot({ date: '', locationIds: [], totalCapacity: 24, cutoffTime: '' });
      loadAll();
      // Trigger immediate sync so customer order form can see the new slot
      window.api.triggerSync().catch((err) => console.error('Sync failed:', err));
    } catch (error) {
      console.error('Failed to create bake slot:', error);
    }
  }

  function toggleLocationSelection(locationId: string) {
    setNewSlot(prev => {
      const isSelected = prev.locationIds.includes(locationId);
      return {
        ...prev,
        locationIds: isSelected
          ? prev.locationIds.filter(id => id !== locationId)
          : [...prev.locationIds, locationId],
      };
    });
  }

  async function toggleSlot(slotId: string, isOpen: boolean) {
    try {
      await window.api.updateBakeSlot(slotId, { is_open: isOpen ? 1 : 0 });
      loadAll();
      // Trigger immediate sync so customer order form reflects the change
      window.api.triggerSync().catch((err) => console.error('Sync failed:', err));
    } catch (error) {
      console.error('Failed to update slot:', error);
    }
  }

  async function toggleFlavor(flavorId: string, isActive: boolean) {
    try {
      await window.api.updateFlavor(flavorId, { isActive });
      loadAll();
      // Trigger immediate sync so customer order form reflects the change
      window.api.triggerSync().catch((err) => console.error('Sync failed:', err));
    } catch (error) {
      console.error('Failed to update flavor:', error);
    }
  }

  function openFlavorModal(flavor?: Flavor) {
    if (flavor) {
      setEditingFlavor(flavor);
      let sizes: FlavorSize[] = [];
      try {
        const parsed = JSON.parse(flavor.sizes);
        // Migrate sizes without is_active (default to true)
        sizes = parsed.map((s: { name: string; price: number; is_active?: boolean }) => ({
          name: s.name,
          price: s.price,
          is_active: s.is_active !== undefined ? s.is_active : true,
        }));
      } catch {
        sizes = [{ name: 'Regular', price: 10, is_active: true }];
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
        sizes: [{ name: 'Regular', price: 10, is_active: true }],
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

  async function duplicateFlavor(flavor: Flavor) {
    try {
      const result = await window.api.duplicateFlavor(flavor.id);
      if (result.success) {
        loadAll();
      } else {
        alert(result.error || 'Failed to duplicate flavor');
      }
    } catch (error) {
      console.error('Failed to duplicate flavor:', error);
    }
  }

  function addSize() {
    setFlavorForm({
      ...flavorForm,
      sizes: [...flavorForm.sizes, { name: '', price: 0, is_active: true }],
    });
  }

  function removeSize(index: number) {
    if (flavorForm.sizes.length <= 1) return;
    setFlavorForm({
      ...flavorForm,
      sizes: flavorForm.sizes.filter((_, i) => i !== index),
    });
  }

  function updateSize(index: number, field: 'name' | 'price' | 'is_active', value: string | number | boolean) {
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
      return sizes.map((s: { name: string; price: number; is_active?: boolean }) => {
        const label = `${s.name}: $${s.price}`;
        // Mark inactive sizes
        if (s.is_active === false) {
          return `(${label})`;
        }
        return label;
      }).join(', ');
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
    setNewSlot({ ...newSlot, date: dateStr, locationIds: [] });
    setShowNewSlot(true);
  }

  return (
    <div className="config-page">


      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* Pick Up Days Tab */}
          {activeTab === 'slots' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Pick Up Days</h2>
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
                    + Add Pick Up Day
                  </button>
                </div>
              </div>

              {/* List View */}
              {slotsView === 'list' && (
                <>
                  {bakeSlots.length === 0 ? (
                    <div className="empty-state">
                      <p>No pick up days configured. Add one to start taking orders!</p>
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
                    Click on a future date to add a new pick up day
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
                              className="btn btn-small btn-secondary"
                              onClick={() => duplicateFlavor(flavor)}
                              title="Create a copy of this flavor and its recipe"
                            >
                              Duplicate
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
                <button className="btn btn-primary" onClick={() => openLocationModal()}>
                  + Add Location
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="empty-state">
                  <p>No locations configured. Add one to set up pickup points!</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Status</th>
                      <th>Actions</th>
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
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => openLocationModal(location)}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn btn-small ${location.is_active ? 'btn-secondary' : 'btn-primary'}`}
                              onClick={() => toggleLocation(location.id, !location.is_active)}
                            >
                              {location.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => deleteLocation(location)}
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

          {/* Costs Tab */}
          {activeTab === 'costs' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Cost Settings</h2>
              </div>

              <div style={{ padding: '20px', maxWidth: '500px' }}>
                <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.9rem' }}>
                  Set overhead costs that apply to each loaf. These are added to ingredient costs when calculating profit.
                </p>

                <div className="form-group">
                  <label className="form-label">Packaging (per loaf)</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fontSize: '1.1rem' }}>$</span>
                    <input
                      type="number"
                      className="form-input"
                      value={overheadForm.packaging_per_loaf}
                      onChange={(e) => setOverheadForm({ ...overheadForm, packaging_per_loaf: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      style={{ maxWidth: '120px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px', lineHeight: '1.4' }}>
                    <strong>Includes:</strong> Bread bags, labels, twist ties, parchment paper, pan liners<br />
                    <strong>How to calculate:</strong> Add up what you spend on packaging supplies, divide by how many loaves those supplies cover.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Utilities (per loaf)</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fontSize: '1.1rem' }}>$</span>
                    <input
                      type="number"
                      className="form-input"
                      value={overheadForm.utilities_per_loaf}
                      onChange={(e) => setOverheadForm({ ...overheadForm, utilities_per_loaf: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      style={{ maxWidth: '120px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px', lineHeight: '1.4' }}>
                    <strong>Includes:</strong> Electricity (oven), propane/gas, paper towels, cleaning supplies<br />
                    <strong>How to calculate:</strong> Estimate monthly costs for baking-related utilities, divide by loaves baked that month.
                  </div>
                  <details style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px', cursor: 'pointer' }}>
                    <summary style={{ color: '#8B7355', fontWeight: '500' }}>See example calculation (propane oven)</summary>
                    <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px', lineHeight: '1.5' }}>
                      <strong>Propane usage estimate:</strong><br />
                      • Standard oven: ~35,000 BTU/hr<br />
                      • 4 hours at 450°F (45% duty cycle): ~63,000 BTUs<br />
                      • Propane: 91,500 BTUs/gallon → <strong>0.69 gal/bake day</strong><br /><br />
                      <strong>Cost per loaf (Indiana bulk propane ~$2.25/gal):</strong><br />
                      • 0.69 gal × $2.25 = $1.55/bake day<br />
                      • 18-24 loaves → <strong>$0.06-0.09/loaf</strong> for propane<br /><br />
                      <em>Add ~$0.03 for electricity, paper towels, cleaning supplies → $0.10-0.12 total is reasonable.</em>
                    </div>
                  </details>
                </div>

                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px', marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontWeight: '600' }}>Total Overhead per Loaf</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#8B7355' }}>
                      ${(overheadForm.packaging_per_loaf + overheadForm.utilities_per_loaf).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={saveOverhead}
                      disabled={!overheadChanged || savingOverhead}
                    >
                      {savingOverhead ? 'Saving...' : 'Save Changes'}
                    </button>
                    {overheadChanged && (
                      <button className="btn btn-secondary" onClick={resetOverheadForm}>
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ingredients Tab */}
          {activeTab === 'ingredients' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Ingredient Library</h2>
                <button className="btn btn-primary" onClick={() => openIngredientModal()}>
                  + Add Ingredient
                </button>
              </div>

              {/* Filter and Search */}
              <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>Category:</label>
                  <select
                    className="form-select"
                    value={ingredientFilter}
                    onChange={(e) => setIngredientFilter(e.target.value)}
                    style={{ minWidth: '120px' }}
                  >
                    <option value="all">All</option>
                    <option value="base">Base</option>
                    <option value="sweetener">Sweetener</option>
                    <option value="spice">Spice</option>
                    <option value="misc">Misc</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search ingredients..."
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredIngredients.length === 0 ? (
                <div className="empty-state">
                  <p>No ingredients found. {ingredients.length === 0 ? 'Add one to get started!' : 'Try adjusting your filter.'}</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Cost/Unit</th>
                      <th>Package</th>
                      <th>Price</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIngredients.map((ing) => (
                      <tr key={ing.id}>
                        <td style={{ fontWeight: '500' }}>{ing.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {formatCostPerUnit(ing.cost_per_unit, ing.unit)}
                        </td>
                        <td>
                          {ing.contents_size > 0
                            ? `${ing.package_size} ${ing.package_unit} × ${ing.contents_size} ${ing.unit}`
                            : `${ing.package_size} ${ing.package_unit || ing.unit}`}
                        </td>
                        <td>${ing.package_price.toFixed(2)}</td>
                        <td>{ing.vendor || '-'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{ing.category}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => openIngredientModal(ing)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => deleteIngredient(ing)}
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

              <div style={{ padding: '12px 16px', borderTop: '1px solid #e0e0e0', fontSize: '0.85rem', color: '#666' }}>
                {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} in library
              </div>
            </div>
          )}
        </>
      )}

      {/* New Pick Up Day Modal */}
      {showNewSlot && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Pick Up Day</h2>
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
                <label className="form-label">Pickup Locations</label>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                  Select all locations where customers can pick up on this day
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {locations.filter(loc => loc.is_active).map((loc) => (
                    <label
                      key={loc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: newSlot.locationIds.includes(loc.id) ? '#e8f5e9' : '#f5f5f5',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: newSlot.locationIds.includes(loc.id) ? '1px solid #4caf50' : '1px solid transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newSlot.locationIds.includes(loc.id)}
                        onChange={() => toggleLocationSelection(loc.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: newSlot.locationIds.includes(loc.id) ? '600' : '400' }}>
                        {loc.name}
                      </span>
                    </label>
                  ))}
                </div>
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
                disabled={!newSlot.date || newSlot.locationIds.length === 0}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flavor Modal */}
      {showFlavorModal && (
        <div className="modal-overlay">
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
                <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                  Toggle the checkbox to show/hide each size on the order form.
                </p>
                {flavorForm.sizes.map((size, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title={size.is_active ? 'Visible to customers' : 'Hidden from customers'}
                    >
                      <input
                        type="checkbox"
                        checked={size.is_active}
                        onChange={(e) => updateSize(index, 'is_active', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={size.name}
                      onChange={(e) => updateSize(index, 'name', e.target.value)}
                      placeholder="Size name"
                      style={{ flex: 2, opacity: size.is_active ? 1 : 0.5 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, opacity: size.is_active ? 1 : 0.5 }}>
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

      {/* Ingredient Modal */}
      {showIngredientModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}</h2>
              <button className="modal-close" onClick={closeIngredientModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                  placeholder="e.g., Flour"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={ingredientForm.category}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, category: e.target.value })}
                  >
                    <option value="base">Base</option>
                    <option value="sweetener">Sweetener</option>
                    <option value="spice">Spice</option>
                    <option value="misc">Misc</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ingredientForm.vendor}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, vendor: e.target.value })}
                    placeholder="e.g., Costco"
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px', marginTop: '8px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Package Info</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                  Enter how much you paid and how much you got. Cost per unit will be calculated automatically.
                </p>

                <div className="form-group">
                  <label className="form-label">Package Price *</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '4px' }}>$</span>
                    <input
                      type="number"
                      className="form-input"
                      value={ingredientForm.package_price || ''}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, package_price: parseFloat(e.target.value) || 0 })}
                      placeholder="18.71"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Package Size *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={ingredientForm.package_size || ''}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, package_size: parseFloat(e.target.value) || 0 })}
                      placeholder="29"
                      min="0"
                      step="0.01"
                      style={{ flex: 1 }}
                    />
                    <select
                      className="form-select"
                      value={ingredientForm.package_unit}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, package_unit: e.target.value })}
                      style={{ width: '140px' }}
                    >
                      <option value="">-- select --</option>
                      <optgroup label="Weight">
                        <option value="oz">oz (ounces)</option>
                        <option value="lb">lb (pounds)</option>
                        <option value="g">g (grams)</option>
                        <option value="kg">kg (kilograms)</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="fl oz">fl oz</option>
                        <option value="cup">cup(s)</option>
                        <option value="pint">pint</option>
                        <option value="quart">quart</option>
                        <option value="gallon">gallon</option>
                        <option value="ml">ml</option>
                        <option value="L">L (liters)</option>
                      </optgroup>
                      <optgroup label="Package Types">
                        <option value="can">can</option>
                        <option value="jar">jar</option>
                        <option value="bag">bag</option>
                        <option value="box">box</option>
                        <option value="bottle">bottle</option>
                        <option value="pack">pack</option>
                        <option value="each">each</option>
                      </optgroup>
                    </select>
                  </div>
                  <p className="form-hint">
                    {isPackageType
                      ? `How many ${ingredientForm.package_unit}s did you buy?`
                      : 'How the ingredient is sold (e.g., "20 lb" or "10 fl oz")'
                    }
                  </p>
                </div>

                {/* Contents fields - only show for package types (can, jar, bag, etc.) */}
                {isPackageType && (
                  <div className="form-group">
                    <label className="form-label">Contents per {ingredientForm.package_unit} *</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-input"
                        value={ingredientForm.contents_size || ''}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, contents_size: parseFloat(e.target.value) || 0 })}
                        placeholder="12"
                        min="0"
                        step="0.01"
                        style={{ width: '100px' }}
                      />
                      <select
                        className="form-select"
                        value={ingredientForm.unit}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                        style={{ width: '140px' }}
                      >
                        <optgroup label="Weight">
                          <option value="g">g (grams)</option>
                          <option value="oz">oz (ounces)</option>
                          <option value="lb">lb (pounds)</option>
                          <option value="kg">kg (kilograms)</option>
                        </optgroup>
                        <optgroup label="Volume">
                          <option value="ml">ml (milliliters)</option>
                          <option value="fl oz">fl oz</option>
                          <option value="cup">cup</option>
                          <option value="tsp">tsp</option>
                          <option value="tbsp">tbsp</option>
                        </optgroup>
                      </select>
                    </div>
                    <p className="form-hint">
                      How much is in each {ingredientForm.package_unit}? (e.g., "12 oz" per can)
                    </p>
                  </div>
                )}

                {ingredientForm.package_size > 0 && ingredientForm.package_price > 0 && (!isPackageType || ingredientForm.contents_size > 0) && (
                  <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>Calculated Cost per Unit:</span>
                      <span style={{ fontWeight: '700', color: '#8B7355', fontSize: '1.1rem' }}>
                        {isPackageType
                          ? formatCostPerUnit(ingredientForm.package_price / (ingredientForm.package_size * ingredientForm.contents_size), ingredientForm.unit)
                          : formatCostPerUnit(ingredientForm.package_price / ingredientForm.package_size, ingredientForm.package_unit)
                        }
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                      {isPackageType
                        ? `$${ingredientForm.package_price.toFixed(2)} ÷ (${ingredientForm.package_size} ${ingredientForm.package_unit}s × ${ingredientForm.contents_size} ${ingredientForm.unit} each)`
                        : `$${ingredientForm.package_price.toFixed(2)} ÷ ${ingredientForm.package_size} ${ingredientForm.package_unit}`
                      }
                    </div>
                  </div>
                )}

                {/* Density for weight↔volume conversion */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">
                    Weight per Volume
                    <span style={{ fontWeight: 'normal', color: '#666' }}> (optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="form-input"
                      step="0.1"
                      value={ingredientForm.density_grams || ''}
                      onChange={(e) =>
                        setIngredientForm({
                          ...ingredientForm,
                          density_grams: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="grams"
                      style={{ width: '100px' }}
                    />
                    <span>g per</span>
                    <select
                      className="form-select"
                      value={ingredientForm.density_measure}
                      onChange={(e) =>
                        setIngredientForm({
                          ...ingredientForm,
                          density_measure: e.target.value as 'tsp' | 'tbsp' | 'cup',
                        })
                      }
                      style={{ width: '90px' }}
                    >
                      <option value="tsp">tsp</option>
                      <option value="tbsp">tbsp</option>
                      <option value="cup">cup</option>
                    </select>
                  </div>
                  <p className="form-hint" style={{ marginTop: '4px' }}>
                    Needed for converting between weight and volume in recipes.
                    <br />
                    Measure a level amount and weigh it on a kitchen scale.
                  </p>
                </div>
              </div>
            </div>
            {ingredientSuccess && (
              <div style={{
                padding: '12px 16px',
                margin: '0 16px 16px',
                borderRadius: '6px',
                backgroundColor: ingredientSuccess.includes('Failed') || ingredientSuccess.includes('Please') ? '#ffebee' : '#e8f5e9',
                color: ingredientSuccess.includes('Failed') || ingredientSuccess.includes('Please') ? '#c62828' : '#2e7d32',
                fontWeight: '500',
                textAlign: 'center',
              }}>
                {ingredientSuccess}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeIngredientModal} disabled={ingredientSaving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveIngredient}
                disabled={ingredientSaving}
              >
                {ingredientSaving ? 'Saving...' : (editingIngredient ? 'Save Changes' : 'Add Ingredient')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingLocation ? 'Edit Location' : 'Add Location'}</h2>
              <button className="modal-close" onClick={closeLocationModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g., Farmer's Market"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  placeholder="e.g., 123 Main St, City, State"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeLocationModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveLocation}
                disabled={!locationForm.name.trim()}
              >
                {editingLocation ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
