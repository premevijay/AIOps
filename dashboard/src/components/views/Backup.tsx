import { useEffect, useMemo, useState } from 'react'
import { latestResults, recentResults, statusColor, relativeTime, type ResultRecord } from '../../resultsApi'
import { Icon } from '../../charts'
import { card, sectionTitle } from '../ui'

const BACKUP_OPS = new Set(['backup', 'get_config'])

export function Backup() {
  const [records, setRecords] = useState<ResultRecord[]>([])
  const [recent, setRecent] = useState<ResultRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [latest, activity] = await Promise.all([
          latestResults(),
          recentResults({ op: 'backup', limit: 20 }),
        ])
        if (!alive) return
        setRecords(latest.filter((r) => BACKUP_OPS.has(r.op)))
        setRecent(activity)
        setError(null)
      } catch {
        if (alive) setError('Results store unreachable — is it running?')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const kpis = useMemo(() => {
    const devices = new Set(records.map((r) => r.device))
    const drift = records.filter((r) => r.status === 'changed' || r.status === 'drift').length
    const failed = records.filter((r) => r.status === 'failed').length
    const newest = records.reduce<string | null>((acc, r) => (acc == null || r.ts > acc ? r.ts : acc), null)
    return [
      { label: 'Devices captured', value: String(devices.size), color: '#5E9BFF', sub: 'distinct devices backed up' },
      { label: 'Drift detected', value: String(drift), color: '#FBBF24', sub: 'config changed since baseline' },
      { label: 'Failed', value: String(failed), color: '#F87171', sub: 'backup / get_config errors' },
      { label: 'Last run', value: newest ? relativeTime(newest) : '—', color: '#A78BFA', sub: 'most recent capture' },
    ]
  }, [records])

  // Latest record per device for the main table.
  const byDevice = useMemo(() => {
    const map = new Map<string, ResultRecord>()
    for (const r of records) {
      const cur = map.get(r.device)
      if (!cur || r.ts > cur.ts) map.set(r.device, r)
    }
    return Array.from(map.values()).sort((a, b) => (a.ts < b.ts ? 1 : -1))
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
          <div style={sectionTitle}>Backup Results</div>
          <span style={{ fontSize: 11.5, color: '#7A88A3' }}>live · results store</span>
        </div>

        {loading && <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>Loading backup results…</div>}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,.08)', border: '1px solid #3A1D24', borderRadius: 10, padding: '12px 14px' }}>
            <Icon d="M12 9v4M12 17v0M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" size={15} stroke="#F87171" width={2} />
            {error}
          </div>
        )}

        {!loading && !error && byDevice.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#7A88A3', padding: '12px 2px' }}>No backup results yet — run a backup job to populate this view.</div>
        )}

        {!loading && !error && byDevice.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr 2fr .8fr', gap: 12, padding: '0 4px 10px', borderBottom: '1px solid #1B2740', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600 }}>
              <span>Device</span><span>Status</span><span>Summary</span><span>When</span>
            </div>
            {byDevice.map((r) => {
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

      {!loading && !error && recent.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitle}>Recent activity</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>live · results store</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recent.map((r) => {
              const sc = statusColor(r.status)
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: '1px solid #141C2E' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flex: 'none' }} />
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11.5, color: '#C7D3EA', width: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.device}</span>
                  <span style={{ flex: 1, fontSize: 11.5, color: '#9DA9C0', minWidth: 0 }}>{r.summary}</span>
                  <span style={{ fontSize: 11, color: '#5C6B85' }} title={r.ts}>{relativeTime(r.ts)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
