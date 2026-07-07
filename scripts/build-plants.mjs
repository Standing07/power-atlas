#!/usr/bin/env node
/**
 * 電廠資料管線（多來源）→ 依國家產出 public/data/plants/{ISO3}.json
 *
 * 來源優先序（後者覆蓋前者）：
 *   1. WRI Global Power Plant Database v1.3 (2021, CC BY 4.0) — 全球底圖
 *   2. 美國 EIA-860M（每月更新, 公有領域）— 覆蓋美國，資料最新
 *   3. GEM Global Integrated Power Tracker（若使用者放入檔案）— 覆蓋指定國家
 *
 * 每個國家檔案都帶 source { label, url, year }，前端會顯示。
 * 篩選裝置容量 ≥100MW 的電廠。重建：npm run plants
 */
import { mkdir, readFile, writeFile, rm, access, readdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import countries from 'i18n-iso-countries'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
countries.registerLocale(require('i18n-iso-countries/langs/en.json'))

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'scripts', '.cache')
const OUT = path.join(ROOT, 'public', 'data', 'plants')
const MIN_MW = 100

const WRI_ZIP = 'https://wri-dataportal-prod.s3.amazonaws.com/manual/global_power_plant_database_v_1_3.zip'

const tierOf = (mw) => (mw >= 2000 ? '2GW+' : mw >= 1000 ? '1-2GW' : mw >= 500 ? '500MW-1GW' : '100-500MW')

const round4 = (n) => Number(n.toFixed(4))

function summarize(plants) {
  const byFuel = {}, byTier = {}
  for (const p of plants) {
    byFuel[p.fuel] = (byFuel[p.fuel] ?? 0) + 1
    byTier[p.tier] = (byTier[p.tier] ?? 0) + 1
  }
  return { byFuel, byTier }
}

// ---------------------------------------------------------------- WRI（全球底圖）

const WRI_FUEL = {
  Coal: 'coal', Gas: 'gas', Oil: 'oil', Nuclear: 'nuclear', Hydro: 'hydro',
  Wind: 'wind', Solar: 'solar', Geothermal: 'geothermal',
  Biomass: 'biofuel', Waste: 'biofuel', Cogeneration: 'gas', Petcoke: 'coal', Other: 'other',
}

function parseCsvLine(line) {
  const out = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

async function ensureWriCsv() {
  const csv = path.join(CACHE, 'gppd.csv')
  try { await access(csv); return csv } catch { /* download */ }
  await mkdir(CACHE, { recursive: true })
  const zip = path.join(CACHE, 'gppd.zip')
  console.log('  ↓ 下載 WRI GPPD')
  const res = await fetch(WRI_ZIP)
  if (!res.ok) throw new Error(`WRI 下載失敗 HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip))
  execSync(`unzip -o -j "${zip}" "global_power_plant_database.csv" -d "${CACHE}"`, { stdio: 'ignore' })
  execSync(`mv "${path.join(CACHE, 'global_power_plant_database.csv')}" "${csv}"`)
  return csv
}

async function processWRI() {
  const csvPath = await ensureWriCsv()
  const lines = (await readFile(csvPath, 'utf8')).split('\n')
  const header = parseCsvLine(lines[0])
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  const byCountry = new Map()
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const c = parseCsvLine(lines[i])
    const mw = Number(c[idx.capacity_mw])
    if (!Number.isFinite(mw) || mw < MIN_MW) continue
    const iso3 = c[idx.country]
    const lat = Number(c[idx.latitude]), lon = Number(c[idx.longitude])
    if (!iso3 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const yr = c[idx.commissioning_year]
    const plant = {
      name: c[idx.name], mw: Math.round(mw), lat: round4(lat), lon: round4(lon),
      fuel: WRI_FUEL[c[idx.primary_fuel]] ?? 'other', tier: tierOf(mw),
      year: yr && Number.isFinite(Number(yr)) ? Math.round(Number(yr)) : null,
    }
    if (!byCountry.has(iso3)) byCountry.set(iso3, [])
    byCountry.get(iso3).push(plant)
  }
  return {
    byCountry,
    source: { label: 'WRI Global Power Plant Database v1.3', url: 'https://datasets.wri.org/dataset/globalpowerplantdatabase', year: 2021 },
  }
}

// ---------------------------------------------------------------- 美國 EIA-860M（最新）

function eiaFuel(tech, code) {
  const t = String(tech || '')
  if (/coal/i.test(t)) return 'coal'
  if (/petroleum|oil|diesel/i.test(t)) return 'oil'
  if (/natural gas|gas turbine|combined cycle|gas internal/i.test(t)) return 'gas'
  if (/nuclear/i.test(t)) return 'nuclear'
  if (/hydro/i.test(t)) return 'hydro'
  if (/offshore wind|onshore wind|wind turbine/i.test(t)) return 'wind'
  if (/solar/i.test(t)) return 'solar'
  if (/geothermal/i.test(t)) return 'geothermal'
  if (/biomass|wood|landfill|biogas|municipal/i.test(t)) return 'biofuel'
  // 退回用 Energy Source Code
  const m = { COL: 'coal', NG: 'gas', NUC: 'nuclear', WAT: 'hydro', WND: 'wind', SUN: 'solar', GEO: 'geothermal' }
  return m[String(code || '').toUpperCase()] ?? 'other'
}

async function isXlsx(file) {
  // xlsx 是 zip，前兩個位元組必為 'PK'（0x50 0x4B）
  try {
    const buf = await readFile(file)
    return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b
  } catch { return false }
}

async function downloadEia() {
  await mkdir(CACHE, { recursive: true })
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  const now = new Date()
  // EIA-860M 約有 2 個月落差，往前試最多 6 個月，取第一個「真的是 xlsx」的檔
  for (let back = 1; back <= 6; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const month = months[d.getMonth()], year = d.getFullYear()
    const fname = `${month}_generator${year}.xlsx`
    const dest = path.join(CACHE, fname)
    if (await isXlsx(dest)) return { dest, month, year }
    const res = await fetch(`https://www.eia.gov/electricity/data/eia860m/xls/${fname}`)
    if (!res.ok) continue
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
    if (await isXlsx(dest)) {
      console.log(`  ↓ EIA-860M ${fname}`)
      return { dest, month, year }
    }
    await rm(dest, { force: true }) // 抓到 HTML 錯誤頁，丟棄再試前一個月
  }
  return null
}

async function processEIA() {
  let file
  try { file = await downloadEia() } catch (e) { console.warn(`  ⚠ EIA 下載失敗（${e.message}），美國沿用 WRI`); return null }
  if (!file) { console.warn('  ⚠ 找不到 EIA-860M 檔案，美國沿用 WRI'); return null }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file.dest)
  const ws = wb.getWorksheet('Operating')
  const header = ws.getRow(3).values.map((v) => String(v).trim())
  const col = (name) => header.indexOf(name)
  const cId = col('Plant ID'), cName = col('Plant Name'), cCap = col('Nameplate Capacity (MW)')
  const cTech = col('Technology'), cCode = col('Energy Source Code'), cYear = col('Operating Year')
  const cLat = col('Latitude'), cLon = col('Longitude')
  if ([cId, cName, cCap, cLat, cLon].some((i) => i < 0)) { console.warn('  ⚠ EIA 欄位對不上，美國沿用 WRI'); return null }

  // 以 Plant ID 聚合各機組 → 電廠
  const plants = new Map()
  ws.eachRow((row, rn) => {
    if (rn <= 3) return
    const v = row.values
    const id = v[cId]
    const cap = Number(v[cCap])
    const lat = Number(v[cLat]), lon = Number(v[cLon])
    if (!id || !Number.isFinite(cap) || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    const tech = v[cTech]
    if (/batter|storage|flywheel/i.test(String(tech))) return // 儲能非發電，排除
    if (!plants.has(id)) plants.set(id, { name: String(v[cName]), lat, lon, mw: 0, fuels: {}, year: null })
    const p = plants.get(id)
    p.mw += cap
    const f = eiaFuel(tech, v[cCode])
    p.fuels[f] = (p.fuels[f] ?? 0) + cap
    const y = Number(v[cYear])
    if (Number.isFinite(y)) p.year = p.year ? Math.min(p.year, y) : y
  })

  const list = []
  for (const p of plants.values()) {
    if (p.mw < MIN_MW) continue
    const fuel = Object.entries(p.fuels).sort((a, b) => b[1] - a[1])[0][0] // 容量最大的燃料為主
    list.push({ name: p.name, mw: Math.round(p.mw), lat: round4(p.lat), lon: round4(p.lon), fuel, tier: tierOf(p.mw), year: p.year })
  }
  console.log(`  ✓ EIA：美國 ${list.length} 座 ≥${MIN_MW}MW 電廠（${file.month} ${file.year}）`)
  const label = `EIA-860M (${file.month[0].toUpperCase()}${file.month.slice(1)} ${file.year})`
  return { USA: { plants: list, source: { label, url: 'https://www.eia.gov/electricity/data/eia860m/', year: file.year } } }
}

// ---------------------------------------------------------------- GEM Global Integrated Power Tracker
// scripts/.cache/gem.xlsx（使用者半年填表單下載）。覆蓋「重點國家＋東亞」，僅運轉中、≥100MW。

// GEM 國家名稱 → ISO3（i18n-iso-countries 對不到的手動補）
const GEM_NAME_FIX = {
  'South Korea': 'KOR', 'North Korea': 'PRK', 'Taiwan': 'TWN', 'Vietnam': 'VNM',
  'Russia': 'RUS', 'Turkey': 'TUR', 'Iran': 'IRN', 'Hong Kong': 'HKG', 'Macau': 'MAC',
  'United States': 'USA', 'Czechia': 'CZE', 'Laos': 'LAO', 'Brunei': 'BRN',
}
// GEM Type → 本站燃料鍵
const GEM_TYPE = {
  'utility-scale solar': 'solar', wind: 'wind', coal: 'coal', hydropower: 'hydro',
  bioenergy: 'biofuel', nuclear: 'nuclear', geothermal: 'geothermal',
}
// 目標國家：重點國家（除美國，走 EIA）＋東亞
const GEM_TARGET = new Set([
  'TWN', 'CHN', 'JPN', 'DEU', 'IND', 'GBR', 'FRA', 'KOR', 'ITA', 'BRA', 'CAN', 'RUS',
  'AUS', 'MEX', 'ESP', 'IDN', 'NLD', 'SAU', 'TUR', 'CHE', 'POL', 'SGP', 'VNM', 'PHL',
  'THA', 'MYS', 'EGY', 'NGA', 'ARG', 'MNG', 'PRK', 'HKG', 'MAC',
])

const cell = (v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? '') : v)

function gemIso3(name) {
  return GEM_NAME_FIX[name] ?? countries.getAlpha3Code(name, 'en') ?? null
}

async function processGEM() {
  const gemPath = path.join(CACHE, 'gem.xlsx')
  try { await access(gemPath) } catch { return null }
  console.log('  ↓ 處理 GEM Global Integrated Power Tracker')

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(gemPath, {})
  // 聚合鍵 = GEM location ID（同一場址）；沒有就用 名稱|國家
  const sites = new Map() // key -> { iso3, name, lat, lon, mw, fuels:{}, year }
  for await (const ws of reader) {
    if (ws.name !== 'Power facilities') continue
    for await (const row of ws) {
      if (row.number === 1) continue
      const v = row.values
      if (String(cell(v[10])) !== 'operating') continue
      const iso3 = gemIso3(String(cell(v[2]) || ''))
      if (!iso3 || !GEM_TARGET.has(iso3)) continue
      const mw = Number(cell(v[9]))
      const lat = Number(cell(v[43])), lon = Number(cell(v[44]))
      if (!Number.isFinite(mw) || mw <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
      // 燃料：油/氣用第 17 欄細分，其餘用 Type
      const type = String(cell(v[1]) || '')
      let fuel = GEM_TYPE[type] ?? 'other'
      if (type === 'oil/gas') fuel = /oil/i.test(String(cell(v[17]) || '')) ? 'oil' : 'gas'
      const key = String(cell(v[50]) || `${cell(v[5])}|${iso3}`)
      if (!sites.has(key)) sites.set(key, { iso3, name: String(cell(v[5]) || ''), lat, lon, mw: 0, fuels: {}, year: null })
      const s = sites.get(key)
      s.mw += mw
      s.fuels[fuel] = (s.fuels[fuel] ?? 0) + mw
      const y = Number(cell(v[11]))
      if (Number.isFinite(y) && y > 1900) s.year = s.year ? Math.min(s.year, y) : y
    }
    break
  }

  const byCountry = {}
  let kept = 0
  for (const s of sites.values()) {
    if (s.mw < MIN_MW) continue
    const fuel = Object.entries(s.fuels).sort((a, b) => b[1] - a[1])[0][0]
    const plant = { name: s.name, mw: Math.round(s.mw), lat: round4(s.lat), lon: round4(s.lon), fuel, tier: tierOf(s.mw), year: s.year }
    if (!byCountry[s.iso3]) byCountry[s.iso3] = { plants: [], source: { label: 'GEM Global Integrated Power Tracker (Mar 2026)', url: 'https://globalenergymonitor.org/projects/global-integrated-power-tracker/', year: 2026 } }
    byCountry[s.iso3].plants.push(plant)
    kept++
  }
  console.log(`  ✓ GEM：${kept} 座 ≥${MIN_MW}MW 運轉中電廠，${Object.keys(byCountry).length} 個目標國家`)
  return byCountry
}

// ---------------------------------------------------------------- 主流程

async function main() {
  console.log('== 電廠資料管線（多來源）==')
  const wri = await processWRI()
  const eia = await processEIA()
  const gem = await processGEM()

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const sourceByCountry = {}
  const summary = {}
  // 先寫 WRI 底圖
  for (const [iso3, plants] of wri.byCountry) {
    sourceByCountry[iso3] = { plants, source: wri.source }
  }
  // EIA 覆蓋
  if (eia) for (const [iso3, data] of Object.entries(eia)) sourceByCountry[iso3] = data
  // GEM 覆蓋
  if (gem) for (const [iso3, data] of Object.entries(gem)) sourceByCountry[iso3] = data

  for (const [iso3, { plants, source }] of Object.entries(sourceByCountry)) {
    plants.sort((a, b) => b.mw - a.mw)
    const { byFuel, byTier } = summarize(plants)
    await writeFile(path.join(OUT, `${iso3}.json`), JSON.stringify({ iso3, count: plants.length, source, byFuel, byTier, plants }))
    summary[iso3] = { count: plants.length, source: source.label }
  }
  await writeFile(path.join(OUT, '_index.json'), JSON.stringify({
    minMW: MIN_MW, generated: new Date().toISOString().slice(0, 10), countries: summary,
  }))

  const total = Object.values(sourceByCountry).reduce((s, c) => s + c.plants.length, 0)
  console.log(`  ✓ 合計 ${total} 座電廠，${Object.keys(sourceByCountry).length} 國`)
  console.log('  完成 ✓')
}

main().catch((err) => { console.error('✗ 電廠管線失敗：', err.message); process.exit(1) })

// 避免未使用匯入警告
void readdir
