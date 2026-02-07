'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Check, Plus, Loader2 } from 'lucide-react'

interface SearchResult {
  id: string
  name: string
  description: string | null
  category: string | null
  categoryName: string | null
  matchScore: number
  lifecycleStatus: string
  isVerified: boolean
}

interface Props {
  onProductSelect: (product: { id: string; name: string; isNew: boolean }) => void
  selectedProduct?: { id: string; name: string; isNew: boolean } | null
}

/**
 * Product search with typeahead + "create new" fallback
 * 
 * Flow:
 * 1. Consumer types product name
 * 2. System searches existing products (debounced)
 * 3. If match found: consumer selects it
 * 4. If no match: consumer clicks "Add new product" → creates placeholder
 */
export default function ProductSearch({ onProductSelect, selectedProduct }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
      if (!res.ok) throw new Error('Search failed')
      
      const data = await res.json()
      setResults(data.results || [])
      setShowResults(true)
    } catch (err) {
      console.error('Product search error:', err)
      setError('Search failed. Please try again.')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300) // 300ms debounce
  }

  // Select an existing product
  const handleSelectProduct = (product: SearchResult) => {
    onProductSelect({
      id: product.id,
      name: product.name,
      isNew: false,
    })
    setQuery(product.name)
    setShowResults(false)
  }

  // Create a new placeholder product
  const handleCreateNew = async () => {
    if (query.trim().length < 2) return
    
    setIsCreating(true)
    setError(null)
    
    try {
      const res = await fetch('/api/products/placeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
      })
      
      const data = await res.json()
      
      if (data.created) {
        onProductSelect({
          id: data.product.id,
          name: data.product.name,
          isNew: true,
        })
        setShowResults(false)
      } else if (data.suggestions && data.suggestions.length > 0) {
        // Server found near-duplicates, show them
        setResults(data.suggestions.map((s: any) => ({
          ...s,
          lifecycleStatus: s.isVerified ? 'verified' : 'pending_verification',
          category: null,
          categoryName: null,
        })))
        setShowResults(true)
        setError('Similar products found. Please select one or try a different name.')
      }
    } catch (err) {
      console.error('Create placeholder error:', err)
      setError('Failed to create product. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // Clear selection
  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    onProductSelect(null as any)
  }

  // If product is already selected, show it
  if (selectedProduct) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{selectedProduct.name}</p>
          <p className="text-xs text-muted-foreground">
            {selectedProduct.isNew ? 'New product (pending verification)' : 'Existing product'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for a product (e.g., iPhone 15, Samsung TV)..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {/* Search results dropdown */}
      {showResults && (
        <Card className="absolute z-50 w-full mt-1 max-h-72 overflow-y-auto shadow-lg">
          <div className="p-1">
            {results.length > 0 ? (
              <>
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {product.isVerified && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Create new option at bottom */}
                <div className="border-t mt-1 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={isCreating || query.trim().length < 2}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 text-primary" />
                    )}
                    <span className="text-sm text-primary">
                      Add &quot;{query.trim()}&quot; as new product
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  No products found for &quot;{query}&quot;
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateNew}
                  disabled={isCreating || query.trim().length < 2}
                  className="gap-1"
                >
                  {isCreating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Add as new product
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
