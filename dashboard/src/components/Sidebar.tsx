import { navDef, vaults, type ViewId } from '../data'
import { Icon } from '../charts'

export function Sidebar({ view, setView, badges = {} }: { view: ViewId; setView: (v: ViewId) => void; badges?: Partial<Record<ViewId, string>> }) {
  return (
    <aside style={{ width: 248, flex: 'none', display: 'flex', flexDirection: 'column', background: '#0B1020', borderRight: '1px solid #182238' }}>
      <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(94,155,255,.4)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, letterSpacing: '.3px' }}>
            Aether<span style={{ color: '#5E9BFF' }}>NetOps</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#5C6B85', letterSpacing: '.4px', textTransform: 'uppercase' }}>Autonomous Network Ops</div>
        </div>
      </div>

      <nav style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {navDef.map((item) => {
          const active = view === item.id
          const badge = badges[item.id] ?? item.badge
          return (
            <div key={item.id}>
              {item.heading && (
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.7px', color: '#4C5A78', fontWeight: 700, padding: '15px 12px 6px' }}>
                  {item.heading}
                </div>
              )}
              <div
                className="nav-h"
                role="button"
                tabIndex={0}
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView(item.id) } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 500, transition: 'background .12s',
                  ...(active
                    ? { background: 'linear-gradient(100deg,rgba(94,155,255,.16),rgba(167,139,250,.08))', color: '#fff', boxShadow: 'inset 0 0 0 1px #2C3A63' }
                    : { color: '#9DA9C0' }),
                }}
              >
                <Icon d={item.icon} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge && (
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10.5, background: '#3A1D2A', color: '#F87171', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>
                    {badge}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 14 }}>
        <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 12, padding: 13 }}>
          <div style={{ fontSize: 10.5, color: '#5C6B85', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, fontWeight: 600 }}>Secret Vaults</div>
          {vaults.map((v) => (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'pulseDot 2.4s ease-in-out infinite', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{v.name}</div>
                <div style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{v.detail}</div>
              </div>
              <span style={{ fontSize: 10, color: '#34D399', fontWeight: 600 }}>{v.bound}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
