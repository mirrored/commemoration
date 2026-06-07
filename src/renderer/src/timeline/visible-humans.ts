import type { GraveHumanSummary } from '../../../shared/grave-human'

/** 当前 thin_rank 上限下时间轴上可交互的人物（有逝世日期） */
export function visibleHumansAtCap(
  humans: GraveHumanSummary[],
  cap: number
): GraveHumanSummary[] {
  return humans.filter((h) => Boolean(h.death_date) && h.thin_rank <= cap)
}
