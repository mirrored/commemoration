import type { Graph } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'
import {
  isTimelinePersonVisible,
  type TimelineVisibilityPolicy
} from './timeline-visibility'
import { zIndexForThinRank } from './thin-rank-layout'

function personInitial(name: string): string {
  return (name.trim().slice(0, 1) || '?').replace(/[<>&"']/g, '')
}

/** 按策略强制设置全部人物节点/分支的显示状态（初次渲染必须调用，仅靠 style.visibility 不可靠） */
export async function enforceTimelineVisibility(
  graph: Graph,
  humans: GraveHumanSummary[],
  policy: TimelineVisibilityPolicy
): Promise<void> {
  const showIds: string[] = []
  const hideIds: string[] = []
  const nodeUpdates: { id: string; style: Record<string, unknown> }[] = []

  for (const human of humans) {
    if (!human.death_date) continue

    const personId = `person-${human.id}`
    const branchId = `branch-${human.id}`
    const show = isTimelinePersonVisible(human, policy)

    if (show) {
      showIds.push(personId, branchId)
      nodeUpdates.push({
        id: personId,
        style: {
          visibility: 'visible',
          zIndex: zIndexForThinRank(human.thin_rank),
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
      nodeUpdates.push({
        id: personId,
        style: {
          visibility: 'hidden',
          pointerEvents: 'none',
          label: false,
          icon: false
        }
      })
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

/**
 * 切换可见性：仅对状态变化的节点 show/hide，并 draw。
 */
export async function applyTimelineVisibilityToGraph(
  graph: Graph,
  humans: GraveHumanSummary[],
  policy: TimelineVisibilityPolicy,
  previousPolicy: TimelineVisibilityPolicy
): Promise<void> {
  const showIds: string[] = []
  const hideIds: string[] = []
  const nodeUpdates: { id: string; style: Record<string, unknown> }[] = []

  for (const human of humans) {
    if (!human.death_date) continue

    const wasShown = isTimelinePersonVisible(human, previousPolicy)
    const show = isTimelinePersonVisible(human, policy)
    if (wasShown === show) continue

    const personId = `person-${human.id}`
    const branchId = `branch-${human.id}`

    if (show) {
      showIds.push(personId, branchId)
      nodeUpdates.push({
        id: personId,
        style: {
          zIndex: zIndexForThinRank(human.thin_rank),
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

/** @deprecated 使用 applyTimelineVisibilityToGraph */
export async function applyThinRankCapToGraph(
  graph: Graph,
  humans: GraveHumanSummary[],
  cap: number,
  previousCap: number
): Promise<void> {
  const policy = { cap, segmentSampleIds: null, useSegmentInitial: false }
  const previousPolicy = { cap: previousCap, segmentSampleIds: null, useSegmentInitial: false }
  return applyTimelineVisibilityToGraph(graph, humans, policy, previousPolicy)
}
