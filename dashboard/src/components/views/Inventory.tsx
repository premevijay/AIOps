import { type Device } from '../../data'
import { C, typeIcon as icon, typeIconBg as iconBg, typeIconFg as iconFg, type DeviceType } from '../../theme'
import { CapDots, Icon } from '../../charts'

const GRID = '1.6fr 1.4fr 1fr .9fr 1.1fr .8fr .9fr 32px'

const typeFilters: [DeviceType | 'all', string][] = [
  ['all', 'All Devices'],
  ['switch', 'Switches'],
  ['firewall', 'Firewalls'],
  ['lb', 'Load Balancers'],
]

export function Inventory({
  devices,
  typeFilter,
  setTypeFilter,
  openOnb,
  selectDevice,
}: {
  devices: Device[]
  typeFilter: DeviceType | 'all'
  setTypeFilter: (t: DeviceType | 'all') => void
  openOnb: () => void
  selectDevice: (name: string) => void
}) {
  const counts: Record<string, number> = {
    all: devices.length,
    switch: devices.filter((d) => d.type === 'switch').length,
    firewall: devices.filter((d) => d.type === 'firewall').length,
    lb: devices.filter((d) => d.type === 'lb').length,
  }
  const filtered = typeFilter === 'all' ? devices : devices.filter((d) => d.type === typeFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {typeFilters.map(([id, label]) => {
          const active = typeFilter === id
          return (
            <div
              key={id}
              className="chip-h"
              onClick={() => setTypeFilter(id)}
              style={{
                border: `1px solid ${active ? '#3A4D72' : '#1B2740'}`,
                background: active ? 'rgba(94,155,255,.12)' : 'transparent',
                color: active ? '#E6ECF5' : '#9DA9C0',
                borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {label} <span style={{ opacity: 0.6, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{counts[id]}</span>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
        <div className="chip-h" style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #1B2740', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: '#9DA9C0', cursor: 'pointer' }}>
          <Icon d="M3 6h18M7 12h10M11 18h2" size={14} width={2} /> Vault: All
        </div>
        <button className="btn-h" onClick={openOnb} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          <Icon d="M12 5v14M5 12h14" size={14} width={2.4} stroke="currentColor" />
          Onboard Device
        </button>
      </div>

      {/* table */}
      <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 18px', borderBottom: '1px solid #1B2740', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
          <span>Device</span><span>Vendor / Model</span><span>Site / Region</span><span>Vault</span><span>Capabilities</span><span>Backup</span><span>Health</span><span />
        </div>
        {filtered.map((d) => (
          <DeviceRow key={d.name} d={d} onClick={() => selectDevice(d.name)} />
        ))}
      </div>
    </div>
  )
}

function DeviceRow({ d, onClick }: { d: Device; onClick: () => void }) {
  const statusColor = C[d.status]
  return (
    <div
      className="row-h"
      onClick={onClick}
      style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '13px 18px', borderBottom: '1px solid #141C2E', alignItems: 'center', cursor: 'pointer', transition: 'background .12s' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon d={icon(d.type)} size={15} stroke={iconFg(d.type)} width={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
          <div style={{ fontSize: 11, color: '#5C6B85' }}>{d.role}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12.5 }}>{d.vendor}</div>
        <div style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{d.model}</div>
      </div>
      <div>
        <div style={{ fontSize: 12.5 }}>{d.site}</div>
        <div style={{ fontSize: 11, color: '#5C6B85' }}>{d.region}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
        <span style={{ fontSize: 11.5, color: '#9DA9C0' }}>{d.vault}</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}><CapDots set={d.caps} /></div>
      <div style={{ fontSize: 11.5, color: '#9DA9C0', fontFamily: 'IBM Plex Mono' }}>{d.backup}</div>
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: statusColor }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
          {d.status}
        </span>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
    </div>
  )
}
