import { useMemo, useState } from 'react'
import { regionHubs, regionOf, type Device, type RegionCode } from '../../data'
import { C, typeIcon } from '../../theme'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

const W = 1000
const H = 560
const CORE = { x: W / 2, y: H / 2 }
const HUB_POS: Record<RegionCode, { x: number; y: number }> = {
  NA: { x: 250, y: 150 },
  EMEA: { x: 750, y: 150 },
  APAC: { x: 750, y: 410 },
  LATAM: { x: 250, y: 410 },
}
const statusColor = (s: Device['status']) => C[s]

export function Topology({ devices, onSelect }: { devices: Device[]; onSelect: (name: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)

  const { hubs, nodes } = useMemo(() => {
    const hubs = regionHubs.map((code) => ({ code, ...HUB_POS[code], devices: devices.filter((d) => regionOf(d) === code) }))
    const nodes = hubs.flatMap((hub) => {
      const n = hub.devices.length
      return hub.devices.map((d, i) => {
        // fan devices out on an arc facing away from the core
        const base = Math.atan2(hub.y - CORE.y, hub.x - CORE.x)
        const spread = Math.min(Math.PI * 1.1, 0.5 + n * 0.32)
        const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1)
        const r = 104
        return { device: d, region: hub.code, x: hub.x + Math.cos(a) * r, y: hub.y + Math.sin(a) * r }
      })
    })
    return { hubs, nodes }
  }, [devices])

  const hoverNode = nodes.find((n) => n.device.name === hover)
  const activeRegion = hoverNode?.region ?? null
  const dim = (on: boolean) => (hover && !on ? 0.18 : 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={sectionTitle}>Fleet Interconnect</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: '#9DA9C0' }}>
            {[['Healthy', C.healthy], ['Warning', C.warning], ['Critical', C.critical]].map(([l, c]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c as string }} />{l}
              </span>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
          {/* core → hub links */}
          {hubs.map((h) => {
            const on = !activeRegion || activeRegion === h.code
            return <line key={'cl' + h.code} x1={CORE.x} y1={CORE.y} x2={h.x} y2={h.y} stroke={on && activeRegion ? '#3A4D72' : '#1B2740'} strokeWidth={on && activeRegion ? 2 : 1.4} opacity={dim(on)} />
          })}
          {/* hub → device links */}
          {nodes.map((n) => {
            const on = n.device.name === hover
            const hub = HUB_POS[n.region]
            return <line key={'dl' + n.device.name} x1={hub.x} y1={hub.y} x2={n.x} y2={n.y} stroke={on ? statusColor(n.device.status) : '#1B2740'} strokeWidth={on ? 2.4 : 1.3} opacity={dim(!activeRegion || n.region === activeRegion)} />
          })}

          {/* core */}
          <g opacity={dim(true)}>
            <circle cx={CORE.x} cy={CORE.y} r={30} fill="#15233A" stroke="#2C3A63" strokeWidth={1.5} />
            <circle cx={CORE.x} cy={CORE.y} r={30} fill="none" stroke="#5E9BFF" strokeWidth={1.5} opacity={0.4} />
            <text x={CORE.x} y={CORE.y - 1} textAnchor="middle" fill="#E6ECF5" fontSize={11} fontWeight={700} fontFamily="Space Grotesk">CORE</text>
            <text x={CORE.x} y={CORE.y + 12} textAnchor="middle" fill="#7A88A3" fontSize={8.5} fontFamily="IBM Plex Mono">global mesh</text>
          </g>

          {/* hubs */}
          {hubs.map((h) => {
            const on = !activeRegion || activeRegion === h.code
            return (
              <g key={h.code} opacity={dim(on)}>
                <rect x={h.x - 34} y={h.y - 18} width={68} height={36} rx={9} fill="#0E1426" stroke="#26324B" strokeWidth={1.3} />
                <text x={h.x} y={h.y - 1} textAnchor="middle" fill="#C7D3EA" fontSize={11.5} fontWeight={700} fontFamily="Space Grotesk">{h.code}</text>
                <text x={h.x} y={h.y + 11} textAnchor="middle" fill="#5C6B85" fontSize={8.5} fontFamily="IBM Plex Mono">{h.devices.length} nodes</text>
              </g>
            )
          })}

          {/* device nodes */}
          {nodes.map((n) => {
            const sel = n.device.name === hover
            return (
              <g
                key={n.device.name}
                style={{ cursor: 'pointer' }}
                opacity={dim(!activeRegion || n.region === activeRegion)}
                onMouseEnter={() => setHover(n.device.name)}
                onMouseLeave={() => setHover((h) => (h === n.device.name ? null : h))}
                onClick={() => onSelect(n.device.name)}
              >
                {sel && <circle cx={n.x} cy={n.y} r={15} fill="none" stroke={statusColor(n.device.status)} strokeWidth={1.5} opacity={0.5} />}
                <circle cx={n.x} cy={n.y} r={9} fill="#0B1020" stroke={statusColor(n.device.status)} strokeWidth={2.4} />
                <g transform={`translate(${n.x - 5},${n.y - 5})`}>
                  <Icon d={typeIcon(n.device.type)} size={10} stroke={statusColor(n.device.status)} width={2} />
                </g>
                {sel && (
                  <g>
                    <rect x={n.x - 78} y={n.y + 16} width={156} height={30} rx={7} fill="#0B1020" stroke="#26324B" />
                    <text x={n.x} y={n.y + 29} textAnchor="middle" fill="#E6ECF5" fontSize={9.5} fontFamily="IBM Plex Mono">{n.device.name}</text>
                    <text x={n.x} y={n.y + 40} textAnchor="middle" fill="#7A88A3" fontSize={8.5}>{n.device.vendor} · {n.device.site}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        <div style={{ fontSize: 11.5, color: '#5C6B85', textAlign: 'center', marginTop: 4 }}>
          Hover a node to trace its path to core · click to open the device drawer
        </div>
      </div>

      {/* region summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {hubs.map((h) => {
          const warn = h.devices.filter((d) => d.status === 'warning').length
          const crit = h.devices.filter((d) => d.status === 'critical').length
          return (
            <div key={h.code} style={{ ...card, borderRadius: 13, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>{h.code}</span>
                <div style={{ flex: 1 }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: crit ? C.critical : warn ? C.warning : C.healthy }} />
              </div>
              <div style={{ fontSize: 12, color: '#9DA9C0' }}>{h.devices.length} devices · {crit} critical · {warn} warning</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
