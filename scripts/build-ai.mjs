#!/usr/bin/env node
/**
 * AI 算力能源資料管線：Epoch AI「AI Supercomputers」資料集（CC BY 4.0）
 * → public/data/ai-compute.json
 *
 * 產出：全球現存 AI 超級電腦（含功率 MW、國家、擁有者、晶片），
 *      以及各國合計功率，供「AI 與電力」專區使用。
 *
 * 重建：npm run ai
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import countries from 'i18n-iso-countries'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
countries.registerLocale(require('i18n-iso-countries/langs/en.json'))

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'data')
const SRC = 'https://epoch.ai/data/ai_supercomputers.csv'

// Epoch 國名 → ISO3（對不到的手動補）
const NAME_FIX = {
  'United States of America': 'USA', 'Korea (Republic of)': 'KOR', 'Russia': 'RUS',
  'Taiwan': 'TWN', 'United Kingdom of Great Britain and Northern Ireland': 'GBR',
  'Iran (Islamic Republic of)': 'IRN', 'Czechia': 'CZE', 'Viet Nam': 'VNM',
  'United Arab Emirates': 'ARE', 'Saudi Arabia': 'SAU',
}

function parseCsv(text) {
  const rows = []
  let cur = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}

async function main() {
  console.log('== AI 算力能源管線（Epoch AI）==')
  const res = await fetch(SRC)
  if (!res.ok) throw new Error(`下載失敗 HTTP ${res.status}`)
  const rows = parseCsv(await res.text())
  const header = rows[0]
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
  const need = ['Name', 'Status', 'Country', 'Owner', 'Power Capacity (MW)', 'First Operational Date']
  for (const c of need) if (!(c in idx)) throw new Error(`Epoch 資料缺欄位「${c}」（上游格式可能改變）`)

  const systems = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length < 5) continue
    if (r[idx['Status']] !== 'Existing') continue
    const mwRaw = r[idx['Power Capacity (MW)']] || r[idx['Reported Power Capacity (MW)']] || r[idx['Calculated Power Capacity (MW)']]
    const mw = Number(mwRaw)
    if (!Number.isFinite(mw) || mw <= 0) continue
    const cname = (r[idx['Country']] || '').trim()
    const iso3 = NAME_FIX[cname] ?? countries.getAlpha3Code(cname, 'en') ?? null
    const date = (r[idx['First Operational Date']] || '').slice(0, 7)
    systems.push({
      name: (r[idx['Name']] || '').trim(),
      mw: Number(mw.toFixed(1)),
      iso3,
      country: cname,
      owner: (r[idx['Owner']] || '').trim(),
      chips: (r[idx['Chip type (primary)']] || '').trim(),
      chipCount: Number(r[idx['Total number of AI chips']]) || null,
      since: date || null,
    })
  }
  systems.sort((a, b) => b.mw - a.mw)

  // 各國合計
  const byCountry = {}
  for (const s of systems) {
    if (!s.iso3) continue
    if (!byCountry[s.iso3]) byCountry[s.iso3] = { mw: 0, count: 0 }
    byCountry[s.iso3].mw += s.mw
    byCountry[s.iso3].count++
  }
  for (const k of Object.keys(byCountry)) byCountry[k].mw = Number(byCountry[k].mw.toFixed(1))

  const totalMw = Number(systems.reduce((s, x) => s + x.mw, 0).toFixed(1))
  if (systems.length < 100) throw new Error(`驗證失敗：只解析到 ${systems.length} 座（預期 >100）`)

  await mkdir(OUT, { recursive: true })
  await writeFile(path.join(OUT, 'ai-compute.json'), JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    source: { label: 'Epoch AI — AI Supercomputers (CC BY 4.0)', url: 'https://epoch.ai/data/ai-supercomputers', year: 2026 },
    totalMw,
    count: systems.length,
    byCountry,
    systems: systems.slice(0, 120), // 前 120 大，避免檔案過大
  }))

  console.log(`  ✓ ${systems.length} 座現存 AI 超級電腦，合計 ${(totalMw / 1000).toFixed(1)} GW`)
  console.log(`  ✓ 涵蓋 ${Object.keys(byCountry).length} 國`)
}

main().catch((e) => { console.error('✗ AI 管線失敗：', e.message); process.exit(1) })
