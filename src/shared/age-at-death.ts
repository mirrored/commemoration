import { commonPrecision, parsePartialDate, type PartialDate } from './partial-date'

/** 根据生卒日期计算去世时年龄（足岁）；缺任一日期或无法解析时返回 null */
export function computeAgeAtDeath(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): number | null {
  const birth = parsePartialDate(birthDate)
  const death = parsePartialDate(deathDate)
  if (!birth || !death || death.year < birth.year) return null

  const precision = commonPrecision(birth, death)

  if (precision === 'year') {
    return death.year - birth.year
  }

  if (precision === 'month') {
    let age = death.year - birth.year
    const birthMonth = birth.month ?? 1
    const deathMonth = death.month ?? 12
    if (deathMonth < birthMonth) age -= 1
    return age >= 0 ? age : null
  }

  const birthMonth = birth.month ?? 1
  const birthDay = birth.day ?? 1
  const deathMonth = death.month ?? 12
  const deathDay = death.day ?? 28

  let age = death.year - birth.year
  const birthKey = `${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
  const deathKey = `${String(deathMonth).padStart(2, '0')}-${String(deathDay).padStart(2, '0')}`
  if (deathKey < birthKey) age -= 1

  return age >= 0 ? age : null
}

function isApproximateAge(
  birth: PartialDate | null,
  death: PartialDate | null
): boolean {
  if (!birth || !death) return false
  return birth.precision === 'year' || death.precision === 'year'
}

/** 详情/列表展示：如「87岁」；仅年份精度时为「约87岁」 */
export function formatAgeAtDeath(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  const birth = parsePartialDate(birthDate)
  const death = parsePartialDate(deathDate)
  const age = computeAgeAtDeath(birthDate, deathDate)
  if (age == null) return '—'
  return isApproximateAge(birth, death) ? `约${age}岁` : `${age}岁`
}
