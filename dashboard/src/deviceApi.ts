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
