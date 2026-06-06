import type { Graph } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'

function personShown(human: GraveHumanSummary, cap: number): boolean {
  return Boolean(human.death_date) && human.thin_rank <= cap
}

/**
 * 切换 thin_rank 显示：show/hide + zIndex，并 draw。
 */
export async function applyThinRankCapToGraph(
  graph: Graph,
  humans: GraveHumanSummary[],
  cap: number
): Promise<void> {
  const showIds: string[] = []
  const hideIds: string[] = []
  const nodeUpdates: { id: string; style: Record<string, unknown> }[] = []

  for (const human of humans) {
    if (!human.death_date) continue
    const show = personShown(human, cap)
    const personId = `person-${human.id}`
    const branchId = `branch-${human.id}`

    if (show) {
      showIds.push(personId, branchId)
    } else {
      hideIds.push(personId, branchId)
    }

    nodeUpdates.push({
      id: personId,
      style: {
        zIndex: human.thin_rank,
        pointerEvents: 'auto',
        labelPointerEvents: 'none'
      }
    })
  }

  if (hideIds.length > 0) {
    await graph.hideElement(hideIds, false)
  }
  if (showIds.length > 0) {
    await graph.showElement(showIds, false)
  }
  if (nodeUpdates.length > 0) {
    graph.updateNodeData(nodeUpdates)
  }
  await graph.draw()
}
