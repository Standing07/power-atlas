import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { loadIndex } from '../lib/data'
import type { CountryIndexEntry } from '../lib/types'

/** 全部國家下拉選單：任何國家都能一鍵進入深度解析 */
export default function CountrySelect({ current }: { current?: string }) {
  const { t, countryName } = useLang()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<CountryIndexEntry[]>([])

  useEffect(() => {
    loadIndex().then((idx) => setEntries(idx.countries))
  }, [])

  const options = useMemo(
    () =>
      entries
        .map((c) => ({ iso3: c.iso3, name: countryName(c.iso2, c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
    [entries, countryName]
  )

  return (
    <select
      value={current ?? ''}
      onChange={(e) => {
        const iso3 = e.target.value
        if (iso3) navigate(iso3 === 'TWN' ? '/taiwan' : `/country/${iso3}`)
      }}
      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm outline-none focus:border-brand-500"
    >
      <option value="" disabled>
        {t('select_country')}
      </option>
      {options.map((o) => (
        <option key={o.iso3} value={o.iso3}>
          {o.name}
        </option>
      ))}
    </select>
  )
}
