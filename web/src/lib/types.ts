export type Sex = 'female' | 'male' | 'other'
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type Severity = 'mild' | 'moderate' | 'severe'
export type ConditionStatus = 'active' | 'managed' | 'resolved'
export type ReportKind = 'lab' | 'imaging' | 'prescription' | 'discharge' | 'other'
export type SectionKey = 'allergies' | 'medications' | 'conditions' | 'reports' | 'emergency_contact'
export type ShareState = 'active' | 'revoked' | 'expired' | 'not_found'

export type Profile = {
  id: string
  full_name: string
  date_of_birth: string | null
  sex: Sex | null
  blood_group: BloodGroup | null
  phone: string | null
  abha_number: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
}

export type Allergy = { id: string; substance: string; reaction: string | null; severity: Severity; created_at: string }

export type Medication = {
  id: string
  name: string
  dose: string | null
  frequency: string | null
  start_date: string | null
  prescribed_by: string | null
  notes: string | null
  active: boolean
  critical: boolean
  created_at: string
}

export type Condition = {
  id: string
  name: string
  diagnosed_on: string | null
  status: ConditionStatus
  notes: string | null
  created_at: string
}

export type Report = {
  id: string
  title: string
  kind: ReportKind
  report_date: string | null
  notes: string | null
  file_path: string | null
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type Share = {
  id: string
  user_id: string
  token: string
  kind: 'standard' | 'emergency'
  label: string | null
  sections: SectionKey[]
  expires_at: string | null
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

export type AccessLog = {
  id: number
  share_id: string
  viewed_at: string
  sections: SectionKey[]
  device: string | null
}

// What the doctor's page receives from open_share()
export type SharedRecord =
  | { status: Exclude<ShareState, 'active'> }
  | {
      status: 'active'
      kind: 'standard' | 'emergency'
      label: string | null
      sections: SectionKey[]
      expires_at: string | null
      server_time: string
      patient: { full_name: string; age: number | null; sex: Sex | null; blood_group: BloodGroup | null; abha_number: string | null }
      allergies?: Pick<Allergy, 'substance' | 'reaction' | 'severity'>[]
      medications?: Pick<Medication, 'name' | 'dose' | 'frequency' | 'start_date' | 'prescribed_by' | 'notes' | 'critical'>[]
      conditions?: Pick<Condition, 'name' | 'diagnosed_on' | 'status' | 'notes'>[]
      reports?: Pick<Report, 'id' | 'title' | 'kind' | 'report_date' | 'notes' | 'file_path' | 'file_name' | 'mime_type'>[]
      emergency_contact?: { name: string | null; phone: string | null; relation: string | null }
    }

export type ShareStatus = { status: ShareState; expires_at: string | null; server_time: string }
