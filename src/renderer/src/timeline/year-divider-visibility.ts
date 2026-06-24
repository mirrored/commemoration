import type { GraveHumanSummary } from '../../../shared/grave-human'
import { partialDateToSortTime } from '../../../shared/partial-date'
import { deathYear } from './year-range-filter'

/** 可见人物所在年，及其后一年（需绘制分界线） */
export function computeDividerYearsForVisible(
  humans: GraveHumanSummary[],
  isPersonVisible: (human: GraveHumanSummary) => boolean
): Set<number> {
  const visibleYears = new Set<number>()
  for (const human of humans) {
    if (!isPersonVisible(human)) continue
    const year = deathYear(human)
    if (year != null) visibleYears.add(year)
  }

  const dividerYears = new Set<number>()
  for (const y of visibleYears) {
    dividerYears.add(y)
    dividerYears.add(y + 1)
  }
  return dividerYears
}

/** 时间轴上实际存在分界线的年份（数据中有相邻不同逝世年） */
export function listAllYearDividerYears(humans: GraveHumanSummary[]): number[] {
  const valid = humans
    .filter((h) => h.death_date)
    .map((h) => ({
      human: h,
      time: partialDateToSortTime(h.death_date)
    }))
    .filter((item) => item.time != null && !Number.isNaN(item.time))
    .sort((a, b) => a.time! - b.time! || a.human.id - b.human.id)

  const years: number[] = []
  for (let i = 1; i < valid.length; i += 1) {
    const prevYear = new Date(valid[i - 1].time!).getFullYear()
    const currYear = new Date(valid[i].time!).getFullYear()
    if (currYear !== prevYear) {
      years.push(currYear)
    }
  }
  return years
}

export function yearDividerElementIds(year: number): string[] {
  return [
    `year-divider-top-${year}`,
    `year-divider-bottom-${year}`,
    `year-divider-label-${year}`,
    `year-divider-line-${year}`
  ]
}
