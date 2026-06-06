import type { GraveHumanSummary } from '../../../shared/grave-human'
import { formatTooltipLine } from './buildGraph'

export interface TimelinePersonTooltip {
  showAtClient: (text: string, clientX: number, clientY: number) => void
  hide: () => void
  destroy: () => void
}

export function createTimelinePersonTooltip(doc: Document = document): TimelinePersonTooltip {
  const el = doc.createElement('div')
  el.className = 'timeline-person-tooltip'
  el.hidden = true
  doc.body.appendChild(el)

  return {
    showAtClient(text, clientX, clientY) {
      el.textContent = text
      el.hidden = false
      el.style.left = `${clientX}px`
      el.style.top = `${clientY}px`
    },
    hide() {
      el.hidden = true
    },
    destroy() {
      el.remove()
    }
  }
}

export function personTooltipText(human: {
  name: string
  birth_date?: string | null
  death_date?: string | null
}): string {
  return formatTooltipLine(human.name, human.birth_date, human.death_date)
}
