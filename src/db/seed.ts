/**
 * Seed initial data on first launch.
 * Runs once — checks if DB is empty, then populates.
 */

import { getDB, uid, type Category, type Product, type Table, type Staff } from './index'

const CATEGORY_COLORS = [
  '#8B5CF6', // violet — Alkohol
  '#10B981', // emerald — Sallata
  '#F59E0B', // amber — Kafe
  '#EF4444', // red — Burger
  '#06B6D4', // cyan — Pijet
  '#EC4899', // pink — Embelsira
  '#84CC16', // lime — Pasta
  '#F97316', // orange — Pizza
  '#3B82F6', // blue — Cocktails
  '#A855F7'  // purple — Raki
]

const SAMPLE_CATEGORIES: Array<Omit<Category, 'id' | 'createdAt'>> = [
  { name: 'Kafe', color: '#F59E0B', sortOrder: 1 },
  { name: 'Pijet', color: '#06B6D4', sortOrder: 2 },
  { name: 'Alkohol', color: '#8B5CF6', sortOrder: 3 },
  { name: 'Cocktails', color: '#3B82F6', sortOrder: 4 },
  { name: 'Sallata', color: '#10B981', sortOrder: 5 },
  { name: 'Pasta', color: '#84CC16', sortOrder: 6 },
  { name: 'Pizza', color: '#F97316', sortOrder: 7 },
  { name: 'Embelsira', color: '#EC4899', sortOrder: 8 }
]

// Products by category name (resolved to IDs at seed time)
const SAMPLE_PRODUCTS: Array<{
  category: string
  name: string
  price: number // cents
}> = [
  // Kafe
  { category: 'Kafe', name: 'Espresso', price: 120 },
  { category: 'Kafe', name: 'Espresso Doppio', price: 200 },
  { category: 'Kafe', name: 'Macchiato', price: 150 },
  { category: 'Kafe', name: 'Cappuccino', price: 200 },
  { category: 'Kafe', name: 'Latte Macchiato', price: 220 },
  { category: 'Kafe', name: 'Americano', price: 180 },
  { category: 'Kafe', name: 'Mocha', price: 250 },
  { category: 'Kafe', name: 'Turke', price: 150 },

  // Pijet
  { category: 'Pijet', name: 'Coca Cola', price: 150 },
  { category: 'Pijet', name: 'Fanta', price: 150 },
  { category: 'Pijet', name: 'Sprite', price: 150 },
  { category: 'Pijet', name: 'Uje 0.5L', price: 100 },
  { category: 'Pijet', name: 'Uje gazoz 0.5L', price: 120 },
  { category: 'Pijet', name: 'Lemonade', price: 250 },
  { category: 'Pijet', name: 'Ice Tea', price: 200 },
  { category: 'Pijet', name: 'Red Bull', price: 300 },

  // Alkohol
  { category: 'Alkohol', name: 'Whisky', price: 400 },
  { category: 'Alkohol', name: 'Vodka', price: 350 },
  { category: 'Alkohol', name: 'Gin', price: 400 },
  { category: 'Alkohol', name: 'Rum', price: 400 },
  { category: 'Alkohol', name: 'Tequila', price: 400 },
  { category: 'Alkohol', name: 'Birre 0.33L', price: 200 },
  { category: 'Alkohol', name: 'Birre 0.5L', price: 250 },
  { category: 'Alkohol', name: 'Vere e kuqe', price: 350 },

  // Cocktails
  { category: 'Cocktails', name: 'Mojito', price: 450 },
  { category: 'Cocktails', name: 'Sex on the Beach', price: 500 },
  { category: 'Cocktails', name: 'Pina Colada', price: 500 },
  { category: 'Cocktails', name: 'Margarita', price: 500 },
  { category: 'Cocktails', name: 'Aperol Spritz', price: 450 },

  // Sallata
  { category: 'Sallata', name: 'Caesar Salad', price: 450 },
  { category: 'Sallata', name: 'Greek Salad', price: 400 },
  { category: 'Sallata', name: 'Tuna Salad', price: 500 },
  { category: 'Sallata', name: 'Sezone', price: 350 },

  // Pasta
  { category: 'Pasta', name: 'Spaghetti Bolognese', price: 600 },
  { category: 'Pasta', name: 'Spaghetti Carbonara', price: 600 },
  { category: 'Pasta', name: 'Penne Arrabbiata', price: 550 },
  { category: 'Pasta', name: 'Fettuccine Alfredo', price: 600 },
  { category: 'Pasta', name: 'Lasagne', price: 650 },

  // Pizza
  { category: 'Pizza', name: 'Margherita', price: 500 },
  { category: 'Pizza', name: 'Pepperoni', price: 600 },
  { category: 'Pizza', name: 'Quattro Formaggi', price: 650 },
  { category: 'Pizza', name: 'Capricciosa', price: 650 },
  { category: 'Pizza', name: 'BBQ Chicken', price: 700 },

  // Embelsira
  { category: 'Embelsira', name: 'Tiramisu', price: 350 },
  { category: 'Embelsira', name: 'Cheesecake', price: 350 },
  { category: 'Embelsira', name: 'Brownie', price: 300 },
  { category: 'Embelsira', name: 'Cremebrulle', price: 400 }
]

const SAMPLE_TABLES = 10

export async function seedIfEmpty(): Promise<{ seeded: boolean }> {
  const db = await getDB()

  // Check if any category exists — if yes, skip seed
  const existingCats = await db.count('categories')
  if (existingCats > 0) {
    return { seeded: false }
  }

  const now = Date.now()

  // ─── Seed categories ───
  const tx1 = db.transaction('categories', 'readwrite')
  const categoryIds: Record<string, string> = {}
  for (const cat of SAMPLE_CATEGORIES) {
    const id = uid()
    categoryIds[cat.name] = id
    await tx1.store.put({
      id,
      name: cat.name,
      color: cat.color,
      sortOrder: cat.sortOrder,
      createdAt: now
    })
  }
  await tx1.done

  // ─── Seed products ───
  const tx2 = db.transaction('products', 'readwrite')
  let sortIdx = 1
  for (const p of SAMPLE_PRODUCTS) {
    const categoryId = categoryIds[p.category]
    if (!categoryId) continue
    await tx2.store.put({
      id: uid(),
      name: p.name,
      price: p.price,
      categoryId,
      sortOrder: sortIdx++,
      active: true,
      createdAt: now,
      trackStock: false,
      autoDeductOnSale: false,
      stockUnit: null,
      stockQuantity: 0,
      lowStockThreshold: 0
    })
  }
  await tx2.done

  // ─── Seed tables ───
  const tx3 = db.transaction('tables', 'readwrite')
  for (let i = 1; i <= SAMPLE_TABLES; i++) {
    await tx3.store.put({
      id: uid(),
      name: `T${i}`,
      sortOrder: i,
      createdAt: now
    })
  }
  await tx3.done

  // ─── Seed default admin staff ───
  const tx4 = db.transaction('staff', 'readwrite')
  await tx4.store.put({
    id: uid(),
    name: 'Admin',
    pin: '0000',
    role: 'admin',
    active: true,
    createdAt: now,
    status: ''
  })
  await tx4.store.put({
    id: uid(),
    name: 'Banakier',
    pin: '1234',
    role: 'cashier',
    active: true,
    createdAt: now,
    status: ''
  })
  await tx4.done

  // ─── Seed default settings ───
  const tx5 = db.transaction('settings', 'readwrite')
  await tx5.store.put({ key: 'venueName', value: 'Kendi Cafe' })
  await tx5.store.put({ key: 'venueLocation', value: 'Veternik, Prishtinë' })
  await tx5.store.put({ key: 'currency', value: '€' })
  await tx5.store.put({ key: 'theme', value: 'dark' })
  await tx5.done

  return { seeded: true }
}

export { CATEGORY_COLORS }
