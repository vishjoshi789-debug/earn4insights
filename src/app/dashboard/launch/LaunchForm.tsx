'use client'

import { Button } from '@/components/ui/button'
import { launchProduct } from './launch.actions'

export default function LaunchForm() {
  return (
    <form action={launchProduct} className="space-y-8">
      {/* PRODUCT BASICS */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Product basics
        </h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Product name *
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Acme App"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Platform *
          </label>
          <select
            name="platform"
            required
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            <option value="">Select</option>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
            <option value="saas">SaaS</option>
          </select>
        </div>
      </div>

      {/* PRODUCT CONTEXT */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Product context
        </h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Website / App URL
          </label>
          <input
            name="domain"
            placeholder="https://example.com"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Description (optional)
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Short description"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Button type="submit" className="w-full h-11 text-base">
          Launch product
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You can change settings later. Feedback starts once launched.
        </p>
      </div>
    </form>
  )
}
