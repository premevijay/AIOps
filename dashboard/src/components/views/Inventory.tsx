import { useEffect, useMemo, useState } from 'react'
import { listDevices, type Device } from '../../deviceApi'
import { Icon } from '../../charts'

const GRID = '1.7fr 1.2fr 1fr .9fr 1.3fr 1.3fr'

// Derive a human vault-system label from a raw vault_path. The supervisor only
// gives us the path; infer the backing system honestly, fall back to "—".
function vaultSystem(path: string): string {
  const p = (path || '').toLowerCase()
  if (p.startsWith('aiops/') || p.includes('conjur')) return 'CyberArk'
  if (p.includes('kv/') || p.includes('hashicorp')) return 'HashiCorp'
  return '—'
}

export function Inventory({
  openOnb,
}: {
  // App passes the legacy mock props; the live view ignores them and fetches
  // real inventory itself. Only the onboarding opener is still used here.
  devices?: unknown
  typeFilter?: unknown
  setTypeFilter?: unknown
  openOnb: () => void
  selectDevice?: unknown
}) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    let alive = true
    listDevices()
      .then((d) => { if (alive) { setDevices(d); setError(null) } })
      .catch(() => { if (alive) { setDevices([]); setError('unreachable') } })
    return () => { alive = false }
  }, [])

  // Build filter chips from the real `type` values present in the data.
  const types = useMemo(() => {
    const set = new Set<string>()
    for (const d of devices ?? []) if (d.type) set.add(d.type)
    return Array.from(set).sort()
  }, [devices])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: devices?.length ?? 0 }
    for (const t of types) c[t] = (devices ?? []).filter((d) => d.type === t).length
    return c
  }, [devices, types])

  const filtered = (devices ?? []).filter((d) => filter === 'all' || d.type === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {(['all', ...types] as string[]).map((id) => {
          const active = filter === id
          const label = id === 'all' ? 'All Devices' : id
          return (
            <div
              key={id}
              className="chip-h"
              onClick={() => setFilter(id)}
              style={{
                border: `1px solid ${active ? '#3A4D72' : '#1B2740'}`,
                background: active ? 'rgba(94,155,255,.12)' : 'transparent',
                color: active ? '#E6ECF5' : '#9DA9C0',
                borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, textTransform: id === 'all' ? 'none' : 'capitalize',
              }}
            >
              {label} <span style={{ opacity: 0.6, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{counts[id] ?? 0}</span>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
        {/* live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: error ? '#F87171' : '#34D399', fontFamily: 'IBM Plex Mono' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: error ? '#F87171' : '#34D399', boxShadow: `0 0 0 3px ${error ? '#F8717122' : '#34D39922'}` }} />
          live · inventory
        </div>
        <button className="btn-h" onClick={openOnb} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          <Icon d="M12 5v14M5 12h14" size={14} width={2.4} stroke="currentColor" />
          Onboard Device
        </button>
      </div>

      {/* table */}
      <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 18px', borderBottom: '1px solid #1B2740', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
          <span>Device</span><span>Vendor</span><span>OS</span><span>Type</span><span>Mgmt Host</span><span>Vault Binding</span>
        </div>

        {/* loading */}
        {devices === null && (
          <div style={{ padding: '40px 18px', textAlign: 'center', color: '#5C6B85', fontSize: 13 }}>
            Loading inventory…
          </div>
        )}

        {/* error */}
        {devices !== null && error && (
          <div style={{ padding: '36px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Icon d="M12 9v4M12 17v0M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" size={22} stroke="#F87171" width={2} />
            <div style={{ fontSize: 13.5, color: '#E6ECF5', fontWeight: 500 }}>Inventory service unreachable — is the supervisor running?</div>
            <div style={{ fontSize: 11.5, color: '#5C6B85' }}>Expected the supervisor at /api/agent</div>
          </div>
        )}

        {/* empty (reachable, no devices) */}
        {devices !== null && !error && filtered.length === 0 && (
          <div style={{ padding: '36px 18px', textAlign: 'center', color: '#5C6B85', fontSize: 13 }}>
            No devices in inventory.
          </div>
        )}

        {/* rows */}
        {devices !== null && !error && filtered.map((d) => <DeviceRow key={d.name} d={d} />)}
      </div>
    </div>
  )
}

function DeviceRow({ d }: { d: Device }) {
  const sys = vaultSystem(d.vault_path)
  return (
    <div
      className="row-h"
      style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '13px 18px', borderBottom: '1px solid #141C2E', alignItems: 'center', transition: 'background .12s' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name || '—'}</div>
      </div>
      <div style={{ fontSize: 12.5 }}>{d.vendor || '—'}</div>
      <div style={{ fontSize: 12.5, color: '#9DA9C0', fontFamily: 'IBM Plex Mono' }}>{d.os || '—'}</div>
      <div style={{ fontSize: 12.5, textTransform: 'capitalize', color: '#9DA9C0' }}>{d.type || '—'}</div>
      <div style={{ fontSize: 12, color: '#9DA9C0', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {d.mgmt_host || '—'}{d.port ? `:${d.port}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sys === '—' ? '#5C6B85' : '#34D399', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: '#C7D3EA' }}>{sys}</div>
          <div style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.vault_path || '—'}</div>
        </div>
      </div>
    </div>
  )
}
