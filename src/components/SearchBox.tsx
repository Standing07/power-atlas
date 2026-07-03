import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { loadIndex } from '../lib/data'
import type { CountryIndexEntry } from '../lib/types'
import Flag from './Flag'

/** 國家搜尋框：中英文名稱、ISO 代碼即時建議 */
export default function SearchBox({ large = false }: { large?: boolean }) {
  const { t, countryName } = useLang()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<CountryIndexEntry[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadIndex().then((idx) => setEntries(idx.countries))
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return entries
      .map((c) => ({ c, zh: countryName(c.iso2, c.name), en: c.name }))
      .filter(({ c, zh, en }) =>
        zh.toLowerCase().includes(q) || en.toLowerCase().includes(q) ||
        c.iso3.toLowerCase() === q || (c.iso2 ?? '').toLowerCase() === q
      )
      .slice(0, 8)
  }, [query, entries, countryName])

  const go = (iso3: string) => {
    setQuery('')
    setOpen(false)
    navigate(iso3 === 'TWN' ? '/taiwan' : `/country/${iso3}`)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className={`flex items-center gap-2 rounded-full border border-stone-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 ${large ? 'px-5 py-3.5' : 'px-4 py-2'}`}>
        <span className="text-stone-400">🔍</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, results.length - 1))
            else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0))
            else if (e.key === 'Enter' && results[highlight]) go(results[highlight].c.iso3)
          }}
          placeholder={t('search_placeholder')}
          className={`w-full bg-transparent outline-none placeholder:text-stone-400 ${large ? 'text-lg' : 'text-sm'}`}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          {results.map(({ c, zh, en }, i) => (
            <li key={c.iso3}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(c.iso3)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${i === highlight ? 'bg-brand-50' : ''}`}
              >
                <Flag iso2={c.iso2} />
                <span className="font-medium">{zh}</span>
                <span className="text-xs text-stone-400">{en !== zh ? en : c.iso3}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
