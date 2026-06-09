import type { GraveHumanDetail } from '../../../shared/grave-human'
import { formatAgeAtDeath } from '../../../shared/age-at-death'
import { navigate } from '../router'
import {
  createInitialsAvatarDataUrl,
  hasExternalAvatar,
  resolveAvatarSrc
} from '../timeline/avatar'
import { formatLifeSpanCompact } from '../timeline/buildGraph'
import { renderAchievementsHtml, parseAchievements } from '../person/achievements'
import { parseNotableWorks, renderNotableWorksHtml } from '../person/notable-works'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function field(label: string, value: string): string {
  return `
    <section class="detail-field">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(value)}</p>
    </section>
  `
}

function optionalField(label: string, value: string | null | undefined): string {
  if (!hasText(value)) return ''
  return field(label, value!.trim())
}

function metaLine(label: string, value: string | null | undefined): string {
  if (!hasText(value)) return ''
  return `<p><strong>${escapeHtml(label)}</strong>${escapeHtml(value!.trim())}</p>`
}

function metaAgeLine(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  const label = formatAgeAtDeath(birthDate, deathDate)
  if (label === '—') return ''
  return metaLine('终年', label)
}

function renderAvatar(person: GraveHumanDetail): string {
  const fallback = createInitialsAvatarDataUrl(person.name, person.gender, 88)
  const external = resolveAvatarSrc(person.avatar)
  if (external && hasExternalAvatar(person.avatar)) {
    return `<img class="person-avatar person-avatar--photo" src="${escapeHtml(external)}" data-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(person.name)}" referrerpolicy="no-referrer" />`
  }
  return `<img class="person-avatar person-avatar--generated" src="${escapeHtml(fallback)}" alt="${escapeHtml(person.name)}" />`
}

function notableWorksSection(person: GraveHumanDetail): string {
  if (!hasText(person.notable_works)) return ''
  if (parseNotableWorks(person.notable_works).length === 0) return ''
  return `
    <section class="detail-field detail-field--works">
      <h3>代表作品</h3>
      ${renderNotableWorksHtml(person.notable_works)}
    </section>
  `
}

function achievementsSection(person: GraveHumanDetail): string {
  if (!hasText(person.achievements)) return ''
  if (parseAchievements(person.achievements).length === 0) return ''
  return `
    <section class="detail-field detail-field--achievements">
      <h3>主要成就</h3>
      ${renderAchievementsHtml(person.achievements)}
    </section>
  `
}

function renderDetail(person: GraveHumanDetail): string {
  return `
    <div class="person-page">
      <header class="app-header app-header--compact">
        <button id="back-button" type="button" class="secondary">← 返回时间轴</button>
        <div class="app-header__title">
          <h1>${escapeHtml(person.name)}</h1>
          <p class="subtitle">${escapeHtml(formatLifeSpanCompact(person.birth_date, person.death_date))}</p>
        </div>
      </header>
      <div class="person-hero">
        ${renderAvatar(person)}
        <div class="person-hero__meta">
          ${metaAgeLine(person.birth_date, person.death_date)}
          ${metaLine('职业', person.occupation)}
          ${metaLine('民族', person.ethnicity)}
          ${metaLine('出生地', person.birthplace)}
        </div>
      </div>
      <div class="person-detail-grid">
        ${notableWorksSection(person)}
        ${optionalField('生平简介', person.biography)}
        ${achievementsSection(person)}
        ${optionalField('纪念备注', person.memorial_notes)}
      </div>
    </div>
  `
}

function bindAvatarFallback(root: HTMLElement): void {
  const img = root.querySelector<HTMLImageElement>('.person-avatar--photo')
  if (!img) return
  img.addEventListener('error', () => {
    const fallback = img.dataset.fallback
    if (!fallback) return
    img.src = fallback
    img.classList.remove('person-avatar--photo')
    img.classList.add('person-avatar--generated')
  })
}

export function renderPersonDetailShell(): string {
  return `<div class="person-page person-page--loading"><p class="timeline-status">加载人物信息…</p></div>`
}

export async function mountPersonDetailView(root: HTMLElement, id: number): Promise<void> {
  root.innerHTML = renderPersonDetailShell()

  const result = await window.api.graveHuman.get(id)
  if (!result.ok) {
    root.innerHTML = `
      <div class="person-page">
        <header class="app-header app-header--compact">
          <button id="back-button" type="button" class="secondary">← 返回时间轴</button>
        </header>
        <p class="timeline-status timeline-status--error">${escapeHtml(result.error)}</p>
      </div>
    `
    root.querySelector<HTMLButtonElement>('#back-button')?.addEventListener('click', () => {
      navigate({ name: 'timeline' })
    })
    return
  }

  root.innerHTML = renderDetail(result.data)
  bindAvatarFallback(root)
  root.querySelector<HTMLButtonElement>('#back-button')?.addEventListener('click', () => {
    navigate({ name: 'timeline' })
  })
}
