'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PRODUCT_CATEGORIES, getCategoryName } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'
import { Sparkles, Check, AlertCircle } from 'lucide-react'

type ProductInfo = {
  id: string
  name: string
  category: string
  hasCategory: boolean
  responseCount: number
}

export default function AssignCategoriesPage() {
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Record<string, ProductCategory>>({})

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/check-products')
      if (response.ok) {
        const data = await response.json()
        // Remove duplicates
        const uniqueProducts = data.productStats.filter(
          (p: ProductInfo, index: number, self: ProductInfo[]) => 
            self.findIndex((t: ProductInfo) => t.id === p.id) === index
        )
        setProducts(uniqueProducts)
        
        // Initialize selected categories
        const initial: Record<string, ProductCategory> = {}
        uniqueProducts.forEach((p: ProductInfo) => {
          if (p.hasCategory && p.category !== 'NOT ASSIGNED') {
            initial[p.id] = p.category as ProductCategory
          }
        })
        setSelectedCategories(initial)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const assignCategory = async (productId: string) => {
    const category = selectedCategories[productId]
    if (!category) {
      alert('Please select a category first')
      return
    }

    setSaving(productId)
    try {
      const response = await fetch('/api/admin/assign-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, category }),
      })

      if (response.ok) {
        // Update local state
        setProducts(products.map(p => 
          p.id === productId 
            ? { ...p, category, hasCategory: true }
            : p
        ))
        alert('Category assigned successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to assign category: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to assign category:', error)
      alert('Failed to assign category. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const assignAllCategories = async () => {
    setSaving('all')
    try {
      const assignments = Object.entries(selectedCategories).map(([productId, category]) => ({
        productId,
        category,
      }))

      const response = await fetch('/api/admin/assign-categories-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })

      if (response.ok) {
        alert('All categories assigned successfully!')
        await loadProducts()
      } else {
        const error = await response.json()
        alert(`Failed to assign categories: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to assign categories:', error)
      alert('Failed to assign categories. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const productsWithoutCategories = products.filter(p => !p.hasCategory).length
  const allCategoriesSelected = products.every(p => 
    p.hasCategory || selectedCategories[p.id]
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-500" />
          Assign Product Categories
        </h1>
        <p className="text-muted-foreground mt-1">
          Assign categories to your products to enable weekly rankings
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Category Assignment Status</CardTitle>
          <CardDescription>
            {productsWithoutCategories === 0 ? (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <Check className="h-4 w-4" />
                All products have categories assigned!
              </span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {productsWithoutCategories} product{productsWithoutCategories !== 1 ? 's' : ''} need{productsWithoutCategories === 1 ? 's' : ''} categories
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Total products: <strong>{products.length}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                With categories: <strong>{products.filter(p => p.hasCategory).length}</strong>
              </p>
            </div>
            {allCategoriesSelected && productsWithoutCategories > 0 && (
              <Button 
                onClick={assignAllCategories}
                disabled={saving === 'all'}
              >
                {saving === 'all' ? 'Saving...' : 'Save All Categories'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading products...
            </CardContent>
          </Card>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No products found
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      {product.hasCategory && (
                        <Badge variant="default" className="bg-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          Assigned
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>ID: {product.id}</span>
                      <span>{product.responseCount} responses</span>
                      {product.hasCategory && (
                        <span className="text-green-600 dark:text-green-400">
                          Current: {getCategoryName(product.category as ProductCategory)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedCategories[product.id] || ''}
                      onValueChange={(value) => 
                        setSelectedCategories({ ...selectedCategories, [product.id]: value as ProductCategory })
                      }
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(PRODUCT_CATEGORIES).map((category) => (
                          <SelectItem key={category} value={category}>
                            <div className="flex items-center gap-2">
                              <span>{PRODUCT_CATEGORIES[category as ProductCategory].icon}</span>
                              {getCategoryName(category as ProductCategory)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => assignCategory(product.id)}
                      disabled={!selectedCategories[product.id] || saving === product.id}
                      variant={product.hasCategory ? 'outline' : 'default'}
                    >
                      {saving === product.id ? 'Saving...' : product.hasCategory ? 'Update' : 'Assign'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
