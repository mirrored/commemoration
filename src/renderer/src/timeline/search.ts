import type { GraveHumanSummary } from '../../../shared/grave-human'
import { formatPartialDate } from '../../../shared/partial-date'

export type GraveHumanSearchField =
  | 'name'
  | 'ethnicity'
  | 'nationality'
  | 'birthplace'
  | 'occupation'
  | 'notable_works'
  | 'achievements'
  | 'birth_date'
  | 'death_date'

export interface GraveHumanSearchFieldOption {
  value: GraveHumanSearchField
  label: string
}

export const GRAVE_HUMAN_SEARCH_FIELDS: GraveHumanSearchFieldOption[] = [
  { value: 'name', label: '姓名' },
  { value: 'ethnicity', label: '民族' },
  { value: 'nationality', label: '国籍' },
  { value: 'birthplace', label: '出生地' },
  { value: 'occupation', label: '职业' },
  { value: 'notable_works', label: '作品' },
  { value: 'achievements', label: '成就' },
  { value: 'birth_date', label: '出生年份' },
  { value: 'death_date', label: '去世年份' }
]

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function textHaystack(value: string | null | undefined): string {
  return (value ?? '').toLowerCase()
}

function listTextHaystack(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function yearHaystack(date: string | null | undefined): string {
  if (!date) return ''
  const year = date.slice(0, 4)
  return year && /^\d{4}$/.test(year) ? year : date.slice(0, 10).toLowerCase()
}

function fieldHaystack(human: GraveHumanSummary, field: GraveHumanSearchField): string {
  switch (field) {
    case 'name':
      return textHaystack(human.name)
    case 'ethnicity':
      return textHaystack(human.ethnicity)
    case 'nationality':
      return textHaystack(human.nationality)
    case 'birthplace':
      return textHaystack(human.birthplace)
    case 'occupation':
      return textHaystack(human.occupation)
    case 'notable_works':
      return listTextHaystack(human.notable_works)
    case 'achievements':
      return listTextHaystack(human.achievements)
    case 'birth_date':
      return yearHaystack(human.birth_date)
    case 'death_date':
      return yearHaystack(human.death_date)
  }
}

/** 子串匹配；出生/去世年份字段仅匹配年份部分 */
export function searchGraveHumans(
  humans: GraveHumanSummary[],
  field: GraveHumanSearchField,
  query: string
): GraveHumanSummary[] {
  const q = normalizeQuery(query)
  if (!q) return []

  return humans.filter((human) => fieldHaystack(human, field).includes(q))
}

export function formatSearchDate(value: string | null | undefined): string {
  return formatPartialDate(value)
}
