// Typed fetch client for the supervisor inventory API.
//
// Reached at the relative base `/api/agent`, which a same-origin proxy strips
// and forwards to the supervisor (nginx → supervisor:8088 in prod, vite dev
// proxy → localhost:8088 in dev). Keeping the base relative avoids CORS.

const BASE = '/api/agent'

// Mirrors the JSON returned by `GET /api/agent/devices`. The real inventory is
// sparser than the prototype mock — there is no live CPU / compliance / status.
export interface Device {
  name: string
  vendor: string
  os: string
  type: string
  mgmt_host: string
  port: number
  vault_path: string
}

export async function listDevices(): Promise<Device[]> {
  const res = await fetch(`${BASE}/devices`)
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as Device[]
}

// The worker's reply for a triggered job (mirrors aiops_worker JobResult).
export interface JobResult {
  op: string
  device_name: string
  ok: boolean
  data: Record<string, unknown> | null
  error: string | null
  duration_ms: number | null
}

// Trigger a single safe capability job (backup | get_config | health |
// compliance) on the worker via the supervisor and return its JobResult. The
// supervisor rejects `apply` here — that path is gated by the change service.
export async function runJob(op: string, deviceName: string): Promise<JobResult> {
  const res = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, device_name: deviceName }),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as JobResult
}
