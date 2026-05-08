'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './cn'

export type ComboboxItem = { id: string; label: string; sublabel?: string }

export function Combobox({
  items,
  value,
  onChange,
  onCreate,
  placeholder,
  createLabel = (q) => `+ Crează "${q}"`,
  emptyLabel = 'Niciun rezultat.',
  label,
  required,
  disabled,
}: {
  items: ComboboxItem[]
  value: string | null
  onChange: (id: string | null) => void
  /** When provided, an extra "create" row appears for unmatched queries. */
  onCreate?: (query: string) => Promise<ComboboxItem | null> | ComboboxItem | null
  placeholder?: string
  createLabel?: (query: string) => ReactNode
  emptyLabel?: ReactNode
  label?: string
  required?: boolean
  disabled?: boolean
}) {
  const inputId = useId()
  const listId = `${inputId}-list`
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const selected = items.find((i) => i.id === value) ?? null
  const [query, setQuery] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [busyCreate, setBusyCreate] = useState(false)

  // Sync displayed text when external `value` prop changes (e.g. parent
  // selects after inline create).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(selected?.label ?? '')
  }, [selected?.id, selected?.label])

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const trimmed = query.trim()
  const filtered = useMemo(() => {
    if (!trimmed) return items
    const q = trimmed.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(q))
  }, [items, trimmed])

  const exactMatch = filtered.some((i) => i.label.toLowerCase() === trimmed.toLowerCase())
  const showCreate = !!onCreate && trimmed.length > 0 && !exactMatch
  const totalRows = filtered.length + (showCreate ? 1 : 0)

  async function handleCreate() {
    if (!onCreate || !trimmed) return
    setBusyCreate(true)
    try {
      const created = await onCreate(trimmed)
      if (created) {
        onChange(created.id)
        setOpen(false)
      }
    } finally {
      setBusyCreate(false)
    }
  }

  function pickIndex(i: number) {
    if (i < filtered.length) {
      onChange(filtered[i].id)
      setOpen(false)
    } else if (showCreate) {
      handleCreate()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => Math.min(i + 1, totalRows - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pickIndex(activeIdx)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-medium text-stone-700 mb-1.5">
          {label}
          {required && <span className="text-brand-700"> *</span>}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActiveIdx(0)
          if (e.target.value === '') onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full px-3 py-2.5 border border-stone-300 rounded-md text-[15px] bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20 disabled:bg-stone-50 disabled:text-stone-400"
      />
      {open && (filtered.length > 0 || showCreate || trimmed === '') && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-auto bg-white border border-stone-200 rounded-md shadow-lg py-1 text-sm"
        >
          {filtered.length === 0 && !showCreate && (
            <li className="px-3 py-2 text-stone-400 text-sm">{emptyLabel}</li>
          )}
          {filtered.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={value === it.id}
              onMouseDown={(e) => {
                e.preventDefault()
                pickIndex(i)
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                'px-3 py-2 cursor-pointer flex flex-col',
                activeIdx === i ? 'bg-stone-100' : '',
                value === it.id ? 'text-brand-800 font-medium' : 'text-stone-800',
              )}
            >
              <span>{it.label}</span>
              {it.sublabel && <span className="text-[11px] text-stone-500">{it.sublabel}</span>}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={activeIdx === filtered.length}
              onMouseDown={(e) => {
                e.preventDefault()
                pickIndex(filtered.length)
              }}
              onMouseEnter={() => setActiveIdx(filtered.length)}
              className={cn(
                'px-3 py-2 cursor-pointer border-t border-stone-100 text-brand-700',
                activeIdx === filtered.length ? 'bg-brand-50' : '',
                busyCreate && 'opacity-60 pointer-events-none',
              )}
            >
              {busyCreate ? 'Se creează...' : createLabel(trimmed)}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
