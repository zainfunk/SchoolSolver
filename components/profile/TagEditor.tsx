'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  presets: string[]
  selected: string[]
  onChange: (tags: string[]) => void
  editable?: boolean
}

export default function TagEditor({ label, presets, selected, onChange, editable = true }: Props) {
  const [customInput, setCustomInput] = useState('')

  function toggle(tag: string) {
    if (!editable) return
    onChange(
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag],
    )
  }

  function addCustom() {
    const t = customInput.trim()
    if (!t || selected.includes(t)) { setCustomInput(''); return }
    onChange([...selected, t])
    setCustomInput('')
  }

  // Tags not in presets (user-added custom ones)
  const customTags = selected.filter((t) => !presets.includes(t))

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>

      {/* Preset tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((tag) => {
          const on = selected.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              disabled={!editable}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                on
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400',
                !editable && on && 'cursor-default',
                !editable && !on && 'hidden',
              )}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* Custom tags */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {customTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200"
            >
              {tag}
              {editable && (
                <button onClick={() => onChange(selected.filter((t) => t !== tag))} className="hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add custom */}
      {editable && (
        <div className="flex items-center gap-2 mt-1">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder={`Add custom ${label.toLowerCase()}…`}
            className="text-xs border rounded-md px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={addCustom}
            className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      )}
    </div>
  )
}
