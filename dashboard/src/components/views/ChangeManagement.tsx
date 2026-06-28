import { riskColor, changeStatusColor, type ChangeRequest, type AuditEntry } from '../../data'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

export function ChangeManagement({
  changes,
  audit,
  onApprove,
  onReject,
}: {
  changes: ChangeRequest[]
  audit: AuditEntry[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const pending = changes.filter((c) => c.status === 'Pending').length
  const scheduled = changes.filter((c) => c.status === 'Scheduled' || c.status === 'Approved').length
  const applied = changes.filter((c) => c.status === 'Applied').length

  const kpis = [
    { label: 'Pending Approval', value: String(pending), color: '#FBBF24', sub: 'awaiting operator sign-off' },
    { label: 'Scheduled', value: String(scheduled), color: '#A78BFA', sub: 'queued for change window' },
    { label: 'Applied (24h)', value: String(applied), color: '#34D399', sub: 'staged via Vault' },
    { label: 'Rollback Ready', value: '100%', color: '#5E9BFF', sub: 'golden config per change' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: '#7A88A3', marginBottom: 9 }}>{k.label}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 26, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#5C6B85', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* change queue */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitle}>Change Requests</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>agent-proposed & operator-raised</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {changes.map((c) => (
              <ChangeCard key={c.id} c={c} onApprove={() => onApprove(c.id)} onReject={() => onReject(c.id)} />
            ))}
          </div>
        </div>

        {/* audit trail */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 14 }}>Audit Trail</div>
          <div style={{ position: 'relative', paddingLeft: 6 }}>
            {audit.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i === audit.length - 1 ? 0 : 16, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color, marginTop: 4, boxShadow: `0 0 0 3px ${a.color}22` }} />
                  {i !== audit.length - 1 && <span style={{ flex: 1, width: 1, background: '#1B2740', marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 2 }}>
                  <div style={{ fontSize: 12.5, color: '#C7D3EA', lineHeight: 1.45 }}>{a.text}</div>
                  <div style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono', marginTop: 3 }}>{a.actor} · {a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangeCard({ c, onApprove, onReject }: { c: ChangeRequest; onApprove: () => void; onReject: () => void }) {
  const decided = c.status !== 'Pending'
  return (
    <div style={{ background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#5E9BFF', background: 'rgba(94,155,255,.1)', padding: '2px 7px', borderRadius: 5 }}>{c.id}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: c.source === 'Agent' ? '#A78BFA' : '#9DA9C0' }}>
          {c.source === 'Agent' && <Icon d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z" size={11} stroke="#A78BFA" width={2} />}
          {c.source}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: riskColor[c.risk], background: `${riskColor[c.risk]}1A`, padding: '2px 8px', borderRadius: 5 }}>{c.risk} risk</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: changeStatusColor[c.status] }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: changeStatusColor[c.status] }} />{c.status}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{c.title}</div>
      <div style={{ fontSize: 12, color: '#9DA9C0', lineHeight: 1.5, marginBottom: 10 }}>{c.summary}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon d="M3 7h18v4H3zM3 13h18v4H3z" size={12} stroke="#5C6B85" width={2} />{c.device}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={12} stroke="#5C6B85" width={2} />{c.window}</span>
        <div style={{ flex: 1 }} />
        <span>{c.requested}</span>
      </div>
      {!decided && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-h" onClick={onApprove} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#34D399', color: '#06251A', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            <Icon d="M20 6L9 17l-5-5" size={13} stroke="currentColor" width={2.4} />
            Approve & Stage to Vault
          </button>
          <button className="btn-h" onClick={onReject} style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 8, padding: '8px 14px', fontWeight: 500, fontSize: 12, cursor: 'pointer' }}>Reject</button>
        </div>
      )}
    </div>
  )
}
