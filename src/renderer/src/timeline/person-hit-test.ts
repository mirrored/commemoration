import type { Graph } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'
import { TIMELINE_PORTRAIT_SIZE } from './buildGraph'

export interface PersonHitResult {
  id: string
  human: GraveHumanSummary
}

/** 是否在当前 thin_rank 上限下应显示且可交互 */
export function isPersonVisibleAtCap(
  human: GraveHumanSummary,
  cap: number
): boolean {
  return Boolean(human.death_date) && human.thin_rank <= cap
}

/**
 * 用屏幕坐标在可见人物头像中做圆形命中（不依赖 G6 pointerEvents）。
 * 优先 thin_rank 较大者，避免被 rank=1 的大拾取区挡住。
 */
export function hitTestPersonAtClient(
  graph: Graph,
  humans: GraveHumanSummary[],
  cap: number,
  clientX: number,
  clientY: number
): PersonHitResult | null {
  const [canvasX, canvasY] = graph.getCanvasByClient([clientX, clientY])

  const candidates = humans
    .filter((h) => isPersonVisibleAtCap(h, cap))
    .sort((a, b) => b.thin_rank - a.thin_rank)

  let best: (PersonHitResult & { dist: number }) | null = null

  for (const human of candidates) {
    const id = `person-${human.id}`
    if (graph.getElementVisibility(id) === 'hidden') continue

    const style = graph.getElementRenderStyle(id)
    const nx = Number(style.x)
    const ny = Number(style.y)
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue

    const size = Number(style.size) || TIMELINE_PORTRAIT_SIZE
    const radius = size / 2
    const dist = Math.hypot(nx - canvasX, ny - canvasY)

    if (dist <= radius * 1.08 && (!best || dist < best.dist)) {
      best = { id, human, dist }
    }
  }

  if (!best) return null
  return { id: best.id, human: best.human }
}
