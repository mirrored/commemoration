export const THIN_RANK_MIN = 1
export const THIN_RANK_MAX = 5

/** 与 buildGraph TIMELINE_PORTRAIT_SIZE 一致，避免循环依赖 */
const PORTRAIT_BASE_SIZE = 48
const LABEL_BASE_FONT_SIZE = 11

/** 人物圆直径（px） */
const PERSON_SIZE_BY_RANK: Record<number, number> = {
  1: 48,
  2: 38,
  3: 28,
  4: 22,
  5: 20
}

/**
 * 分支长度占可用区间的比例（rank 越小越远、越长；4/5 明显更短）
 * 在 [minBranchLength, maxBranchLength] 内插值
 */
const BRANCH_FACTOR_BY_RANK: Record<number, number> = {
  1: 1,
  2: 0.72,
  3: 0.48,
  4: 0.22,
  5: 0.12
}

function clampThinRank(rank: number): number {
  return Math.min(THIN_RANK_MAX, Math.max(THIN_RANK_MIN, Math.round(rank)))
}

/** thin_rank 对应圆直径 */
export function personSizeForThinRank(rank: number): number {
  return PERSON_SIZE_BY_RANK[clampThinRank(rank)]
}

export function labelFontSizeForPersonSize(
  personSize: number,
  baseSize = PORTRAIT_BASE_SIZE
): number {
  const ratio = personSize / baseSize
  return Math.max(8, LABEL_BASE_FONT_SIZE * ratio)
}

/** thin_rank 越小分支越长，远离干线 */
export function branchLengthForThinRank(
  maxBranchLength: number,
  rank: number,
  personRadius: number,
  minBranchLength: number
): number {
  const floor = Math.max(minBranchLength, personRadius + 6)
  const factor = BRANCH_FACTOR_BY_RANK[clampThinRank(rank)]
  return floor + factor * Math.max(0, maxBranchLength - floor)
}

/** rank 1 在最上层 */
export function zIndexForThinRank(rank: number): number {
  return 20 - clampThinRank(rank)
}
