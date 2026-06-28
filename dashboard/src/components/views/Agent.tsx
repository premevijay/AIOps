import { useEffect, useRef, useState } from 'react'
import { suggestions, tools, ctxItemsBase, agentSteps, type ChatMsg } from '../../data'
import { ICON } from '../../theme'
import { Icon } from '../../charts'
import { Html } from '../ui'

const AI = ICON.ai

export function Agent() {
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [showSug, setShowSug] = useState(true)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat, running])

  function send(text: string) {
    if (running) return
    if (!text || !text.trim()) return
    setShowSug(false)
    setDraft('')
    setChat((c) => [...c, { role: 'user', text }])
    runAgent()
  }
  function runAgent() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    let acc = 0
    setRunning(true)
    agentSteps.forEach((s) => {
      acc += s.t
      timers.current.push(
        setTimeout(() => {
          setChat((c) => [...c, s.m])
          if (s.m.kind === 'fix') setRunning(false)
        }, acc),
      )
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, height: 'calc(100vh - 150px)' }}>
      {/* chat */}
      <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1B2740', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={AI} size={16} stroke="#fff" width={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>Aether Agent</div>
            <div style={{ fontSize: 11, color: '#5C6B85', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Read-write · approvals required for config changes</div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#34D399', fontWeight: 500, whiteSpace: 'nowrap', flex: 'none' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'pulseDot 2s infinite' }} />3,847 connected
          </span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ChatStream chat={chat} running={running} />
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #1B2740' }}>
          {showSug && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {suggestions.map((s) => (
                <div key={s.label} className="chip-h" onClick={() => send(s.text)} style={{ border: '1px solid #26324B', borderRadius: 20, padding: '7px 13px', fontSize: 12, color: '#9DA9C0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />{s.label}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0A0F1E', border: '1px solid #26324B', borderRadius: 11, padding: '11px 14px' }}>
            <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" size={16} stroke="#5C6B85" width={2} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(draft) }}
              disabled={running}
              placeholder={running ? 'Agent is working…' : 'Ask the agent to investigate, remediate, or query the fleet…'}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#E6ECF5', fontFamily: 'IBM Plex Sans', fontSize: 13 }}
            />
            <button className="btn-h" onClick={() => send(draft)} disabled={running} style={{ background: '#5E9BFF', color: '#06122B', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.55 : 1 }}>
              <Icon d="M5 12h14M13 6l6 6-6 6" size={16} stroke="currentColor" width={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* context panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 13, padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600, marginBottom: 12 }}>Agent Toolbelt</div>
          {tools.map((t) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <Icon d={t.icon} size={15} stroke="#5E9BFF" width={2} />
              <span style={{ flex: 1, fontSize: 12.5, color: '#C7D3EA' }}>{t.name}</span>
              <span style={{ fontSize: 10, color: '#5C6B85', fontFamily: 'IBM Plex Mono' }}>{t.scope}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 13, padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#5C6B85', fontWeight: 600, marginBottom: 12 }}>Active Context</div>
          {ctxItemsBase(chat.length > 0).map((c) => (
            <div key={c.label} style={{ marginBottom: 11 }}>
              <div style={{ fontSize: 10.5, color: '#5C6B85', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 12.5, fontFamily: 'IBM Plex Mono', color: '#C7D3EA' }}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatStream({ chat, running }: { chat: ChatMsg[]; running: boolean }) {
  if (chat.length === 0) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 380, opacity: 0.9 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px', background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={AI} size={26} stroke="#fff" width={2} />
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, marginBottom: 8 }}>How can I help operate the network?</div>
        <div style={{ fontSize: 13, color: '#9DA9C0', lineHeight: 1.6 }}>
          I can investigate incidents, run health checks, diff configs against Vault baselines, and propose remediations across all 3,847 devices. Pick a scenario below or ask anything.
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chat.map((m, i) => <Bubble key={i} m={m} />)}
      {running && <Typing />}
    </div>
  )
}

function Typing() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: '#5C6B85', fontSize: 12 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E9BFF', animation: 'blink 1s infinite' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E9BFF', animation: 'blink 1s infinite .2s' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E9BFF', animation: 'blink 1s infinite .4s' }} />
      <span style={{ marginLeft: 4 }}>agent working…</span>
    </div>
  )
}

function Head({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#5E9BFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={icon} size={12} stroke="#fff" width={2} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
    </div>
  )
}

function Bubble({ m }: { m: ChatMsg }) {
  if (m.role === 'user') {
    return (
      <div style={{ animation: 'fadeUp .3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#1B2740', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 13, maxWidth: '78%' }}>{m.text}</div>
        </div>
      </div>
    )
  }
  if (m.kind === 'tool') {
    return (
      <div style={{ animation: 'fadeUp .3s ease' }}>
        <div style={{ maxWidth: '88%' }}>
          <Head icon={ICON.health} label="Tool call" color="#5E9BFF" />
          <div style={{ background: '#0A0F1E', border: '1px solid #1B2740', borderRadius: 10, padding: '12px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11.5 }}>
            <div style={{ color: '#22D3EE', marginBottom: 5 }}>▸ {m.tool}({m.args})</div>
            <div style={{ color: '#9DA9C0', paddingLeft: 14, borderLeft: '2px solid #1B2740' }}>{m.out}</div>
          </div>
        </div>
      </div>
    )
  }
  if (m.kind === 'cause') {
    return (
      <div style={{ animation: 'fadeUp .3s ease' }}>
        <div style={{ maxWidth: '88%' }}>
          <Head icon={AI} label="Root cause" color="#FBBF24" />
          <Html as="div" html={m.text ?? ''} style={{ background: 'linear-gradient(100deg,rgba(251,191,36,.08),transparent)', border: '1px solid #3A341F', borderRadius: 10, padding: '13px 15px', fontSize: 13, lineHeight: 1.6 }} />
        </div>
      </div>
    )
  }
  if (m.kind === 'fix') {
    return (
      <div style={{ animation: 'fadeUp .3s ease' }}>
        <div style={{ maxWidth: '88%' }}>
          <Head icon={ICON.comp} label="Remediation" color="#34D399" />
          <div style={{ background: '#0E1426', border: '1px solid #1B2740', borderRadius: 10, padding: '14px 15px' }}>
            {(m.actions ?? []).map((a, j) => (
              <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 0', fontSize: 12.5 }}>
                <span style={{ color: '#34D399', marginTop: 1 }}>✓</span>
                <Html html={a} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-h" style={{ background: '#34D399', color: '#06251A', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Approve & Stage to Vault</button>
              <button className="btn-h" style={{ background: '#141C2E', color: '#C7D3EA', border: '1px solid #26324B', borderRadius: 8, padding: '8px 14px', fontWeight: 500, fontSize: 12.5, cursor: 'pointer' }}>View runbook</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  // think
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ maxWidth: '88%' }}>
        <Head icon={AI} label="Agent" color="#A78BFA" />
        <Html as="div" html={m.text ?? ''} style={{ fontSize: 13, lineHeight: 1.6, color: '#C7D3EA' }} />
      </div>
    </div>
  )
}
