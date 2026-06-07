/** 解析 achievements：每行一项，格式与 notable_works 类似（- 前缀，可无年份） */

const LIST_PREFIX = /^\s*(?:[-*+]\s+|\d+\.\s+)/
const YEAR_PREFIX = /^\s*(\d{4})\s*(?:[·•.\-—]\s*)/
const YEAR_ONLY = /^\d{4}年?$/
const YEAR_RUN = /\d{4}年(?:[、，]\d{4}年)+/
/** 第3、5届 — 多届次枚举，顿号不拆 */
const SESSION_ENUM = /第[\d一二三四五六七八九十百]+(?:、[\d一二三四五六七八九十百]+)+届/
const SESSION_FRAGMENT = /^[\d一二三四五六七八九十百]+届/
const SESSION_HEAD_FRAGMENT = /第[\d一二三四五六七八九十百]+$/
const BOOK_LINE = /^《[^》]+》）?$/
const OPEN_PAREN_TAIL = /（[^）]*$/
const YEAR_IN_PAREN_TAIL = /（\d{4}年?$/
const SESSION_LINE = /^第?[一二三四五六七八九十百\d]+届/
const CONTINUATION = /^(面向|旨在|致力|从事|培育|致力于|专门为|主要|长期)/
const NAME_PREFIX = /^[^：:\n]{1,12}[：:]\s*/

const BRACKET_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['（', '）'],
  ['(', ')'],
  ['《', '》'],
  ['「', '」'],
  ['【', '】'],
]
const OPENER_TO_CLOSER: Record<string, string> = Object.fromEntries(BRACKET_PAIRS)
const CLOSER_TO_OPENER: Record<string, string> = Object.fromEntries(
  BRACKET_PAIRS.map(([open, close]) => [close, open]),
)

function normalizeItem(line: string): string {
  let t = line.trim().replace(/[。；;]+$/, '')
  t = t.replace(LIST_PREFIX, '')
  const yearMatch = t.match(YEAR_PREFIX)
  if (yearMatch) {
    t = t.slice(yearMatch[0].length).trim()
  }
  return t
}

function protectTokens(
  text: string,
  pattern: RegExp,
  prefix: string
): { text: string; tokens: string[] } {
  const tokens: string[] = []
  const protectedText = text.replace(pattern, (match) => {
    tokens.push(match)
    return `\x00${prefix}${tokens.length - 1}\x00`
  })
  return { text: protectedText, tokens }
}

function unprotectTokens(text: string, tokens: string[], prefix: string): string {
  let out = text
  for (let i = 0; i < tokens.length; i++) {
    out = out.replace(`\x00${prefix}${i}\x00`, tokens[i])
  }
  return out
}

function protectAchievementText(text: string): { text: string; yearTokens: string[]; sessionTokens: string[] } {
  const year = protectTokens(text, YEAR_RUN, 'YR')
  const session = protectTokens(year.text, SESSION_ENUM, 'SE')
  return { text: session.text, yearTokens: year.tokens, sessionTokens: session.tokens }
}

function unprotectAchievementText(
  text: string,
  yearTokens: string[],
  sessionTokens: string[]
): string {
  return unprotectTokens(unprotectTokens(text, sessionTokens, 'SE'), yearTokens, 'YR')
}

function isFormattedList(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.length > 0 && lines.every((l) => LIST_PREFIX.test(l))
}

function splitOutsideBrackets(text: string, separators: string): string[] {
  const sepSet = new Set(separators)
  const parts: string[] = []
  let buf = ''
  const stack: string[] = []

  for (const ch of text) {
    if (ch in OPENER_TO_CLOSER) {
      stack.push(ch)
      buf += ch
    } else if (ch in CLOSER_TO_OPENER) {
      if (stack.length > 0 && stack[stack.length - 1] === CLOSER_TO_OPENER[ch]) {
        stack.pop()
      }
      buf += ch
    } else if (sepSet.has(ch) && stack.length === 0) {
      const piece = buf.trim()
      if (piece) parts.push(piece)
      buf = ''
    } else {
      buf += ch
    }
  }
  const tail = buf.trim()
  if (tail) parts.push(tail)
  return parts
}

function joinMerged(prev: string, curr: string): string {
  if (YEAR_ONLY.test(curr)) return `${prev}、${curr}`
  if (BOOK_LINE.test(curr) && (OPEN_PAREN_TAIL.test(prev) || YEAR_IN_PAREN_TAIL.test(prev))) {
    const sep = YEAR_IN_PAREN_TAIL.test(prev) ? '，' : ''
    return prev + sep + curr
  }
  if (SESSION_LINE.test(curr) && /(共产党|中央|政协|人大|政治局)/.test(prev)) {
    return `${prev}、${curr}`
  }
  if (CONTINUATION.test(curr)) {
    return prev.endsWith('奖') || prev.endsWith('）') || prev.endsWith('"') || prev.endsWith('”')
      ? prev + curr
      : `${prev}，${curr}`
  }
  if (OPEN_PAREN_TAIL.test(prev) || prev.endsWith('（')) {
    const sep = YEAR_IN_PAREN_TAIL.test(prev) ? '，' : ''
    return prev + sep + curr
  }
  if (/\d{4}年$/.test(prev) && /^\d{4}年/.test(curr)) return `${prev}、${curr}`
  if (SESSION_HEAD_FRAGMENT.test(prev) && SESSION_FRAGMENT.test(curr)) return `${prev}、${curr}`
  return `${prev} ${curr}`
}

function shouldMergeWithPrevious(prev: string, curr: string): boolean {
  if (!prev || !curr) return false
  if (YEAR_ONLY.test(curr)) return true
  if (BOOK_LINE.test(curr) && prev.includes('（')) {
    const open = (prev.match(/（/g) ?? []).length
    const close = (prev.match(/）/g) ?? []).length
    if (open > close) return true
  }
  if (OPEN_PAREN_TAIL.test(prev) || YEAR_IN_PAREN_TAIL.test(prev)) return true
  if (SESSION_LINE.test(curr) && /(共产党|中央|政协|人大|政治局|候补|委员)/.test(prev)) {
    return true
  }
  if (CONTINUATION.test(curr) && /(设立|成立|创立|创办|奖)/.test(prev)) return true
  if (/\d{4}年$/.test(prev) && /^\d{4}年/.test(curr)) return true
  if (SESSION_HEAD_FRAGMENT.test(prev) && SESSION_FRAGMENT.test(curr)) return true
  if (/[（年]$/.test(prev) && BOOK_LINE.test(curr)) return true
  return false
}

function mergeFragments(items: string[]): string[] {
  const merged: string[] = []
  for (const item of items) {
    const normalized = normalizeItem(item)
    if (!normalized) continue
    if (merged.length > 0 && shouldMergeWithPrevious(merged[merged.length - 1], normalized)) {
      merged[merged.length - 1] = joinMerged(merged[merged.length - 1], normalized)
    } else {
      merged.push(normalized)
    }
  }
  return merged
}

function splitIntoItems(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (NAME_PREFIX.test(trimmed) && /[；;]/.test(trimmed)) {
    return [normalizeItem(trimmed)]
  }

  if (isFormattedList(trimmed)) {
    const lines = trimmed.split(/\r?\n/).map((l) => normalizeItem(l.trim())).filter(Boolean)
    return mergeFragments(lines)
  }

  const { text: protectedText, yearTokens, sessionTokens } = protectAchievementText(trimmed)
  const chunks: string[] = []

  if (protectedText.includes('\n')) {
    for (const line of protectedText.split(/\r?\n/)) {
      const row = line.trim()
      if (!row) continue
      const sub = splitOutsideBrackets(row, '、，,；;')
      chunks.push(...(sub.length > 0 ? sub : [row]))
    }
  } else {
    chunks.push(...splitOutsideBrackets(protectedText, '、，,；;'))
  }

  const items = chunks
    .map((c) => unprotectAchievementText(normalizeItem(c), yearTokens, sessionTokens))
    .filter(Boolean)
  return mergeFragments(items)
}

export function parseAchievements(raw: string | null | undefined): string[] {
  const text = raw?.trim()
  if (!text) return []

  const items = splitIntoItems(text)
  if (items.length > 0) return items

  return [text]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderAchievementsHtml(raw: string | null | undefined): string {
  const items = parseAchievements(raw)
  if (items.length === 0) {
    return ''
  }

  const rows = items
    .map((item) => `<li class="achievement-item">${escapeHtml(item)}</li>`)
    .join('')

  return `<ul class="achievement-list">${rows}</ul>`
}
