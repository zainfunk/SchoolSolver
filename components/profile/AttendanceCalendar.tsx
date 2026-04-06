'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AttendanceRecord } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  records: AttendanceRecord[]
  clubName: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function AttendanceCalendar({ records, clubName }: Props) {
  // Build a map of date → present/absent
  const recordMap = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const r of records) m.set(r.meetingDate, r.present)
    return m
  }, [records])

  // Determine which months have records, default to current month if none
  const monthsWithRecords = useMemo(() => {
    const months = new Set<string>()
    for (const date of recordMap.keys()) {
      months.add(date.slice(0, 7)) // YYYY-MM
    }
    if (months.size === 0) {
      const now = new Date()
      months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort()
  }, [recordMap])

  const [monthIndex, setMonthIndex] = useState(() => monthsWithRecords.length - 1)

  const currentMonthKey = monthsWithRecords[monthIndex] ?? monthsWithRecords[monthsWithRecords.length - 1]
  const [yearStr, monthStr] = currentMonthKey.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // 0-indexed

  // Build calendar grid for this month
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const presentCount = records.filter(
    (r) => r.meetingDate.startsWith(currentMonthKey) && r.present,
  ).length
  const totalCount = records.filter((r) => r.meetingDate.startsWith(currentMonthKey)).length

  return (
    <div className="rounded-lg border bg-white p-4">
      {/* Club name + month navigation */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{clubName}</p>
          <p className="text-sm font-semibold text-gray-800">
            {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {totalCount > 0 && (
            <span className="text-xs text-gray-500 mr-2">
              {presentCount}/{totalCount} attended
            </span>
          )}
          <button
            onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
            disabled={monthIndex === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMonthIndex((i) => Math.min(monthsWithRecords.length - 1, i + 1))}
            disabled={monthIndex === monthsWithRecords.length - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />
          const dateKey = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`
          const status = recordMap.get(dateKey)
          return (
            <div
              key={dateKey}
              title={
                status === true ? 'Present' : status === false ? 'Absent' : undefined
              }
              className={cn(
                'aspect-square flex items-center justify-center rounded-md text-xs font-medium',
                status === true && 'bg-green-100 text-green-700 ring-1 ring-green-300',
                status === false && 'bg-red-100 text-red-600 ring-1 ring-red-300',
                status === undefined && 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-green-100 ring-1 ring-green-300 inline-block" />
          Present
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-red-100 ring-1 ring-red-300 inline-block" />
          Absent
        </span>
      </div>
    </div>
  )
}
