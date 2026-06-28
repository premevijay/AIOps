import { useEffect, useRef, useState } from 'react'
import { vendorCatalog, flatVendors, capDefs, stepLabels, onbSubtitles, type Vendor } from '../data'
import { Icon } from '../charts'

type CapKey = 'B' | 'C' | 'H' | 'M' | 'A'
interface OnbState {
  host: string
  port: string
  protocol: string
  site: string
  region: string
  vault: string
  vaultPath: string
  auth: string
  caps: Record<CapKey, boolean>
}
// Example management IP — used as the host placeholder and as the fallback
// in the verify summary when the operator hasn't typed one yet.
const DEFAULT_HOST = '10.40.12.5'

const initial: OnbState = {
  host: '', port: '22', protocol: 'SSH', site: '', region: 'NA', vault: 'CyberArk', vaultPath: '', auth: 'AppRole',
  caps: { B: true, C: true, H: true, M: true, A: true },
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E9BFF" strokeWidth="2.4" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 11-6.2-8.5" strokeLinecap="round" />
    </svg>
  )
}
function CheckMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
  )
}
function EmptyDot() {
  return <span style={{ display: 'block', width: 9, height: 9, borderRadius: '50%', border: '2px solid #26324B', margin: 5 }} />
}

export function OnboardingWizard({ onClose, onComplete }: { onClose: () => void; onComplete?: (vendor: Vendor, onb: OnbState) => void }) {
  const [step, setStep] = useState(0)
  const [vendor, setVendor] = useState<string | null>(null)
  const [onb, setOnb] = useState<OnbState>(initial)
  const [testIdx, setTestIdx] = useState(-1)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const curV: Partial<Vendor> = flatVendors.find((v) => v.id === vendor) ?? {}
  const setField = <K extends keyof OnbState>(k: K, val: OnbState[K]) => setOnb((s) => ({ ...s, [k]: val }))
  const toggleCap = (k: CapKey) => setOnb((s) => ({ ...s, caps: { ...s.caps, [k]: !s.caps[k] } }))

  function pickVendor(v: Vendor) {
    setVendor(v.id)
    setOnb((s) => ({ ...s, port: v.defPort, protocol: v.defProto, vaultPath: 'secret/net/' + v.id + '/' }))
  }
  function runTest() {
    setTestIdx(-1)
    timers.current.forEach(clearTimeout)
    timers.current = []
    let acc = 300
    for (let i = 0; i < 5; i++) {
      timers.current.push(setTimeout(() => setTestIdx(i), acc))
      acc += 750
    }
  }
  function back() {
    if (step > 0) setStep(step - 1)
  }
  function next() {
    if (step === 0 && !vendor) return
    if (step < 4) {
      const n = step + 1
      setStep(n)
      if (n === 4) runTest()
      return
    }
    const fullVendor = flatVendors.find((v) => v.id === vendor)
    if (fullVendor && onComplete) onComplete(fullVendor, onb)
    else onClose()
  }

  const capCount = Object.values(onb.caps).filter(Boolean).length
  const nextEnabled = !(step === 0 && !vendor)
  const nextLabel = step === 4 ? 'Onboard Device' : step === 3 ? 'Test Connection' : 'Continue'

  // segmented control factory
  const seg = (opts: string[], cur: string, setter: (o: string) => void) =>
    opts.map((o) => (
      <div
        key={o}
        onClick={() => setter(o)}
        style={{
          flex: 1, textAlign: 'center', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
          border: `1px solid ${cur === o ? '#3A4D72' : '#26324B'}`,
          background: cur === o ? 'rgba(94,155,255,.12)' : 'transparent',
          color: cur === o ? '#E6ECF5' : '#9DA9C0',
        }}
      >
        {o}
      </div>
    ))

  const testLabels: [string, string][] = [
    ['Reachability probe', 'ICMP + TCP/' + onb.port],
    ['Fetch short-lived secret', 'vault.read'],
    ['Authenticate session', onb.protocol + ' · ' + onb.auth],
    ['Driver handshake & capability probe', (curV.name || '') + ' driver'],
    ['Pull baseline config to Vault store', capCount + ' caps armed'],
  ]
  const testDone = testIdx >= 4

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,7,14,.7)', backdropFilter: 'blur(2px)', zIndex: 40 }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 660, maxHeight: '88vh', background: '#0B1020', border: '1px solid #26324B', borderRadius: 18, zIndex: 41, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        {/* header / stepper */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #182238' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d="M12 5v14M5 12h14" size={17} stroke="#fff" width={2.2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16 }}>Onboard Device</div>
              <div style={{ fontSize: 11.5, color: '#5C6B85' }}>{onbSubtitles[step]}</div>
            </div>
            <div onClick={onClose} style={{ cursor: 'pointer', color: '#7A88A3', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {stepLabels.map((label, i) => {
              const done = i < step, act = i === step
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, fontFamily: 'IBM Plex Mono', flex: 'none', background: done ? '#5E9BFF' : act ? 'rgba(94,155,255,.15)' : '#0E1426', color: done ? '#06122B' : act ? '#5E9BFF' : '#5C6B85', border: `1px solid ${act || done ? '#5E9BFF' : '#26324B'}` }}>
                    {done ? '✓' : String(i + 1)}
                  </span>
                  {act && <span style={{ fontSize: 11, color: '#E6ECF5', whiteSpace: 'nowrap' }}>{label}</span>}
                  {i !== 4 && <span style={{ flex: 1, height: 1, background: done ? '#5E9BFF' : '#26324B' }} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          {step === 0 && <VendorStep vendor={vendor} pickVendor={pickVendor} />}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: curV.iconBg || '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon d={curV.icon || ''} size={13} stroke={curV.iconFg || '#5E9BFF'} width={2} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{curV.name || '—'}</span>
                <span style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{curV.proto || ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Management host / IP" value={onb.host} onChange={(v) => setField('host', v)} placeholder={DEFAULT_HOST} />
                <Field label="Port" value={onb.port} onChange={(v) => setField('port', v)} />
              </div>
              <div>
                <FieldLabel>Transport</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>{seg(['SSH', 'REST', 'HTTPS'], onb.protocol, (o) => setField('protocol', o))}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Site" value={onb.site} onChange={(v) => setField('site', v)} placeholder="NYC-DC1" />
                <div>
                  <FieldLabel>Region</FieldLabel>
                  <div style={{ display: 'flex', gap: 6 }}>{seg(['NA', 'EMEA', 'APAC', 'LATAM'], onb.region, (o) => setField('region', o))}</div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: '#9DA9C0' }}>Credentials are never stored in Aether. At connect time the agent fetches a short-lived secret from your vault and discards it after the session.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                {[{ name: 'CyberArk', engine: 'Conjur / CCP' }, { name: 'HashiCorp Vault', engine: 'KV v2 / SSH engine' }].map((o) => {
                  const checked = onb.vault === o.name
                  return (
                    <div key={o.name} onClick={() => setField('vault', o.name)} style={{ padding: 14, borderRadius: 11, cursor: 'pointer', border: `1px solid ${checked ? '#3A4D72' : '#1B2740'}`, background: checked ? 'rgba(94,155,255,.08)' : '#0E1426' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#15233A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={checked ? '#34D399' : '#7A88A3'} strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</span>
                        {checked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5E9BFF" strokeWidth="2.4" style={{ marginLeft: 'auto' }}><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <div style={{ fontSize: 11, color: '#7A88A3' }}>{o.engine}</div>
                    </div>
                  )
                })}
              </div>
              <Field label="Secret path" value={onb.vaultPath} onChange={(v) => setField('vaultPath', v)} />
              <div>
                <FieldLabel>Auth method</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>{seg(['AppRole', 'Token', 'Certificate'], onb.auth, (o) => setField('auth', o))}</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 12.5, color: '#9DA9C0', marginBottom: 14 }}>Choose which operations Aether will run on this device. You can change these anytime.</div>
              {capDefs.map(([k, name, iconPath, col, desc]) => {
                const on = onb.caps[k as CapKey]
                return (
                  <div key={k} onClick={() => toggleCap(k as CapKey)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', border: `1px solid ${on ? '#26324B' : '#1B2740'}`, background: on ? 'rgba(94,155,255,.04)' : 'transparent', borderRadius: 11, marginBottom: 9, cursor: 'pointer' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: on ? 'rgba(94,155,255,.08)' : '#0E1426', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon d={iconPath} size={16} stroke={on ? col : '#5C6B85'} width={2} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#5C6B85' }}>{desc}</div>
                    </div>
                    <div style={{ width: 38, height: 21, borderRadius: 12, background: on ? col : '#26324B', position: 'relative', flex: 'none', transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 2, [on ? 'right' : 'left']: 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'all .15s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ fontSize: 12.5, color: '#9DA9C0', marginBottom: 16 }}>Verifying the connection end-to-end before onboarding.</div>
              <div style={{ background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 11, padding: '6px 16px' }}>
                {testLabels.map(([label, detail], i) => {
                  let indicator: React.ReactNode, tc = '#9DA9C0', d = detail
                  if (i <= testIdx) { indicator = <CheckMark />; tc = '#E6ECF5'; d = i === 0 ? '14ms' : detail }
                  else if (i === testIdx + 1) { indicator = <Spinner />; tc = '#9DA9C0'; d = '…' }
                  else { indicator = <EmptyDot />; tc = '#5C6B85'; d = '…' }
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid #141C2E' }}>
                      <div style={{ width: 20, height: 20, flex: 'none' }}>{indicator}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: tc }}>{label}</div></div>
                      <span style={{ fontSize: 11, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{d}</span>
                    </div>
                  )
                })}
              </div>
              {testDone && (
                <div style={{ marginTop: 16, background: 'linear-gradient(100deg,rgba(52,211,153,.1),transparent)', border: '1px solid #1E3A30', borderRadius: 11, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" /></svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#34D399' }}>Connection verified</div>
                    <div style={{ fontSize: 11.5, color: '#9DA9C0' }}>{curV.name || '—'} at {onb.host || DEFAULT_HOST} is ready to onboard with {capCount} capabilities enabled.</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #182238', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={back} style={{ padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #26324B', color: step === 0 ? '#3A4659' : '#C7D3EA', background: 'transparent' }}>Back</div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>Step {step + 1} of 5</span>
          <button className="btn-h" onClick={next} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: nextEnabled ? 'pointer' : 'not-allowed', border: 'none', background: nextEnabled ? '#5E9BFF' : '#1B2740', color: nextEnabled ? '#06122B' : '#5C6B85' }}>
            {nextLabel}
          </button>
        </div>
      </div>
    </>
  )
}

function VendorStep({ vendor, pickVendor }: { vendor: string | null; pickVendor: (v: Vendor) => void }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#9DA9C0', marginBottom: 16 }}>Select the platform you're connecting. Each vendor uses a purpose-built driver under the hood.</div>
      {vendorCatalog.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#5C6B85', fontWeight: 600, marginBottom: 10 }}>{g.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            {g.items.map((v) => {
              const checked = vendor === v.id
              return (
                <div key={v.id} className="row-h" onClick={() => pickVendor(v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${checked ? '#3A4D72' : '#1B2740'}`, background: checked ? 'rgba(94,155,255,.1)' : '#0E1426', transition: 'background .12s' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: v.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon d={v.icon} size={15} stroke={v.iconFg} width={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontSize: 10.5, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{v.proto}</div>
                  </div>
                  {checked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E9BFF" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#7A88A3', marginBottom: 6, fontWeight: 500 }}>{children}</div>
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', background: '#0A0F1E', border: '1px solid #26324B', borderRadius: 8, padding: '10px 12px', color: '#E6ECF5', fontFamily: 'IBM Plex Mono', fontSize: 13, outline: 'none' }} />
    </div>
  )
}
