import type { GraveHumanSummary } from '../../../shared/grave-human'
import { parsePartialDate } from '../../../shared/partial-date'

/**
 * 相对全览的缩放倍率阈值。
 * 相邻级别所需额外放大比例约为 3 : 2 : 2 : 1（1→2→3→4→5）。
 */
const RANK_THRESHOLDS: { minRatio: number; cap: number }[] = [
  { minRatio: 8, cap: 5 },
  { minRatio: 7, cap: 4 },
  { minRatio: 5, cap: 3 },
  { minRatio: 3, cap: 2 },
  { minRatio: 0, cap: 1 }
]

/**
 * 根据画布缩放比例决定可见的 thin_rank 上限。
 * @param zoom 当前视口缩放
 * @param baselineZoom 首次 fitView 后的缩放（全览基准），用于相对阈值，避免全览 zoom 很小时需放大很多才到 rank 2
 */
export function maxVisibleThinRankFromZoom(
  zoom: number,
  baselineZoom = 1
): number {
  const base = Math.max(baselineZoom, 0.05)
  const ratio = zoom / base

  for (const { minRatio, cap } of RANK_THRESHOLDS) {
    if (ratio >= minRatio) return cap
  }
  return 1
}

export function countVisibleByThinRank(
  humans: GraveHumanSummary[],
  cap: number
): number {
  return humans.filter((h) => h.thin_rank <= cap).length
}

/** 从逝世日期提取年份区间（仅统计有 death_date 的记录） */
export function getDeathYearRange(
  humans: GraveHumanSummary[]
): { minYear: number; maxYear: number } | null {
  const years: number[] = []
  for (const human of humans) {
    if (!human.death_date) continue
    const parsed = parsePartialDate(human.death_date)
    if (parsed) years.push(parsed.year)
  }
  if (years.length === 0) return null
  return { minYear: Math.min(...years), maxYear: Math.max(...years) }
}

/** 副标题展示：2015—2026 年；同年则 2015 年 */
export function formatDeathYearSpanLabel(humans: GraveHumanSummary[]): string {
  const range = getDeathYearRange(humans)
  if (!range) return '—'
  if (range.minYear === range.maxYear) return `${range.minYear} 年`
  return `${range.minYear}—${range.maxYear} 年`
}

/** @deprecated 使用 formatDeathYearSpanLabel；保留以免外部引用 */
export function getDeathYearSpan(humans: GraveHumanSummary[]): number {
  const range = getDeathYearRange(humans)
  if (!range) return 0
  return Math.max(range.maxYear - range.minYear + 1, 1)
}
