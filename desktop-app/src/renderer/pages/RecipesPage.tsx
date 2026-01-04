import React, { useState, useEffect } from 'react';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit?: number;
}

interface RecipeStep {
  order: number;
  instruction: string;
  duration_minutes?: number;
  notes?: string;
}

interface Recipe {
  id: string;
  name: string;
  flavor_id: string;
  flavor_name: string;
  base_ingredients: string; // JSON
  fold_ingredients: string; // JSON
  lamination_ingredients: string; // JSON
  steps: string; // JSON
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

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);
  const [editSteps, setEditSteps] = useState<RecipeStep[]>([]);
  const [editYield, setEditYield] = useState(1);
  const [editPrepTime, setEditPrepTime] = useState(0);
  const [editBakeTime, setEditBakeTime] = useState(0);
  const [editBakeTemp, setEditBakeTemp] = useState('');
  const [editPrepInstructions, setEditPrepInstructions] = useState('');
  const [editBakeInstructions, setEditBakeInstructions] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    loadRecipes();
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

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setEditMode(false);
    // Parse JSON fields - combine all ingredient types
    try {
      const base = JSON.parse(recipe.base_ingredients || '[]');
      const fold = JSON.parse(recipe.fold_ingredients || '[]');
      const lamination = JSON.parse(recipe.lamination_ingredients || '[]');
      setEditIngredients([...base, ...fold, ...lamination]);
      setEditSteps(JSON.parse(recipe.steps || '[]'));
    } catch {
      setEditIngredients([]);
      setEditSteps([]);
    }
    setEditYield(recipe.yields_loaves || 1);
    setEditPrepTime(recipe.prep_time_minutes || 0);
    setEditBakeTime(recipe.bake_time_minutes || 0);
    setEditBakeTemp(recipe.bake_temp || '');
    setEditPrepInstructions(recipe.prep_instructions || '');
    setEditBakeInstructions(recipe.bake_instructions || '');
    setEditNotes(recipe.notes || '');
  }

  function startEdit() {
    setEditMode(true);
  }

  async function saveRecipe() {
    if (!selectedRecipe) return;

    try {
      await window.api.updateRecipe(selectedRecipe.id, {
        baseIngredients: editIngredients,
        steps: editSteps,
        yieldsLoaves: editYield,
        prepTimeMinutes: editPrepTime,
        bakeTimeMinutes: editBakeTime,
        bakeTemp: editBakeTemp,
        prepInstructions: editPrepInstructions,
        bakeInstructions: editBakeInstructions,
        notes: editNotes,
      });
      setEditMode(false);
      loadRecipes();
    } catch (error) {
      console.error('Failed to save recipe:', error);
    }
  }

  function addIngredient() {
    setEditIngredients([
      ...editIngredients,
      { name: '', quantity: 0, unit: 'g', cost_per_unit: 0 },
    ]);
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
    setEditSteps([
      ...editSteps,
      { order: editSteps.length + 1, instruction: '', duration_minutes: 0 },
    ]);
  }

  function updateStep(index: number, field: keyof RecipeStep, value: string | number) {
    const updated = [...editSteps];
    updated[index] = { ...updated[index], [field]: value };
    setEditSteps(updated);
  }

  function removeStep(index: number) {
    const updated = editSteps.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((step, i) => {
      step.order = i + 1;
    });
    setEditSteps(updated);
  }

  function calculateTotalCost(ingredients: Ingredient[]): number {
    return ingredients.reduce((sum, ing) => sum + ing.quantity * ing.cost_per_unit, 0);
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
              const yieldLoaves = recipe.yields_loaves || 1;
              return (
                <div
                  key={recipe.id}
                  className="recipe-card"
                  onClick={() => openRecipe(recipe)}
                >
                  <h3 className="recipe-name">{recipe.flavor_name || recipe.name}</h3>
                  <div className="recipe-meta">
                    <span>Yield: {yieldLoaves} loaves</span>
                    {recipe.loaf_size && <span>Size: {recipe.loaf_size}</span>}
                    {recipe.season && recipe.season !== 'year_round' && (
                      <span className="season-tag">{recipe.season}</span>
                    )}
                  </div>
                  {totalCost > 0 && (
                    <div className="recipe-cost">
                      Est. Cost: ${totalCost.toFixed(2)} (${(totalCost / yieldLoaves).toFixed(2)}/loaf)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="modal-overlay" onClick={() => setSelectedRecipe(null)}>
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
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Yield</label>
                      <p>{selectedRecipe.yields_loaves || 1} loaves</p>
                    </div>
                    {selectedRecipe.loaf_size && (
                      <div className="form-group">
                        <label className="form-label">Loaf Size</label>
                        <p>{selectedRecipe.loaf_size}</p>
                      </div>
                    )}
                    {selectedRecipe.season && selectedRecipe.season !== 'year_round' && (
                      <div className="form-group">
                        <label className="form-label">Season</label>
                        <p style={{ textTransform: 'capitalize' }}>{selectedRecipe.season.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Time & Temperature */}
                  {(selectedRecipe.prep_time_minutes || selectedRecipe.bake_time_minutes || selectedRecipe.bake_temp) && (
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
                              <td>{ing.quantity} {ing.unit}</td>
                              <td>{ing.cost_per_unit ? `$${(ing.quantity * ing.cost_per_unit).toFixed(2)}` : '-'}</td>
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
                              <td>{ing.quantity} {ing.unit}</td>
                              <td>{ing.cost_per_unit ? `$${(ing.quantity * ing.cost_per_unit).toFixed(2)}` : '-'}</td>
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
                              <td>{ing.quantity} {ing.unit}</td>
                              <td>{ing.cost_per_unit ? `$${(ing.quantity * ing.cost_per_unit).toFixed(2)}` : '-'}</td>
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
                      <p>Total Cost: <strong>${selectedRecipe.total_cost.toFixed(2)}</strong></p>
                      <p>Cost per Loaf: <strong>${selectedRecipe.cost_per_loaf?.toFixed(2) || (selectedRecipe.total_cost / (selectedRecipe.yields_loaves || 1)).toFixed(2)}</strong></p>
                    </div>
                  )}

                  {/* Preparation Instructions */}
                  {selectedRecipe.prep_instructions && (
                    <div className="form-group">
                      <label className="form-label">Preparation Instructions</label>
                      <div className="instructions-text">{selectedRecipe.prep_instructions}</div>
                    </div>
                  )}

                  {/* Baking Instructions */}
                  {selectedRecipe.bake_instructions && (
                    <div className="form-group">
                      <label className="form-label">Baking Instructions</label>
                      <div className="instructions-text">{selectedRecipe.bake_instructions}</div>
                    </div>
                  )}

                  {/* Step-by-step Process */}
                  {parseSteps(selectedRecipe.steps).length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Step-by-Step Process</label>
                      <ol className="recipe-steps">
                        {parseSteps(selectedRecipe.steps).map((step) => (
                          <li key={step.order}>
                            {step.instruction}
                            {step.duration_minutes ? (
                              <span className="step-time"> ({step.duration_minutes} min)</span>
                            ) : null}
                            {step.notes && <div className="step-notes">{step.notes}</div>}
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
                      <label className="form-label">Yield (loaves)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={editYield}
                        onChange={(e) => setEditYield(parseInt(e.target.value))}
                        min="1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prep Time (min)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={editPrepTime}
                        onChange={(e) => setEditPrepTime(parseInt(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bake Time (min)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={editBakeTime}
                        onChange={(e) => setEditBakeTime(parseInt(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bake Temp</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editBakeTemp}
                        onChange={(e) => setEditBakeTemp(e.target.value)}
                        placeholder="e.g., 375°F"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Ingredients
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={addIngredient}
                        style={{ marginLeft: '16px' }}
                      >
                        + Add
                      </button>
                    </label>
                    {editIngredients.map((ing, i) => (
                      <div key={i} className="ingredient-row">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Name"
                          value={ing.name}
                          onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                          style={{ flex: 2 }}
                        />
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Qty"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(i, 'quantity', parseFloat(e.target.value))}
                          style={{ flex: 1 }}
                        />
                        <select
                          className="form-select"
                          value={ing.unit}
                          onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="oz">oz</option>
                          <option value="lb">lb</option>
                          <option value="ml">ml</option>
                          <option value="L">L</option>
                          <option value="tsp">tsp</option>
                          <option value="tbsp">tbsp</option>
                          <option value="cup">cup</option>
                          <option value="each">each</option>
                        </select>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="$/unit"
                          value={ing.cost_per_unit}
                          onChange={(e) => updateIngredient(i, 'cost_per_unit', parseFloat(e.target.value))}
                          step="0.01"
                          style={{ flex: 1 }}
                        />
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => removeIngredient(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Preparation Instructions</label>
                    <textarea
                      className="form-textarea"
                      value={editPrepInstructions}
                      onChange={(e) => setEditPrepInstructions(e.target.value)}
                      rows={4}
                      placeholder="Enter preparation instructions (mixing, shaping, proofing, etc.)"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Baking Instructions</label>
                    <textarea
                      className="form-textarea"
                      value={editBakeInstructions}
                      onChange={(e) => setEditBakeInstructions(e.target.value)}
                      rows={4}
                      placeholder="Enter baking instructions (oven temps, timing, cooling, etc.)"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Step-by-Step Process
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={addStep}
                        style={{ marginLeft: '16px' }}
                      >
                        + Add Step
                      </button>
                    </label>
                    {editSteps.map((step, i) => (
                      <div key={i} className="step-row">
                        <span className="step-number">{step.order}.</span>
                        <textarea
                          className="form-textarea"
                          placeholder="Instruction"
                          value={step.instruction}
                          onChange={(e) => updateStep(i, 'instruction', e.target.value)}
                          rows={2}
                          style={{ flex: 3 }}
                        />
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Min"
                          value={step.duration_minutes || ''}
                          onChange={(e) =>
                            updateStep(i, 'duration_minutes', parseInt(e.target.value) || 0)
                          }
                          style={{ width: '60px' }}
                        />
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => removeStep(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
          max-width: 800px;
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
        .step-notes {
          color: var(--text-gray);
          font-size: 0.875rem;
          font-style: italic;
          margin-top: 4px;
        }
        .ingredient-row, .step-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .step-number {
          font-weight: 600;
          color: var(--primary-green);
          min-width: 24px;
          padding-top: 8px;
        }
        .instructions-text {
          white-space: pre-wrap;
          background: var(--light-gray);
          padding: 12px;
          border-radius: 6px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

export default RecipesPage;
