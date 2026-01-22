import 'server-only'
import fs from 'fs/promises'
import path from 'path'
import { Product } from '@/lib/types/product'

const dataFile = path.join(process.cwd(), 'data', 'products.json')

/* ---------------------------------------------
   Internal helpers
--------------------------------------------- */

async function ensureFile() {
  try {
    await fs.access(dataFile)
  } catch {
    await fs.mkdir(path.dirname(dataFile), { recursive: true })
    await fs.writeFile(dataFile, JSON.stringify([], null, 2))
  }
}

async function writeProducts(products: Product[]) {
  await fs.writeFile(dataFile, JSON.stringify(products, null, 2))
}

/* ---------------------------------------------
   Public API
--------------------------------------------- */

export async function getProducts(): Promise<Product[]> {
  await ensureFile()

  const raw = await fs.readFile(dataFile, 'utf-8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
}

export async function addProduct(product: Product) {
  const products = await getProducts()

  // 🔒 Ensure profile is ALWAYS initialized
  const productWithProfile: Product = {
    ...product,
    profile: {
      currentStep: 1,
      isComplete: false,
      data: {},
    },
  }

  products.push(productWithProfile)
  await writeProducts(products)
}

export async function getProductById(
  id: string
): Promise<Product | undefined> {
  const products = await getProducts()
  return products.find((p) => p.id === id)
}

/* ---------------------------------------------
   PROFILE HELPERS (NEW — IMPORTANT)
--------------------------------------------- */

export async function updateProductProfile(
  productId: string,
  updater: (profile: Product['profile']) => Product['profile']
) {
  const products = await getProducts()

  const index = products.findIndex((p) => p.id === productId)
  if (index === -1) return

  const product = products[index]

  // Ensure profile exists before updating
  const currentProfile = product.profile || {
    currentStep: 1,
    isComplete: false,
    data: {},
  }

  products[index] = {
    ...product,
    profile: updater(currentProfile),
  }

  await writeProducts(products)
}
