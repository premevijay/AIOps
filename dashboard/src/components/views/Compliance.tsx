import { useEffect, useMemo, useState } from 'react'
import { latestResults, statusColor, relativeTime, type ResultRecord } from '../../resultsApi'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

export function Compliance() {
  const [records, setRecords] = useState<ResultRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const latest = await latestResults()
        if (!alive) return
        setRecords(latest.filter((r) => r.op === 'compliance'))
        setError(null)
      } catch {
        if (alive) setError('Results store unreachable — is it running?')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const rows = useMemo(
    () => [...records].sort((a, b) => (a.ts < b.ts ? 1 : -1)),
    [records],
  )

  const kpis = useMemo(() => {
    const compliant = records.filter((r) => r.status === 'compliant').length
    const nonCompliant = records.filter((r) => r.status === 'non-compliant').length
    const failed = records.filter((r) => r.status === 'failed').length
    const devices = new Set(records.map((r) => r.device))
    return [
      { label: 'Compliant', value: String(compliant), color: '#34D399', sub: 'devices passing policy' },
      { label: 'Non-compliant', value: String(nonCompliant), color: '#F87171', sub: 'policy violations found' },
      { label: 'Failed scans', value: String(failed), color: '#FBBF24', sub: 'scan could not complete' },
      { label: 'Devices scanned', value: String(devices.size), color: '#A78BFA', sub: 'distinct devices' },
    ]
  }, [records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {!loading && !error && records.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: '#7A88A3', marginBottom: 9 }}>{k.label}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 26, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#5C6B85', marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Compliance Results</div>
          <span style={{ fontSize: 11.5, color: '#7A88A3' }}>live · results store</span>
        </div>

        {loading && <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>Loading compliance results…</div>}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,.08)', border: '1px solid #3A1D24', borderRadius: 10, padding: '12px 14px' }}>
            <Icon d="M12 9v4M12 17v0M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" size={15} stroke="#F87171" width={2} />
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>No compliance results yet — run a compliance scan to populate this view.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr 2fr .8fr', gap: 12, padding: '0 4px 10px', borderBottom: '1px solid #1B2740', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
              <span>Device</span><span>Status</span><span>Summary</span><span>When</span>
            </div>
            {rows.map((r) => {
              const sc = statusColor(r.status)
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr 2fr .8fr', gap: 12, padding: '11px 4px', borderBottom: '1px solid #141C2E', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#E6ECF5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.device}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: sc }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flex: 'none' }} />{r.status}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#9DA9C0' }}>{r.summary}</span>
                  <span style={{ fontSize: 11.5, color: '#5C6B85' }} title={r.ts}>{relativeTime(r.ts)}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
