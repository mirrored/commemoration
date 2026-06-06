import type { GraveHumanSummary } from '../../../shared/grave-human'

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

export function getDeathYearSpan(humans: GraveHumanSummary[]): number {
  const years = humans
    .map((h) => h.death_date?.slice(0, 4))
    .filter((y): y is string => Boolean(y))
    .map((y) => Number(y))
    .filter((y) => !Number.isNaN(y))

  if (years.length === 0) return 0
  return Math.max(...years) - Math.min(...years)
}
