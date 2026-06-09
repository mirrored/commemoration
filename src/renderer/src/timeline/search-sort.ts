import type { GraveHumanSummary } from '../../../shared/grave-human'
import { computeAgeAtDeath } from '../../../shared/age-at-death'
import { partialDateToSortTime } from '../../../shared/partial-date'

export type SearchResultSortKey = 'birth_date' | 'death_date' | 'age_at_death'
export type SortDirection = 'asc' | 'desc'

export const SEARCH_SORT_COLUMNS: { key: SearchResultSortKey; label: string }[] = [
  { key: 'birth_date', label: '出生日期' },
  { key: 'death_date', label: '去世日期' },
  { key: 'age_at_death', label: '终年' },
]

function dateSortValue(value: string | null | undefined): number | null {
  return partialDateToSortTime(value)
}

function compareNullable(a: number | null, b: number | null, direction: SortDirection): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === 'asc' ? a - b : b - a
}

export function sortSearchResults(
  items: GraveHumanSummary[],
  key: SearchResultSortKey,
  direction: SortDirection
): GraveHumanSummary[] {
  return [...items].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'birth_date':
        cmp = compareNullable(dateSortValue(a.birth_date), dateSortValue(b.birth_date), direction)
        break
      case 'death_date':
        cmp = compareNullable(dateSortValue(a.death_date), dateSortValue(b.death_date), direction)
        break
      case 'age_at_death':
        cmp = compareNullable(
          computeAgeAtDeath(a.birth_date, a.death_date),
          computeAgeAtDeath(b.birth_date, b.death_date),
          direction
        )
        break
    }
    if (cmp !== 0) return cmp
    return a.id - b.id
  })
}
