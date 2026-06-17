import { Graph, GraphEvent } from '@antv/g6'
import type { GraveHumanSummary } from '../../../shared/grave-human'
import { formatAgeAtDeath } from '../../../shared/age-at-death'
import { formatGenderLabel } from '../../../shared/gender-label'
import { navigate } from '../router'
import { buildTimelineGraph } from '../timeline/buildGraph'
import { fitTimelineViewport } from '../timeline/screen-space'
import { hitTestPersonAtClient } from '../timeline/person-hit-test'
import { createTimelinePersonTooltip, personTooltipText } from '../timeline/person-tooltip'
import { applyTimelineVisibilityToGraph, enforceTimelineVisibility } from '../timeline/thin-rank-visibility'
import {
  GRAVE_HUMAN_SEARCH_FIELDS,
  formatSearchDate,
  searchGraveHumans,
  type GraveHumanSearchField
} from '../timeline/search'
import {
  formatDeathYearSpanLabel,
  getDeathYearRange,
  maxVisibleThinRankFromZoom
} from '../timeline/thin-rank'
import {
  createInitialVisibilityPolicy,
  countTimelineVisibleHumans,
  isTimelinePersonVisible,
  type TimelineVisibilityPolicy
} from '../timeline/timeline-visibility'
import {
  boundsForVisibility,
  filterHumansByYearBounds,
  formatYearBoundsLabel,
  parseYearInput,
  resolveYearBounds,
  type YearBounds
} from '../timeline/year-range-filter'
import {
  SEARCH_SORT_COLUMNS,
  sortSearchResults,
  type SearchResultSortKey,
  type SortDirection
} from '../timeline/search-sort'
import { visibleHumansWithPolicy } from '../timeline/visible-humans'

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
      <div class="timeline-year-filter" aria-label="年代筛选">
        <div class="timeline-year-filter__head">
          <span class="timeline-search-field__label">年代筛选</span>
          <p id="year-filter-hint" class="timeline-year-filter__hint"></p>
        </div>
        <div class="timeline-year-filter__row">
          <label class="timeline-year-field">
            <span class="timeline-search-field__label">起始年</span>
            <input id="year-start" type="number" inputmode="numeric" min="1000" max="9999" step="1" placeholder="如 2015" />
          </label>
          <span class="timeline-year-filter__sep" aria-hidden="true">—</span>
          <label class="timeline-year-field">
            <span class="timeline-search-field__label">终止年</span>
            <input id="year-end" type="number" inputmode="numeric" min="1000" max="9999" step="1" placeholder="如 2026" />
          </label>
          <button id="year-filter-apply" type="button">应用</button>
          <button id="year-filter-reset" type="button" class="secondary">重置</button>
        </div>
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
                ${SEARCH_SORT_COLUMNS.map(
                  ({ key, label }) => `
                <th scope="col" aria-sort="none">
                  <button type="button" class="timeline-search-sort" data-sort="${key}">
                    ${escapeHtml(label)}
                    <span class="timeline-search-sort__icon" aria-hidden="true"></span>
                  </button>
                </th>`
                ).join('')}
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
  const searchHeadEl = root.querySelector<HTMLTableSectionElement>(
    '.timeline-search-table thead'
  )
  const yearStartEl = root.querySelector<HTMLInputElement>('#year-start')
  const yearEndEl = root.querySelector<HTMLInputElement>('#year-end')
  const yearApplyBtn = root.querySelector<HTMLButtonElement>('#year-filter-apply')
  const yearResetBtn = root.querySelector<HTMLButtonElement>('#year-filter-reset')
  const yearHintEl = root.querySelector<HTMLParagraphElement>('#year-filter-hint')
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
    !searchBodyEl ||
    !searchHeadEl ||
    !yearStartEl ||
    !yearEndEl ||
    !yearApplyBtn ||
    !yearResetBtn ||
    !yearHintEl
  ) {
    return { destroy: () => undefined, resize: () => undefined }
  }

  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true
    await window.api.auth.logout()
    onLogout()
  })

  let graph: Graph | null = null
  let rawHumans: GraveHumanSummary[] = []
  let filteredHumans: GraveHumanSummary[] = []
  let filterBounds: YearBounds | null = null
  let visibilityBase: TimelineVisibilityPolicy = {
    cap: 1,
    segmentSampleIds: null,
    useSegmentInitial: false
  }
  let thinRankCap = 1
  let baselineZoom = 1
  let viewportHandler: (() => void) | null = null
  let isSyncingCap = false
  let suppressZoomCapSync = false
  let personTooltip = createTimelinePersonTooltip()
  let chartPointerMove: ((e: MouseEvent) => void) | null = null
  let chartPointerLeave: (() => void) | null = null
  let chartClick: ((e: MouseEvent) => void) | null = null
  let interactiveHumans: GraveHumanSummary[] = []
  let tooltipRaf = 0
  let pendingTooltip: { x: number; y: number } | null = null
  let searchMatches: GraveHumanSummary[] = []
  let searchSortKey: SearchResultSortKey | null = null
  let searchSortDir: SortDirection = 'asc'

  const captureBaselineZoom = (): void => {
    if (graph) baselineZoom = Math.max(graph.getZoom(), 0.05)
  }

  const currentVisibilityPolicy = (): TimelineVisibilityPolicy => ({
    cap: thinRankCap,
    segmentSampleIds: visibilityBase.segmentSampleIds,
    useSegmentInitial: visibilityBase.useSegmentInitial,
    sampleSeed: visibilityBase.sampleSeed,
    segmentOverview:
      visibilityBase.useSegmentInitial &&
      (!graph || capFromCurrentZoom() <= 1)
  })

  const previousVisibilityPolicy = (previousCap: number): TimelineVisibilityPolicy => ({
    cap: previousCap,
    segmentSampleIds: visibilityBase.segmentSampleIds,
    useSegmentInitial: visibilityBase.useSegmentInitial,
    sampleSeed: visibilityBase.sampleSeed,
    segmentOverview: currentVisibilityPolicy().segmentOverview
  })

  const isPersonVisible = (human: GraveHumanSummary): boolean =>
    isTimelinePersonVisible(human, currentVisibilityPolicy())

  const refreshDisplayHumans = (): void => {
    filteredHumans = filterHumansByYearBounds(rawHumans, filterBounds)
    const activeBounds = boundsForVisibility(filteredHumans, filterBounds)
    visibilityBase = createInitialVisibilityPolicy(filteredHumans, activeBounds)
    thinRankCap = visibilityBase.cap
  }

  const updateYearFilterHint = (): void => {
    const dataRange = getDeathYearRange(rawHumans)
    const dataLabel = dataRange ? formatYearBoundsLabel(dataRange) : '—'
    if (filterBounds) {
      yearHintEl.textContent = `当前 ${formatYearBoundsLabel(filterBounds)} · 全部数据 ${dataLabel}`
    } else {
      yearHintEl.textContent = `显示全部逝世年份 · 数据范围 ${dataLabel}`
    }
  }

  const capFromCurrentZoom = (): number =>
    maxVisibleThinRankFromZoom(graph?.getZoom() ?? baselineZoom, baselineZoom)

  const updateSearchSortHeaders = (): void => {
    for (const th of searchHeadEl.querySelectorAll<HTMLTableCellElement>('th[aria-sort]')) {
      const btn = th.querySelector<HTMLButtonElement>('.timeline-search-sort')
      const key = btn?.dataset.sort as SearchResultSortKey | undefined
      const active = key != null && key === searchSortKey
      th.setAttribute('aria-sort', active ? (searchSortDir === 'asc' ? 'ascending' : 'descending') : 'none')
      btn?.classList.toggle('timeline-search-sort--active', active)
      btn?.classList.toggle('timeline-search-sort--asc', active && searchSortDir === 'asc')
      btn?.classList.toggle('timeline-search-sort--desc', active && searchSortDir === 'desc')
    }
  }

  const renderSearchResults = (): void => {
    if (searchMatches.length === 0) {
      searchResultsEl.hidden = false
      searchSummaryEl.textContent = '未找到匹配记录'
      searchBodyEl.innerHTML = ''
      searchClearBtn.hidden = false
      updateSearchSortHeaders()
      return
    }

    const rows =
      searchSortKey == null
        ? searchMatches
        : sortSearchResults(searchMatches, searchSortKey, searchSortDir)

    searchSummaryEl.textContent = `共 ${rows.length} 条结果`
    searchBodyEl.innerHTML = rows
      .map(
        (human, index) => `
        <tr data-human-id="${human.id}" tabindex="0" role="button">
          <td>${index + 1}</td>
          <td>${escapeHtml(human.name)}</td>
          <td>${escapeHtml(formatGenderLabel(human.gender))}</td>
          <td>${escapeHtml(formatSearchDate(human.birth_date))}</td>
          <td>${escapeHtml(formatSearchDate(human.death_date))}</td>
          <td>${escapeHtml(formatAgeAtDeath(human.birth_date, human.death_date))}</td>
        </tr>
      `
      )
      .join('')
    searchResultsEl.hidden = false
    searchClearBtn.hidden = false
    updateSearchSortHeaders()
  }

  const runSearch = (): void => {
    const field = searchFieldEl.value as GraveHumanSearchField
    const query = searchQueryEl.value
    searchMatches = searchGraveHumans(filteredHumans, field, query)
    renderSearchResults()
  }

  const toggleSearchSort = (key: SearchResultSortKey): void => {
    if (searchMatches.length === 0) return
    if (searchSortKey === key) {
      searchSortDir = searchSortDir === 'asc' ? 'desc' : 'asc'
    } else {
      searchSortKey = key
      searchSortDir = 'asc'
    }
    renderSearchResults()
  }

  const clearSearch = (): void => {
    searchQueryEl.value = ''
    searchMatches = []
    searchSortKey = null
    searchSortDir = 'asc'
    searchResultsEl.hidden = true
    searchBodyEl.innerHTML = ''
    searchSummaryEl.textContent = ''
    searchClearBtn.hidden = true
    updateSearchSortHeaders()
  }

  searchBtn.addEventListener('click', runSearch)
  searchQueryEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch()
  })
  searchClearBtn.addEventListener('click', clearSearch)
  searchHeadEl.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-sort]')
    if (!btn?.dataset.sort) return
    event.preventDefault()
    toggleSearchSort(btn.dataset.sort as SearchResultSortKey)
  })
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

  const updateSubtitle = (humans: GraveHumanSummary[]): void => {
    const subtitle = root.querySelector<HTMLParagraphElement>('#timeline-subtitle')
    if (!subtitle) return
    const spanLabel = formatDeathYearSpanLabel(humans)
    const policy = currentVisibilityPolicy()
    const visible = countTimelineVisibleHumans(humans, policy)
    const total = humans.length
    if (total === 0) {
      subtitle.textContent = '所选年代内暂无人物 · 请调整筛选条件'
      return
    }
    if (visible < total) {
      subtitle.textContent = `时间跨度 ${spanLabel} · 当前显示（${visible}/${total}）· 放大显示更多 · 点击头像查看详情`
    } else {
      subtitle.textContent = `时间跨度 ${spanLabel} · 点击头像查看详情`
    }
  }

  const disableAutoFit = (): void => {
    if (!graph) return
    graph.setOptions({ autoFit: undefined })
  }

  const rebuildTimelineGraph = async (): Promise<void> => {
    if (!graph || filteredHumans.length === 0) return
    resetCapAtSegmentOverview()
    const viewportWidth = chartEl.clientWidth || 1100
    const height = chartEl.clientHeight || 560
    const graphData = buildTimelineGraph(filteredHumans, viewportWidth, height, isPersonVisible)
    graph.resize(viewportWidth, height)
    graph.setData({ nodes: graphData.nodes, edges: graphData.edges })
    await graph.draw()
    suppressZoomCapSync = true
    try {
      await fitTimelineViewport(graph)
      captureBaselineZoom()
      resetCapAtSegmentOverview()
      thinRankCap = visibilityBase.cap
    } finally {
      suppressZoomCapSync = false
    }
    await enforceTimelineVisibility(graph, filteredHumans, currentVisibilityPolicy())
    refreshInteractiveHumans()
    updateSubtitle(filteredHumans)
  }

  const refreshInteractiveHumans = (): void => {
    interactiveHumans = visibleHumansWithPolicy(filteredHumans, currentVisibilityPolicy())
  }

  const applyVisibilityPolicy = async (newCap: number): Promise<void> => {
    if (!graph || filteredHumans.length === 0 || newCap === thinRankCap) return
    isSyncingCap = true
    const previousCap = thinRankCap
    try {
      thinRankCap = newCap
      await applyTimelineVisibilityToGraph(
        graph,
        filteredHumans,
        currentVisibilityPolicy(),
        previousVisibilityPolicy(previousCap)
      )
      refreshInteractiveHumans()
      updateSubtitle(filteredHumans)
    } finally {
      isSyncingCap = false
    }
  }

  const resetCapAtSegmentOverview = (): void => {
    if (!visibilityBase.useSegmentInitial) return
    if (capFromCurrentZoom() <= 1) {
      thinRankCap = visibilityBase.cap
    }
  }

  const syncCapFromZoom = (): void => {
    if (!graph || isSyncingCap || suppressZoomCapSync) return
    const zoomCap = capFromCurrentZoom()
    if (visibilityBase.useSegmentInitial && zoomCap <= 1) {
      if (thinRankCap !== visibilityBase.cap) {
        thinRankCap = visibilityBase.cap
        void enforceTimelineVisibility(graph, filteredHumans, currentVisibilityPolicy()).then(
          () => {
            refreshInteractiveHumans()
            updateSubtitle(filteredHumans)
          }
        )
      }
      return
    }
    const newCap = Math.max(zoomCap, visibilityBase.cap)
    if (newCap !== thinRankCap) {
      void applyVisibilityPolicy(newCap)
    }
  }

  const renderGraph = (): void => {
    destroyGraph()
    refreshDisplayHumans()
    thinRankCap = visibilityBase.cap
    refreshInteractiveHumans()

    const viewportWidth = chartEl.clientWidth || 1100
    const height = chartEl.clientHeight || 560
    const graphData = buildTimelineGraph(filteredHumans, viewportWidth, height, isPersonVisible)

    if (graphData.nodes.length === 0) {
      showStatus(
        filterBounds
          ? '所选年代内暂无人物，请调整起始/终止年。'
          : '暂无逝世日期数据，请先在数据库中导入人物记录。',
        true
      )
      return
    }

    statusEl.hidden = true
    updateSubtitle(filteredHumans)

    graph = new Graph({
      container: chartEl,
      width: viewportWidth,
      height,
      autoFit: { type: 'view', options: { direction: 'both' } },
      padding: [24, 32, 48, 32],
      animation: false,
      data: {
        nodes: graphData.nodes,
        edges: graphData.edges
      },
      layout: { type: 'preset' },
      node: {
        style: {
          port: false,
          shadowBlur: 0
        },
        state: {
          active: {
            stroke: '#fff',
            lineWidth: 3,
            shadowBlur: 4
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
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        {
          type: 'fix-element-size',
          key: 'timeline-fix-size',
          enable: true,
          nodeFilter: (datum) => {
            const nodeType = (datum.data as { nodeType?: string } | undefined)?.nodeType
            return nodeType === 'person' || nodeType === 'fork' || nodeType === 'axis'
          },
          edgeFilter: (datum) => {
            const edgeType = (datum.data as { edgeType?: string } | undefined)?.edgeType
            return edgeType === 'trunk' || edgeType === 'branch' || edgeType === 'year-divider'
          }
        }
      ]
    })

    const flushTooltip = (): void => {
      tooltipRaf = 0
      if (!graph || !pendingTooltip) return
      const { x, y } = pendingTooltip
      pendingTooltip = null
      const hit = hitTestPersonAtClient(graph, interactiveHumans, x, y)
      if (!hit) {
        personTooltip.hide()
        return
      }
      const style = graph.getElementRenderStyle(hit.id)
      const [anchorX, anchorY] = graph.getClientByCanvas([style.x, style.y])
      personTooltip.showAtClient(personTooltipText(hit.human), anchorX, anchorY)
    }

    const scheduleTooltip = (clientX: number, clientY: number): void => {
      pendingTooltip = { x: clientX, y: clientY }
      if (tooltipRaf) return
      tooltipRaf = requestAnimationFrame(flushTooltip)
    }

    chartPointerMove = (e: MouseEvent) => scheduleTooltip(e.clientX, e.clientY)
    chartPointerLeave = () => personTooltip.hide()
    chartClick = (e: MouseEvent) => {
      if (!graph) return
      const hit = hitTestPersonAtClient(graph, interactiveHumans, e.clientX, e.clientY)
      if (hit) navigate({ name: 'person', id: hit.human.id })
    }

    chartEl.addEventListener('mousemove', chartPointerMove)
    chartEl.addEventListener('mouseleave', chartPointerLeave)
    chartEl.addEventListener('click', chartClick)

    graph.on(GraphEvent.BEFORE_TRANSFORM, () => personTooltip.hide())

    const debouncedCapSync = debounce(syncCapFromZoom, 80)
    const onAfterTransform = (): void => {
      if (!suppressZoomCapSync) debouncedCapSync()
    }
    viewportHandler = onAfterTransform
    graph.on(GraphEvent.AFTER_TRANSFORM, viewportHandler)

    suppressZoomCapSync = true
    void graph.render().then(async () => {
      if (!graph) return
      disableAutoFit()
      captureBaselineZoom()
      resetCapAtSegmentOverview()
      thinRankCap = visibilityBase.cap
      await enforceTimelineVisibility(graph, filteredHumans, currentVisibilityPolicy())
      refreshInteractiveHumans()
      updateSubtitle(filteredHumans)
      if (!visibilityBase.useSegmentInitial) {
        const zoomCap = capFromCurrentZoom()
        const newCap = Math.max(zoomCap, visibilityBase.cap)
        if (newCap !== thinRankCap) {
          await applyVisibilityPolicy(newCap)
        }
      }
      suppressZoomCapSync = false
    }).catch((error) => {
      suppressZoomCapSync = false
      showStatus(error instanceof Error ? error.message : '时间轴渲染失败', true)
    })
  }

  const applyYearFilterFromInputs = (): void => {
    const startRaw = yearStartEl.value.trim()
    const endRaw = yearEndEl.value.trim()
    const startYear = parseYearInput(startRaw)
    const endYear = parseYearInput(endRaw)

    if (startRaw && startYear == null) {
      showStatus('起始年请输入四位数字，如 2015', true)
      return
    }
    if (endRaw && endYear == null) {
      showStatus('终止年请输入四位数字，如 2026', true)
      return
    }

    filterBounds = resolveYearBounds({ startYear, endYear })
    refreshDisplayHumans()
    updateYearFilterHint()
    clearSearch()
    statusEl.hidden = true
    renderGraph()
  }

  const resetYearFilter = (): void => {
    yearStartEl.value = ''
    yearEndEl.value = ''
    filterBounds = null
    refreshDisplayHumans()
    updateYearFilterHint()
    clearSearch()
    statusEl.hidden = true
    renderGraph()
  }

  yearApplyBtn.addEventListener('click', applyYearFilterFromInputs)
  yearResetBtn.addEventListener('click', resetYearFilter)
  yearStartEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyYearFilterFromInputs()
  })
  yearEndEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyYearFilterFromInputs()
  })

  try {
    const result = await window.api.graveHuman.list()
    if (!result.ok) {
      showStatus(result.error, true)
      return { destroy: destroyGraph, resize: () => undefined }
    }
    rawHumans = result.data
    refreshDisplayHumans()
    updateYearFilterHint()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    renderGraph()
  } catch (error) {
    showStatus(error instanceof Error ? error.message : '加载数据失败', true)
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!chartEl.clientWidth || !chartEl.clientHeight || !graph) return
    void (async () => {
      suppressZoomCapSync = true
      try {
        graph!.resize(chartEl.clientWidth, chartEl.clientHeight)
        await fitTimelineViewport(graph!)
        disableAutoFit()
        captureBaselineZoom()
        resetCapAtSegmentOverview()
        await rebuildTimelineGraph()
      } finally {
        suppressZoomCapSync = false
      }
    })()
  })
  resizeObserver.observe(chartEl)

  return {
    destroy: () => {
      if (tooltipRaf) cancelAnimationFrame(tooltipRaf)
      resizeObserver.disconnect()
      destroyGraph()
      personTooltip.destroy()
    },
    resize: () => {
      if (graph) {
        graph.resize(chartEl.clientWidth, chartEl.clientHeight)
        void rebuildTimelineGraph()
      }
    }
  }
}
