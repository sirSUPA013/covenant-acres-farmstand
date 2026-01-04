export interface Location {
  id: string;
  name: string;
  address: string;
  description: string;

  // Display
  isActive: boolean;
  sortOrder: number;

  createdAt: string;
  updatedAt: string;
}
