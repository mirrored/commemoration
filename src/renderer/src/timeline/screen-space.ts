import type { Graph } from '@antv/g6'
import type { TimelineEdgeType, TimelineNodeType } from './buildGraph'
import {
  TIMELINE_BRANCH_LINE_WIDTH,
  TIMELINE_FORK_LINE_WIDTH,
  TIMELINE_FORK_SIZE,
  TIMELINE_LABEL_FONT_SIZE,
  TIMELINE_LABEL_OFFSET_Y,
  TIMELINE_PORTRAIT_LINE_WIDTH,
  TIMELINE_PORTRAIT_SIZE,
  TIMELINE_TRUNK_LINE_WIDTH,
  TIMELINE_YEAR_DIVIDER_LINE_WIDTH,
  TIMELINE_YEAR_LABEL_FONT_SIZE
} from './buildGraph'

/** 避免全览 zoom 极小时图元逻辑尺寸过大导致包围盒异常、视口被甩飞 */
const MAX_INV_ZOOM = 8

function invScale(zoom: number): number {
  return Math.min(1 / Math.max(zoom, 0.08), MAX_INV_ZOOM)
}

function isHiddenNode(node: { style?: Record<string, unknown> }): boolean {
  return node.style?.visibility === 'hidden'
}

/** 将人物/分叉/标签/边线宽按 1/zoom 补偿，使屏幕上尺寸基本恒定 */
export function applyTimelineScreenSpace(graph: Graph): void {
  const scale = invScale(graph.getZoom())

  const nodeUpdates = graph
    .getNodeData()
    .map((node) => {
      const nodeType = (node.data as { nodeType?: TimelineNodeType })?.nodeType
      const style: Record<string, number> = {}

      if (isHiddenNode(node)) return null

      switch (nodeType) {
        case 'person':
          style.size = TIMELINE_PORTRAIT_SIZE * scale
          style.labelFontSize = TIMELINE_LABEL_FONT_SIZE * scale
          style.labelOffsetY = TIMELINE_LABEL_OFFSET_Y * scale
          style.lineWidth = TIMELINE_PORTRAIT_LINE_WIDTH * scale
          break
        case 'fork':
          style.size = TIMELINE_FORK_SIZE * scale
          style.lineWidth = TIMELINE_FORK_LINE_WIDTH * scale
          break
        case 'axis':
          if (node.style?.labelText) {
            const yearDividerLabel = node.id.startsWith('year-divider-label')
            style.labelFontSize =
              (yearDividerLabel ? TIMELINE_YEAR_LABEL_FONT_SIZE : 10) * scale
          }
          break
        default:
          return null
      }

      return { id: node.id, style }
    })
    .filter((item): item is { id: string; style: Record<string, number> } => item != null)

  if (nodeUpdates.length > 0) {
    graph.updateNodeData(nodeUpdates)
  }

  const edgeUpdates = graph
    .getEdgeData()
    .map((edge) => {
      const edgeType = (edge.data as { edgeType?: TimelineEdgeType })?.edgeType
      const style: Record<string, number> = {}

      if (edge.style?.visibility === 'hidden') return null

      switch (edgeType) {
        case 'trunk':
          style.lineWidth = TIMELINE_TRUNK_LINE_WIDTH * scale
          break
        case 'branch':
          style.lineWidth = TIMELINE_BRANCH_LINE_WIDTH * scale
          break
        case 'year-divider':
          style.lineWidth = TIMELINE_YEAR_DIVIDER_LINE_WIDTH * scale
          break
        default:
          return null
      }

      return { id: edge.id, style }
    })
    .filter((item): item is { id: string; style: Record<string, number> } => item != null)

  if (edgeUpdates.length > 0) {
    graph.updateEdgeData(edgeUpdates)
  }
}
