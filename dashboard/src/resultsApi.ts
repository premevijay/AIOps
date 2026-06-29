// Typed fetch client for the results store.
//
// Reached at the relative base `/api/results`, which a same-origin proxy strips
// and forwards to the results service (nginx → results:8090 in prod, vite dev
// proxy → localhost:8090 in dev). Keeping the base relative avoids CORS.
//
// The results store persists every worker JobResult, normalized into a
// ResultRecord. The dashboard's Backup / Compliance / Health views read the
// latest record per device+op (`/results/latest`) plus recent history
// (`/results`). The real data is sparse — a status + one-line summary + a
// timestamp — so the views render exactly that, no fabricated metrics.

const BASE = '/api/results'

// A normalized worker job outcome (mirrors results_service.models.ResultRecord).
export type ResultStatus =
  | 'ok'
  | 'failed'
  | 'changed'
  | 'drift'
  | 'compliant'
  | 'non-compliant'

export type ResultOp = 'backup' | 'get_config' | 'health' | 'compliance' | 'apply'

export interface ResultRecord {
  id: string
  device: string
  op: string
  ok: boolean
  status: string
  summary: string
  detail: Record<string, unknown>
  ts: string
}

// Most recent record per (device, op) — what the view tiles read.
export async function latestResults(): Promise<ResultRecord[]> {
  const res = await fetch(`${BASE}/results/latest`)
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ResultRecord[]
}

// Newest-first history, optionally filtered by device and/or op.
export async function recentResults(params: {
  device?: string
  op?: string
  limit?: number
} = {}): Promise<ResultRecord[]> {
  const q = new URLSearchParams()
  if (params.device) q.set('device', params.device)
  if (params.op) q.set('op', params.op)
  if (params.limit != null) q.set('limit', String(params.limit))
  const qs = q.toString()
  const res = await fetch(`${BASE}/results${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ResultRecord[]
}

// On-theme color for a normalized status (shared by all three views).
export function statusColor(status: string): string {
  switch (status) {
    case 'ok':
    case 'compliant':
      return '#34D399'
    case 'changed':
    case 'drift':
      return '#FBBF24'
    case 'failed':
    case 'non-compliant':
      return '#F87171'
    default:
      return '#9DA9C0'
  }
}

// Compact relative time from an ISO8601 timestamp ("3m ago", "2h ago").
export function relativeTime(ts: string): string {
  const then = Date.parse(ts)
  if (Number.isNaN(then)) return ts
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
