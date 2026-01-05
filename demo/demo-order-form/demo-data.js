/**
 * Demo Data for Mock Order Form
 * This data mirrors what would come from the real API
 */

const DEMO_LOCATIONS = [
  { id: 'loc-demo1', name: "Saturday Farmer's Market", address: '100 Main Street, Downtown' },
  { id: 'loc-demo2', name: 'Farm Pickup', address: '4521 Country Road, Covenant Acres Farm' },
  { id: 'loc-demo3', name: 'Wednesday Market', address: '250 Oak Avenue, Community Center' },
];

// Generate upcoming bake slots
function generateDemoSlots() {
  const slots = [];
  const today = new Date();

  // Next 4 Saturdays (Farmer's Market)
  for (let i = 0; i < 4; i++) {
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7) + (i * 7));
    if (saturday <= today) saturday.setDate(saturday.getDate() + 7);

    slots.push({
      id: `slot-sat-${i}`,
      date: saturday.toISOString(),
      locationIds: ['loc-demo1', 'loc-demo2'],
      spotsRemaining: 12 + Math.floor(Math.random() * 10),
      isOpen: true,
    });
  }

  // Next 4 Wednesdays (Wednesday Market)
  for (let i = 0; i < 4; i++) {
    const wednesday = new Date(today);
    wednesday.setDate(today.getDate() + ((3 - today.getDay() + 7) % 7) + (i * 7));
    if (wednesday <= today) wednesday.setDate(wednesday.getDate() + 7);

    slots.push({
      id: `slot-wed-${i}`,
      date: wednesday.toISOString(),
      locationIds: ['loc-demo3'],
      spotsRemaining: 8 + Math.floor(Math.random() * 8),
      isOpen: true,
    });
  }

  return slots.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const DEMO_BAKE_SLOTS = generateDemoSlots();

const DEMO_FLAVORS = [
  {
    id: 'flav-classic',
    name: 'Classic Sourdough',
    description: 'Traditional tangy sourdough with a crispy crust',
    sizes: [{ name: 'Regular Loaf', price: 8.00 }],
  },
  {
    id: 'flav-garlic',
    name: 'Garlic Cheddar',
    description: 'Savory sourdough loaded with roasted garlic and sharp cheddar',
    sizes: [{ name: 'Regular Loaf', price: 10.00 }],
  },
  {
    id: 'flav-jalapeno',
    name: 'Jalapeño Cheddar',
    description: 'Spicy kick with melted cheddar pockets throughout',
    sizes: [{ name: 'Regular Loaf', price: 10.00 }],
  },
  {
    id: 'flav-cinnamon',
    name: 'Cinnamon Raisin',
    description: 'Sweet swirls of cinnamon with plump raisins',
    sizes: [{ name: 'Regular Loaf', price: 10.00 }],
  },
  {
    id: 'flav-chocolate',
    name: 'Double Chocolate',
    description: 'Rich chocolate dough with chocolate chip pockets',
    sizes: [{ name: 'Regular Loaf', price: 12.00 }],
  },
  {
    id: 'flav-rosemary',
    name: 'Rosemary Olive Oil',
    description: 'Fragrant rosemary with rich olive oil crumb',
    sizes: [{ name: 'Regular Loaf', price: 10.00 }],
  },
  {
    id: 'flav-honey',
    name: 'Honey Wheat',
    description: 'Wholesome whole wheat sweetened with local honey',
    sizes: [{ name: 'Regular Loaf', price: 9.00 }],
  },
  {
    id: 'flav-pumpkin',
    name: 'Pumpkin Spice',
    description: 'Seasonal favorite with real pumpkin and warm spices',
    sizes: [{ name: 'Regular Loaf', price: 12.00 }],
  },
];
