import type { GraveHumanSummary } from '../../../shared/grave-human'
import { parsePartialDate } from '../../../shared/partial-date'

export interface YearRangeFilter {
  startYear: number | null
  endYear: number | null
}

export interface YearBounds {
  minYear: number
  maxYear: number
}

export function deathYear(human: GraveHumanSummary): number | null {
  const parsed = parsePartialDate(human.death_date)
  return parsed?.year ?? null
}

export function parseYearInput(value: string): number | null {
  const text = value.trim()
  if (!text || !/^\d{4}$/.test(text)) return null
  const year = Number(text)
  return Number.isFinite(year) ? year : null
}

/** 仅起始或仅终止有效时，视为单年筛选 */
export function resolveYearBounds(filter: YearRangeFilter): YearBounds | null {
  const { startYear, endYear } = filter
  if (startYear == null && endYear == null) return null
  if (startYear != null && endYear == null) {
    return { minYear: startYear, maxYear: startYear }
  }
  if (startYear == null && endYear != null) {
    return { minYear: endYear, maxYear: endYear }
  }
  return {
    minYear: Math.min(startYear!, endYear!),
    maxYear: Math.max(startYear!, endYear!)
  }
}

export function filterHumansByYearBounds(
  humans: GraveHumanSummary[],
  bounds: YearBounds | null
): GraveHumanSummary[] {
  const withDeathYear = humans.filter((h) => deathYear(h) != null)
  if (!bounds) return withDeathYear
  return withDeathYear.filter((h) => {
    const year = deathYear(h)!
    return year >= bounds.minYear && year <= bounds.maxYear
  })
}

export function deriveYearBoundsFromHumans(
  humans: GraveHumanSummary[]
): YearBounds | null {
  const years: number[] = []
  for (const human of humans) {
    const year = deathYear(human)
    if (year != null) years.push(year)
  }
  if (years.length === 0) return null
  return { minYear: Math.min(...years), maxYear: Math.max(...years) }
}

export function boundsForVisibility(
  filteredHumans: GraveHumanSummary[],
  filterBounds: YearBounds | null
): YearBounds | null {
  if (filterBounds) return filterBounds
  return deriveYearBoundsFromHumans(filteredHumans)
}

export function formatYearBoundsLabel(bounds: YearBounds | null): string {
  if (!bounds) return '—'
  if (bounds.minYear === bounds.maxYear) return `${bounds.minYear} 年`
  return `${bounds.minYear}—${bounds.maxYear} 年`
}

export function inclusiveYearSpan(bounds: YearBounds): number {
  return Math.max(bounds.maxYear - bounds.minYear + 1, 1)
}
