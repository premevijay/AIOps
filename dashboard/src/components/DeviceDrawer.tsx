import { type Device, drawerCapMeta } from '../data'
import { typeIcon, typeIconBg, typeIconFg } from '../theme'
import { Icon } from '../charts'

export function DeviceDrawer({ device, onClose, onAskAgent }: { device: Device; onClose: () => void; onAskAgent: () => void }) {
  const capRows = drawerCapMeta.map(([k, name, iconPath, col]) => {
    const on = device.caps.includes(k)
    return { name, icon: iconPath, fg: on ? col : '#5C6B85', state: on ? 'Active' : 'Off', track: on ? col : '#26324B', knobSide: on ? 'right' : 'left' }
  })

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,7,14,.6)', zIndex: 30, animation: 'fadeUp .2s ease' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, background: '#0B1020', borderLeft: '1px solid #1B2740', zIndex: 31, overflowY: 'auto', animation: 'fadeUp .25s ease', boxShadow: '-20px 0 50px rgba(0,0,0,.5)' }}>
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid #182238' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: typeIconBg(device.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon d={typeIcon(device.type)} size={21} stroke={typeIconFg(device.type)} width={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 15, fontWeight: 600 }}>{device.name}</div>
              <div style={{ fontSize: 12, color: '#7A88A3', marginTop: 2 }}>{device.vendor} · {device.model}</div>
            </div>
            <div onClick={onClose} style={{ cursor: 'pointer', color: '#7A88A3', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-h" onClick={onAskAgent} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', color: '#06122B', border: 'none', borderRadius: 9, padding: 9, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
              <Icon d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z" size={14} stroke="currentColor" width={2.2} />
              Ask Agent
            </button>
            <button className="btn-h" style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 9, padding: '9px 13px', fontWeight: 500, fontSize: 12.5, cursor: 'pointer' }}>
              Backup Now
            </button>
          </div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            {device.stats.map((s) => (
              <div key={s.label} style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ fontSize: 10.5, color: '#5C6B85', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600, marginBottom: 11 }}>Capabilities Enabled</div>
            {capRows.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid #141C2E' }}>
                <Icon d={c.icon} size={16} stroke={c.fg} width={2} />
                <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                <span style={{ fontSize: 11.5, color: c.fg, fontWeight: 500 }}>{c.state}</span>
                <div style={{ width: 34, height: 19, borderRadius: 11, background: c.track, position: 'relative', flex: 'none' }}>
                  <span style={{ position: 'absolute', top: 2, [c.knobSide]: 2, width: 15, height: 15, borderRadius: '50%', background: '#fff' }} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600, marginBottom: 10 }}>Vault Binding</div>
            <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 10, padding: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{device.vault}</div>
                <div style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{device.vaultPath}</div>
              </div>
              <span style={{ fontSize: 11, color: '#34D399', fontWeight: 600 }}>Rotated 6h ago</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
