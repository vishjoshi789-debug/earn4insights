'use client'

/**
 * ICP Weight Editor
 *
 * Renders a weight slider for each ICP criterion.
 * Enforces the hard constraint: all weights must sum to exactly 100.
 * The Save button is disabled and a warning shown while the total ≠ 100.
 *
 * Design decision: show running total + disable Save rather than auto-redistributing.
 * Auto-redistribution creates surprising UX when criteria are marked required.
 */

import { useState, useMemo } from 'react'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

export type CriterionKey = string

export type EditableCriterion = {
  key: CriterionKey
  values: string[]
  weight: number
  required: boolean
  requiresConsentCategory?: string
}

type Props = {
  initialCriteria: Record<CriterionKey, Omit<EditableCriterion, 'key'>>
  onSave: (criteria: Record<CriterionKey, Omit<EditableCriterion, 'key'>>, totalWeight: number) => void
  saving?: boolean
}

// ── Available criterion keys (for the "Add Criterion" selector) ───

const CRITERION_OPTIONS: { key: string; label: string; consentCategory?: string }[] = [
  { key: 'ageRange',         label: 'Age Range',         consentCategory: 'demographic' },
  { key: 'gender',           label: 'Gender',             consentCategory: 'demographic' },
  { key: 'country',          label: 'Country',            consentCategory: 'demographic' },
  { key: 'city',             label: 'City',               consentCategory: 'demographic' },
  { key: 'profession',       label: 'Profession',         consentCategory: 'demographic' },
  { key: 'education',        label: 'Education',          consentCategory: 'demographic' },
  { key: 'engagementTier',   label: 'Engagement Tier',    consentCategory: 'behavioral' },
  { key: 'feedbackFrequency',label: 'Feedback Frequency', consentCategory: 'behavioral' },
  { key: 'sentimentBias',    label: 'Sentiment Bias',     consentCategory: 'behavioral' },
  { key: 'interests',        label: 'Interests',          consentCategory: 'behavioral' },
  { key: 'values',           label: 'Values',             consentCategory: 'psychographic' },
  { key: 'lifestyle',        label: 'Lifestyle',          consentCategory: 'psychographic' },
  { key: 'personality',      label: 'Personality',        consentCategory: 'psychographic' },
  { key: 'aspirations',      label: 'Aspirations',        consentCategory: 'psychographic' },
  { key: 'health',           label: 'Health Interests',   consentCategory: 'sensitive_health' },
  { key: 'dietary',          label: 'Dietary Preferences',consentCategory: 'sensitive_dietary' },
  { key: 'religion',         label: 'Religion',           consentCategory: 'sensitive_religion' },
  { key: 'caste',            label: 'Community / Caste',  consentCategory: 'sensitive_caste' },
]

function getCriterionLabel(key: string): string {
  return CRITERION_OPTIONS.find((o) => o.key === key)?.label ?? key
}

// ── Component ─────────────────────────────────────────────────────

export function IcpWeightEditor({ initialCriteria, onSave, saving = false }: Props) {
  const [criteria, setCriteria] = useState<EditableCriterion[]>(() =>
    Object.entries(initialCriteria).map(([key, c]) => ({ key, ...c }))
  )
  const [newValuesInput, setNewValuesInput] = useState<Record<string, string>>({})

  const totalWeight = useMemo(
    () => criteria.reduce((sum, c) => sum + c.weight, 0),
    [criteria]
  )
  const isValid = totalWeight === 100

  // Update a criterion's weight
  function setWeight(key: string, weight: number) {
    setCriteria((prev) =>
      prev.map((c) => (c.key === key ? { ...c, weight } : c))
    )
  }

  // Toggle required flag
  function toggleRequired(key: string) {
    setCriteria((prev) =>
      prev.map((c) => (c.key === key ? { ...c, required: !c.required } : c))
    )
  }

  // Add a value to a criterion's values list
  function addValue(key: string) {
    const raw = (newValuesInput[key] ?? '').trim()
    if (!raw) return
    setCriteria((prev) =>
      prev.map((c) =>
        c.key === key && !c.values.includes(raw)
          ? { ...c, values: [...c.values, raw] }
          : c
      )
    )
    setNewValuesInput((prev) => ({ ...prev, [key]: '' }))
  }

  // Remove a value from a criterion's values list
  function removeValue(key: string, value: string) {
    setCriteria((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, values: c.values.filter((v) => v !== value) } : c
      )
    )
  }

  // Remove a criterion entirely
  function removeCriterion(key: string) {
    setCriteria((prev) => prev.filter((c) => c.key !== key))
  }

  // Add a new criterion
  function addCriterion(key: string) {
    if (criteria.some((c) => c.key === key)) return
    const option = CRITERION_OPTIONS.find((o) => o.key === key)
    setCriteria((prev) => [
      ...prev,
      {
        key,
        values: [],
        weight: 0,
        required: false,
        requiresConsentCategory: option?.consentCategory,
      },
    ])
  }

  function handleSave() {
    if (!isValid) return
    const result: Record<string, Omit<EditableCriterion, 'key'>> = {}
    for (const c of criteria) {
      const { key, ...rest } = c
      result[key] = rest
    }
    onSave(result, totalWeight)
  }

  const usedKeys = new Set(criteria.map((c) => c.key))
  const availableToAdd = CRITERION_OPTIONS.filter((o) => !usedKeys.has(o.key))

  return (
    <div className="space-y-4">
      {/* Total weight indicator */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Total Weight</span>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${isValid ? 'text-green-600' : 'text-destructive'}`}>
            {totalWeight} / 100
          </span>
          {isValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      {!isValid && (
        <p className="text-sm text-destructive">
          {totalWeight < 100
            ? `Weights are ${100 - totalWeight} short. Increase one or more criteria to reach 100.`
            : `Weights exceed 100 by ${totalWeight - 100}. Reduce one or more criteria.`}
        </p>
      )}

      {/* Criteria list */}
      <div className="space-y-3">
        {criteria.map((criterion) => (
          <Card key={criterion.key} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {getCriterionLabel(criterion.key)}
                  </CardTitle>
                  {criterion.requiresConsentCategory && (
                    <CardDescription className="text-xs mt-0.5">
                      Requires consent: <code className="text-xs">{criterion.requiresConsentCategory}</code>
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id={`required-${criterion.key}`}
                      checked={criterion.required}
                      onCheckedChange={() => toggleRequired(criterion.key)}
                    />
                    <Label htmlFor={`required-${criterion.key}`} className="text-xs text-muted-foreground">
                      Required
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCriterion(criterion.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Weight slider */}
              <div className="flex items-center gap-3">
                <Label className="w-16 text-xs text-right text-muted-foreground shrink-0">
                  Weight
                </Label>
                <Slider
                  value={[criterion.weight]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([val]: number[]) => setWeight(criterion.key, val)}
                  className="flex-1"
                />
                <Badge variant="outline" className="w-12 text-center justify-center shrink-0">
                  {criterion.weight}
                </Badge>
              </div>

              {/* Values */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target Values</Label>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {criterion.values.map((v) => (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeValue(criterion.key, v)}
                    >
                      {v}
                      <span className="text-muted-foreground">×</span>
                    </Badge>
                  ))}
                  {criterion.values.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No values yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Add value..."
                    value={newValuesInput[criterion.key] ?? ''}
                    onChange={(e) =>
                      setNewValuesInput((prev) => ({ ...prev, [criterion.key]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addValue(criterion.key)
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => addValue(criterion.key)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add criterion */}
      {availableToAdd.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Add criterion:</span>
          {availableToAdd.map((o) => (
            <Button
              key={o.key}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => addCriterion(o.key)}
            >
              <Plus className="h-3 w-3" />
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!isValid || saving}
        className="w-full"
      >
        {saving ? 'Saving…' : isValid ? 'Save Criteria' : `Fix weights (${totalWeight}/100)`}
      </Button>
    </div>
  )
}
