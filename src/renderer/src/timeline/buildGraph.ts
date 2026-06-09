import type { GraveHumanSummary } from '../../../shared/grave-human'
import {
  formatPartialDate,
  formatPartialDateDot,
  partialDateToSortTime
} from '../../../shared/partial-date'
import { genderBranchColors } from './colors'

export type TimelineNodeType =
  | 'fork'
  | 'person'
  | 'stub'
  | 'axis'
  | 'trunk-anchor'
  | 'year-divider'

export type TimelineEdgeType = 'trunk' | 'branch' | 'year-divider'

const MIN_FORK_GAP = 64
const TRUNK_EXTEND_PX = 72

/** 逻辑尺寸（zoom=1）；实际渲染由 screen-space 按 1/zoom 补偿为屏幕恒定 */
export const TIMELINE_TRUNK_LINE_WIDTH = 16
export const TIMELINE_BRANCH_LINE_WIDTH = 2.5
export const TIMELINE_YEAR_DIVIDER_LINE_WIDTH = 3.5
export const TIMELINE_FORK_SIZE = 12
export const TIMELINE_FORK_LINE_WIDTH = 2
export const TIMELINE_PORTRAIT_SIZE = 48
export const TIMELINE_PORTRAIT_LINE_WIDTH = 2
export const TIMELINE_LABEL_FONT_SIZE = 11
export const TIMELINE_LABEL_OFFSET_Y = 6
export const TIMELINE_YEAR_LABEL_FONT_SIZE = 12

/** 人物圆心与干线之间的额外净距（不含圆半径、分叉点） */
const BRANCH_TRUNK_GAP = 18
/** 年份分界线超出最外圈人物/标签的延伸量 */
const YEAR_DIVIDER_EXTEND = 56

export interface TimelineGraphNode {
  id: string
  type?: string
  data: {
    nodeType: TimelineNodeType
    humanId?: number
    name?: string
    gender?: string
    thinRank?: number
    birthDate?: string | null
    deathDate?: string | null
    yearLabel?: string
  }
  style: Record<string, unknown>
}

export interface TimelineGraphEdge {
  id: string
  source: string
  target: string
  data: { edgeType: TimelineEdgeType }
  style?: Record<string, unknown>
}

export interface TimelineLayout {
  width: number
  height: number
  paddingX: number
  paddingY: number
  branchLength: number
}

export interface TimelineGraphData {
  nodes: TimelineGraphNode[]
  edges: TimelineGraphEdge[]
  layout: TimelineLayout
  range: { min: number; max: number }
}

function parseDeathTime(deathDate: string | null): number {
  if (!deathDate) return Number.NaN
  const value = partialDateToSortTime(deathDate)
  return value == null ? Number.NaN : value
}

function formatDateLabel(value: string | null | undefined): string {
  return formatPartialDate(value)
}

/** 用于悬停提示：1924.07.02、1930.04、1936 */
export function formatDateDot(value: string | null | undefined): string {
  return formatPartialDateDot(value)
}

export { genderBranchColors } from './colors'

/** 年份分界线：取相邻不同逝世年份分叉的中点，与干线人物位置一致 */
function collectYearBoundaryPositions(
  valid: { time: number }[],
  forkXs: number[]
): { year: number; x: number }[] {
  const boundaries: { year: number; x: number }[] = []
  for (let i = 1; i < valid.length; i++) {
    const prevYear = new Date(valid[i - 1].time).getFullYear()
    const currYear = new Date(valid[i].time).getFullYear()
    if (currYear !== prevYear) {
      boundaries.push({ year: currYear, x: (forkXs[i - 1] + forkXs[i]) / 2 })
    }
  }
  return boundaries
}

/** 按时间比例得到理想 x，再保证相邻分叉最小间距且不越界 */
function layoutForkPositions(
  idealXs: number[],
  minX: number,
  maxX: number,
  minGap: number
): number[] {
  if (idealXs.length === 0) return []
  const xs = [...idealXs]

  for (let i = 1; i < xs.length; i++) {
    if (xs[i] < xs[i - 1] + minGap) {
      xs[i] = xs[i - 1] + minGap
    }
  }

  const overflow = xs[xs.length - 1] - maxX
  if (overflow > 0) {
    for (let i = 0; i < xs.length; i++) {
      xs[i] -= overflow
    }
  }

  const underflow = minX - xs[0]
  if (underflow > 0) {
    for (let i = 0; i < xs.length; i++) {
      xs[i] += underflow
    }
  }

  for (let i = xs.length - 2; i >= 0; i--) {
    if (xs[i] > xs[i + 1] - minGap) {
      xs[i] = xs[i + 1] - minGap
    }
  }

  const underflow2 = minX - xs[0]
  if (underflow2 > 0) {
    for (let i = 0; i < xs.length; i++) {
      xs[i] += underflow2
    }
  }

  return xs
}

const trunkEdgeStyle = {
  stroke: '#8b5a2b',
  lineWidth: TIMELINE_TRUNK_LINE_WIDTH,
  lineCap: 'round' as const,
  opacity: 0.94
}

const hiddenAnchorStyle = {
  size: 1,
  fill: 'transparent',
  stroke: 'transparent',
  lineWidth: 0,
  opacity: 0,
  label: false,
  pointerEvents: 'none' as const
}

export function buildTimelineGraph(
  humans: GraveHumanSummary[],
  canvasWidth: number,
  canvasHeight: number,
  thinRankCap = 1
): TimelineGraphData {
  const paddingX = 96
  const paddingY = 72
  const personRadius = TIMELINE_PORTRAIT_SIZE / 2
  const forkRadius = TIMELINE_FORK_SIZE / 2
  const trunkHalf = TIMELINE_TRUNK_LINE_WIDTH / 2
  const labelRoom = TIMELINE_LABEL_FONT_SIZE + TIMELINE_LABEL_OFFSET_Y + 14
  const minBranchLength =
    personRadius + forkRadius + trunkHalf + BRANCH_TRUNK_GAP
  const maxBranchLength = Math.max(
    minBranchLength,
    (canvasHeight - paddingY * 2) / 2 - personRadius - labelRoom
  )
  const branchLength = Math.min(160, Math.max(minBranchLength, maxBranchLength))
  const usableWidth = Math.max(320, canvasWidth - paddingX * 2)
  const centerY = canvasHeight / 2
  const forkMinX = paddingX
  const forkMaxX = paddingX + usableWidth

  const valid = humans
    .filter((h) => h.death_date)
    .map((h) => ({ human: h, time: parseDeathTime(h.death_date) }))
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => a.time - b.time || a.human.id - b.human.id)

  if (valid.length === 0) {
    return {
      nodes: [],
      edges: [],
      layout: { width: canvasWidth, height: canvasHeight, paddingX, paddingY, branchLength },
      range: { min: 0, max: 1 }
    }
  }

  const min = valid[0].time
  const max = valid[valid.length - 1].time
  const span = Math.max(max - min, 1)

  const idealXs = valid.map((item) => {
    const ratio = (item.time - min) / span
    return forkMinX + ratio * usableWidth
  })

  const forkXs = layoutForkPositions(idealXs, forkMinX, forkMaxX, MIN_FORK_GAP)
  const xByHumanId = new Map<number, number>()
  valid.forEach((item, index) => {
    xByHumanId.set(item.human.id, forkXs[index])
  })

  const firstForkX = forkXs[0]
  const lastForkX = forkXs[forkXs.length - 1]
  const trunkLeftX = Math.max(paddingX * 0.5, firstForkX - TRUNK_EXTEND_PX)
  const trunkRightX = Math.min(paddingX + usableWidth + TRUNK_EXTEND_PX * 0.5, lastForkX + TRUNK_EXTEND_PX)

  const nodes: TimelineGraphNode[] = []
  const edges: TimelineGraphEdge[] = []

  nodes.push({
    id: 'trunk-anchor-left',
    data: { nodeType: 'trunk-anchor' },
    style: { ...hiddenAnchorStyle, x: trunkLeftX, y: centerY }
  })

  nodes.push({
    id: 'trunk-anchor-right',
    data: { nodeType: 'trunk-anchor' },
    style: { ...hiddenAnchorStyle, x: trunkRightX, y: centerY }
  })

  valid.forEach((item, index) => {
    const { human } = item
    const x = xByHumanId.get(human.id) ?? forkMinX
    const direction = index % 2 === 0 ? -1 : 1
    const forkId = `fork-${human.id}`
    const leafId = `person-${human.id}`
    const colors = genderBranchColors(human.gender)
    const showPerson = human.thin_rank <= thinRankCap
    const branchY = centerY + direction * branchLength

    nodes.push({
      id: forkId,
      data: {
        nodeType: 'fork',
        humanId: human.id,
        name: human.name,
        gender: human.gender,
        thinRank: human.thin_rank,
        birthDate: human.birth_date,
        deathDate: human.death_date
      },
      style: {
        x,
        y: centerY,
        size: TIMELINE_FORK_SIZE,
        fill: '#a67c52',
        stroke: '#5c3d1e',
        lineWidth: TIMELINE_FORK_LINE_WIDTH,
        opacity: showPerson ? 1 : 0.85,
        label: false,
        pointerEvents: 'none' as const
      }
    })

    const initial = (human.name.trim().slice(0, 1) || '?').replace(/[<>&"']/g, '')

    nodes.push({
      id: leafId,
      data: {
        nodeType: 'person',
        humanId: human.id,
        name: human.name,
        gender: human.gender,
        thinRank: human.thin_rank,
        birthDate: human.birth_date,
        deathDate: human.death_date
      },
      style: {
        x,
        y: branchY,
        size: TIMELINE_PORTRAIT_SIZE,
        fill: colors.fill,
        stroke: colors.stroke,
        lineWidth: TIMELINE_PORTRAIT_LINE_WIDTH,
        opacity: 1,
        visibility: showPerson ? 'visible' : 'hidden',
        zIndex: human.thin_rank,
        pointerEvents: showPerson ? 'auto' : 'none',
        cursor: showPerson ? 'pointer' : 'default',
        icon: showPerson,
        iconText: showPerson ? initial : '',
        iconFill: '#ffffff',
        iconFontSize: Math.round(TIMELINE_PORTRAIT_SIZE * 0.42),
        iconFontWeight: 600,
        label: showPerson,
        labelText: showPerson ? human.name : '',
        labelFill: '#f4f6fa',
        labelFontSize: TIMELINE_LABEL_FONT_SIZE,
        labelFontWeight: 600,
        labelPlacement: 'bottom',
        labelOffsetY: TIMELINE_LABEL_OFFSET_Y,
        labelMaxWidth: 96,
        labelWordWrap: true,
        labelBackground: true,
        labelBackgroundFill: 'rgba(15, 23, 42, 0.55)',
        labelBackgroundRadius: 4,
        labelPadding: [2, 4],
        labelPointerEvents: 'none'
      }
    })

    edges.push({
      id: `branch-${human.id}`,
      source: forkId,
      target: leafId,
      data: { edgeType: 'branch' },
      style: {
        stroke: colors.branch,
        lineWidth: TIMELINE_BRANCH_LINE_WIDTH,
        opacity: 0.9,
        visibility: showPerson ? 'visible' : 'hidden'
      }
    })

    if (index === 0) {
      edges.push({
        id: 'trunk-left',
        source: 'trunk-anchor-left',
        target: forkId,
        data: { edgeType: 'trunk' },
        style: trunkEdgeStyle
      })
    } else {
      const prev = valid[index - 1].human
      edges.push({
        id: `trunk-${prev.id}-${human.id}`,
        source: `fork-${prev.id}`,
        target: forkId,
        data: { edgeType: 'trunk' },
        style: trunkEdgeStyle
      })
    }

    if (index === valid.length - 1) {
      edges.push({
        id: 'trunk-right',
        source: forkId,
        target: 'trunk-anchor-right',
        data: { edgeType: 'trunk' },
        style: trunkEdgeStyle
      })
    }
  })

  const branchOuterY = branchLength + personRadius + labelRoom
  const dividerTopY = centerY - branchOuterY - YEAR_DIVIDER_EXTEND
  const dividerBottomY = centerY + branchOuterY + YEAR_DIVIDER_EXTEND
  const yearBoundaries = collectYearBoundaryPositions(valid, forkXs)

  for (const { year, x } of yearBoundaries) {
    const topId = `year-divider-top-${year}`
    const bottomId = `year-divider-bottom-${year}`

    nodes.push({
      id: topId,
      data: { nodeType: 'year-divider', yearLabel: `${year}` },
      style: { ...hiddenAnchorStyle, x, y: dividerTopY }
    })

    nodes.push({
      id: bottomId,
      data: { nodeType: 'year-divider' },
      style: { ...hiddenAnchorStyle, x, y: dividerBottomY }
    })

    nodes.push({
      id: `year-divider-label-${year}`,
      data: { nodeType: 'axis', yearLabel: `${year}` },
      style: {
        x,
        y: dividerTopY - 18,
        size: 0,
        labelText: `${year}`,
        labelFill: '#eef2f8',
        labelFontSize: TIMELINE_YEAR_LABEL_FONT_SIZE,
        labelFontWeight: 700,
        labelPlacement: 'center',
        labelBackground: true,
        labelBackgroundFill: 'rgba(36, 48, 72, 0.92)',
        labelBackgroundStroke: 'rgba(180, 198, 235, 0.45)',
        labelBackgroundLineWidth: 1,
        labelBackgroundRadius: 6,
        labelPadding: [3, 8],
        pointerEvents: 'none' as const
      }
    })

    edges.push({
      id: `year-divider-line-${year}`,
      source: topId,
      target: bottomId,
      data: { edgeType: 'year-divider' },
      style: {
        stroke: 'rgba(186, 204, 238, 0.88)',
        lineWidth: TIMELINE_YEAR_DIVIDER_LINE_WIDTH,
        lineDash: [10, 7],
        opacity: 1,
        shadowColor: 'rgba(140, 170, 220, 0.35)',
        shadowBlur: 6
      }
    })
  }

  const yearStart = new Date(min).getFullYear()
  const yearEnd = new Date(max).getFullYear()

  nodes.push({
    id: `axis-start-${yearStart}`,
    data: { nodeType: 'axis', yearLabel: `${yearStart}` },
    style: {
      x: trunkLeftX,
      y: dividerBottomY + 4,
      size: 0,
      labelText: `${yearStart}`,
      labelFill: '#8f98a8',
      labelFontSize: 10,
      labelPlacement: 'center',
      pointerEvents: 'none' as const
    }
  })

  nodes.push({
    id: `axis-end-${yearEnd}`,
    data: { nodeType: 'axis', yearLabel: `${yearEnd}` },
    style: {
      x: trunkRightX,
      y: dividerBottomY + 4,
      size: 0,
      labelText: `${yearEnd}`,
      labelFill: '#8f98a8',
      labelFontSize: 10,
      labelPlacement: 'center',
      pointerEvents: 'none' as const
    }
  })

  return {
    nodes,
    edges,
    layout: { width: canvasWidth, height: canvasHeight, paddingX, paddingY, branchLength },
    range: { min, max }
  }
}

export function formatDeathLabel(deathDate: string | null): string {
  return formatDateLabel(deathDate)
}

export function formatLifeSpan(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  return `${formatDateLabel(birthDate)} — ${formatDateLabel(deathDate)}`
}

export function formatLifeSpanCompact(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  return `${formatDateDot(birthDate)}-${formatDateDot(deathDate)}`
}

/** 悬停一行：叶嘉莹 1924.07.02-2024.11.24 */
export function formatTooltipLine(
  name: string,
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  return `${name} ${formatLifeSpanCompact(birthDate, deathDate)}`
}
