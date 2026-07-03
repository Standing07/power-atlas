#!/usr/bin/env node
/**
 * 資料管線：下載 → 清洗 → 驗證 → 產出靜態 JSON
 *
 * 來源：
 *  - OWID energy dataset (CC-BY, 底層為 Ember + Energy Institute)
 *  - IRENA 統計 API（地熱、離岸/陸域風電拆分）
 *  - world-atlas (Natural Earth) 地圖圖資
 *
 * 執行：npm run data          （重用已下載的快取）
 *      npm run data -- --force（強制重新下載）
 *
 * 任何驗證關卡失敗都會以非零狀態碼結束，且不覆寫既有的 public/data，
 * 讓 GitHub Actions 自動更新失敗時保留舊資料。
 */
import { mkdir, readFile, writeFile, rm, rename, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import countries from 'i18n-iso-countries'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'scripts', '.cache')
const OUT = path.join(ROOT, 'public', 'data')
const STAGE = path.join(ROOT, 'scripts', '.stage') // 先寫到暫存區，全部驗證通過才搬進 public/data

const FORCE = process.argv.includes('--force')

const OWID_URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv'
const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json'
const IRENA_URL =
  'https://pxweb.irena.org/api/v1/en/IRENASTAT/Power%20Capacity%20and%20Generation/Country_ELECGEN_2025_H2_v-PX%201.px'

const START_YEAR = 1985

// ---------------------------------------------------------------- 下載

async function download(url, file, options) {
  const dest = path.join(CACHE, file)
  if (!FORCE) {
    try {
      await access(dest)
      console.log(`  ✓ 使用快取 ${file}`)
      return dest
    } catch {
      /* 沒有快取，往下下載 */
    }
  }
  console.log(`  ↓ 下載 ${url}`)
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`下載失敗 ${url}: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  return dest
}

// ---------------------------------------------------------------- CSV 解析（處理引號欄位）

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// ---------------------------------------------------------------- IRENA：地熱、離岸/陸域風電

const IRENA_TECH = { 3: 'windOnshore', 4: 'windOffshore', 12: 'geothermal' }

async function loadIrena() {
  const body = JSON.stringify({
    query: [
      { code: 'Technology', selection: { filter: 'item', values: ['3', '4', '12'] } },
      { code: 'Grid connection', selection: { filter: 'item', values: ['2'] } }, // All
    ],
    response: { format: 'json' },
  })
  let raw
  try {
    const file = await download(IRENA_URL, 'irena-elecgen.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch (err) {
    console.warn(`  ⚠ IRENA 資料無法取得（${err.message}），將以「風力（合計）」顯示，不拆分。`)
    return { data: new Map(), years: [] }
  }
  // key = [iso3, techCode, dataType, grid, yearIndex]
  const yearVar = raw.columns?.find?.((c) => c.code === 'Year')
  // pxweb json 格式的 year index 對照要另外抓 metadata；直接假設 index 0 = 2000（已於探索時確認）
  const BASE_YEAR = 2000
  const map = new Map() // iso3 -> year -> {windOnshore, windOffshore, geothermal} (TWh)
  for (const row of raw.data) {
    const [iso3, tech, , , yearIdx] = row.key
    const field = IRENA_TECH[tech]
    const v = row.values[0]
    if (!field || v === '..' || v === '-' || v === '') continue
    const year = BASE_YEAR + Number(yearIdx)
    const twh = Number(v) / 1000 // GWh -> TWh
    if (!Number.isFinite(twh)) continue
    if (!map.has(iso3)) map.set(iso3, new Map())
    const byYear = map.get(iso3)
    if (!byYear.has(year)) byYear.set(year, {})
    byYear.get(year)[field] = twh
  }
  void yearVar
  console.log(`  ✓ IRENA：${map.size} 個國家有風電/地熱拆分資料`)
  return { data: map }
}

// ---------------------------------------------------------------- 地圖圖資

async function buildGeoJson() {
  const file = await download(ATLAS_URL, 'countries-110m.json', undefined)
  const topo = JSON.parse(await readFile(file, 'utf8'))
  const geo = feature(topo, topo.objects.countries)
  // 南極洲沒有電網資料，移除以免地圖出現一大塊灰色
  geo.features = geo.features.filter((f) => f.properties.name !== 'Antarctica')
  // 修正跨越 180 度經線的圖形（俄羅斯、斐濟）：ECharts 會把 +180→-180 的跳變畫成橫貫地圖的色帶，
  // 把負經度平移 +360 讓圖形連續
  for (const f of geo.features) {
    const lons = []
    const walk = (c, fn) => (typeof c[0] === 'number' ? fn(c) : c.forEach((x) => walk(x, fn)))
    walk(f.geometry.coordinates, (pt) => lons.push(pt[0]))
    if (Math.max(...lons) - Math.min(...lons) > 300) {
      walk(f.geometry.coordinates, (pt) => {
        if (pt[0] < 0) pt[0] += 360
      })
    }
  }
  let matched = 0
  for (const f of geo.features) {
    // world-atlas 的 id 是 ISO 3166 數字碼
    const iso3 = countries.numericToAlpha3(String(f.id).padStart(3, '0'))
    if (iso3) {
      f.properties = { iso3, name: f.properties.name }
      matched++
    } else {
      f.properties = { name: f.properties.name }
    }
  }
  if (!geo.features.some((f) => f.properties.iso3 === 'TWN')) {
    throw new Error('驗證失敗：地圖圖資中找不到台灣（TWN）獨立圖徵')
  }
  console.log(`  ✓ 地圖：${geo.features.length} 個圖徵，${matched} 個對到 ISO 代碼（含台灣）`)
  return geo
}

// ---------------------------------------------------------------- OWID 主資料

const NUM_COLS = [
  'population', 'gdp',
  'electricity_generation', 'electricity_demand', 'electricity_demand_per_capita',
  'carbon_intensity_elec', 'net_elec_imports', 'net_elec_imports_share_demand',
  'coal_electricity', 'gas_electricity', 'oil_electricity', 'nuclear_electricity',
  'hydro_electricity', 'wind_electricity', 'solar_electricity', 'biofuel_electricity',
  'other_renewable_exc_biofuel_electricity',
  'coal_share_elec', 'gas_share_elec', 'oil_share_elec', 'nuclear_share_elec',
  'hydro_share_elec', 'wind_share_elec', 'solar_share_elec', 'biofuel_share_elec',
  'other_renewables_share_elec_exc_biofuel',
  'low_carbon_share_elec', 'renewables_share_elec', 'fossil_share_elec',
  'coal_production', 'oil_production', 'gas_production',
  'coal_consumption', 'oil_consumption', 'gas_consumption',
  'nuclear_consumption', 'hydro_consumption', 'wind_consumption', 'solar_consumption',
  'biofuel_consumption', 'other_renewable_consumption',
  'primary_energy_consumption', 'energy_per_gdp', 'energy_per_capita',
]

async function loadOwid() {
  const file = await download(OWID_URL, 'owid-energy-data.csv', undefined)
  const text = await readFile(file, 'utf8')
  const lines = text.split('\n')
  const header = parseCsvLine(lines[0])
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const col of ['country', 'year', 'iso_code', ...NUM_COLS]) {
    if (!(col in idx)) throw new Error(`驗證失敗：OWID 資料缺少欄位 ${col}（上游格式可能改變）`)
  }
  const rows = new Map() // iso3 -> [rows]
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cells = parseCsvLine(lines[i])
    let iso = cells[idx.iso_code]
    const name = cells[idx.country]
    const year = Number(cells[idx.year])
    if (year < START_YEAR) continue
    if (!iso) {
      // OWID 的彙總列（World、區域、收入分組）沒有 iso_code；只保留 World 與科索沃
      if (name === 'World') iso = 'WORLD'
      else if (name === 'Kosovo') iso = 'XKX'
      else continue
    }
    const r = { year, name }
    for (const col of NUM_COLS) {
      const v = cells[idx[col]]
      r[col] = v === '' ? null : Number(v)
    }
    if (!rows.has(iso)) rows.set(iso, [])
    rows.get(iso).push(r)
  }
  console.log(`  ✓ OWID：${rows.size} 個國家/地區（含世界彙總）`)
  return rows
}

// ---------------------------------------------------------------- 整併

const round = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)))

/** 用 IRENA 的比例拆分 OWID 的風電總量與其他再生能源中的地熱 */
function applyIrenaSplit(point, irenaYear, estimated = false) {
  if (!irenaYear) return
  const { windOnshore = null, windOffshore = null, geothermal = null } = irenaYear
  if (estimated) point.splitEstimated = true
  if (point.wind != null && windOnshore != null && windOffshore != null && windOnshore + windOffshore > 0) {
    const offShare = windOffshore / (windOnshore + windOffshore)
    point.windOffshore = round(point.wind * offShare)
    point.windOnshore = round(point.wind - point.windOffshore)
  }
  if (point.otherRenewables != null && geothermal != null && geothermal > 0) {
    point.geothermal = round(Math.min(geothermal, point.otherRenewables))
    point.otherRenewables = round(point.otherRenewables - point.geothermal)
  }
}

function selfSufficiency(r, carriedFossil) {
  const total = r.primary_energy_consumption
  if (!total || total <= 0) return null
  const hasProdData = r.coal_production != null || r.oil_production != null || r.gas_production != null
  let fossil = (r.coal_production ?? 0) + (r.oil_production ?? 0) + (r.gas_production ?? 0)
  if (!hasProdData) {
    // 化石燃料生產欄位缺漏時：僅在最近已知的化石產量佔比很小（<15%，例如台灣、日本）
    // 才沿用該小值估算；產能大國（沙烏地等）缺漏則不猜測，回傳 null。
    if (carriedFossil == null || carriedFossil / total >= 0.15) return null
    fossil = carriedFossil
  }
  const domestic =
    fossil +
    (r.nuclear_consumption ?? 0) + (r.hydro_consumption ?? 0) + (r.wind_consumption ?? 0) +
    (r.solar_consumption ?? 0) + (r.biofuel_consumption ?? 0) + (r.other_renewable_consumption ?? 0)
  return Math.min(domestic / total, 5) // 出口大國可能 >1，上限 5 避免極端值
}

function buildSeries(owidRows, irena, iso3) {
  const irenaByYear = irena.data.get(iso3)
  // IRENA 資料通常比 Ember 晚 1–2 年；之後的年份沿用最近一年的拆分比例（標記為估計）
  const lastIrenaYear = irenaByYear ? Math.max(...irenaByYear.keys()) : null
  let carriedFossil = null // 最近一年已知的化石燃料總產量（處理台灣等生產欄位中斷的情況）
  return owidRows
    .filter((r) => r.electricity_generation != null || r.coal_electricity != null)
    .map((r) => {
      if (r.coal_production != null || r.oil_production != null || r.gas_production != null) {
        carriedFossil = (r.coal_production ?? 0) + (r.oil_production ?? 0) + (r.gas_production ?? 0)
      }
      const p = {
        year: r.year,
        generation: round(r.electricity_generation),
        demand: round(r.electricity_demand),
        demandPerCapita: round(r.electricity_demand_per_capita, 0),
        carbonIntensity: round(r.carbon_intensity_elec, 1),
        netImports: round(r.net_elec_imports),
        netImportsShare: round(r.net_elec_imports_share_demand, 2),
        population: r.population,
        coal: round(r.coal_electricity),
        gas: round(r.gas_electricity),
        oil: round(r.oil_electricity),
        nuclear: round(r.nuclear_electricity),
        hydro: round(r.hydro_electricity),
        wind: round(r.wind_electricity),
        solar: round(r.solar_electricity),
        biofuel: round(r.biofuel_electricity),
        otherRenewables: round(r.other_renewable_exc_biofuel_electricity),
        shares: {
          coal: round(r.coal_share_elec, 2),
          gas: round(r.gas_share_elec, 2),
          oil: round(r.oil_share_elec, 2),
          nuclear: round(r.nuclear_share_elec, 2),
          hydro: round(r.hydro_share_elec, 2),
          wind: round(r.wind_share_elec, 2),
          solar: round(r.solar_share_elec, 2),
          biofuel: round(r.biofuel_share_elec, 2),
          otherRenewables: round(r.other_renewables_share_elec_exc_biofuel, 2),
          lowCarbon: round(r.low_carbon_share_elec, 2),
          renewables: round(r.renewables_share_elec, 2),
          fossil: round(r.fossil_share_elec, 2),
        },
        selfSufficiency: round(selfSufficiency(r, carriedFossil), 3),
        fuelTrade: {
          coalProduction: round(r.coal_production, 1),
          coalConsumption: round(r.coal_consumption, 1),
          oilProduction: round(r.oil_production, 1),
          oilConsumption: round(r.oil_consumption, 1),
          gasProduction: round(r.gas_production, 1),
          gasConsumption: round(r.gas_consumption, 1),
        },
        energyPerGdp: round(r.energy_per_gdp, 3),
      }
      if (irenaByYear?.has(r.year)) applyIrenaSplit(p, irenaByYear.get(r.year))
      else if (lastIrenaYear && r.year > lastIrenaYear) applyIrenaSplit(p, irenaByYear.get(lastIrenaYear), true)
      return p
    })
}

/** 出口/進口角色徽章 */
function tradeBadges(latest) {
  const badges = []
  const t = latest.fuelTrade
  for (const fuel of ['coal', 'oil', 'gas']) {
    const prod = t[`${fuel}Production`]
    const cons = t[`${fuel}Consumption`]
    if (prod != null && cons != null && prod > 50 && prod > cons * 1.5) badges.push(`${fuel}Exporter`)
  }
  if (latest.selfSufficiency != null && latest.selfSufficiency > 1.3) badges.push('energyExporter')
  if (latest.selfSufficiency != null && latest.selfSufficiency < 0.3) badges.push('importDependent')
  return badges
}

// ---------------------------------------------------------------- 驗證

const KEY_COUNTRY_CHECKS = [
  // [iso3, 說明, 檢查函式]（範圍放寬，避免年度小幅變動造成誤報）
  ['TWN', '台灣：高度依賴進口、化石為主', (c) => c.selfSufficiency < 0.25 && c.shares.fossil > 60],
  ['USA', '美國：天然氣為最大宗', (c) => c.shares.gas > 25 && c.shares.gas < 60],
  ['CHN', '中國：燃煤為主', (c) => c.shares.coal > 40],
  ['DEU', '德國：再生能源過半或接近', (c) => c.shares.renewables > 35],
  ['JPN', '日本：化石為主、依賴進口', (c) => c.shares.fossil > 50 && c.selfSufficiency < 0.4],
  ['IND', '印度：燃煤為主', (c) => c.shares.coal > 55],
  ['KOR', '韓國：核能有一定佔比', (c) => c.shares.nuclear > 15 && c.shares.nuclear < 45],
  ['SGP', '新加坡：天然氣為絕對主力', (c) => c.shares.gas > 70],
  ['AUS', '澳洲：煤炭出口大國', (c) => c.badges.includes('coalExporter')],
  ['FRA', '法國：核能為主', (c) => c.shares.nuclear > 50],
  ['VNM', '越南：煤+水力為主', (c) => c.shares.coal + c.shares.hydro > 45],
  ['PHL', '菲律賓：燃煤為主、有地熱', (c) => c.shares.coal > 40],
  ['GBR', '英國：風電佔比顯著', (c) => c.shares.wind > 15],
]

async function validate(index, world) {
  const errors = []
  // 1. 佔比加總 ≈ 100%
  let checked = 0
  for (const c of index) {
    const s = c.shares
    const parts = [s.coal, s.gas, s.oil, s.nuclear, s.hydro, s.wind, s.solar, s.biofuel, s.otherRenewables]
    if (parts.every((v) => v != null)) {
      const sum = parts.reduce((a, b) => a + b, 0)
      checked++
      if (Math.abs(sum - 100) > 3) errors.push(`${c.iso3} 能源佔比加總 ${sum.toFixed(1)}% 偏離 100%`)
    }
  }
  if (checked < 100) errors.push(`只有 ${checked} 個國家有完整佔比資料（預期 >100）`)

  // 2. 國家數不得比上次少 10% 以上
  try {
    const prev = JSON.parse(await readFile(path.join(OUT, 'countries.json'), 'utf8'))
    if (index.length < prev.countries.length * 0.9) {
      errors.push(`國家數 ${index.length} 比上次 ${prev.countries.length} 減少超過 10%`)
    }
  } catch {
    /* 第一次執行，跳過 */
  }

  // 3. 重點國家抽樣
  for (const [iso3, label, check] of KEY_COUNTRY_CHECKS) {
    const c = index.find((x) => x.iso3 === iso3)
    if (!c) errors.push(`找不到重點國家 ${iso3}`)
    else if (!check(c)) errors.push(`重點國家抽樣失敗 — ${label}（實際值：${JSON.stringify(c.shares)} selfSuff=${c.selfSufficiency}）`)
  }

  // 4. 資料年份
  const latestYear = Math.max(...index.map((c) => c.latestYear))
  const currentYear = new Date().getFullYear()
  if (latestYear < currentYear - 3) errors.push(`最新資料年份 ${latestYear} 過舊`)
  console.log(`  ✓ 最新資料年份：${latestYear}（提醒：上游每年 4–6 月左右發布前一年資料）`)

  if (!world || world.latest?.generation < 20000) errors.push('世界彙總資料異常（全球發電量 < 20,000 TWh）')

  return errors
}

// ---------------------------------------------------------------- 主流程

async function main() {
  console.log('== 全球電力地圖 資料管線 ==')
  await mkdir(CACHE, { recursive: true })
  await rm(STAGE, { recursive: true, force: true })
  await mkdir(path.join(STAGE, 'country'), { recursive: true })

  console.log('[1/5] 下載與解析來源資料')
  const [owid, irena, geo] = await Promise.all([loadOwid(), loadIrena(), buildGeoJson()])

  console.log('[2/5] 整併各國時間序列')
  const index = []
  let world = null
  for (const [iso, rows] of owid) {
    rows.sort((a, b) => a.year - b.year)
    const series = buildSeries(rows, irena, iso)
    if (!series.length) continue
    const withGen = series.filter((p) => p.generation != null)
    const latest = withGen.at(-1) ?? series.at(-1)
    if (!latest) continue

    if (iso === 'WORLD') {
      world = { name: 'World', latestYear: latest.year, latest, series }
      continue
    }
    const iso3 = iso
    const iso2 = iso3 === 'XKX' ? 'XK' : (countries.alpha3ToAlpha2(iso3) ?? null)
    // 電力資料（Ember）通常比燃料生產資料（Energy Institute）多一年，
    // 自給率與燃料貿易回退到最近有資料的年份
    const latestTrade = [...series].reverse().find((p) => p.selfSufficiency != null) ?? latest
    const entry = {
      iso3,
      iso2,
      name: rows.at(-1).name,
      latestYear: latest.year,
      generation: latest.generation,
      demand: latest.demand,
      demandPerCapita: latest.demandPerCapita,
      population: latest.population,
      carbonIntensity: latest.carbonIntensity,
      netImportsShare: latest.netImportsShare,
      selfSufficiency: latestTrade.selfSufficiency,
      tradeYear: latestTrade.year,
      energyPerGdp: latestTrade.energyPerGdp,
      shares: latest.shares,
      fuelTrade: latestTrade.fuelTrade,
      windOnshore: latest.windOnshore ?? null,
      windOffshore: latest.windOffshore ?? null,
      geothermal: latest.geothermal ?? null,
    }
    entry.badges = tradeBadges(latestTrade)
    index.push(entry)
    await writeFile(
      path.join(STAGE, 'country', `${iso3}.json`),
      JSON.stringify({ iso3, iso2, name: entry.name, series })
    )
  }
  index.sort((a, b) => (b.generation ?? 0) - (a.generation ?? 0))

  console.log(`[3/5] 驗證（${index.length} 個國家）`)
  const errors = await validate(index, world)
  if (errors.length) {
    console.error('\n✗ 驗證失敗，保留舊資料，不更新：')
    for (const e of errors) console.error('  - ' + e)
    process.exit(1)
  }
  console.log('  ✓ 全部驗證關卡通過')

  console.log('[4/5] 寫入 public/data')
  await writeFile(
    path.join(STAGE, 'countries.json'),
    JSON.stringify({
      generated: new Date().toISOString().slice(0, 10),
      sources: {
        energy: 'Our World in Data (Ember; Energy Institute) — CC BY 4.0',
        windGeothermalSplit: 'IRENA Renewable Energy Statistics',
        map: 'Natural Earth (world-atlas)',
      },
      world,
      countries: index,
    })
  )
  await writeFile(path.join(STAGE, 'world.geo.json'), JSON.stringify(geo))

  // 原子性搬移：驗證全過才覆蓋
  await rm(OUT, { recursive: true, force: true })
  await mkdir(path.dirname(OUT), { recursive: true })
  await rename(STAGE, OUT)

  console.log('[5/5] 完成 ✓')
  console.log(`  countries.json：${index.length} 個國家`)
}

main().catch((err) => {
  console.error('✗ 資料管線失敗：', err.message)
  process.exit(1)
})
