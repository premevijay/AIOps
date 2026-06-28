import { backupKpis, backupJobs, diffLines, diffMeta, recentBackups } from '../../data'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

export function Backup() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {backupKpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: '#7A88A3', marginBottom: 9 }}>{k.label}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 26, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#5C6B85', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitle}>Backup Jobs</div>
            <button className="btn-h" style={{ background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Run Backup Now</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr .8fr .6fr .8fr', gap: 10, padding: '0 2px 10px', borderBottom: '1px solid #1B2740', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
            <span>Scope</span><span>Schedule</span><span>Last</span><span>Drift</span><span>Status</span>
          </div>
          {backupJobs.map((b) => (
            <div key={b.scope} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr .8fr .6fr .8fr', gap: 10, padding: '11px 2px', borderBottom: '1px solid #141C2E', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{b.scope}</div>
                <div style={{ fontSize: 10, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{b.target}</div>
              </div>
              <span style={{ fontSize: 11.5, color: '#9DA9C0' }}>{b.schedule}</span>
              <span style={{ fontSize: 11.5, color: '#9DA9C0', fontFamily: 'IBM Plex Mono' }}>{b.last}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: b.driftColor }}>{b.drift}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: b.statusColor }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.statusColor }} />{b.status}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1B2740' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={sectionTitle}>Config Diff</div>
              <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 500 }}>drift detected</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono', marginTop: 4 }}>{diffMeta}</div>
          </div>
          <div style={{ padding: '12px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11.5, lineHeight: 1.7, overflowX: 'auto' }}>
            {diffLines.map((l, i) => (
              <div key={i} style={{ whiteSpace: 'pre', background: l.bg, color: l.c, padding: '0 6px', borderRadius: 3 }}>{l.row}</div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1B2740', padding: '12px 16px', display: 'flex', gap: 8 }}>
            <button className="btn-h" style={{ flex: 1, background: '#34D399', color: '#06251A', border: 'none', borderRadius: 8, padding: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Restore Baseline</button>
            <button className="btn-h" style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 8, padding: '8px 13px', fontWeight: 500, fontSize: 12, cursor: 'pointer' }}>Approve Change</button>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Recent Backups</div>
          <span style={{ fontSize: 11.5, color: '#7A88A3' }}>stored to Git + HashiCorp Vault object store</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .7fr .7fr .8fr 1.1fr', gap: 12, padding: '0 4px 10px', borderBottom: '1px solid #1B2740', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
          <span>Device</span><span>Trigger</span><span>Size</span><span>Version</span><span>When</span><span />
        </div>
        {recentBackups.map((r) => (
          <div key={r.device} className="row-h" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .7fr .7fr .8fr 1.1fr', gap: 12, padding: '11px 4px', borderBottom: '1px solid #141C2E', alignItems: 'center', transition: 'background .12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: r.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon d={r.icon} size={13} stroke={r.iconFg} width={2} />
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.device}</span>
            </div>
            <span style={{ fontSize: 11.5, color: '#9DA9C0' }}>{r.trigger}</span>
            <span style={{ fontSize: 11.5, color: '#9DA9C0', fontFamily: 'IBM Plex Mono' }}>{r.size}</span>
            <span style={{ fontSize: 11.5, color: '#C7D3EA', fontFamily: 'IBM Plex Mono' }}>{r.version}</span>
            <span style={{ fontSize: 11.5, color: '#5C6B85' }}>{r.time}</span>
            <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
              <span className="copy-h" style={{ fontSize: 11, color: '#5E9BFF', fontWeight: 500, cursor: 'pointer' }}>Diff</span>
              <span className="copy-h" style={{ fontSize: 11, color: '#9DA9C0', fontWeight: 500, cursor: 'pointer' }}>Restore</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
