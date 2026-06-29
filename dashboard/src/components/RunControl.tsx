import { useEffect, useState } from 'react'
import { listDevices, runJob, type Device, type JobResult } from '../deviceApi'
import { Icon } from '../charts'

// A small "run a capability job now" control: pick a managed device, hit Run,
// the supervisor dispatches the job to the worker, and on completion we refresh
// the view (so the new result shows up). Used by Backup / Compliance / Health.
//
//   op    — the capability to run (backup | health | compliance | get_config)
//   label — button text, e.g. "Run backup"
//   onDone — called after a job finishes so the parent can refetch results
export function RunControl({ op, label, onDone }: { op: string; label: string; onDone: () => void }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [device, setDevice] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    listDevices()
      .then((ds) => {
        if (!alive) return
        setDevices(ds)
        setDevice((d) => d || ds[0]?.name || '')
      })
      .catch(() => { /* supervisor down — leave the picker empty, button disabled */ })
    return () => { alive = false }
  }, [])

  async function run() {
    if (!device || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r: JobResult = await runJob(op, device)
      setMsg({
        ok: r.ok,
        text: r.ok
          ? `${op} on ${device} ok${r.duration_ms != null ? ` · ${r.duration_ms}ms` : ''}`
          : `${op} on ${device} failed: ${r.error ?? 'unknown error'}`,
      })
      onDone()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'request failed' })
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || !device

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <select
        value={device}
        onChange={(e) => setDevice(e.target.value)}
        disabled={busy}
        style={{ background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 8, color: '#E6ECF5', fontSize: 12.5, padding: '7px 10px', outline: 'none', fontFamily: 'inherit', cursor: busy ? 'not-allowed' : 'pointer' }}
      >
        {devices.length === 0 && <option value="">no devices</option>}
        {devices.map((d) => (
          <option key={d.name} value={d.name} style={{ background: '#0A0F1E' }}>{d.name}</option>
        ))}
      </select>
      <button
        className="btn-h"
        onClick={run}
        disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        <Icon d="M5 3l14 9-14 9V3z" size={12} stroke="currentColor" width={2} />
        {busy ? 'Running…' : label}
      </button>
      {msg && (
        <span style={{ fontSize: 11.5, color: msg.ok ? '#34D399' : '#F87171' }}>{msg.text}</span>
      )}
    </div>
  )
}
