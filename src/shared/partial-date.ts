/** 支持 YYYY、YYYY-MM、YYYY-MM-DD 三种精度 */

export type DatePrecision = 'year' | 'month' | 'day'

export interface PartialDate {
  year: number
  month?: number
  day?: number
  precision: DatePrecision
  raw: string
}

const YEAR_RE = /^(\d{4})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/

function validMonth(month: number): boolean {
  return month >= 1 && month <= 12
}

function validDay(day: number): boolean {
  return day >= 1 && day <= 31
}

export function parsePartialDate(value: string | null | undefined): PartialDate | null {
  if (!value) return null
  const text = value.trim()
  if (!text) return null

  const yearMatch = YEAR_RE.exec(text)
  if (yearMatch) {
    return { year: Number(yearMatch[1]), precision: 'year', raw: yearMatch[1] }
  }

  const monthMatch = MONTH_RE.exec(text)
  if (monthMatch) {
    const month = Number(monthMatch[2])
    if (!validMonth(month)) return null
    return {
      year: Number(monthMatch[1]),
      month,
      precision: 'month',
      raw: `${monthMatch[1]}-${monthMatch[2]}`,
    }
  }

  const dayMatch = DAY_RE.exec(text)
  if (dayMatch) {
    const month = Number(dayMatch[2])
    const day = Number(dayMatch[3])
    if (!validMonth(month) || !validDay(day)) return null
    return {
      year: Number(dayMatch[1]),
      month,
      day,
      precision: 'day',
      raw: `${dayMatch[1]}-${dayMatch[2]}-${dayMatch[3]}`,
    }
  }

  return null
}

export function commonPrecision(a: PartialDate, b: PartialDate): DatePrecision {
  const rank: Record<DatePrecision, number> = { year: 0, month: 1, day: 2 }
  return rank[a.precision] <= rank[b.precision] ? a.precision : b.precision
}

/** 列表/详情展示：1936、1930-04、1930-04-06 */
export function formatPartialDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = parsePartialDate(value)
  if (!parsed) return value.slice(0, 10)
  if (parsed.precision === 'year') return String(parsed.year)
  if (parsed.precision === 'month') {
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
  }
  return parsed.raw
}

/** 点分展示：1936、1930.04、1930.04.06 */
export function formatPartialDateDot(value: string | null | undefined): string {
  const formatted = formatPartialDate(value)
  if (formatted === '—') return formatted
  return formatted.replaceAll('-', '.')
}

/** 排序/时间轴：年取 7 月 1 日，月取 15 日 */
export function partialDateToSortTime(value: string | null | undefined): number | null {
  const parsed = parsePartialDate(value)
  if (!parsed) return null

  if (parsed.precision === 'year') {
    return Date.parse(`${parsed.year}-07-01T00:00:00`)
  }
  if (parsed.precision === 'month') {
    return Date.parse(
      `${parsed.year}-${String(parsed.month).padStart(2, '0')}-15T00:00:00`
    )
  }
  return Date.parse(`${parsed.raw}T00:00:00`)
}
