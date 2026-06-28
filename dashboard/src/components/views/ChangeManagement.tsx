import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listChanges, createChange, approveChange, rejectChange, applyChange,
  type Change, type ChangeStatus, type RiskLevel, type ChangeDevice,
} from '../../changeApi'
import { devices } from '../../data'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

// Status / risk color tokens (on-theme with the rest of the dashboard).
const statusColor: Record<ChangeStatus, string> = {
  proposed: '#FBBF24',
  approved: '#5E9BFF',
  applied: '#34D399',
  rejected: '#F87171',
  failed: '#F87171',
}
const riskColor: Record<RiskLevel, string> = {
  low: '#34D399',
  medium: '#FBBF24',
  high: '#F87171',
  critical: '#F87171',
}

// Map the prototype devices to a change-service device payload. os is inferred
// from vendor; mgmt_host is a prototype placeholder.
function vendorOs(vendor: string): string {
  const v = vendor.toLowerCase()
  if (v.includes('nexus')) return 'nxos'
  if (v.includes('palo')) return 'panos'
  if (v.includes('forti')) return 'fortios'
  if (v.includes('f5')) return 'tmos'
  if (v.includes('check point')) return 'gaia'
  if (v.includes('ftd')) return 'ftd'
  if (v.includes('avi')) return 'avi'
  return 'ios'
}
function devicePayload(name: string): ChangeDevice {
  const d = devices.find((x) => x.name === name)
  return {
    name,
    vendor: d?.vendor ?? 'Cisco',
    os: vendorOs(d?.vendor ?? ''),
    mgmt_host: '10.10.10.11',
  }
}

const inputStyle: React.CSSProperties = {
  background: '#0A0F1E',
  border: '1px solid #1B2740',
  borderRadius: 8,
  color: '#E6ECF5',
  fontSize: 12.5,
  padding: '8px 10px',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#7A88A3', marginBottom: 5 }

export function ChangeManagement({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await listChanges()
      setChanges(list)
      setError(null)
      onPendingCount?.(list.filter((c) => c.status === 'proposed').length)
    } catch {
      setError('Change service unreachable — is it running?')
    } finally {
      setLoading(false)
    }
  }, [onPendingCount])

  useEffect(() => { void refresh() }, [refresh])

  const counts = useMemo(() => {
    const by = (s: ChangeStatus) => changes.filter((c) => c.status === s).length
    return { proposed: by('proposed'), approved: by('approved'), applied: by('applied') }
  }, [changes])

  const kpis = [
    { label: 'Pending Approval', value: String(counts.proposed), color: '#FBBF24', sub: 'awaiting operator sign-off' },
    { label: 'Approved', value: String(counts.approved), color: '#5E9BFF', sub: 'ready to apply' },
    { label: 'Applied', value: String(counts.applied), color: '#34D399', sub: 'pushed to device' },
    { label: 'Total', value: String(changes.length), color: '#A78BFA', sub: 'all change requests' },
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

      <ProposeForm onCreated={refresh} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Change Requests</div>
          <span style={{ fontSize: 11.5, color: '#7A88A3' }}>live · change service</span>
        </div>

        {loading && <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>Loading change requests…</div>}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,.08)', border: '1px solid #3A1D24', borderRadius: 10, padding: '12px 14px' }}>
            <Icon d="M12 9v4M12 17v0M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" size={15} stroke="#F87171" width={2} />
            {error}
          </div>
        )}

        {!loading && !error && changes.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>No change requests yet — propose one above.</div>
        )}

        {!loading && !error && changes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {changes.map((c) => (
              <ChangeCard key={c.id} c={c} onChanged={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProposeForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [deviceName, setDeviceName] = useState(devices[0]?.name ?? '')
  const [intent, setIntent] = useState('')
  const [config, setConfig] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!intent.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      const lines = config.split('\n').map((l) => l.trim()).filter(Boolean)
      await createChange({
        device: devicePayload(deviceName),
        intent: intent.trim(),
        config: lines,
        requested_by: 'dashboard',
      })
      setIntent('')
      setConfig('')
      await onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to propose change')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <div style={{ ...sectionTitle, marginBottom: 14 }}>Propose change</div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'start' }}>
        <div>
          <div style={labelStyle}>Device</div>
          <select value={deviceName} onChange={(e) => setDeviceName(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {devices.map((d) => (
              <option key={d.name} value={d.name} style={{ background: '#0A0F1E' }}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Intent</div>
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. Harden SNMP community"
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={labelStyle}>Config (one line per command)</div>
        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          placeholder={'snmp-server community netopsRO RO\nno snmp-server community public'}
          rows={3}
          style={{ ...inputStyle, fontFamily: 'IBM Plex Mono', fontSize: 12, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
      {err && <div style={{ fontSize: 11.5, color: '#F87171', marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          className="btn-h"
          onClick={submit}
          disabled={busy || !intent.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 12, cursor: busy || !intent.trim() ? 'not-allowed' : 'pointer', opacity: busy || !intent.trim() ? 0.6 : 1 }}
        >
          <Icon d="M12 5v14M5 12h14" size={13} stroke="currentColor" width={2.4} />
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

function ChangeCard({ c, onChanged }: { c: Change; onChanged: () => Promise<void> }) {
  const [showAudit, setShowAudit] = useState(false)
  const [approver, setApprover] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const shortId = c.id.length > 12 ? c.id.slice(0, 8) : c.id
  const sc = statusColor[c.status]
  const rc = riskColor[c.risk.level]

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const needsApprover = c.status === 'proposed'
  const result = c.result as { ok?: boolean; status?: string } | null | undefined

  return (
    <div style={{ background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#5E9BFF', background: 'rgba(94,155,255,.1)', padding: '2px 7px', borderRadius: 5 }}>{shortId}</span>
        <span style={{ fontSize: 11.5, color: '#9DA9C0', fontFamily: 'IBM Plex Mono' }}>{c.device.name}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: `${rc}1A`, padding: '2px 8px', borderRadius: 5 }}>{c.risk.level} · {c.risk.score}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: sc }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc }} />{c.status}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{c.intent}</div>

      {/* policy verdict */}
      <div style={{ fontSize: 11.5, marginBottom: 8 }}>
        {c.policy.allow ? (
          <span style={{ color: '#34D399' }}>policy ✓ allowed</span>
        ) : (
          <span style={{ color: '#F87171' }}>
            policy ✕ denied{c.policy.violations.length > 0 ? `: ${c.policy.violations.join('; ')}` : ''}
          </span>
        )}
        {c.risk.factors.length > 0 && (
          <span style={{ color: '#5C6B85' }}> · {c.risk.factors.join(' · ')}</span>
        )}
      </div>

      {/* config lines */}
      {c.config.length > 0 && (
        <pre style={{ margin: '0 0 10px', background: '#070B14', border: '1px solid #141C2E', borderRadius: 8, padding: '8px 10px', fontFamily: 'IBM Plex Mono', fontSize: 11.5, color: '#9DCBFF', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          {c.config.join('\n')}
        </pre>
      )}

      {/* result (after apply) */}
      {result && (result.ok != null || result.status != null) && (
        <div style={{ fontSize: 11.5, marginBottom: 8, color: result.ok === false || c.status === 'failed' ? '#F87171' : '#34D399' }}>
          result: {result.ok != null ? (result.ok ? 'ok' : 'failed') : ''}{result.status ? ` · ${result.status}` : ''}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>
        <span>{c.requested_by}</span>
        {c.window && <span>· {c.window}</span>}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowAudit((s) => !s)}
          style={{ background: 'none', border: 'none', color: '#7A88A3', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          {showAudit ? 'Hide' : 'Audit'} ({c.audit.length})
        </button>
      </div>

      {showAudit && c.audit.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #141C2E', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {c.audit.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: '#9DA9C0', fontFamily: 'IBM Plex Mono', lineHeight: 1.5 }}>
              <span style={{ color: '#5C6B85' }}>{a.ts}</span> · <span style={{ color: '#5E9BFF' }}>{a.actor}</span> · <span style={{ color: '#C7D3EA' }}>{a.action}</span>
              {a.detail ? ` · ${a.detail}` : ''}
            </div>
          ))}
        </div>
      )}

      {err && <div style={{ fontSize: 11, color: '#F87171', marginTop: 8 }}>{err}</div>}

      {/* actions by status */}
      {(c.status === 'proposed' || c.status === 'approved') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {needsApprover && (
            <input
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="approver"
              style={{ ...inputStyle, width: 140, padding: '7px 10px' }}
            />
          )}
          {c.status === 'proposed' && (
            <>
              <button
                className="btn-h"
                disabled={busy || !approver.trim()}
                onClick={() => run(() => approveChange(c.id, approver.trim()))}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#34D399', color: '#06251A', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: busy || !approver.trim() ? 'not-allowed' : 'pointer', opacity: busy || !approver.trim() ? 0.6 : 1 }}
              >
                <Icon d="M20 6L9 17l-5-5" size={13} stroke="currentColor" width={2.4} />Approve
              </button>
              <button
                className="btn-h"
                disabled={busy || !approver.trim()}
                onClick={() => run(() => rejectChange(c.id, approver.trim(), 'rejected from dashboard'))}
                style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 8, padding: '8px 14px', fontWeight: 500, fontSize: 12, cursor: busy || !approver.trim() ? 'not-allowed' : 'pointer', opacity: busy || !approver.trim() ? 0.6 : 1 }}
              >
                Reject
              </button>
            </>
          )}
          {c.status === 'approved' && (
            <button
              className="btn-h"
              disabled={busy}
              onClick={() => run(() => applyChange(c.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              <Icon d="M5 3l14 9-14 9V3z" size={12} stroke="currentColor" width={2} />Apply
            </button>
          )}
        </div>
      )}
    </div>
  )
}
