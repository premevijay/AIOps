import { useEffect, useMemo, useRef, useState } from 'react'
import { navDef, type Device, type ViewId } from '../data'
import { typeIcon, typeIconBg, typeIconFg } from '../theme'
import { Icon } from '../charts'

interface Result {
  key: string
  group: 'Views' | 'Devices' | 'Sites'
  label: string
  sub: string
  icon: string
  iconColor: string
  run: () => void
}

export function CommandPalette({
  devices,
  onClose,
  onSelectView,
  onSelectDevice,
  onSelectSite,
}: {
  devices: Device[]
  onClose: () => void
  onSelectView: (v: ViewId) => void
  onSelectDevice: (name: string) => void
  onSelectSite: (site: string) => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo<Result[]>(() => {
    const needle = q.trim().toLowerCase()
    const match = (s: string) => s.toLowerCase().includes(needle)

    const views: Result[] = navDef
      .filter((n) => !needle || match(n.label))
      .map((n) => ({ key: 'v:' + n.id, group: 'Views', label: n.label, sub: 'Go to ' + n.label, icon: n.icon, iconColor: '#5E9BFF', run: () => { onSelectView(n.id); onClose() } }))

    const devs: Result[] = devices
      .filter((d) => !needle || match(d.name) || match(d.vendor) || match(d.site) || match(d.role))
      .slice(0, 6)
      .map((d) => ({ key: 'd:' + d.name, group: 'Devices', label: d.name, sub: `${d.vendor} · ${d.site}`, icon: typeIcon(d.type), iconColor: typeIconFg(d.type), run: () => { onSelectDevice(d.name); onClose() } }))

    const siteSet = Array.from(new Set(devices.map((d) => d.site)))
    const sites: Result[] = siteSet
      .filter((s) => needle && match(s))
      .slice(0, 4)
      .map((s) => ({ key: 's:' + s, group: 'Sites', label: s, sub: 'Filter inventory to this site', icon: 'M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z', iconColor: '#A78BFA', run: () => { onSelectSite(s); onClose() } }))

    return [...views, ...devs, ...sites]
  }, [q, devices, onClose, onSelectView, onSelectDevice, onSelectSite])

  useEffect(() => { setActive(0) }, [q])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); results[active]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  // group headers while keeping a single running index for highlight
  let runningIndex = -1
  const groups: Result['group'][] = ['Views', 'Devices', 'Sites']

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,7,14,.7)', backdropFilter: 'blur(2px)', zIndex: 50 }} />
      <div style={{ position: 'absolute', top: '14%', left: '50%', transform: 'translateX(-50%)', width: 620, maxHeight: '70vh', background: '#0B1020', border: '1px solid #26324B', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid #182238' }}>
          <Icon d="M21 21l-4-4M11 18a7 7 0 100-14 7 7 0 000 14z" size={17} stroke="#5C6B85" width={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search devices, sites, or jump to a view…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#E6ECF5', fontFamily: 'IBM Plex Sans', fontSize: 14 }}
          />
          <span style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono', border: '1px solid #26324B', borderRadius: 5, padding: '2px 6px' }}>ESC</span>
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', padding: '8px 8px 10px' }}>
          {results.length === 0 && (
            <div style={{ padding: '26px 16px', textAlign: 'center', color: '#5C6B85', fontSize: 13 }}>No matches for “{q}”.</div>
          )}
          {groups.map((g) => {
            const items = results.filter((r) => r.group === g)
            if (!items.length) return null
            return (
              <div key={g} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: '#5C6B85', fontWeight: 600, padding: '8px 12px 4px' }}>{g}</div>
                {items.map((r) => {
                  runningIndex++
                  const idx = runningIndex
                  const isActive = idx === active
                  return (
                    <div
                      key={r.key}
                      onMouseEnter={() => setActive(idx)}
                      onClick={r.run}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 9, cursor: 'pointer', background: isActive ? '#141C2E' : 'transparent' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: r.group === 'Devices' ? typeIconBg(devices.find((d) => d.name === r.label)!.type) : '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon d={r.icon} size={14} stroke={r.iconColor} width={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontFamily: r.group === 'Devices' ? 'IBM Plex Mono' : 'IBM Plex Sans', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: '#5C6B85' }}>{r.sub}</div>
                      </div>
                      {isActive && <Icon d="M9 18l6-6-6-6" size={14} stroke="#5C6B85" width={2} />}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
