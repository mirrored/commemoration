/** 根据生卒日期计算去世时年龄（足岁）；缺任一日期或无法解析时返回 null */
export function computeAgeAtDeath(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): number | null {
  const birth = birthDate?.slice(0, 10)
  const death = deathDate?.slice(0, 10)
  if (!birth || !death || birth.length < 10 || death.length < 10) return null

  const born = Date.parse(`${birth}T00:00:00`)
  const died = Date.parse(`${death}T00:00:00`)
  if (Number.isNaN(born) || Number.isNaN(died) || died < born) return null

  let age = Number(death.slice(0, 4)) - Number(birth.slice(0, 4))
  if (death.slice(5) < birth.slice(5)) age -= 1

  return age >= 0 ? age : null
}

/** 详情/列表展示：如「87岁」；无法计算时为「—」 */
export function formatAgeAtDeath(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined
): string {
  const age = computeAgeAtDeath(birthDate, deathDate)
  return age == null ? '—' : `${age}岁`
}
