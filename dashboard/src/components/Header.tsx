export function Header({ title, sub, onSearchClick }: { title: string; sub: string; onSearchClick?: () => void }) {
  return (
    <header style={{ height: 62, flex: 'none', borderBottom: '1px solid #182238', display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', background: 'rgba(11,16,32,.6)' }}>
      <div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5C6B85' }}>{sub}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div
        className="chip-h"
        onClick={onSearchClick}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0E1426', border: '1px solid #1B2740', borderRadius: 9, padding: '7px 12px', width: 280, cursor: 'pointer' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <span style={{ flex: 1, color: '#5C6B85', fontSize: 13 }}>Search devices, sites, incidents…</span>
        <span style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono', border: '1px solid #26324B', borderRadius: 5, padding: '1px 5px' }}>⌘K</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0E1426', border: '1px solid #1B2740', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 500 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399' }} />
        Global · All Regions
      </div>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2A3550,#3A4D72)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: '#C7D3EA' }}>
        NK
      </div>
    </header>
  )
}
