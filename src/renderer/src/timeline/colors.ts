export function genderBranchColors(gender: string): {
  fill: string
  stroke: string
  branch: string
} {
  switch (gender) {
    case 'male':
      return { fill: '#4a7ae8', stroke: '#eef4ff', branch: '#6b9cff' }
    case 'female':
      return { fill: '#e86ba0', stroke: '#fff5f9', branch: '#f09cc4' }
    default:
      return { fill: '#9aa3b2', stroke: '#eef1f6', branch: '#b8c0ce' }
  }
}
