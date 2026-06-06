import { Graph, GraphEvent } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'
import { formatGenderLabel } from '../../../shared/gender-label'
import { navigate } from '../router'
import { buildTimelineGraph } from '../timeline/buildGraph'
import { applyTimelineScreenSpace } from '../timeline/screen-space'
import { hitTestPersonAtClient } from '../timeline/person-hit-test'
import { createTimelinePersonTooltip, personTooltipText } from '../timeline/person-tooltip'
import { applyThinRankCapToGraph } from '../timeline/thin-rank-visibility'
import {
  GRAVE_HUMAN_SEARCH_FIELDS,
  formatSearchDate,
  searchGraveHumans,
  type GraveHumanSearchField
} from '../timeline/search'
import {
  countVisibleByThinRank,
  getDeathYearSpan,
  maxVisibleThinRankFromZoom
} from '../timeline/thin-rank'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return ((...args: never[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export interface TimelineViewHandle {
  destroy: () => void
  resize: () => void
}

export function renderTimelineShell(): string {
  return `
    <div class="timeline-page">
      <header class="app-header">
        <div class="app-header__title">
          <h1>纪念时间轴</h1>
          <p class="subtitle" id="timeline-subtitle">沿生命干线回望逝者 · 滚轮放大显示更多人物</p>
        </div>
        <button id="logout-button" type="button" class="secondary">退出登录</button>
      </header>
      <div class="timeline-toolbar">
        <label class="timeline-search-field">
          <span class="timeline-search-field__label">搜索项</span>
          <select id="search-field" class="timeline-search-select">
            ${GRAVE_HUMAN_SEARCH_FIELDS.map(
              (f) => `<option value="${f.value}">${escapeHtml(f.label)}</option>`
            ).join('')}
          </select>
        </label>
        <label class="timeline-search-query">
          <span class="timeline-search-field__label">关键词</span>
          <input id="search-query" type="search" placeholder="输入后回车或点击搜索" autocomplete="off" />
        </label>
        <button id="search-button" type="button">搜索</button>
        <button id="search-clear-button" type="button" class="secondary" hidden>清除</button>
      </div>
      <div id="timeline-status" class="timeline-status" hidden></div>
      <div id="search-results" class="timeline-search-results" hidden>
        <p id="search-results-summary" class="timeline-search-results__summary"></p>
        <div class="timeline-search-results__scroll">
          <table class="timeline-search-table">
            <thead>
              <tr>
                <th scope="col">序号</th>
                <th scope="col">姓名</th>
                <th scope="col">性别</th>
                <th scope="col">出生日期</th>
                <th scope="col">去世日期</th>
              </tr>
            </thead>
            <tbody id="search-results-body"></tbody>
          </table>
        </div>
      </div>
      <div id="timeline-chart" class="timeline-chart"></div>
    </div>
  `
}

export async function mountTimelineView(
  root: HTMLElement,
  onLogout: () => void
): Promise<TimelineViewHandle> {
  root.innerHTML = renderTimelineShell()

  const chartEl = root.querySelector<HTMLDivElement>('#timeline-chart')
  const statusEl = root.querySelector<HTMLDivElement>('#timeline-status')
  const logoutBtn = root.querySelector<HTMLButtonElement>('#logout-button')
  const searchFieldEl = root.querySelector<HTMLSelectElement>('#search-field')
  const searchQueryEl = root.querySelector<HTMLInputElement>('#search-query')
  const searchBtn = root.querySelector<HTMLButtonElement>('#search-button')
  const searchClearBtn = root.querySelector<HTMLButtonElement>('#search-clear-button')
  const searchResultsEl = root.querySelector<HTMLDivElement>('#search-results')
  const searchSummaryEl = root.querySelector<HTMLParagraphElement>('#search-results-summary')
  const searchBodyEl = root.querySelector<HTMLTableSectionElement>('#search-results-body')
  if (
    !chartEl ||
    !statusEl ||
    !logoutBtn ||
    !searchFieldEl ||
    !searchQueryEl ||
    !searchBtn ||
    !searchClearBtn ||
    !searchResultsEl ||
    !searchSummaryEl ||
    !searchBodyEl
  ) {
    return { destroy: () => undefined, resize: () => undefined }
  }

  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true
    await window.api.auth.logout()
    onLogout()
  })

  let graph: Graph | null = null
  let allHumans: GraveHumanSummary[] = []
  let thinRankCap = 1
  let baselineZoom = 1
  let viewportHandler: (() => void) | null = null
  let isSyncingCap = false
  let personTooltip = createTimelinePersonTooltip()
  let chartPointerMove: ((e: MouseEvent) => void) | null = null
  let chartPointerLeave: (() => void) | null = null
  let chartClick: ((e: MouseEvent) => void) | null = null

  const captureBaselineZoom = (): void => {
    if (graph) baselineZoom = Math.max(graph.getZoom(), 0.05)
  }

  const capFromCurrentZoom = (): number =>
    maxVisibleThinRankFromZoom(graph?.getZoom() ?? baselineZoom, baselineZoom)

  const renderSearchResults = (matches: GraveHumanSummary[]): void => {
    if (matches.length === 0) {
      searchResultsEl.hidden = false
      searchSummaryEl.textContent = '未找到匹配记录'
      searchBodyEl.innerHTML = ''
      searchClearBtn.hidden = false
      return
    }

    searchSummaryEl.textContent = `共 ${matches.length} 条结果`
    searchBodyEl.innerHTML = matches
      .map(
        (human, index) => `
        <tr data-human-id="${human.id}" tabindex="0" role="button">
          <td>${index + 1}</td>
          <td>${escapeHtml(human.name)}</td>
          <td>${escapeHtml(formatGenderLabel(human.gender))}</td>
          <td>${escapeHtml(formatSearchDate(human.birth_date))}</td>
          <td>${escapeHtml(formatSearchDate(human.death_date))}</td>
        </tr>
      `
      )
      .join('')
    searchResultsEl.hidden = false
    searchClearBtn.hidden = false
  }

  const runSearch = (): void => {
    const field = searchFieldEl.value as GraveHumanSearchField
    const query = searchQueryEl.value
    const matches = searchGraveHumans(allHumans, field, query)
    renderSearchResults(matches)
  }

  const clearSearch = (): void => {
    searchQueryEl.value = ''
    searchResultsEl.hidden = true
    searchBodyEl.innerHTML = ''
    searchSummaryEl.textContent = ''
    searchClearBtn.hidden = true
  }

  searchBtn.addEventListener('click', runSearch)
  searchQueryEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch()
  })
  searchClearBtn.addEventListener('click', clearSearch)
  searchBodyEl.addEventListener('click', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-human-id]')
    if (!row) return
    const id = Number(row.dataset.humanId)
    if (!Number.isNaN(id)) navigate({ name: 'person', id })
  })
  searchBodyEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-human-id]')
    if (!row) return
    event.preventDefault()
    const id = Number(row.dataset.humanId)
    if (!Number.isNaN(id)) navigate({ name: 'person', id })
  })

  const showStatus = (message: string, isError = false): void => {
    statusEl.textContent = message
    statusEl.hidden = false
    statusEl.classList.toggle('timeline-status--error', isError)
  }

  const destroyGraph = (): void => {
    personTooltip.hide()
    if (chartPointerMove) {
      chartEl.removeEventListener('mousemove', chartPointerMove)
      chartPointerMove = null
    }
    if (chartPointerLeave) {
      chartEl.removeEventListener('mouseleave', chartPointerLeave)
      chartPointerLeave = null
    }
    if (chartClick) {
      chartEl.removeEventListener('click', chartClick)
      chartClick = null
    }
    if (graph && viewportHandler) {
      graph.off(GraphEvent.AFTER_TRANSFORM, viewportHandler)
      viewportHandler = null
    }
    if (graph) {
      graph.destroy()
      graph = null
    }
  }

  const updateSubtitle = (humans: GraveHumanSummary[], cap: number): void => {
    const subtitle = root.querySelector<HTMLParagraphElement>('#timeline-subtitle')
    if (!subtitle) return
    const yearSpan = getDeathYearSpan(humans)
    const visible = countVisibleByThinRank(humans, cap)
    const total = humans.filter((h) => h.death_date).length
    if (visible < total) {
      subtitle.textContent = `时间跨度 ${yearSpan} 年 · 当前显示（${visible}/${total}）· 放大显示更多 · 点击头像查看详情`
    } else {
      subtitle.textContent = `沿生命干线回望逝者 · 点击头像查看详情`
    }
  }

  const disableAutoFit = (): void => {
    if (!graph) return
    graph.setOptions({ autoFit: undefined })
  }

  const rebuildTimelineGraph = async (cap: number): Promise<void> => {
    if (!graph || allHumans.length === 0) return
    thinRankCap = cap
    const width = chartEl.clientWidth || 1100
    const height = chartEl.clientHeight || 560
    const graphData = buildTimelineGraph(allHumans, width, height, thinRankCap)
    graph.setData({ nodes: graphData.nodes, edges: graphData.edges })
    await graph.draw()
    applyTimelineScreenSpace(graph)
    updateSubtitle(allHumans, thinRankCap)
  }

  /** 仅切换 thin_rank 可见性，不重建图，避免视口被 translateTo 甩飞 */
  const applyThinRankCap = async (cap: number): Promise<void> => {
    if (!graph || allHumans.length === 0 || cap === thinRankCap) return
    isSyncingCap = true
    try {
      thinRankCap = cap
      await applyThinRankCapToGraph(graph, allHumans, cap)
      applyTimelineScreenSpace(graph)
      updateSubtitle(allHumans, thinRankCap)
    } finally {
      isSyncingCap = false
    }
  }

  const syncViewportVisuals = (): void => {
    if (!graph) return
    applyTimelineScreenSpace(graph)
  }

  const syncCapFromZoom = (): void => {
    if (!graph || isSyncingCap) return
    const cap = capFromCurrentZoom()
    if (cap !== thinRankCap) {
      void applyThinRankCap(cap)
    }
  }

  const renderGraph = (humans: GraveHumanSummary[]): void => {
    destroyGraph()
    allHumans = humans

    const width = chartEl.clientWidth || 1100
    const height = chartEl.clientHeight || 560
    thinRankCap = 1
    const graphData = buildTimelineGraph(allHumans, width, height, thinRankCap)

    if (graphData.nodes.length === 0) {
      showStatus('暂无逝世日期数据，请先在数据库中导入人物记录。', true)
      return
    }

    statusEl.hidden = true
    updateSubtitle(allHumans, thinRankCap)

    graph = new Graph({
      container: chartEl,
      width,
      height,
      autoFit: 'view',
      padding: [24, 32, 48, 32],
      data: {
        nodes: graphData.nodes,
        edges: graphData.edges
      },
      layout: { type: 'preset' },
      node: {
        style: {
          port: false,
          shadowBlur: 8,
          shadowColor: 'rgba(0,0,0,0.25)'
        },
        state: {
          active: {
            stroke: '#fff',
            lineWidth: 3,
            shadowBlur: 14
          }
        }
      },
      edge: {
        type: 'line',
        style: {
          endArrow: false,
          opacity: 0.9
        }
      },
      behaviors: ['drag-canvas', 'zoom-canvas']
    })

    const updateTooltipFromPointer = (clientX: number, clientY: number): void => {
      if (!graph) return
      const hit = hitTestPersonAtClient(graph, allHumans, thinRankCap, clientX, clientY)
      if (!hit) {
        personTooltip.hide()
        return
      }
      const style = graph.getElementRenderStyle(hit.id)
      const [anchorX, anchorY] = graph.getClientByCanvas([style.x, style.y])
      personTooltip.showAtClient(personTooltipText(hit.human), anchorX, anchorY)
    }

    chartPointerMove = (e: MouseEvent) => updateTooltipFromPointer(e.clientX, e.clientY)
    chartPointerLeave = () => personTooltip.hide()
    chartClick = (e: MouseEvent) => {
      if (!graph) return
      const hit = hitTestPersonAtClient(graph, allHumans, thinRankCap, e.clientX, e.clientY)
      if (hit) navigate({ name: 'person', id: hit.human.id })
    }

    chartEl.addEventListener('mousemove', chartPointerMove)
    chartEl.addEventListener('mouseleave', chartPointerLeave)
    chartEl.addEventListener('click', chartClick)

    graph.on(GraphEvent.BEFORE_TRANSFORM, () => personTooltip.hide())

    const debouncedCapSync = debounce(syncCapFromZoom, 80)
    const onAfterTransform = (): void => {
      syncViewportVisuals()
      debouncedCapSync()
    }
    viewportHandler = onAfterTransform
    graph.on(GraphEvent.AFTER_TRANSFORM, viewportHandler)

    void graph.render().then(async () => {
      if (!graph) return
      disableAutoFit()
      captureBaselineZoom()
      applyTimelineScreenSpace(graph)
      const cap = capFromCurrentZoom()
      if (cap !== thinRankCap) {
        await applyThinRankCap(cap)
      }
    })
  }

  try {
    const result = await window.api.graveHuman.list()
    if (!result.ok) {
      showStatus(result.error, true)
      return { destroy: destroyGraph, resize: () => undefined }
    }
    renderGraph(result.data)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : '加载数据失败', true)
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!chartEl.clientWidth || !chartEl.clientHeight || !graph) return
    void (async () => {
      graph!.resize(chartEl.clientWidth, chartEl.clientHeight)
      await graph!.fitView()
      disableAutoFit()
      captureBaselineZoom()
      await rebuildTimelineGraph(capFromCurrentZoom())
    })()
  })
  resizeObserver.observe(chartEl)

  return {
    destroy: () => {
      resizeObserver.disconnect()
      destroyGraph()
      personTooltip.destroy()
    },
    resize: () => {
      if (graph) {
        graph.resize(chartEl.clientWidth, chartEl.clientHeight)
        void rebuildTimelineGraph(thinRankCap)
      }
    }
  }
}
