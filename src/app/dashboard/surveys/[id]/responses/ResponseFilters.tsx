'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
  availableLanguages: string[]
  totalResponses: number
  filteredCount: number
}

export default function ResponseFilters({ availableLanguages, totalResponses, filteredCount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [filters, setFilters] = useState({
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    ratingMin: searchParams.get('ratingMin') || '',
    ratingMax: searchParams.get('ratingMax') || '',
    language: searchParams.get('language') || 'all',
    modality: searchParams.get('modality') || 'all',
    sentiment: searchParams.get('sentiment') || 'all',
  })

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.ratingMin) params.set('ratingMin', filters.ratingMin)
    if (filters.ratingMax) params.set('ratingMax', filters.ratingMax)
    if (filters.language !== 'all') params.set('language', filters.language)
    if (filters.modality !== 'all') params.set('modality', filters.modality)
    if (filters.sentiment !== 'all') params.set('sentiment', filters.sentiment)

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      ratingMin: '',
      ratingMax: '',
      language: 'all',
      modality: 'all',
      sentiment: 'all',
    })
    startTransition(() => {
      router.push('')
    })
  }

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.ratingMin ||
    filters.ratingMax ||
    filters.language !== 'all' ||
    filters.modality !== 'all' ||
    filters.sentiment !== 'all'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter Responses
          </CardTitle>
          {hasActiveFilters && (
            <Badge variant="secondary">
              Showing {filteredCount} of {totalResponses}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
        </div>

        {/* Rating Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ratingMin">Min Rating</Label>
            <Input
              id="ratingMin"
              type="number"
              min="1"
              max="10"
              placeholder="1"
              value={filters.ratingMin}
              onChange={(e) => setFilters({ ...filters, ratingMin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ratingMax">Max Rating</Label>
            <Input
              id="ratingMax"
              type="number"
              min="1"
              max="10"
              placeholder="10"
              value={filters.ratingMax}
              onChange={(e) => setFilters({ ...filters, ratingMax: e.target.value })}
            />
          </div>
        </div>

        {/* Modality, Language, Sentiment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="modality">Modality</Label>
            <Select value={filters.modality} onValueChange={(value) => setFilters({ ...filters, modality: value })}>
              <SelectTrigger id="modality">
                <SelectValue placeholder="All modalities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modalities</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={filters.language} onValueChange={(value) => setFilters({ ...filters, language: value })}>
              <SelectTrigger id="language">
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                {availableLanguages.length > 0 ? (
                  availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No languages detected
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sentiment">Sentiment</Label>
            <Select value={filters.sentiment} onValueChange={(value) => setFilters({ ...filters, sentiment: value })}>
              <SelectTrigger id="sentiment">
                <SelectValue placeholder="All sentiments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={applyFilters} disabled={isPending} className="flex-1">
            {isPending ? 'Applying...' : 'Apply Filters'}
          </Button>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} disabled={isPending}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
