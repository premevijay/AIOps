import { useEffect, useMemo, useState } from 'react'
import {
  titles, devices as seedDevices,
  buildDevice, type ViewId, type MonTab, type Device, type Vendor,
} from './data'
import type { DeviceType } from './theme'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Overview } from './components/views/Overview'
import { Topology } from './components/views/Topology'
import { Inventory } from './components/views/Inventory'
import { Backup } from './components/views/Backup'
import { Compliance } from './components/views/Compliance'
import { Health } from './components/views/Health'
import { Monitoring } from './components/views/Monitoring'
import { Agent } from './components/views/Agent'
import { ChangeManagement } from './components/views/ChangeManagement'
import { DeviceDrawer } from './components/DeviceDrawer'
import { OnboardingWizard } from './components/OnboardingWizard'
import { CommandPalette } from './components/CommandPalette'

export default function App() {
  const [view, setView] = useState<ViewId>('overview')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [monTab, setMonTab] = useState<MonTab>('switch')
  const [typeFilter, setTypeFilter] = useState<DeviceType | 'all'>('all')
  const [onbOpen, setOnbOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Lifted, mutable app state
  const [devices, setDevices] = useState<Device[]>(seedDevices)
  // Live pending-change count, driven by the Change Management view from the
  // real change service.
  const [pending, setPending] = useState(0)

  const goto = (v: ViewId) => {
    setView(v)
    setSelectedId(null)
  }
  const selected = selectedId ? devices.find((d) => d.name === selectedId) ?? null : null
  const [title, sub] = titles[view]

  // Live nav badges (live pending-change count from the change service)
  const badges = useMemo<Partial<Record<ViewId, string>>>(
    () => ({ changes: pending ? String(pending) : undefined }),
    [pending],
  )

  // Global keyboard: Cmd/Ctrl+K toggles palette; Esc closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((p) => !p)
        return
      }
      if (e.key !== 'Escape') return
      if (paletteOpen) setPaletteOpen(false)
      else if (onbOpen) setOnbOpen(false)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, onbOpen, selectedId])

  // Onboarding completion → real device in inventory
  function onboardDevice(vendor: Vendor, onb: Parameters<typeof buildDevice>[1]) {
    const d = buildDevice(vendor, onb)
    setDevices((list) => [d, ...list])
    setOnbOpen(false)
    setTypeFilter('all')
    setView('inventory')
    setSelectedId(d.name)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100vh', width: '100%', color: '#E6ECF5', fontSize: 14, overflow: 'hidden', background: 'radial-gradient(1200px 600px at 80% -10%, rgba(94,155,255,.06), transparent), #080B14' }}>
      <Sidebar view={view} setView={goto} badges={badges} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header title={title} sub={sub} onSearchClick={() => setPaletteOpen(true)} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px 60px' }}>
          {view === 'overview' && <Overview goAgent={() => goto('agent')} />}
          {view === 'topology' && <Topology devices={devices} onSelect={setSelectedId} />}
          {view === 'inventory' && (
            <Inventory
              devices={devices}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              openOnb={() => setOnbOpen(true)}
              selectDevice={setSelectedId}
            />
          )}
          {view === 'backup' && <Backup />}
          {view === 'compliance' && <Compliance />}
          {view === 'health' && <Health goAgent={() => goto('agent')} />}
          {view === 'monitoring' && <Monitoring monTab={monTab} setMonTab={setMonTab} />}
          {view === 'agent' && <Agent />}
          {view === 'changes' && <ChangeManagement onPendingCount={setPending} />}
        </div>
      </main>

      {/* Overlays anchor to the full app frame */}
      {selected && (
        <DeviceDrawer
          device={selected}
          onClose={() => setSelectedId(null)}
          onAskAgent={() => goto('agent')}
        />
      )}
      {onbOpen && <OnboardingWizard onClose={() => setOnbOpen(false)} onComplete={onboardDevice} />}
      {paletteOpen && (
        <CommandPalette
          devices={devices}
          onClose={() => setPaletteOpen(false)}
          onSelectView={goto}
          onSelectDevice={(name) => { setView('inventory'); setSelectedId(name) }}
          onSelectSite={(site) => {
            setView('inventory')
            setTypeFilter('all')
            const first = devices.find((d) => d.site === site)
            if (first) setSelectedId(first.name)
          }}
        />
      )}
    </div>
  )
}
