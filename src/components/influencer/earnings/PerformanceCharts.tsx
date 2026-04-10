'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

// ── Bar Chart (vertical) ────────────────────────────────────────

interface BarChartCardProps {
  title: string
  data: Array<{ name: string; value: number }>
  color?: string
  height?: number
}

export function BarChartCard({ title, data, color = COLORS[0], height = 250 }: BarChartCardProps) {
  if (data.length === 0) return <EmptyChart title={title} />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Horizontal Bar Chart ────────────────────────────────────────

interface HorizontalBarChartCardProps {
  title: string
  data: Array<{ name: string; value: number }>
  color?: string
  height?: number
}

export function HorizontalBarChartCard({ title, data, color = COLORS[1], height = 250 }: HorizontalBarChartCardProps) {
  if (data.length === 0) return <EmptyChart title={title} />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Donut Chart ─────────────────────────────────────────────────

interface DonutChartCardProps {
  title: string
  data: Array<{ name: string; value: number }>
  height?: number
}

export function DonutChartCard({ title, data, height = 250 }: DonutChartCardProps) {
  if (data.length === 0) return <EmptyChart title={title} />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Line Chart ──────────────────────────────────────────────────

interface LineChartCardProps {
  title: string
  data: Array<Record<string, any>>
  lines: Array<{ key: string; color?: string; label?: string }>
  xKey?: string
  height?: number
}

export function LineChartCard({ title, data, lines, xKey = 'date', height = 250 }: LineChartCardProps) {
  if (data.length === 0) return <EmptyChart title={title} />
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {lines.map((line, i) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label ?? line.key}
                stroke={line.color ?? COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Gauge (half-donut) ──────────────────────────────────────────

interface GaugeCardProps {
  title: string
  value: number
  max?: number
  label?: string
}

export function GaugeCard({ title, value, max = 100, label }: GaugeCardProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const remaining = max - clamped

  const gaugeColor =
    clamped >= 70 ? '#10b981' :
    clamped >= 40 ? '#f59e0b' :
    '#ef4444'

  const data = [
    { name: 'Value', value: clamped },
    { name: 'Remaining', value: remaining },
  ]

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-4">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={gaugeColor} />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center -mt-4">
          <span className="text-2xl font-bold">{clamped.toFixed(1)}%</span>
          {label && <p className="text-xs text-muted-foreground mt-0.5">{label}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Placeholder card ────────────────────────────────────────────

export function PlaceholderChart({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
          {message}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ title }: { title: string }) {
  return <PlaceholderChart title={title} message="No data available" />
}
