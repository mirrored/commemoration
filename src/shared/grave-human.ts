export interface GraveHumanSummary {
  id: number
  name: string
  gender: string
  birth_date: string | null
  death_date: string | null
  ethnicity: string | null
  nationality: string | null
  birthplace: string | null
  occupation: string | null
  notable_works: string | null
  achievements: string | null
  thin_rank: number
  avatar: string | null
}

export interface GraveHumanDetail {
  id: number
  name: string
  gender: string
  birth_date: string | null
  death_date: string | null
  ethnicity: string | null
  nationality: string | null
  birthplace: string | null
  occupation: string | null
  notable_works: string | null
  biography: string | null
  achievements: string | null
  memorial_notes: string | null
  thin_rank: number
  avatar: string | null
  created_at: string
  updated_at: string
}
