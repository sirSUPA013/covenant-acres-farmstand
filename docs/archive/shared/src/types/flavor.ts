export type Season = 'year_round' | 'spring' | 'summer' | 'fall' | 'winter' | 'christmas';

export interface FlavorSize {
  name: string; // e.g., "Regular", "XL"
  price: number;
  weight: string; // e.g., "1 lb", "1.5 lb"
}

export interface Flavor {
  id: string;
  name: string;
  description: string;

  // Pricing by size
  sizes: FlavorSize[];

  // Recipe link
  recipeId: string | null;

  // Availability
  isActive: boolean;
  season: Season;

  // Display
  sortOrder: number;
  imageUrl: string | null;

  // Cost (for profit tracking)
  estimatedCost: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface FlavorSummary {
  id: string;
  name: string;
  basePrice: number;
  isActive: boolean;
}
