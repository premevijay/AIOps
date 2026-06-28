import { kpis, regions, healthDonutSegs, healthLegend, postures, activity, coverage } from '../../data'
import { Spark, Donut, Icon } from '../../charts'
import { Html, card, sectionTitle } from '../ui'

export function Overview({ goAgent }: { goAgent: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI insight banner */}
      <div style={{ background: 'linear-gradient(100deg,rgba(94,155,255,.12),rgba(167,139,250,.08))', border: '1px solid #2C3A63', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 15 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z" size={20} stroke="#fff" width={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Agent flagged 2 emerging issues overnight — 1 auto-remediated</div>
          <div style={{ fontSize: 12.5, color: '#9DA9C0' }}>
            BGP flap on <span style={{ fontFamily: 'IBM Plex Mono', color: '#C7D3EA' }}>nexus-dc-fra-02</span> auto-resolved · PA-firewall <span style={{ fontFamily: 'IBM Plex Mono', color: '#C7D3EA' }}>pa5260-lon-01</span> CPU trending high, awaiting approval
          </div>
        </div>
        <button className="btn-h" onClick={goAgent} style={{ background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Open Agent
        </button>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 13, padding: '15px 16px' }}>
            <div style={{ fontSize: 11.5, color: '#7A88A3', fontWeight: 500, marginBottom: 9 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 25, lineHeight: 1, color: k.color }}>{k.value}</div>
              <div style={{ marginBottom: 2 }}><Spark data={k.spark} color={k.sparkColor} /></div>
            </div>
            <div style={{ fontSize: 11, color: k.deltaColor, marginTop: 8, fontWeight: 500 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* regions */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={sectionTitle}>Fleet by Region</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>3,847 devices · 38 sites</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {regions.map((r) => (
              <div key={r.code}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, width: 54 }}>{r.code}</span>
                  <span style={{ fontSize: 12, color: '#7A88A3', flex: 1 }}>{r.name}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#C7D3EA' }}>{r.count}</span>
                </div>
                <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', background: '#0A0F1E' }}>
                  <div style={{ width: `${r.h}%`, background: '#34D399' }} />
                  <div style={{ width: `${r.w}%`, background: '#FBBF24' }} />
                  <div style={{ width: `${r.c}%`, background: '#F87171' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* health donut + posture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div><Donut segs={healthDonutSegs} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ ...sectionTitle, marginBottom: 10 }}>Fleet Health</div>
              {healthLegend.map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
                  <span style={{ fontSize: 12, color: '#9DA9C0', flex: 1 }}>{l.label}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600 }}>{l.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{ ...sectionTitle, marginBottom: 14 }}>Posture</div>
            {postures.map((p) => (
              <div key={p.label} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: '#9DA9C0' }}>{p.label}</span>
                  <span style={{ fontWeight: 600, color: p.color }}>{p.value}</span>
                </div>
                <div style={{ height: 6, borderRadius: 5, background: '#0A0F1E', overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* recent activity + capability matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 15 }}>Recent Agent Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid #141C2E' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: 'none', background: a.color }} />
                <div style={{ flex: 1 }}>
                  <Html as="div" html={a.text} style={{ fontSize: 13 }} />
                  <div style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{a.meta}</div>
                </div>
                <span style={{ fontSize: 11, color: '#5C6B85', whiteSpace: 'nowrap' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 15 }}>Capability Coverage by Vendor Class</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {coverage.map((c) => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontSize: 12.5, width: 120, color: '#C7D3EA' }}>{c.label}</span>
                <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                  {c.caps.map((cap) => (
                    <div key={cap.name} title={cap.name} style={{ flex: 1, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cap.bg, border: `1px solid ${cap.bd}` }}>
                      <Icon d={cap.icon} size={13} stroke={cap.fg} width={2.4} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: '#7A88A3' }}>
              <span>Backup</span><span>Compliance</span><span>Health</span><span>Monitor</span><span>AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
