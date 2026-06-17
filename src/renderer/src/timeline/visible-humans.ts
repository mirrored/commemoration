import type { GraveHumanSummary } from '../../../shared/grave-human'
import {
  isTimelinePersonVisible,
  type TimelineVisibilityPolicy,
  visibleTimelineHumans
} from './timeline-visibility'

/** 当前策略下时间轴上可交互的人物 */
export function visibleHumansAtCap(
  humans: GraveHumanSummary[],
  cap: number
): GraveHumanSummary[] {
  return visibleTimelineHumans(humans, {
    cap,
    segmentSampleIds: null,
    useSegmentInitial: false
  })
}

export function visibleHumansWithPolicy(
  humans: GraveHumanSummary[],
  policy: TimelineVisibilityPolicy
): GraveHumanSummary[] {
  return visibleTimelineHumans(humans, policy)
}

export { isTimelinePersonVisible }
