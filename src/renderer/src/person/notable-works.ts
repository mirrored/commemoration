export type NotableWorkItem = {
  year: number | null
  title: string
}

const LIST_LINE =
  /^\s*(?:[-*+]\s+|\d+\.\s+)?(?:(\d{4})\s*(?:[·•.\-—]\s*|\s+))(.+)$/
const YEAR_PREFIX = /^\s*(\d{4})\s*(?:[·•.\-—]\s*)(.+)$/
const BOOK_TITLE = /《[^》]+》/g

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

/** 解析 DB 中的代表作品：支持「- YYYY · 作品」列表，也兼容无年份的《书名》串 */
export function parseNotableWorks(raw: string | null | undefined): NotableWorkItem[] {
  const text = raw?.trim()
  if (!text) return []

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: NotableWorkItem[] = []

  for (const line of lines) {
    const listMatch = line.match(LIST_LINE)
    if (listMatch) {
      items.push({ year: Number(listMatch[1]), title: normalizeTitle(listMatch[2]) })
      continue
    }
    const yearMatch = line.match(YEAR_PREFIX)
    if (yearMatch) {
      items.push({ year: Number(yearMatch[1]), title: normalizeTitle(yearMatch[2]) })
      continue
    }
    const books = line.matchAll(BOOK_TITLE)
    let found = false
    for (const m of books) {
      found = true
      items.push({ year: null, title: m[0] })
    }
    if (!found) {
      items.push({ year: null, title: normalizeTitle(line) })
    }
  }

  if (items.length === 0) {
    const books = [...text.matchAll(BOOK_TITLE)]
    if (books.length > 0) {
      return books.map((m) => ({ year: null, title: m[0] }))
    }
    return [{ year: null, title: text }]
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
      const yearCell = item.year
        ? `<span class="notable-works-year">${item.year}</span>`
        : '<span class="notable-works-year notable-works-year--unknown">—</span>'
      return `<li class="notable-works-item">${yearCell}<span class="notable-works-title">${escapeHtml(item.title)}</span></li>`
    })
    .join('')

  return `<ul class="notable-works-list">${rows}</ul>`
}
