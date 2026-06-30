export type NotableWorkItem = {
  /** 排序用起始年 */
  year: number | null
  /** 展示：1956、1952-1956、1956.12，或分类标签如「遗物」「相关书籍」 */
  timeLabel: string | null
  title: string
}

const LIST_PREFIX = /^\s*(?:[-*+]\s+|\d+\.\s+)/
const TIME_SEP = /^\s*(?:[·•.\-—]\s*|\s+)/
const CATEGORY_SEP = /\s*[·•.\-—]\s+/
/** 分类标签最长字符数，避免把含间隔符的长句误拆成「标签 · 正文」 */
const CATEGORY_LABEL_MAX_LEN = 24
const BOOK_TITLE = /《[^》]+》/g

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

function formatDotMonth(year: number, month: number, day?: number | null): string {
  const mm = String(month).padStart(2, '0')
  if (day != null) {
    return `${year}.${mm}.${String(day).padStart(2, '0')}`
  }
  return `${year}.${mm}`
}

/** 从行首解析时间前缀（已去掉列表符号） */
function parseTimePrefix(
  text: string
): { timeLabel: string; year: number; consumed: number } | null {
  // 1956.12 / 1956.12.03
  let m = /^(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/.exec(text)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = m[3] != null ? Number(m[3]) : null
    if (month >= 1 && month <= 12 && (day == null || (day >= 1 && day <= 31))) {
      return {
        timeLabel: formatDotMonth(year, month, day),
        year,
        consumed: m[0].length
      }
    }
  }

  // 1978年12月 / 1982年9月1日
  m = /^(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/.exec(text)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = m[3] != null ? Number(m[3]) : null
    if (month >= 1 && month <= 12 && (day == null || (day >= 1 && day <= 31))) {
      return {
        timeLabel: formatDotMonth(year, month, day),
        year,
        consumed: m[0].length
      }
    }
  }

  // 1954-1959年 / 1960-1970年代 / 1941-1990
  m = /^(\d{4})-(\d{4})(?:年代)?年?/.exec(text)
  if (m) {
    const start = Number(m[1])
    const end = Number(m[2])
    if (start <= end) {
      return { timeLabel: `${start}-${end}`, year: start, consumed: m[0].length }
    }
  }

  // 1950年代
  m = /^(\d{4})年代/.exec(text)
  if (m) {
    const year = Number(m[1])
    return { timeLabel: `${year}年代`, year, consumed: m[0].length }
  }

  // 1956年
  m = /^(\d{4})年/.exec(text)
  if (m) {
    const year = Number(m[1])
    return { timeLabel: String(year), year, consumed: m[0].length }
  }

  // 1956 · / 1956 标题
  m = /^(\d{4})(?=\s*(?:[·•.\-—]|\s+))/.exec(text)
  if (m) {
    const year = Number(m[1])
    return { timeLabel: String(year), year, consumed: m[0].length }
  }

  return null
}

function parseLineWithTime(stripped: string): NotableWorkItem | null {
  const parsed = parseTimePrefix(stripped)
  if (!parsed) return null

  const rest = stripped.slice(parsed.consumed).replace(TIME_SEP, '')
  if (!rest.trim()) return null

  return {
    year: parsed.year,
    timeLabel: parsed.timeLabel,
    title: normalizeTitle(rest)
  }
}

/** 无年份的分类行，例如「遗物 · …」「相关书籍 · …」 */
function parseCategoryLabelLine(stripped: string): NotableWorkItem | null {
  const sep = CATEGORY_SEP.exec(stripped)
  if (!sep || sep.index === undefined) return null

  const label = normalizeTitle(stripped.slice(0, sep.index))
  const title = normalizeTitle(stripped.slice(sep.index + sep[0].length))
  if (!label || !title) return null
  if (label.length > CATEGORY_LABEL_MAX_LEN) return null
  if (label.includes('《') || label.includes('》')) return null
  if (/^\d/.test(label) || parseTimePrefix(label)) return null

  return { year: null, timeLabel: label, title }
}

function parseLineWithoutTime(stripped: string): NotableWorkItem[] {
  const labeled = parseCategoryLabelLine(stripped)
  if (labeled) return [labeled]

  const books = stripped.matchAll(BOOK_TITLE)
  const bookMatches = [...books]
  if (bookMatches.length > 0) {
    return bookMatches.map((m) => ({ year: null, timeLabel: null, title: m[0] }))
  }

  const title = normalizeTitle(stripped)
  return title ? [{ year: null, timeLabel: null, title }] : []
}

/** 解析 DB 中的代表作品：支持年份、年份范围、年月、分类标签及无年份书目 */
export function parseNotableWorks(raw: string | null | undefined): NotableWorkItem[] {
  const text = raw?.trim()
  if (!text) return []

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: NotableWorkItem[] = []

  for (const line of lines) {
    const stripped = line.replace(LIST_PREFIX, '')
    if (!stripped) continue

    const withTime = parseLineWithTime(stripped)
    if (withTime) {
      items.push(withTime)
      continue
    }

    items.push(...parseLineWithoutTime(stripped))
  }

  if (items.length === 0) {
    const books = [...text.matchAll(BOOK_TITLE)]
    if (books.length > 0) {
      return books.map((m) => ({ year: null, timeLabel: null, title: m[0] }))
    }
    return [{ year: null, timeLabel: null, title: text }]
  }

  return items.sort((a, b) => {
    if (a.year == null && b.year == null) return 0
    if (a.year == null) return 1
    if (b.year == null) return -1
    return a.year - b.year
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderNotableWorksHtml(raw: string | null | undefined): string {
  const items = parseNotableWorks(raw)
  if (items.length === 0) {
    return '<p class="notable-works-empty">—</p>'
  }

  const rows = items
    .map((item) => {
      const yearCell = item.timeLabel
        ? `<span class="notable-works-year${item.year == null ? ' notable-works-year--label' : ''}">${escapeHtml(item.timeLabel)}</span>`
        : '<span class="notable-works-year notable-works-year--unknown">—</span>'
      return `<li class="notable-works-item">${yearCell}<span class="notable-works-title">${escapeHtml(item.title)}</span></li>`
    })
    .join('')

  return `<ul class="notable-works-list">${rows}</ul>`
}
