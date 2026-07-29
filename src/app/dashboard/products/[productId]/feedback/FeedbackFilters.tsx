'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  /** Languages actually present in this product's feedback. */
  availableLanguages: string[]
  totalCount: number
  filteredCount: number
}

const ALL = 'all'

export default function FeedbackFilters({
  availableLanguages,
  totalCount,
  filteredCount,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [filters, setFilters] = useState({
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    ratingMin: searchParams.get('ratingMin') || '',
    ratingMax: searchParams.get('ratingMax') || '',
    sentiment: searchParams.get('sentiment') || ALL,
    modality: searchParams.get('modality') || ALL,
    status: searchParams.get('status') || ALL,
    language: searchParams.get('language') || ALL,
  })

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.ratingMin) params.set('ratingMin', filters.ratingMin)
    if (filters.ratingMax) params.set('ratingMax', filters.ratingMax)
    if (filters.sentiment !== ALL) params.set('sentiment', filters.sentiment)
    if (filters.modality !== ALL) params.set('modality', filters.modality)
    if (filters.status !== ALL) params.set('status', filters.status)
    if (filters.language !== ALL) params.set('language', filters.language)

    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      ratingMin: '',
      ratingMax: '',
      sentiment: ALL,
      modality: ALL,
      status: ALL,
      language: ALL,
    })
    startTransition(() => {
      router.push(pathname)
    })
  }

  const hasActiveFilters =
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.ratingMin) ||
    Boolean(filters.ratingMax) ||
    filters.sentiment !== ALL ||
    filters.modality !== ALL ||
    filters.status !== ALL ||
    filters.language !== ALL

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filter Feedback
          </CardTitle>
          {hasActiveFilters && (
            <Badge variant="secondary">
              Showing {filteredCount} of {totalCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
        </div>

        {/* Rating range — feedback ratings are 1-5 stars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ratingMin">Min rating</Label>
            <Input
              id="ratingMin"
              type="number"
              min="1"
              max="5"
              placeholder="1"
              value={filters.ratingMin}
              onChange={(e) => setFilters({ ...filters, ratingMin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ratingMax">Max rating</Label>
            <Input
              id="ratingMax"
              type="number"
              min="1"
              max="5"
              placeholder="5"
              value={filters.ratingMax}
              onChange={(e) => setFilters({ ...filters, ratingMax: e.target.value })}
            />
          </div>
        </div>

        {/* Sentiment / Modality / Status / Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sentiment">Sentiment</Label>
            <Select
              value={filters.sentiment}
              onValueChange={(value) => setFilters({ ...filters, sentiment: value })}
            >
              <SelectTrigger id="sentiment">
                <SelectValue placeholder="All sentiments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modality">Modality</Label>
            <Select
              value={filters.modality}
              onValueChange={(value) => setFilters({ ...filters, modality: value })}
            >
              <SelectTrigger id="modality">
                <SelectValue placeholder="All modalities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All modalities</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Review status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="new">Unreviewed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="addressed">Addressed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={filters.language}
              onValueChange={(value) => setFilters({ ...filters, language: value })}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All languages</SelectItem>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
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
