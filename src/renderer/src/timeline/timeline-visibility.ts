import type { GraveHumanSummary } from '../../../shared/grave-human'
import {
  deathYear,
  deriveYearBoundsFromHumans,
  inclusiveYearSpan,
  type YearBounds
} from './year-range-filter'

export interface TimelineVisibilityPolicy {
  cap: number
  segmentSampleIds: Set<number> | null
  useSegmentInitial: boolean
  /** 全览缩放时仅显示五段抽样人物（与 thinRankCap 解耦，避免误抬 cap 后露出全部 rank 1） */
  segmentOverview?: boolean
  /** 本次加载/筛选的抽样种子（非缓存，每次 refresh 重新生成） */
  sampleSeed?: number
}

export function normalizeThinRank(rank: unknown): number {
  const n = typeof rank === 'number' ? rank : Number(rank)
  if (!Number.isFinite(n) || n < 1) return 5
  return Math.min(5, Math.max(1, Math.round(n)))
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
}

function pickRandom<T>(pool: T[], count: number, rng: () => number): T[] {
  if (count <= 0 || pool.length === 0) return []
  const copy = [...pool]
  shuffleInPlace(copy, rng)
  return copy.slice(0, Math.min(count, copy.length))
}

/** 五段抽样：每段随机 1–2 名 thin_rank=1，不足则依次降级 */
export function computeSegmentSampleIds(
  humans: GraveHumanSummary[],
  bounds: YearBounds,
  segmentCount = 5,
  sampleSeed = 0
): Set<number> {
  const ids = new Set<number>()
  const yearSpan = inclusiveYearSpan(bounds)
  const rng = seededRandom(
    bounds.minYear * 10_000 + bounds.maxYear * 97 + humans.length + sampleSeed
  )

  for (let i = 0; i < segmentCount; i += 1) {
    const segStart = bounds.minYear + Math.floor((i * yearSpan) / segmentCount)
    const segEnd =
      i === segmentCount - 1
        ? bounds.maxYear
        : bounds.minYear + Math.floor(((i + 1) * yearSpan) / segmentCount) - 1

    const inSegment = humans.filter((human) => {
      const year = deathYear(human)
      return year != null && year >= segStart && year <= segEnd
    })
    if (inSegment.length === 0) continue

    const targetCount = rng() < 0.55 ? 1 : 2
    let picked = 0

    for (let rank = 1; rank <= 5 && picked < targetCount; rank += 1) {
      const pool = inSegment.filter(
        (human) =>
          normalizeThinRank(human.thin_rank) === rank && !ids.has(human.id)
      )
      if (pool.length === 0) continue
      const selected = pickRandom(pool, targetCount - picked, rng)
      for (const human of selected) {
        ids.add(human.id)
        picked += 1
        if (picked >= targetCount) break
      }
    }
  }

  return ids
}

export function createInitialVisibilityPolicy(
  humans: GraveHumanSummary[],
  bounds: YearBounds | null,
  sampleSeed = Math.floor(Math.random() * 0x1_0000_0000)
): TimelineVisibilityPolicy {
  // 无年代筛选时 bounds 为 null，仍按当前可见人物的实际年份区间抽样（与筛选后逻辑一致）
  const activeBounds = bounds ?? deriveYearBoundsFromHumans(humans)
  if (!activeBounds) {
    return { cap: 1, segmentSampleIds: null, useSegmentInitial: false, sampleSeed }
  }

  const span = inclusiveYearSpan(activeBounds)
  if (span < 5) {
    return { cap: 2, segmentSampleIds: null, useSegmentInitial: false, sampleSeed }
  }

  return {
    cap: 1,
    segmentSampleIds: computeSegmentSampleIds(humans, activeBounds, 5, sampleSeed),
    useSegmentInitial: true,
    segmentOverview: true,
    sampleSeed
  }
}

export function isTimelinePersonVisible(
  human: GraveHumanSummary,
  policy: TimelineVisibilityPolicy
): boolean {
  if (!human.death_date) return false

  const sampleIds = policy.segmentSampleIds
  if (
    policy.useSegmentInitial &&
    policy.segmentOverview &&
    sampleIds &&
    sampleIds.size > 0
  ) {
    return sampleIds.has(human.id)
  }

  return normalizeThinRank(human.thin_rank) <= policy.cap
}

export function countTimelineVisibleHumans(
  humans: GraveHumanSummary[],
  policy: TimelineVisibilityPolicy
): number {
  return humans.filter((human) => isTimelinePersonVisible(human, policy)).length
}

export function visibleTimelineHumans(
  humans: GraveHumanSummary[],
  policy: TimelineVisibilityPolicy
): GraveHumanSummary[] {
  return humans.filter((human) => isTimelinePersonVisible(human, policy))
}
