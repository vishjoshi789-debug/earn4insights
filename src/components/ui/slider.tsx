"use client"

import * as React from "react"

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
}

export function Slider({
  value,
  defaultValue = [0],
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  ...rest
}: SliderProps) {
  const currentValue = value?.[0] ?? defaultValue[0]

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      onChange={(e) => {
        onValueChange?.([Number(e.target.value)])
      }}
      className={`h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary ${className ?? ""}`}
      {...rest}
    />
  )
}
