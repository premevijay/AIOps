import { useState } from 'react'
import { monTabDefs, metByTab, synthetics, alerts, type MonTab, type AlertStatus } from '../../data'
import { Area, MiniBars, Icon } from '../../charts'
import { card, sectionTitle } from '../ui'
import { GrafanaPanel } from '../GrafanaPanel'

export function Monitoring({ monTab, setMonTab }: { monTab: MonTab; setMonTab: (t: MonTab) => void }) {
  const metrics = metByTab[monTab]
  const [alertState, setAlertState] = useState<AlertStatus[]>(() => alerts.map(() => 'active'))
  const setStatus = (i: number, s: AlertStatus) => setAlertState((prev) => prev.map((v, j) => (j === i ? s : v)))
  const activeCount = alertState.filter((s) => s === 'active').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Live telemetry — embedded Grafana panels (netops-overview) */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Live telemetry (Grafana)</div>
          <span style={{ fontSize: 11.5, color: '#7A88A3' }}>netops-overview · panels 1–3</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <GrafanaPanel panelId={1} title="Interface throughput" />
          <GrafanaPanel panelId={2} title="Interface status" />
          <GrafanaPanel panelId={3} title="Reachability" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {monTabDefs.map(([id, label]) => {
          const active = monTab === id
          return (
            <div
              key={id}
              className="chip-h"
              onClick={() => setMonTab(id)}
              style={{
                border: `1px solid ${active ? '#3A4D72' : '#1B2740'}`,
                background: active ? 'rgba(94,155,255,.12)' : 'transparent',
                color: active ? '#E6ECF5' : '#9DA9C0',
                borderRadius: 8, padding: '8px 15px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {label}
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#7A88A3' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'pulseDot 2s infinite' }} />
          Live · SNMP poll 30s
        </div>
      </div>

      {/* SNMP metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ ...card, borderRadius: 13, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#9DA9C0' }}>{m.label}</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: m.color }}>{m.value}</span>
            </div>
            <div><Area data={m.data} color={m.color} /></div>
            <div style={{ fontSize: 10.5, color: '#5C6B85', marginTop: 8, fontFamily: 'IBM Plex Mono' }}>{m.foot}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* synthetic monitors */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div style={sectionTitle}>Synthetic Monitors</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>12 probes · 5 vantage points</span>
          </div>
          {synthetics.map((s) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderBottom: '1px solid #141C2E' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{s.target}</div>
              </div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}><MiniBars data={s.bars} color={s.color} /></div>
              <div style={{ textAlign: 'right', width: 70 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: s.color }}>{s.latency}</div>
                <div style={{ fontSize: 10, color: '#5C6B85' }}>{s.uptime}</div>
              </div>
            </div>
          ))}
        </div>

        {/* alerts */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={sectionTitle}>Active Alerts</div>
            <span style={{ fontSize: 11.5, color: '#7A88A3' }}>{activeCount} active</span>
          </div>
          {alerts.map((a, i) => {
            const status = alertState[i]
            const muted = status !== 'active'
            return (
              <div key={i} style={{ padding: 11, borderRadius: 10, marginBottom: 8, background: muted ? '#0A0F1E' : a.bg, border: `1px solid ${muted ? '#1B2740' : a.bd}`, opacity: muted ? 0.7 : 1 }}>
                <div style={{ display: 'flex', gap: 11 }}>
                  <Icon d={a.icon} size={16} stroke={muted ? '#5C6B85' : a.fg} width={2} style={{ flex: 'none', marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#7A88A3', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{a.meta}</div>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#5C6B85', whiteSpace: 'nowrap' }}>{a.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, paddingLeft: 27 }}>
                  {status === 'active' ? (
                    <>
                      <button className="btn-h" onClick={() => setStatus(i, 'acked')} style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 7, padding: '4px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Acknowledge</button>
                      <button className="btn-h" onClick={() => setStatus(i, 'snoozed')} style={{ background: 'transparent', color: '#9DA9C0', border: '1px solid #26324B', borderRadius: 7, padding: '4px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Snooze</button>
                    </>
                  ) : (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: status === 'acked' ? '#34D399' : '#A78BFA' }}>
                        <Icon d={status === 'acked' ? 'M20 6L9 17l-5-5' : 'M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} size={13} stroke="currentColor" width={2.2} />
                        {status === 'acked' ? 'Acknowledged' : 'Snoozed 1h'}
                      </span>
                      <button className="btn-h" onClick={() => setStatus(i, 'active')} style={{ background: 'transparent', color: '#5C6B85', border: 'none', borderRadius: 7, padding: '4px 6px', fontSize: 11, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>undo</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
