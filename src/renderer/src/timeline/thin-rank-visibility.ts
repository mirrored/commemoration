import type { Graph } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'

function personShown(human: GraveHumanSummary, cap: number): boolean {
  return Boolean(human.death_date) && human.thin_rank <= cap
}

function personInitial(name: string): string {
  return (name.trim().slice(0, 1) || '?').replace(/[<>&"']/g, '')
}

/**
 * 切换 thin_rank 显示：仅对状态变化的节点 show/hide，并 draw。
 */
export async function applyThinRankCapToGraph(
  graph: Graph,
  humans: GraveHumanSummary[],
  cap: number,
  previousCap: number
): Promise<void> {
  const showIds: string[] = []
  const hideIds: string[] = []
  const nodeUpdates: { id: string; style: Record<string, unknown> }[] = []

  for (const human of humans) {
    if (!human.death_date) continue

    const wasShown = personShown(human, previousCap)
    const show = personShown(human, cap)
    if (wasShown === show) continue

    const personId = `person-${human.id}`
    const branchId = `branch-${human.id}`

    if (show) {
      showIds.push(personId, branchId)
      nodeUpdates.push({
        id: personId,
        style: {
          zIndex: human.thin_rank,
          pointerEvents: 'auto',
          labelPointerEvents: 'none',
          label: true,
          labelText: human.name,
          icon: true,
          iconText: personInitial(human.name)
        }
      })
    } else {
      hideIds.push(personId, branchId)
    }
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
