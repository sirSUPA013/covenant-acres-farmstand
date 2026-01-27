import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Ingredient with library reference
interface Ingredient {
  id: string; // Unique ID for drag-drop sorting
  ingredient_id?: string;
  name: string;
  quantity: number;
  unit: string;
  base_unit?: string; // The unit from the ingredient library (for cost calculation)
  cost_per_unit?: number;
  density_g_per_ml?: number; // Density for weight/volume conversions
  phase?: 'base' | 'fold' | 'lamination';
}

// Unit conversion factors to grams (for weight) or ml (for volume)
const UNIT_TO_GRAMS: Record<string, number> = {
  'g': 1,
  'kg': 1000,
  'oz': 28.3495,
  'lbs': 453.592,
};

const UNIT_TO_ML: Record<string, number> = {
  'ml': 1,
  'tsp': 4.92892,
  'tbsp': 14.7868,
  'cup': 236.588,
  'fl oz': 29.5735,
};

// Check if a unit is a weight unit
function isWeightUnit(unit: string): boolean {
  return unit in UNIT_TO_GRAMS;
}

// Check if a unit is a volume unit
function isVolumeUnit(unit: string): boolean {
  return unit in UNIT_TO_ML;
}

// Check if conversion between two units requires density (cross-type: weight↔volume)
function needsDensityForConversion(fromUnit: string, toUnit: string): boolean {
  if (fromUnit === toUnit) return false;
  const fromIsWeight = isWeightUnit(fromUnit);
  const fromIsVolume = isVolumeUnit(fromUnit);
  const toIsWeight = isWeightUnit(toUnit);
  const toIsVolume = isVolumeUnit(toUnit);
  // Cross-type conversion needed
  return (fromIsWeight && toIsVolume) || (fromIsVolume && toIsWeight);
}

// Check if an ingredient has a conversion problem (needs density but doesn't have it)
function hasConversionProblem(ing: Ingredient): boolean {
  const baseUnit = ing.base_unit || ing.unit;
  if (!needsDensityForConversion(ing.unit, baseUnit)) return false;
  // Needs density but doesn't have a valid one
  return !ing.density_g_per_ml || ing.density_g_per_ml <= 0;
}

// Convert quantity from one unit to another, with optional density for cross-type conversion
function convertUnits(quantity: number, fromUnit: string, toUnit: string, densityGPerMl?: number): number {
  if (fromUnit === toUnit) return quantity;

  const fromIsWeight = isWeightUnit(fromUnit);
  const fromIsVolume = isVolumeUnit(fromUnit);
  const toIsWeight = isWeightUnit(toUnit);
  const toIsVolume = isVolumeUnit(toUnit);

  // Same type conversions (weight-to-weight or volume-to-volume)
  if (fromIsWeight && toIsWeight) {
    const inGrams = quantity * UNIT_TO_GRAMS[fromUnit];
    return inGrams / UNIT_TO_GRAMS[toUnit];
  }

  if (fromIsVolume && toIsVolume) {
    const inMl = quantity * UNIT_TO_ML[fromUnit];
    return inMl / UNIT_TO_ML[toUnit];
  }

  // Cross-type conversions require density
  if (densityGPerMl && densityGPerMl > 0) {
    // Volume to weight: convert to ml, then multiply by density to get grams
    if (fromIsVolume && toIsWeight) {
      const inMl = quantity * UNIT_TO_ML[fromUnit];
      const inGrams = inMl * densityGPerMl;
      return inGrams / UNIT_TO_GRAMS[toUnit];
    }

    // Weight to volume: convert to grams, then divide by density to get ml
    if (fromIsWeight && toIsVolume) {
      const inGrams = quantity * UNIT_TO_GRAMS[fromUnit];
      const inMl = inGrams / densityGPerMl;
      return inMl / UNIT_TO_ML[toUnit];
    }
  }

  // "each" or incompatible units without density - no conversion possible
  return quantity;
}

// Calculate ingredient cost with proper unit conversion
function calculateIngredientCost(ing: Ingredient): number {
  if (!ing.cost_per_unit || !ing.quantity) return 0;

  const baseUnit = ing.base_unit || ing.unit; // Fall back to recipe unit if no base_unit
  const quantityInBaseUnit = convertUnits(ing.quantity, ing.unit, baseUnit, ing.density_g_per_ml);
  const cost = quantityInBaseUnit * ing.cost_per_unit;

  return cost;
}

// Step with ID for drag-and-drop
interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
  duration_minutes?: number;
  phase?: string;
}

// Library ingredient from database
interface LibraryIngredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  package_price: number;
  package_size: number;
  package_unit: string;
  vendor: string;
  category: string;
  density_g_per_ml?: number;
}

interface Recipe {
  id: string;
  name: string;
  flavor_id: string;
  flavor_name: string;
  base_ingredients: string;
  fold_ingredients: string;
  lamination_ingredients: string;
  steps: string;
  yields_loaves: number;
  loaf_size: string;
  total_cost: number;
  cost_per_loaf: number;
  notes: string;
  season: string;
  source: string;
  updated_at: string;
  prep_time_minutes: number;
  bake_time_minutes: number;
  bake_temp: string;
  prep_instructions: string;
  bake_instructions: string;
}

const STEP_PHASES = ['Setup', 'Mix', 'Bulk Ferment', 'Shape', 'Proof', 'Bake', 'Cool'] as const;
const INGREDIENT_PHASES = ['base', 'fold', 'lamination'] as const;

// Sortable Step Component
function SortableStep({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: RecipeStep;
  index: number;
  onUpdate: (index: number, field: keyof RecipeStep, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="step-row">
      <div {...attributes} {...listeners} className="drag-handle">
        ≡
      </div>
      <span className="step-number">{index + 1}.</span>
      <div className="step-content">
        <div className="step-header">
          <select
            className="step-phase-select"
            value={step.phase || ''}
            onChange={(e) => onUpdate(index, 'phase', e.target.value)}
          >
            <option value="">Phase...</option>
            {STEP_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <div className="step-duration">
            <input
              type="number"
              placeholder="0"
              value={step.duration_minutes || ''}
              onChange={(e) => onUpdate(index, 'duration_minutes', parseInt(e.target.value) || 0)}
            />
            <span>min</span>
          </div>
        </div>
        <textarea
          className="step-instruction"
          placeholder="Describe this step..."
          value={step.instruction}
          onChange={(e) => onUpdate(index, 'instruction', e.target.value)}
          rows={3}
        />
      </div>
      <button className="step-remove" onClick={() => onRemove(index)}>
        ×
      </button>
    </div>
  );
}

// Sortable Ingredient Row Component
function SortableIngredient({
  ingredient,
  index,
  libraryIngredients,
  onSelect,
  onUpdate,
  onRemove,
  calculateCost,
  onAddNew,
}: {
  ingredient: Ingredient;
  index: number;
  libraryIngredients: LibraryIngredient[];
  onSelect: (index: number, libIng: LibraryIngredient) => void;
  onUpdate: (index: number, field: keyof Ingredient, value: string | number) => void;
  onRemove: (index: number) => void;
  calculateCost: (ing: Ingredient) => number;
  onAddNew: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ingredient.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="ingredient-row">
      <div {...attributes} {...listeners} className="drag-handle" style={{ cursor: 'grab', padding: '0 8px', color: '#999' }}>
        ≡
      </div>
      <IngredientDropdown
        value={ingredient.name}
        libraryIngredients={libraryIngredients}
        onSelect={(libIng) => onSelect(index, libIng)}
        onAddNew={onAddNew}
      />
      <input
        type="number"
        className="form-input ingredient-qty"
        placeholder="Qty"
        value={ingredient.quantity || ''}
        onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)}
      />
      <select
        className="form-select ingredient-unit-select"
        value={ingredient.unit || 'g'}
        onChange={(e) => onUpdate(index, 'unit', e.target.value)}
      >
        <optgroup label="Weight">
          <option value="g">g</option>
          <option value="oz">oz</option>
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </optgroup>
        <optgroup label="Volume">
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
          <option value="cup">cup</option>
          <option value="fl oz">fl oz</option>
        </optgroup>
        <optgroup label="Count">
          <option value="each">each</option>
        </optgroup>
      </select>
      <div className="ingredient-cost">
        {ingredient.cost_per_unit ? (
          hasConversionProblem(ingredient) ? (
            <span style={{ color: '#e74c3c' }} title="Cost may be wrong: recipe uses different unit type than purchase unit, but no density set for conversion">
              ⚠️ ${calculateCost(ingredient).toFixed(2)}
            </span>
          ) : (
            `$${calculateCost(ingredient).toFixed(2)}`
          )
        ) : '-'}
        {hasConversionProblem(ingredient) && (
          <small style={{display: 'block', fontSize: '9px', color: '#e74c3c'}}>
            needs density for {ingredient.unit}↔{ingredient.base_unit}
          </small>
        )}
      </div>
      <select
        className="ingredient-phase-select"
        value={ingredient.phase || 'base'}
        onChange={(e) => onUpdate(index, 'phase', e.target.value)}
      >
        {INGREDIENT_PHASES.map((phase) => (
          <option key={phase} value={phase}>
            {phase.charAt(0).toUpperCase() + phase.slice(1)}
          </option>
        ))}
      </select>
      <button className="ingredient-remove" onClick={() => onRemove(index)}>
        ×
      </button>
    </div>
  );
}

// Ingredient Dropdown Component
function IngredientDropdown({
  value,
  libraryIngredients,
  onSelect,
  onAddNew,
}: {
  value: string;
  libraryIngredients: LibraryIngredient[];
  onSelect: (ingredient: LibraryIngredient) => void;
  onAddNew: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = libraryIngredients.filter((ing) =>
    ing.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ingredient-dropdown" ref={dropdownRef}>
      <input
        type="text"
        className="ingredient-dropdown-input"
        placeholder="Select ingredient..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && (
        <div className="ingredient-dropdown-list">
          {filtered.map((ing) => (
            <div
              key={ing.id}
              className={`ingredient-dropdown-item ${ing.name === value ? 'selected' : ''}`}
              onClick={() => {
                onSelect(ing);
                setSearch(ing.name);
                setIsOpen(false);
              }}
            >
              {ing.name}
              <span className="ingredient-detail">
                {ing.unit} · ${ing.cost_per_unit?.toFixed(4)}/{ing.unit}
              </span>
            </div>
          ))}
          <div
            className="ingredient-dropdown-item add-new"
            onClick={() => {
              onAddNew();
              setIsOpen(false);
            }}
          >
            ➕ Add New Ingredient
          </div>
        </div>
      )}
    </div>
  );
}

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Library ingredients
  const [libraryIngredients, setLibraryIngredients] = useState<LibraryIngredient[]>([]);

  // Edit form state
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);
  const [editSteps, setEditSteps] = useState<RecipeStep[]>([]);
  const [editBakeTemp, setEditBakeTemp] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Inline ingredient form
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [ingredientFormMessage, setIngredientFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unit: 'g',
    package_price: 0,
    package_size: 0,
    package_unit: '',
    vendor: '',
    category: 'base',
    density_grams: null as number | null, // User-friendly way to enter density
    density_measure: 'tsp' as 'tsp' | 'tbsp' | 'cup', // Which volume measure they used
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadRecipes();
    loadLibraryIngredients();
  }, []);

  async function loadRecipes() {
    setLoading(true);
    try {
      const data = await window.api.getRecipes();
      setRecipes(data as Recipe[]);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    }
    setLoading(false);
  }

  async function loadLibraryIngredients() {
    try {
      const data = await window.api.getIngredients();
      setLibraryIngredients(data as LibraryIngredient[]);
    } catch (error) {
      console.error('Failed to load ingredients:', error);
    }
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setEditMode(false);
    // Parse JSON fields with phase assignment and IDs
    try {
      const base = JSON.parse(recipe.base_ingredients || '[]').map((ing: Ingredient, idx: number) => ({
        ...ing,
        id: ing.id || `ing-base-${Date.now()}-${idx}`,
        phase: 'base' as const,
      }));
      const fold = JSON.parse(recipe.fold_ingredients || '[]').map((ing: Ingredient, idx: number) => ({
        ...ing,
        id: ing.id || `ing-fold-${Date.now()}-${idx}`,
        phase: 'fold' as const,
      }));
      const lamination = JSON.parse(recipe.lamination_ingredients || '[]').map((ing: Ingredient, idx: number) => ({
        ...ing,
        id: ing.id || `ing-lam-${Date.now()}-${idx}`,
        phase: 'lamination' as const,
      }));
      setEditIngredients([...base, ...fold, ...lamination]);

      // Parse steps with IDs
      const steps = JSON.parse(recipe.steps || '[]').map((step: RecipeStep, idx: number) => ({
        ...step,
        id: step.id || `step-${Date.now()}-${idx}`,
      }));
      setEditSteps(steps);
    } catch {
      setEditIngredients([]);
      setEditSteps([]);
    }
    setEditBakeTemp(recipe.bake_temp || '');
    setEditNotes(recipe.notes || '');
  }

  function startEdit() {
    setEditMode(true);
  }

  async function saveRecipe() {
    if (!selectedRecipe) return;

    try {
      // Consolidate duplicate ingredients (same ingredient_id, unit, and phase) before saving
      const consolidatedIngredients: Ingredient[] = [];
      const mergedNames: string[] = [];

      for (const ing of editIngredients) {
        if (!ing.ingredient_id || !ing.name) continue; // Skip empty rows

        const existingIndex = consolidatedIngredients.findIndex(
          (c) => c.ingredient_id === ing.ingredient_id && c.unit === ing.unit && c.phase === ing.phase
        );

        if (existingIndex !== -1) {
          // Combine quantities
          consolidatedIngredients[existingIndex].quantity += ing.quantity;
          if (!mergedNames.includes(ing.name)) {
            mergedNames.push(ing.name);
          }
        } else {
          consolidatedIngredients.push({ ...ing });
        }
      }

      // Notify user if any ingredients were merged
      if (mergedNames.length > 0) {
        alert(`Duplicate ingredients were combined: ${mergedNames.join(', ')}`);
      }

      // Separate ingredients by phase
      const baseIngredients = consolidatedIngredients.filter((i) => i.phase === 'base' || !i.phase);
      const foldIngredients = consolidatedIngredients.filter((i) => i.phase === 'fold');
      const laminationIngredients = consolidatedIngredients.filter((i) => i.phase === 'lamination');

      // Auto-calculate times from step phases
      const prepTimeMinutes = calculatePreBakeTime(editSteps);
      const bakeTimeMinutes = calculateBakeTime(editSteps);

      await window.api.updateRecipe(selectedRecipe.id, {
        baseIngredients,
        foldIngredients,
        laminationIngredients,
        steps: editSteps,
        yieldsLoaves: 1, // Always 1 loaf per recipe
        prepTimeMinutes,
        bakeTimeMinutes,
        bakeTemp: editBakeTemp,
        prepInstructions: '', // Clear legacy fields
        bakeInstructions: '',
        notes: editNotes,
      });

      // Reload recipes and refresh the selected recipe with updated data
      const updatedRecipes = await window.api.getRecipes() as Recipe[];
      setRecipes(updatedRecipes);

      // Find and re-select the updated recipe to refresh the view
      const updatedRecipe = updatedRecipes.find(r => r.id === selectedRecipe.id);
      if (updatedRecipe) {
        openRecipe(updatedRecipe);
      }

      setEditMode(false);
    } catch (error) {
      console.error('Failed to save recipe:', error);
    }
  }

  function addIngredient() {
    setEditIngredients([
      ...editIngredients,
      { id: `ing-${Date.now()}-${editIngredients.length}`, name: '', quantity: 0, unit: 'g', cost_per_unit: 0, phase: 'base' },
    ]);
  }

  function handleDragEndIngredients(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditIngredients((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function selectIngredientFromLibrary(index: number, libIngredient: LibraryIngredient) {
    const updated = [...editIngredients];
    updated[index] = {
      ...updated[index],
      ingredient_id: libIngredient.id,
      name: libIngredient.name,
      unit: libIngredient.unit,
      base_unit: libIngredient.unit, // Store the library's unit for cost calculation
      cost_per_unit: libIngredient.cost_per_unit,
      density_g_per_ml: libIngredient.density_g_per_ml, // Store density for cross-type conversions
    };
    setEditIngredients(updated);
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string | number) {
    const updated = [...editIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditIngredients(updated);
  }

  function removeIngredient(index: number) {
    setEditIngredients(editIngredients.filter((_, i) => i !== index));
  }

  function addStep() {
    const newStep: RecipeStep = {
      id: `step-${Date.now()}`,
      order: editSteps.length + 1,
      instruction: '',
      duration_minutes: 0,
      phase: '',
    };
    setEditSteps([...editSteps, newStep]);
  }

  function updateStep(index: number, field: keyof RecipeStep, value: string | number) {
    const updated = [...editSteps];
    updated[index] = { ...updated[index], [field]: value };
    setEditSteps(updated);
  }

  function removeStep(index: number) {
    const updated = editSteps.filter((_, i) => i !== index);
    updated.forEach((step, i) => {
      step.order = i + 1;
    });
    setEditSteps(updated);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((step, idx) => ({ ...step, order: idx + 1 }));
      });
    }
  }

  async function saveNewIngredient() {
    setIngredientFormMessage(null);

    if (!newIngredient.name.trim()) {
      setIngredientFormMessage({ type: 'error', text: 'Please enter an ingredient name.' });
      return;
    }
    if (!newIngredient.package_size || newIngredient.package_size <= 0) {
      setIngredientFormMessage({ type: 'error', text: 'Please enter a valid package size greater than 0.' });
      return;
    }
    if (newIngredient.package_price <= 0) {
      setIngredientFormMessage({ type: 'error', text: 'Please enter a valid package price greater than 0.' });
      return;
    }
    try {
      // Convert grams per measure to density (g/ml)
      // 1 tsp = 4.92892 ml, 1 tbsp = 14.7868 ml, 1 cup = 236.588 ml
      const mlPerMeasure: Record<string, number> = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588 };
      const density = newIngredient.density_grams
        ? newIngredient.density_grams / mlPerMeasure[newIngredient.density_measure]
        : null;

      const savedName = newIngredient.name;
      await window.api.createIngredient({
        name: newIngredient.name,
        unit: newIngredient.unit,
        packagePrice: newIngredient.package_price,
        packageSize: newIngredient.package_size,
        packageUnit: newIngredient.package_unit,
        vendor: newIngredient.vendor,
        category: newIngredient.category,
        density: density,
      });
      await loadLibraryIngredients();
      setNewIngredient({
        name: '',
        unit: 'g',
        package_price: 0,
        package_size: 0,
        package_unit: '',
        vendor: '',
        category: 'base',
        density_grams: null,
        density_measure: 'tsp',
      });
      setIngredientFormMessage({ type: 'success', text: `"${savedName}" added! You can now select it from the dropdown.` });
      // Auto-hide success message and close form after a delay
      setTimeout(() => {
        setShowInlineForm(false);
        setIngredientFormMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to create ingredient:', error);
      setIngredientFormMessage({ type: 'error', text: `Failed to save: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  const PRE_BAKE_PHASES = ['Setup', 'Mix', 'Bulk Ferment', 'Shape', 'Proof'];
  const BAKE_PHASES = ['Bake', 'Cool'];

  function calculatePreBakeTime(steps: RecipeStep[]): number {
    return steps
      .filter((s) => PRE_BAKE_PHASES.includes(s.phase || ''))
      .reduce((sum, step) => sum + (step.duration_minutes || 0), 0);
  }

  function calculateBakeTime(steps: RecipeStep[]): number {
    return steps
      .filter((s) => BAKE_PHASES.includes(s.phase || ''))
      .reduce((sum, step) => sum + (step.duration_minutes || 0), 0);
  }

  function formatMinutes(minutes: number): string {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function formatTotalTime(steps: RecipeStep[]): string {
    const totalMinutes = steps.reduce((sum, step) => sum + (step.duration_minutes || 0), 0);
    return formatMinutes(totalMinutes);
  }

  function calculateTotalCost(ingredients: Ingredient[]): number {
    return ingredients.reduce((sum, ing) => sum + calculateIngredientCost(ing), 0);
  }

  function parseIngredients(json: string): Ingredient[] {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  function parseSteps(json: string): RecipeStep[] {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  return (
    <div className="recipes-page">
      <div className="page-header">
        <h1 className="page-title">Recipes</h1>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading recipes...</div>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <p>No recipes configured yet. Add flavors first, then configure their recipes.</p>
          </div>
        ) : (
          <div className="recipe-grid">
            {recipes.map((recipe) => {
              const baseIng = parseIngredients(recipe.base_ingredients);
              const foldIng = parseIngredients(recipe.fold_ingredients);
              const lamIng = parseIngredients(recipe.lamination_ingredients);
              const allIngredients = [...baseIng, ...foldIng, ...lamIng];
              const totalCost = recipe.total_cost || calculateTotalCost(allIngredients);
              return (
                <div key={recipe.id} className="recipe-card" onClick={() => openRecipe(recipe)}>
                  <h3 className="recipe-name">{recipe.flavor_name || recipe.name}</h3>
                  <div className="recipe-meta">
                    <span>1 loaf</span>
                    {recipe.loaf_size && <span>Size: {recipe.loaf_size}</span>}
                    {recipe.season && recipe.season !== 'year_round' && (
                      <span className="season-tag">{recipe.season}</span>
                    )}
                  </div>
                  {totalCost > 0 && (
                    <div className="recipe-cost">Est. Cost: ${totalCost.toFixed(2)}/loaf</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="modal-overlay">
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedRecipe.flavor_name} Recipe</h2>
              <button className="modal-close" onClick={() => setSelectedRecipe(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {!editMode ? (
                // View Mode
                <>
                  {/* Time & Temperature */}
                  {(selectedRecipe.prep_time_minutes ||
                    selectedRecipe.bake_time_minutes ||
                    selectedRecipe.bake_temp) && (
                    <div className="form-row">
                      {selectedRecipe.prep_time_minutes > 0 && (
                        <div className="form-group">
                          <label className="form-label">Prep Time</label>
                          <p>{selectedRecipe.prep_time_minutes} min</p>
                        </div>
                      )}
                      {selectedRecipe.bake_time_minutes > 0 && (
                        <div className="form-group">
                          <label className="form-label">Bake Time</label>
                          <p>{selectedRecipe.bake_time_minutes} min</p>
                        </div>
                      )}
                      {selectedRecipe.bake_temp && (
                        <div className="form-group">
                          <label className="form-label">Bake Temperature</label>
                          <p>{selectedRecipe.bake_temp}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Base Ingredients */}
                  {parseIngredients(selectedRecipe.base_ingredients).length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Base Ingredients</label>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Quantity</th>
                            <th>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseIngredients(selectedRecipe.base_ingredients).map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td>
                                {ing.quantity} {ing.unit}
                              </td>
                              <td>
                                {ing.cost_per_unit ? (
                                  hasConversionProblem(ing) ? (
                                    <span style={{ color: '#e74c3c' }} title="Cost may be wrong: needs density for unit conversion">
                                      ⚠️ ${calculateIngredientCost(ing).toFixed(2)}
                                    </span>
                                  ) : (
                                    `$${calculateIngredientCost(ing).toFixed(2)}`
                                  )
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Fold-ins */}
                  {parseIngredients(selectedRecipe.fold_ingredients).length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Fold-in Ingredients</label>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Quantity</th>
                            <th>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseIngredients(selectedRecipe.fold_ingredients).map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td>
                                {ing.quantity} {ing.unit}
                              </td>
                              <td>
                                {ing.cost_per_unit ? (
                                  hasConversionProblem(ing) ? (
                                    <span style={{ color: '#e74c3c' }} title="Cost may be wrong: needs density for unit conversion">
                                      ⚠️ ${calculateIngredientCost(ing).toFixed(2)}
                                    </span>
                                  ) : (
                                    `$${calculateIngredientCost(ing).toFixed(2)}`
                                  )
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Lamination */}
                  {parseIngredients(selectedRecipe.lamination_ingredients).length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Lamination Ingredients</label>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Quantity</th>
                            <th>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseIngredients(selectedRecipe.lamination_ingredients).map((ing, i) => (
                            <tr key={i}>
                              <td>{ing.name}</td>
                              <td>
                                {ing.quantity} {ing.unit}
                              </td>
                              <td>
                                {ing.cost_per_unit ? (
                                  hasConversionProblem(ing) ? (
                                    <span style={{ color: '#e74c3c' }} title="Cost may be wrong: needs density for unit conversion">
                                      ⚠️ ${calculateIngredientCost(ing).toFixed(2)}
                                    </span>
                                  ) : (
                                    `$${calculateIngredientCost(ing).toFixed(2)}`
                                  )
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Cost Summary */}
                  {selectedRecipe.total_cost && (
                    <div className="form-group">
                      <label className="form-label">Cost Summary</label>
                      <p>
                        Total Cost: <strong>${selectedRecipe.total_cost.toFixed(2)}</strong>
                      </p>
                    </div>
                  )}

                  {/* Steps */}
                  {parseSteps(selectedRecipe.steps).length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Process Steps</label>
                      <ol className="recipe-steps">
                        {parseSteps(selectedRecipe.steps).map((step) => (
                          <li key={step.order}>
                            {step.phase && (
                              <span
                                className={`phase-badge phase-${step.phase.toLowerCase().replace(' ', '-')}`}
                              >
                                {step.phase}
                              </span>
                            )}{' '}
                            {step.instruction}
                            {step.duration_minutes ? (
                              <span className="step-time"> ({step.duration_minutes} min)</span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {selectedRecipe.notes && (
                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <p>{selectedRecipe.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                // Edit Mode
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Bake Temp</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editBakeTemp}
                        onChange={(e) => setEditBakeTemp(e.target.value)}
                        placeholder="e.g., 450°F"
                      />
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <div className="form-group">
                    <label className="form-label">Ingredients (per loaf)</label>
                    <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                      Select from ingredient library or add new ingredients.
                    </p>

                    {/* Column Headers */}
                    {editIngredients.length > 0 && (
                      <div className="ingredient-header">
                        <span style={{ width: '30px' }}></span>
                        <span style={{ flex: 2 }}>Ingredient</span>
                        <span style={{ width: '70px', textAlign: 'center' }}>Qty</span>
                        <span style={{ minWidth: '60px', textAlign: 'center' }}>Unit</span>
                        <span style={{ minWidth: '70px', textAlign: 'right' }}>Cost</span>
                        <span style={{ minWidth: '100px' }}>Phase</span>
                        <span style={{ width: '40px' }}></span>
                      </div>
                    )}

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndIngredients}
                    >
                      <SortableContext
                        items={editIngredients.map((ing) => ing.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {editIngredients.map((ing, i) => (
                          <SortableIngredient
                            key={ing.id}
                            ingredient={ing}
                            index={i}
                            libraryIngredients={libraryIngredients}
                            onSelect={selectIngredientFromLibrary}
                            onUpdate={updateIngredient}
                            onRemove={removeIngredient}
                            calculateCost={calculateIngredientCost}
                            onAddNew={() => setShowInlineForm(true)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Add Ingredient Button */}
                    <button
                      className="btn btn-secondary"
                      onClick={addIngredient}
                      style={{ marginTop: '4px', width: '100%' }}
                    >
                      + Add Ingredient
                    </button>

                    {/* Inline New Ingredient Form */}
                    {showInlineForm && (
                      <div className="inline-ingredient-form">
                        <h4>Add New Ingredient to Library</h4>
                        <div className="inline-form-row">
                          <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                              type="text"
                              className="form-input"
                              value={newIngredient.name}
                              onChange={(e) =>
                                setNewIngredient({ ...newIngredient, name: e.target.value })
                              }
                              placeholder="e.g., Flour"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Unit</label>
                            <select
                              className="form-select"
                              value={newIngredient.unit}
                              onChange={(e) =>
                                setNewIngredient({ ...newIngredient, unit: e.target.value })
                              }
                            >
                              <optgroup label="Weight">
                                <option value="g">g (grams)</option>
                                <option value="oz">oz (ounces)</option>
                                <option value="lbs">lbs (pounds)</option>
                                <option value="kg">kg (kilograms)</option>
                              </optgroup>
                              <optgroup label="Volume">
                                <option value="ml">ml (milliliters)</option>
                                <option value="tsp">tsp (teaspoon)</option>
                                <option value="tbsp">tbsp (tablespoon)</option>
                                <option value="cup">cup</option>
                                <option value="fl oz">fl oz (fluid ounce)</option>
                              </optgroup>
                              <optgroup label="Count">
                                <option value="each">each</option>
                              </optgroup>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Package Price ($)</label>
                            <input
                              type="number"
                              className="form-input"
                              step="0.01"
                              value={newIngredient.package_price || ''}
                              onChange={(e) =>
                                setNewIngredient({
                                  ...newIngredient,
                                  package_price: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Package Size</label>
                            <input
                              type="number"
                              className="form-input"
                              value={newIngredient.package_size || ''}
                              onChange={(e) =>
                                setNewIngredient({
                                  ...newIngredient,
                                  package_size: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="e.g., 1000"
                            />
                          </div>
                        </div>
                        <div className="inline-form-row">
                          <div className="form-group">
                            <label className="form-label">Vendor</label>
                            <input
                              type="text"
                              className="form-input"
                              value={newIngredient.vendor}
                              onChange={(e) =>
                                setNewIngredient({ ...newIngredient, vendor: e.target.value })
                              }
                              placeholder="e.g., Costco"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Category</label>
                            <select
                              className="form-select"
                              value={newIngredient.category}
                              onChange={(e) =>
                                setNewIngredient({ ...newIngredient, category: e.target.value })
                              }
                            >
                              <option value="base">Base</option>
                              <option value="sweetener">Sweetener</option>
                              <option value="spice">Spice</option>
                              <option value="misc">Misc</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Weight per Volume
                              <small style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 'normal' }}>
                                For weight↔volume conversion (optional)
                              </small>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="number"
                                className="form-input"
                                step="0.1"
                                style={{ width: '80px' }}
                                value={newIngredient.density_grams || ''}
                                onChange={(e) =>
                                  setNewIngredient({
                                    ...newIngredient,
                                    density_grams: e.target.value ? parseFloat(e.target.value) : null,
                                  })
                                }
                                placeholder="grams"
                              />
                              <span>g per</span>
                              <select
                                className="form-select"
                                style={{ width: '80px' }}
                                value={newIngredient.density_measure}
                                onChange={(e) =>
                                  setNewIngredient({
                                    ...newIngredient,
                                    density_measure: e.target.value as 'tsp' | 'tbsp' | 'cup',
                                  })
                                }
                              >
                                <option value="tsp">tsp</option>
                                <option value="tbsp">tbsp</option>
                                <option value="cup">cup</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        {ingredientFormMessage && (
                          <div
                            style={{
                              padding: '10px 14px',
                              marginBottom: '12px',
                              borderRadius: '6px',
                              backgroundColor: ingredientFormMessage.type === 'error' ? '#ffebee' : '#e8f5e9',
                              color: ingredientFormMessage.type === 'error' ? '#c62828' : '#2e7d32',
                              fontWeight: 500,
                            }}
                          >
                            {ingredientFormMessage.text}
                          </div>
                        )}
                        <div className="inline-form-buttons">
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowInlineForm(false);
                              setIngredientFormMessage(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button className="btn btn-primary" onClick={saveNewIngredient}>
                            Save Ingredient
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ingredient Cost Total */}
                    {editIngredients.length > 0 && (
                      <div style={{ marginTop: '12px', fontWeight: 500 }}>
                        Ingredient Cost: ${calculateTotalCost(editIngredients).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Steps Section */}
                  <div
                    style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px', marginTop: '16px' }}
                  >
                    <div className="form-group">
                      <label className="form-label">Process Steps</label>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                        Drag to reorder. Assign phases for organization.
                      </p>

                      {/* Time Breakdown Display */}
                      {editSteps.length > 0 && (
                        <div className="time-breakdown">
                          <div className="time-item">
                            <span className="time-label">Pre-Bake:</span>
                            <span className="time-value">{formatMinutes(calculatePreBakeTime(editSteps))}</span>
                          </div>
                          <div className="time-item">
                            <span className="time-label">Bake:</span>
                            <span className="time-value">{formatMinutes(calculateBakeTime(editSteps))}</span>
                          </div>
                          <div className="time-item time-total">
                            <span className="time-label">Total:</span>
                            <span className="time-value">{formatTotalTime(editSteps)}</span>
                          </div>
                        </div>
                      )}

                      {/* Column Headers */}
                      {editSteps.length > 0 && (
                        <div className="step-header">
                          <span style={{ width: '32px' }}></span>
                          <span style={{ width: '28px' }}>#</span>
                          <span style={{ flex: 1 }}>Phase / Instruction</span>
                          <span style={{ width: '80px', textAlign: 'center' }}>Duration</span>
                          <span style={{ width: '40px' }}></span>
                        </div>
                      )}

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={editSteps.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {editSteps.map((step, i) => (
                            <SortableStep
                              key={step.id}
                              step={step}
                              index={i}
                              onUpdate={updateStep}
                              onRemove={removeStep}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>

                      {/* Add Step Button */}
                      <button
                        className="btn btn-secondary"
                        onClick={addStep}
                        style={{ marginTop: '8px', width: '100%' }}
                      >
                        + Add Step
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-textarea"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {!editMode ? (
                <>
                  <button className="btn btn-secondary" onClick={() => setSelectedRecipe(null)}>
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={startEdit}>
                    Edit Recipe
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={saveRecipe}>
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .recipe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .recipe-card {
          background: var(--light-gray);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .recipe-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .recipe-name {
          font-family: var(--font-heading);
          color: var(--primary-green);
          margin-bottom: 8px;
        }
        .recipe-meta {
          display: flex;
          gap: 12px;
          font-size: 0.875rem;
          color: var(--text-gray);
          margin-bottom: 8px;
        }
        .recipe-cost {
          font-size: 0.875rem;
          color: var(--primary-green);
          font-weight: 500;
        }
        .modal-large {
          max-width: 950px;
          width: 90%;
        }
        .recipe-steps {
          padding-left: 20px;
        }
        .recipe-steps li {
          margin-bottom: 12px;
          line-height: 1.6;
        }
        .step-time {
          color: var(--text-gray);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

export default RecipesPage;
