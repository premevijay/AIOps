// Typed fetch client for the change-management service.
// Reached at the relative base `/api/change` (same-origin proxy: vite dev
// proxy in dev, nginx in prod) — so there is no CORS to deal with.

const BASE = '/api/change'

export type ChangeStatus = 'proposed' | 'approved' | 'rejected' | 'applied' | 'failed'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ChangeDevice {
  name: string
  vendor: string
  os: string
  mgmt_host: string
  port?: number
  vault_path?: string
}

export interface ChangeRisk {
  score: number
  level: RiskLevel
  factors: string[]
}

export interface ChangePolicy {
  allow: boolean
  violations: string[]
}

export interface ChangeAuditEntry {
  ts: string
  actor: string
  action: string
  detail: string
}

export interface Change {
  id: string
  device: ChangeDevice
  intent: string
  config: string[]
  requested_by: string
  status: ChangeStatus
  risk: ChangeRisk
  policy: ChangePolicy
  window: string | null
  created_at: string
  audit: ChangeAuditEntry[]
  result: unknown
}

export interface CreateChangeBody {
  device: ChangeDevice
  intent: string
  config: string[]
  requested_by: string
  window?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function listChanges(): Promise<Change[]> {
  return request<Change[]>('/changes')
}

export function getChange(id: string): Promise<Change> {
  return request<Change>(`/changes/${encodeURIComponent(id)}`)
}

export function createChange(body: CreateChangeBody): Promise<Change> {
  return request<Change>('/changes', { method: 'POST', body: JSON.stringify(body) })
}

export function approveChange(id: string, approver: string): Promise<Change> {
  return request<Change>(`/changes/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approver }),
  })
}

export function rejectChange(id: string, approver: string, reason: string): Promise<Change> {
  return request<Change>(`/changes/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ approver, reason }),
  })
}

export function applyChange(id: string): Promise<Change> {
  return request<Change>(`/changes/${encodeURIComponent(id)}/apply`, { method: 'POST' })
}
