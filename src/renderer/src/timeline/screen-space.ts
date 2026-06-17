import type { Graph } from '@antv/g6'

/** 初次/重置时适配完整时间轴（宽高均纳入） */
export async function fitTimelineViewport(graph: Graph): Promise<void> {
  await graph.fitView({ direction: 'both' })
}
