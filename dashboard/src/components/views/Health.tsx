import { healthKpis, healthCategories, healthDevices, healthChecks, healthDetailDevice } from '../../data'
import { Ring, Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

export function Health({ goAgent }: { goAgent: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {healthKpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: '#7A88A3', marginBottom: 9 }}>{k.label}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 26, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#5C6B85', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 15 }}>Check Categories</div>
          {healthCategories.map((c) => (
            <div key={c.name} style={{ padding: '11px 0', borderBottom: '1px solid #141C2E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon d={c.icon} size={15} stroke={c.color} width={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: '#5C6B85' }}>{c.detail}</div>
                </div>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: c.color }}>{c.pctLabel}</span>
              </div>
              <div style={{ height: 6, borderRadius: 5, background: '#0A0F1E', overflow: 'hidden' }}>
                <div style={{ width: `${c.pct}%`, height: '100%', background: c.color }} />
              </div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div style={sectionTitle}>Devices Needing Attention</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>sorted by health score</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {healthDevices.map((d) => (
              <div key={d.device} className="row-h" onClick={goAgent} style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 11, padding: '12px 14px', cursor: 'pointer', transition: 'background .12s' }}>
                <div style={{ flex: 'none' }}><Ring pct={d.score} color={d.ringColor} /></div>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: d.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon d={d.icon} size={14} stroke={d.iconFg} width={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12.5, fontWeight: 500 }}>{d.device}</div>
                  <div style={{ fontSize: 11, color: '#9DA9C0', marginTop: 2 }}>{d.top}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: d.sevColor, background: d.sevBg, padding: '3px 9px', borderRadius: 6 }}>{d.sev}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={sectionTitle}>Health Check Detail</div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#5E9BFF', background: 'rgba(94,155,255,.1)', padding: '2px 9px', borderRadius: 6 }}>{healthDetailDevice}</span>
          <div style={{ flex: 1 }} />
          <button className="btn-h" onClick={goAgent} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 13px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            <Icon d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z" size={13} stroke="currentColor" width={2.2} />
            Troubleshoot with AI
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {healthChecks.map((g) => (
            <div key={g.cat}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#7A88A3', fontWeight: 600, marginBottom: 8 }}>{g.cat}</div>
              {g.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid #141C2E' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.color, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: '#C7D3EA', lineHeight: 1.3 }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{it.val}</div>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: it.color }}>{it.state}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
