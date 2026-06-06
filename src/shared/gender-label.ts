/** 将 grave_human.gender 枚举值映射为界面展示文案 */
export function formatGenderLabel(gender: string | null | undefined): string {
  switch (gender?.toLowerCase()) {
    case 'male':
      return '男'
    case 'female':
      return '女'
    case 'other':
      return '其它'
    case 'unknown':
      return '未知'
    default:
      return gender?.trim() ? gender : '—'
  }
}
