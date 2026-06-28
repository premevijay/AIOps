import { compKpis, frameworks, violations, compByVendor } from '../../data'
import { card, sectionTitle } from '../ui'

export function Compliance() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {compKpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: '#7A88A3', marginBottom: 9 }}>{k.label}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 26, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#5C6B85', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={sectionTitle}>Compliance by Framework</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>Last scan 2h ago</span>
          </div>
          {frameworks.map((f) => (
            <div key={f.short} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid #141C2E' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11, color: '#5E9BFF' }}>{f.short}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: '#5C6B85' }}>{f.rules}</div>
              </div>
              <div style={{ width: 130 }}>
                <div style={{ height: 7, borderRadius: 5, background: '#0A0F1E', overflow: 'hidden' }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: f.color }} />
                </div>
              </div>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: f.color, width: 46, textAlign: 'right' }}>{f.pct}%</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 14 }}>Top Violations</div>
          {violations.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid #141C2E' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600, color: v.sevColor, background: v.sevBg, padding: '2px 7px', borderRadius: 5, height: 'fit-content' }}>{v.sev}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5 }}>{v.rule}</div>
                <div style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{v.devices}</div>
              </div>
              <span style={{ fontSize: 11, color: '#5E9BFF', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>{v.action}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 16 }}>Compliance by Vendor</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px 30px' }}>
          {compByVendor.map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: 12, width: 118, color: '#C7D3EA' }}>{c.name}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 5, background: '#0A0F1E', overflow: 'hidden' }}>
                <div style={{ width: `${c.pct}%`, height: '100%', background: c.color }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: c.color, width: 34, textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{c.pctLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
