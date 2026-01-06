export interface Ingredient {
  name: string;
  quantity: number;
  unit: string; // g, cups, tsp, tbsp, etc.
  costPerUnit: number | null;
}

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  duration: string | null; // e.g., "10 minutes", "2 hours"
  temperature: string | null; // e.g., "350°F", "room temp"
}

export interface Recipe {
  id: string;
  name: string;
  flavorId: string | null;

  // Ingredients by phase
  baseIngredients: Ingredient[];
  foldIngredients: Ingredient[]; // Added at 2nd fold
  laminationIngredients: Ingredient[]; // Added during lamination

  // Instructions
  steps: RecipeStep[];

  // Yield
  yieldsLoaves: number;
  loafSize: string;

  // Calculated cost
  totalCost: number | null;
  costPerLoaf: number | null;

  // Notes
  notes: string;

  // Metadata
  season: string | null;
  source: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface PrepSheetItem {
  flavorName: string;
  quantity: number;
  ingredients: {
    name: string;
    totalQuantity: number;
    unit: string;
  }[];
  steps: RecipeStep[];
}

export interface BakeDayPrepSheet {
  bakeSlotId: string;
  date: string;
  location: string;
  generatedAt: string;
  items: PrepSheetItem[];
  totalLoaves: number;
}
