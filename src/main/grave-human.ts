import type { GraveHumanDetail, GraveHumanSummary } from '../shared/grave-human'
import { apiGet } from './api-client'

export async function listGraveHumans(): Promise<GraveHumanSummary[]> {
  return apiGet<GraveHumanSummary[]>('/api/grave-human')
}

export async function getGraveHuman(id: number): Promise<GraveHumanDetail> {
  return apiGet<GraveHumanDetail>(`/api/grave-human/${id}`)
}
