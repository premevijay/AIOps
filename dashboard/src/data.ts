import { ICON, type DeviceType, type StatusKey } from './theme'

// ----------------------------------------------------------------------------
// Devices
// ----------------------------------------------------------------------------
export interface DeviceStat {
  label: string
  value: string
  color: string
}
export interface Device {
  name: string
  role: string
  vendor: string
  model: string
  type: DeviceType
  site: string
  region: string
  vault: string
  vaultPath: string
  status: StatusKey
  backup: string
  caps: string
  stats: DeviceStat[]
}

export const devices: Device[] = [
  {
    name: 'cat9500-nyc-core-01', role: 'Campus Core', vendor: 'Cisco Catalyst', model: 'C9500-48Y4C', type: 'switch',
    site: 'NYC-DC1', region: 'NA / us-east', vault: 'CyberArk', vaultPath: 'Safe/NET-Campus/nyc', status: 'healthy', backup: '12m ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '18%', color: '#34D399' }, { label: 'Uptime', value: '214d', color: '#E6ECF5' }, { label: 'IOS-XE', value: '17.9.4', color: '#E6ECF5' }, { label: 'Compliance', value: '98%', color: '#34D399' }],
  },
  {
    name: 'nexus-dc-fra-02', role: 'DC Spine', vendor: 'Cisco Nexus', model: 'N9K-C9336C', type: 'switch',
    site: 'FRA-DC2', region: 'EMEA / eu-central', vault: 'HashiCorp', vaultPath: 'kv/nxos/fra-spine', status: 'warning', backup: '3m ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '44%', color: '#FBBF24' }, { label: 'Uptime', value: '87d', color: '#E6ECF5' }, { label: 'NX-OS', value: '10.3.2', color: '#E6ECF5' }, { label: 'Compliance', value: '91%', color: '#FBBF24' }],
  },
  {
    name: 'sdwan-edge-sin-07', role: 'Branch Edge', vendor: 'Cisco SD-WAN', model: 'C8300-1N1S', type: 'switch',
    site: 'SIN-BR07', region: 'APAC / ap-se', vault: 'CyberArk', vaultPath: 'Safe/SDWAN/sin', status: 'healthy', backup: '8m ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '22%', color: '#34D399' }, { label: 'Tunnels', value: '6 up', color: '#34D399' }, { label: 'vManage', value: '20.12', color: '#E6ECF5' }, { label: 'Compliance', value: '100%', color: '#34D399' }],
  },
  {
    name: 'pa5260-lon-01', role: 'Perimeter FW', vendor: 'Palo Alto', model: 'PA-5260', type: 'firewall',
    site: 'LON-DC3', region: 'EMEA / eu-west', vault: 'HashiCorp', vaultPath: 'kv/panos/lon-perim', status: 'warning', backup: '1h ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '71%', color: '#F87171' }, { label: 'Sessions', value: '1.2M', color: '#E6ECF5' }, { label: 'PAN-OS', value: '11.1.2', color: '#E6ECF5' }, { label: 'Compliance', value: '94%', color: '#FBBF24' }],
  },
  {
    name: 'ftd-chi-dmz-04', role: 'DMZ FW', vendor: 'Cisco FTD', model: 'FPR-2140', type: 'firewall',
    site: 'CHI-DC4', region: 'NA / us-central', vault: 'CyberArk', vaultPath: 'Safe/FTD/chi-dmz', status: 'healthy', backup: '25m ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '33%', color: '#34D399' }, { label: 'Sessions', value: '480K', color: '#E6ECF5' }, { label: 'FTD', value: '7.4.1', color: '#E6ECF5' }, { label: 'Compliance', value: '97%', color: '#34D399' }],
  },
  {
    name: 'cp-mgmt-tlv-01', role: 'Mgmt Gateway', vendor: 'Check Point', model: 'CP-6200', type: 'firewall',
    site: 'TLV-DC1', region: 'EMEA / il', vault: 'HashiCorp', vaultPath: 'kv/checkpoint/tlv', status: 'healthy', backup: '40m ago', caps: 'BCHM',
    stats: [{ label: 'CPU', value: '29%', color: '#34D399' }, { label: 'Policies', value: '42', color: '#E6ECF5' }, { label: 'R', value: '81.20', color: '#E6ECF5' }, { label: 'Compliance', value: '96%', color: '#34D399' }],
  },
  {
    name: 'fgt-syd-edge-09', role: 'Branch FW', vendor: 'Fortinet', model: 'FortiGate-200F', type: 'firewall',
    site: 'SYD-BR09', region: 'APAC / ap-se2', vault: 'CyberArk', vaultPath: 'Safe/Forti/syd', status: 'critical', backup: '2h ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '88%', color: '#F87171' }, { label: 'Sessions', value: '95K', color: '#E6ECF5' }, { label: 'FortiOS', value: '7.4.3', color: '#E6ECF5' }, { label: 'Compliance', value: '83%', color: '#F87171' }],
  },
  {
    name: 'f5-bigip-nyc-03', role: 'App Delivery', vendor: 'F5', model: 'BIG-IP i5800', type: 'lb',
    site: 'NYC-DC1', region: 'NA / us-east', vault: 'CyberArk', vaultPath: 'Safe/F5/nyc-adc', status: 'healthy', backup: '18m ago', caps: 'BCHMA',
    stats: [{ label: 'CPU', value: '26%', color: '#34D399' }, { label: 'VIPs', value: '128', color: '#E6ECF5' }, { label: 'TMOS', value: '17.1.1', color: '#E6ECF5' }, { label: 'Compliance', value: '99%', color: '#34D399' }],
  },
  {
    name: 'avi-ctrl-fra-01', role: 'Service Mesh LB', vendor: 'VMware AVI', model: 'AVI-SE', type: 'lb',
    site: 'FRA-DC2', region: 'EMEA / eu-central', vault: 'HashiCorp', vaultPath: 'kv/avi/fra', status: 'healthy', backup: '14m ago', caps: 'BCHM',
    stats: [{ label: 'CPU', value: '31%', color: '#34D399' }, { label: 'Virt-Svc', value: '64', color: '#E6ECF5' }, { label: 'AVI', value: '22.1.5', color: '#E6ECF5' }, { label: 'Compliance', value: '98%', color: '#34D399' }],
  },
]

// ----------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------
export const vaults = [
  { name: 'CyberArk', detail: 'Conjur · 2,140 secrets', bound: 'OK' },
  { name: 'HashiCorp Vault', detail: 'KV v2 · 1,707 secrets', bound: 'OK' },
]

export type ViewId = 'overview' | 'topology' | 'inventory' | 'backup' | 'compliance' | 'health' | 'monitoring' | 'agent' | 'changes'

export interface NavDef {
  id: ViewId
  label: string
  icon: string
  heading?: string
  badge?: string
}
export const navDef: NavDef[] = [
  { id: 'overview', label: 'Fleet Overview', icon: 'M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z' },
  { id: 'topology', label: 'Topology', icon: 'M5 5h4v4H5zM15 5h4v4h-4zM10 15h4v4h-4zM7 9v3h10V9M12 12v3' },
  { id: 'inventory', label: 'Inventory & Vault', icon: 'M3 5h18v4H3zM3 11h18v4H3zM3 17h18v2H3zM7 7v0M7 13v0' },
  { id: 'backup', label: 'Backup', icon: ICON.backup, heading: 'Capabilities' },
  { id: 'compliance', label: 'Compliance', icon: ICON.comp },
  { id: 'health', label: 'Health Checks', icon: ICON.health },
  { id: 'monitoring', label: 'SNMP & Synthetic', icon: ICON.monitor },
  { id: 'agent', label: 'AI Troubleshooting', icon: ICON.ai, badge: '2' },
  { id: 'changes', label: 'Change Management', icon: 'M9 11l3 3L22 4M3 12a9 9 0 0015.5 6.4M3 12V7m0 5h5', heading: 'Operations' },
]

export const titles: Record<ViewId, [string, string]> = {
  overview: ['Fleet Overview', 'Real-time posture across 3,847 devices, 38 sites'],
  topology: ['Topology', 'Fleet interconnect map with live link health'],
  inventory: ['Inventory & Vault', 'Multi-vendor fleet with vault-bound credentials'],
  backup: ['Backup', 'Versioned config capture, diff & restore across the fleet'],
  compliance: ['Compliance', 'Baselines, drift & framework adherence'],
  health: ['Health Checks', 'Scheduled device state checks & scoring'],
  monitoring: ['SNMP & Synthetic Monitoring', 'Telemetry polling and active probes'],
  agent: ['AI Troubleshooting', 'Autonomous diagnosis & remediation'],
  changes: ['Change Management', 'Approvals, change windows & audit trail'],
}

// ----------------------------------------------------------------------------
// Overview
// ----------------------------------------------------------------------------
export const kpis = [
  { label: 'Devices Online', value: '3,829', color: '#E6ECF5', delta: '↗99.5% reachable', deltaColor: '#34D399', spark: [20, 22, 21, 24, 23, 25, 26], sparkColor: '#34D399' },
  { label: 'Open Incidents', value: '3', color: '#FBBF24', delta: '↓2 vs yesterday', deltaColor: '#34D399', spark: [8, 6, 7, 5, 4, 4, 3], sparkColor: '#FBBF24' },
  { label: 'AI Resolutions (24h)', value: '47', color: '#5E9BFF', delta: '↗81% auto-closed', deltaColor: '#34D399', spark: [12, 18, 22, 30, 38, 44, 47], sparkColor: '#5E9BFF' },
  { label: 'Compliance Score', value: '94.6%', color: '#34D399', delta: '↗1.2 pts this week', deltaColor: '#34D399', spark: [90, 91, 92, 92, 93, 94, 95], sparkColor: '#34D399' },
  { label: 'Backup Coverage', value: '99.4%', color: '#A78BFA', delta: '24 pending nightly', deltaColor: '#7A88A3', spark: [97, 98, 98, 99, 99, 99, 99], sparkColor: '#A78BFA' },
]

export const regions = [
  { code: 'NA', name: 'North America · 12 sites', count: '1,284', h: 94, w: 4, c: 2 },
  { code: 'EMEA', name: 'Europe & ME · 14 sites', count: '1,108', h: 90, w: 7, c: 3 },
  { code: 'APAC', name: 'Asia Pacific · 9 sites', count: '982', h: 88, w: 8, c: 4 },
  { code: 'LATAM', name: 'Latin America · 3 sites', count: '473', h: 97, w: 3, c: 0 },
]

export const healthDonutSegs = [
  { v: 0.962, color: '#34D399' },
  { v: 0.026, color: '#FBBF24' },
  { v: 0.012, color: '#F87171' },
]
export const healthLegend = [
  { label: 'Healthy', color: '#34D399', value: '3,700' },
  { label: 'Warning', color: '#FBBF24', value: '101' },
  { label: 'Critical', color: '#F87171', value: '46' },
]
export const postures = [
  { label: 'Compliance baseline', value: '94.6%', color: '#34D399', pct: 94 },
  { label: 'Backup freshness', value: '99.4%', color: '#A78BFA', pct: 99 },
  { label: 'Vault credential rotation', value: '100%', color: '#5E9BFF', pct: 100 },
]
export const activity = [
  { color: '#34D399', text: 'Auto-remediated BGP flap on <b>nexus-dc-fra-02</b>', meta: 'agent · reverted route-map · verified', time: '02:14' },
  { color: '#FBBF24', text: 'Flagged CPU trend on <b>pa5260-lon-01</b> — approval pending', meta: 'agent · awaiting change window', time: '05:48' },
  { color: '#5E9BFF', text: 'Nightly backup completed — 3,805 configs to Vault', meta: 'scheduler · 24 retries queued', time: '03:00' },
  { color: '#A78BFA', text: 'Compliance scan: CIS L1 drift on 6 FortiGates', meta: 'compliance · remediation drafted', time: '01:30' },
  { color: '#F87171', text: 'Conserve-mode entered on <b>fgt-syd-edge-09</b>', meta: 'snmp trap · investigation open', time: '14:22' },
]

const covCols: [string, string, string][] = [
  ['Backup', ICON.backup, '#34D399'],
  ['Compliance', ICON.comp, '#5E9BFF'],
  ['Health', ICON.health, '#A78BFA'],
  ['Monitor', ICON.monitor, '#22D3EE'],
  ['AI', ICON.ai, '#FBBF24'],
]
function covRow(label: string, caps: number[]) {
  return {
    label,
    caps: covCols.map(([name, icon, col], i) => {
      const on = !!caps[i]
      return { name, icon, fg: on ? col : '#3A4659', bg: on ? 'rgba(94,155,255,.07)' : '#0A0F1E', bd: on ? '#26324B' : '#141C2E' }
    }),
  }
}
export const coverage = [
  covRow('Catalyst / Nexus', [1, 1, 1, 1, 1]),
  covRow('SD-WAN', [1, 1, 1, 1, 1]),
  covRow('Palo / FTD / CP', [1, 1, 1, 1, 1]),
  covRow('FortiGate', [1, 1, 1, 1, 1]),
  covRow('F5 / AVI', [1, 1, 1, 1, 0]),
]

// ----------------------------------------------------------------------------
// Agent
// ----------------------------------------------------------------------------
export const suggestions = [
  { label: 'Why is fgt-syd-edge-09 dropping sessions?', dot: '#F87171', text: 'Why is fgt-syd-edge-09 dropping sessions?' },
  { label: 'Run health check on all EMEA firewalls', dot: '#FBBF24', text: 'Run a health check on all EMEA firewalls' },
  { label: 'Diff nexus-dc-fra-02 against baseline', dot: '#5E9BFF', text: 'Diff nexus-dc-fra-02 against its Vault baseline' },
]
export const tools = [
  { name: 'config.backup / restore', icon: ICON.backup, scope: 'rw' },
  { name: 'compliance.scan', icon: ICON.comp, scope: 'ro' },
  { name: 'health.check', icon: ICON.health, scope: 'ro' },
  { name: 'snmp.poll / walk', icon: ICON.monitor, scope: 'ro' },
  { name: 'cli.exec (approved)', icon: 'M4 17l6-6-6-6M12 19h8', scope: 'rw' },
  { name: 'vault.read (CyberArk/HCV)', icon: 'M4 10h16v11H4zM8 10V7a4 4 0 018 0v3', scope: 'ro' },
]

export interface ChatMsg {
  role: 'user' | 'agent'
  kind?: 'think' | 'tool' | 'cause' | 'fix'
  text?: string
  tool?: string
  args?: string
  out?: string
  actions?: string[]
}
export const agentSteps: { t: number; m: ChatMsg }[] = [
  { t: 600, m: { role: 'agent', kind: 'think', text: 'Parsing intent → fault isolation on FortiGate <code>fgt-syd-edge-09</code>. Pulling live telemetry + last-known-good config from HashiCorp Vault.' } },
  { t: 1500, m: { role: 'agent', kind: 'tool', tool: 'snmp.poll', args: 'fgt-syd-edge-09 · OID 1.3.6.1.4.1.12356', out: 'CPU 88% ↑ · mem 79% ↑ · sess 95K · conserve-mode ENTERED 14:22Z' } },
  { t: 1500, m: { role: 'agent', kind: 'tool', tool: 'config.diff', args: 'running vs vault baseline', out: '2 deltas: ips-sensor "default" → "aggressive" (14:18Z), 3x new policy w/ utm-all logging' } },
  { t: 1400, m: { role: 'agent', kind: 'tool', tool: 'health.check', args: 'process table', out: 'ips_monitor consuming 61% CPU · log-disk I/O saturated · fan2 RPM nominal' } },
  { t: 1300, m: { role: 'agent', kind: 'cause', text: 'Root cause identified — a policy change at <b>14:18Z</b> set IPS to <code>aggressive</code> with full UTM logging on a 200F. The IPS engine + disk logging pushed the box into <b>conserve mode</b>, dropping new sessions. This correlates with the SYD branch latency alert.' } },
  { t: 1200, m: { role: 'agent', kind: 'fix', text: 'Recommended remediation', actions: ['Revert IPS sensor to <code>default</code> profile on affected policies', 'Move UTM logging to FortiAnalyzer (off-box)', 'Stage config to Vault + push during change window'] } },
]

export const ctxItemsBase = (focused: boolean) => [
  { label: 'Scope', value: 'Global · 3,847 devices' },
  { label: 'Focused device', value: focused ? 'fgt-syd-edge-09' : '—' },
  { label: 'Vault session', value: 'HCV · token TTL 42m' },
]

// ----------------------------------------------------------------------------
// Backup
// ----------------------------------------------------------------------------
export const backupKpis = [
  { label: 'Backup Coverage', value: '99.4%', color: '#34D399', sub: '3,829 / 3,847 devices' },
  { label: 'Versions Stored', value: '142,380', color: '#A78BFA', sub: 'Git + Vault object store' },
  { label: 'Backups (24h)', value: '4,106', color: '#5E9BFF', sub: 'nightly + on-change' },
  { label: 'Drift Detected', value: '9', color: '#FBBF24', sub: 'running vs golden' },
]
export const backupJobs = [
  { scope: 'Cisco Catalyst / Nexus', target: 'Git · Vault', schedule: 'Nightly + on-change', last: '12m ago', drift: '2', driftColor: '#FBBF24', status: 'Healthy', statusColor: '#34D399' },
  { scope: 'SD-WAN fabric', target: 'vManage templates', schedule: 'On-change', last: '8m ago', drift: '0', driftColor: '#34D399', status: 'Healthy', statusColor: '#34D399' },
  { scope: 'Palo Alto / FTD / CP', target: 'XML · Git', schedule: 'Nightly', last: '1h ago', drift: '1', driftColor: '#FBBF24', status: 'Healthy', statusColor: '#34D399' },
  { scope: 'FortiGate', target: 'REST · Git', schedule: 'Nightly + on-change', last: '2h ago', drift: '6', driftColor: '#F87171', status: 'Drifted', statusColor: '#F87171' },
  { scope: 'F5 / AVI', target: 'UCS · Git', schedule: 'Nightly', last: '14m ago', drift: '0', driftColor: '#34D399', status: 'Healthy', statusColor: '#34D399' },
]
const diffStyle: Record<string, { c: string; bg: string }> = {
  ' ': { c: '#5C6B85', bg: 'transparent' },
  '-': { c: '#F87171', bg: 'rgba(248,113,113,.10)' },
  '+': { c: '#34D399', bg: 'rgba(52,211,153,.10)' },
}
function mkdiff(sign: string, text: string) {
  const m = diffStyle[sign]
  return { row: sign + ' ' + text, c: m.c, bg: m.bg }
}
export const diffLines = [
  mkdiff(' ', 'router bgp 65001'),
  mkdiff(' ', ' address-family ipv4 unicast'),
  mkdiff('-', '  neighbor 10.10.0.2 route-map RM-IN in'),
  mkdiff('+', '  neighbor 10.10.0.2 route-map RM-IN-V2 in'),
  mkdiff(' ', '!'),
  mkdiff('-', 'snmp-server community public RO'),
  mkdiff('+', 'snmp-server community netopsRO RO'),
  mkdiff(' ', 'ntp server 10.0.0.10'),
  mkdiff('+', 'ntp authenticate'),
]
export const diffMeta = 'nexus-dc-fra-02 · golden v41 ⟷ running @ 02:14'

function rb(device: string, trigger: string, size: string, version: string, time: string, type: DeviceType) {
  return {
    device, trigger, size, version, time,
    icon: type === 'firewall' ? ICON.firewall : type === 'lb' ? ICON.lb : ICON.switch,
    iconBg: type === 'firewall' ? '#241C3A' : type === 'lb' ? '#15303A' : '#15233A',
    iconFg: type === 'firewall' ? '#A78BFA' : type === 'lb' ? '#22D3EE' : '#5E9BFF',
  }
}
export const recentBackups = [
  rb('cat9500-nyc-core-01', 'on-change', '182 KB', 'v41', '12m ago', 'switch'),
  rb('nexus-dc-fra-02', 'on-change', '241 KB', 'v38', '14m ago', 'switch'),
  rb('f5-bigip-nyc-03', 'scheduled', '1.2 MB', 'v19', '18m ago', 'lb'),
  rb('ftd-chi-dmz-04', 'scheduled', '512 KB', 'v33', '25m ago', 'firewall'),
  rb('sdwan-edge-sin-07', 'on-change', '96 KB', 'v27', '8m ago', 'switch'),
  rb('pa5260-lon-01', 'scheduled', '740 KB', 'v33', '1h ago', 'firewall'),
]

// ----------------------------------------------------------------------------
// Compliance
// ----------------------------------------------------------------------------
export const compKpis = [
  { label: 'Overall Compliance', value: '94.6%', color: '#34D399', sub: 'CIS L1 · PCI · internal' },
  { label: 'Open Violations', value: '118', color: '#FBBF24', sub: '14 high · 104 medium/low' },
  { label: 'Config Drift', value: '31', color: '#A78BFA', sub: 'devices off baseline' },
  { label: 'Auto-remediable', value: '76%', color: '#5E9BFF', sub: 'agent can fix unattended' },
]
export const frameworks = [
  { short: 'CIS', name: 'CIS Benchmarks L1', rules: '214 controls · 9 vendor profiles', pct: 95, color: '#34D399' },
  { short: 'PCI', name: 'PCI-DSS 4.0', rules: 'firewall + segmentation', pct: 92, color: '#34D399' },
  { short: 'NIST', name: 'NIST 800-53', rules: 'access + logging controls', pct: 88, color: '#FBBF24' },
  { short: 'INT', name: 'Internal Hardening', rules: 'golden-config drift', pct: 97, color: '#34D399' },
]
export const violations = [
  { sev: 'HIGH', sevColor: '#F87171', sevBg: '#2A161B', rule: 'Weak SNMPv2 community in use', devices: '6 FortiGate · 2 Catalyst', action: 'Remediate' },
  { sev: 'HIGH', sevColor: '#F87171', sevBg: '#2A161B', rule: 'TLS 1.0 enabled on mgmt plane', devices: '3 F5 BIG-IP', action: 'Remediate' },
  { sev: 'MED', sevColor: '#FBBF24', sevBg: '#2A2416', rule: 'IPS profile deviates from golden', devices: 'fgt-syd-edge-09', action: 'Review' },
  { sev: 'MED', sevColor: '#FBBF24', sevBg: '#2A2416', rule: 'NTP not authenticated', devices: '11 devices', action: 'Remediate' },
  { sev: 'LOW', sevColor: '#9DA9C0', sevBg: '#1B2740', rule: 'Login banner missing', devices: '4 Nexus', action: 'Remediate' },
]
function cbv(name: string, pct: number) {
  return { name, pct, pctLabel: pct + '%', color: pct >= 90 ? '#34D399' : pct >= 80 ? '#FBBF24' : '#F87171' }
}
export const compByVendor = [
  cbv('Cisco Catalyst', 98), cbv('Cisco Nexus', 91), cbv('Cisco SD-WAN', 100), cbv('Palo Alto', 94), cbv('Cisco FTD', 97),
  cbv('Check Point', 96), cbv('FortiGate', 83), cbv('F5 BIG-IP', 99), cbv('VMware AVI', 98),
]

// ----------------------------------------------------------------------------
// Health Checks
// ----------------------------------------------------------------------------
export const healthKpis = [
  { label: 'Healthy', value: '3,700', color: '#34D399', sub: '96.2% of fleet' },
  { label: 'Warning', value: '101', color: '#FBBF24', sub: 'degraded · non-impacting' },
  { label: 'Critical', value: '46', color: '#F87171', sub: 'action required' },
  { label: 'Checks Run (24h)', value: '61,520', color: '#5E9BFF', sub: 'avg score 96.2 / 100' },
]
export const healthCategories = [
  { name: 'Hardware', detail: 'CPU · memory · temp · PSU · fan', pct: 97, pctLabel: '97%', color: '#34D399', icon: 'M4 4h16v16H4zM9 9h6v6H9zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2' },
  { name: 'Control Plane', detail: 'BGP · OSPF · HSRP · HA sync', pct: 94, pctLabel: '94%', color: '#34D399', icon: 'M5 9a7 7 0 0114 0M8.5 12.5a3.5 3.5 0 017 0M12 16h.01' },
  { name: 'Data Plane', detail: 'interface errors · optics · drops', pct: 91, pctLabel: '91%', color: '#FBBF24', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { name: 'Software / PSIRT', detail: 'version · advisories · EoL', pct: 88, pctLabel: '88%', color: '#FBBF24', icon: 'M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5' },
]
export interface HealthDevice {
  device: string
  score: number
  top: string
  type: DeviceType
  sev: string
  sevColor: string
  sevBg: string
  ringColor: string
  icon: string
  iconBg: string
  iconFg: string
}
function hdv(device: string, score: number, top: string, type: DeviceType): HealthDevice {
  return {
    device, score, top, type,
    ringColor: score < 70 ? '#F87171' : score < 88 ? '#FBBF24' : '#34D399',
    sev: score < 70 ? 'Critical' : 'Warning',
    sevColor: score < 70 ? '#F87171' : '#FBBF24',
    sevBg: score < 70 ? '#2A161B' : '#2A2416',
    icon: type === 'firewall' ? ICON.firewall : type === 'lb' ? ICON.lb : ICON.switch,
    iconBg: type === 'firewall' ? '#241C3A' : type === 'lb' ? '#15303A' : '#15233A',
    iconFg: type === 'firewall' ? '#A78BFA' : type === 'lb' ? '#22D3EE' : '#5E9BFF',
  }
}
export const healthDevices = [
  hdv('fgt-syd-edge-09', 61, 'CPU 88% · conserve mode active', 'firewall'),
  hdv('pa5260-lon-01', 78, 'CPU trending high (71%)', 'firewall'),
  hdv('nexus-dc-fra-02', 84, 'BGP flap recovered · monitoring', 'switch'),
]
function hc(state: string, name: string, val: string) {
  return { state, name, val, color: state === 'PASS' ? '#34D399' : state === 'WARN' ? '#FBBF24' : '#F87171' }
}
export const healthChecks = [
  { cat: 'Hardware', items: [hc('FAIL', 'CPU utilization < 85%', '88%'), hc('WARN', 'Memory < 80%', '79%'), hc('PASS', 'Temperature nominal', '41°C'), hc('PASS', 'PSU redundancy', '2 / 2')] },
  { cat: 'Control Plane', items: [hc('PASS', 'HA peer in-sync', 'synced'), hc('FAIL', 'Conserve mode inactive', 'active'), hc('PASS', 'Routing adjacencies', 'all up')] },
  { cat: 'Data Plane', items: [hc('PASS', 'Interface error rate', '0.001%'), hc('WARN', 'Session table headroom', '95K'), hc('PASS', 'Optics within range', '-4.2 dBm')] },
  { cat: 'Software', items: [hc('PASS', 'No critical PSIRT', '7.4.3'), hc('PASS', 'Not past end-of-life', 'OK'), hc('WARN', 'Recommended release', '7.4.4')] },
]
export const healthDetailDevice = 'fgt-syd-edge-09'

// ----------------------------------------------------------------------------
// Monitoring
// ----------------------------------------------------------------------------
export type MonTab = 'switch' | 'firewall' | 'lb'
export const monTabDefs: [MonTab, string][] = [['switch', 'Switching'], ['firewall', 'Firewalls'], ['lb', 'Load Balancers']]
export const metByTab: Record<MonTab, { label: string; value: string; color: string; data: number[]; foot: string }[]> = {
  switch: [
    { label: 'CPU · fabric avg', value: '31%', color: '#34D399', data: [22, 25, 24, 28, 30, 29, 33, 31, 30, 31], foot: '9,336C spine · peak 44%' },
    { label: 'Throughput', value: '847G', color: '#5E9BFF', data: [600, 650, 700, 720, 780, 800, 820, 840, 847, 847], foot: 'aggregate north-south' },
    { label: 'Packet errors', value: '0.002%', color: '#34D399', data: [5, 4, 6, 3, 4, 2, 3, 2, 2, 2], foot: 'CRC + drops / 1M' },
    { label: 'Temp · inlet', value: '27°C', color: '#34D399', data: [26, 26, 27, 27, 26, 28, 27, 27, 27, 27], foot: 'all sensors nominal' },
  ],
  firewall: [
    { label: 'CPU · PA-5260', value: '71%', color: '#F87171', data: [40, 45, 50, 58, 62, 66, 70, 72, 71, 71], foot: 'trending high · agent watching' },
    { label: 'Active sessions', value: '1.2M', color: '#5E9BFF', data: [0.8, 0.9, 1.0, 1.05, 1.1, 1.15, 1.18, 1.2, 1.2, 1.2], foot: 'cap 2M · 60% util' },
    { label: 'Threat hits/min', value: '342', color: '#FBBF24', data: [120, 140, 180, 220, 260, 300, 320, 330, 342, 342], foot: 'IPS + WildFire' },
    { label: 'Tunnel uptime', value: '99.99%', color: '#34D399', data: [99, 99, 100, 100, 99, 100, 100, 100, 100, 100], foot: 'IPsec + GlobalProtect' },
  ],
  lb: [
    { label: 'CPU · BIG-IP', value: '26%', color: '#34D399', data: [20, 22, 24, 23, 25, 26, 25, 26, 26, 26], foot: 'TMM across blades' },
    { label: 'Req/sec', value: '184K', color: '#5E9BFF', data: [120, 140, 150, 160, 170, 178, 182, 184, 184, 184], foot: 'L7 across 128 VIPs' },
    { label: 'Conn/sec', value: '42K', color: '#22D3EE', data: [30, 33, 36, 38, 40, 41, 42, 42, 42, 42], foot: 'new TCP' },
    { label: 'Pool health', value: '100%', color: '#34D399', data: [98, 99, 100, 100, 100, 100, 100, 100, 100, 100], foot: '412/412 members up' },
  ],
}
export const synthetics = [
  { name: 'Branch → DC path (SYD)', target: 'icmp · sdwan-edge-sin-07', color: '#F87171', latency: '142ms', uptime: '97.1%', bars: [40, 55, 60, 80, 95, 70, 85] },
  { name: 'HTTPS app probe (NYC)', target: 'https://app.corp · f5-bigip-nyc-03', color: '#34D399', latency: '38ms', uptime: '99.99%', bars: [30, 28, 32, 30, 29, 31, 30] },
  { name: 'DNS resolution (FRA)', target: 'dns · avi-ctrl-fra-01', color: '#34D399', latency: '11ms', uptime: '100%', bars: [20, 22, 18, 20, 21, 19, 20] },
  { name: 'VPN reachability (LON)', target: 'gp · pa5260-lon-01', color: '#FBBF24', latency: '64ms', uptime: '99.4%', bars: [40, 45, 42, 60, 55, 50, 58] },
  { name: 'East-West (CHI DMZ)', target: 'tcp/443 · ftd-chi-dmz-04', color: '#34D399', latency: '4ms', uptime: '100%', bars: [18, 16, 20, 17, 19, 18, 17] },
]
const tri = 'M12 9v4M12 17v0M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'
export const alerts = [
  { title: 'FortiGate in conserve mode', meta: 'fgt-syd-edge-09 · sev critical', time: 'now', fg: '#F87171', bg: 'rgba(248,113,113,.08)', bd: '#3A1D24', icon: tri },
  { title: 'PA-5260 CPU > 70% for 15m', meta: 'pa5260-lon-01 · sev warning', time: '12m', fg: '#FBBF24', bg: 'rgba(251,191,36,.07)', bd: '#3A341F', icon: tri },
  { title: 'SYD branch latency degraded', meta: 'synthetic probe · 142ms p95', time: '18m', fg: '#FBBF24', bg: 'rgba(251,191,36,.07)', bd: '#3A341F', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { title: 'Nexus drift auto-corrected', meta: 'nexus-dc-fra-02 · resolved', time: '2h', fg: '#34D399', bg: 'rgba(52,211,153,.07)', bd: '#1E3A30', icon: 'M20 6L9 17l-5-5' },
]

// ----------------------------------------------------------------------------
// Onboarding wizard
// ----------------------------------------------------------------------------
export interface Vendor {
  id: string
  name: string
  proto: string
  icon: string
  iconBg: string
  iconFg: string
  defPort: string
  defProto: string
  type: DeviceType
  model: string
}
const SW = { icon: ICON.switch, iconBg: '#15233A', iconFg: '#5E9BFF', type: 'switch' as DeviceType }
const FW = { icon: ICON.firewall, iconBg: '#2A1F3A', iconFg: '#A78BFA', type: 'firewall' as DeviceType }
const LB = { icon: ICON.lb, iconBg: '#1F3038', iconFg: '#22D3EE', type: 'lb' as DeviceType }
export const vendorCatalog: { label: string; items: Vendor[] }[] = [
  {
    label: 'Switching & Routing',
    items: [
      { id: 'catalyst', name: 'Cisco Catalyst', proto: 'SSH · IOS-XE', ...SW, defPort: '22', defProto: 'SSH', model: 'C9500-48Y4C' },
      { id: 'nexus', name: 'Cisco Nexus', proto: 'SSH · NX-OS', ...SW, defPort: '22', defProto: 'SSH', model: 'N9K-C9336C' },
      { id: 'sdwan', name: 'Cisco SD-WAN', proto: 'REST · vManage', ...SW, defPort: '443', defProto: 'REST', model: 'C8300-1N1S' },
    ],
  },
  {
    label: 'Firewalls',
    items: [
      { id: 'palo', name: 'Palo Alto', proto: 'REST · PAN-OS', ...FW, defPort: '443', defProto: 'REST', model: 'PA-5260' },
      { id: 'ftd', name: 'Cisco FTD', proto: 'REST · FMC API', ...FW, defPort: '443', defProto: 'REST', model: 'FPR-2140' },
      { id: 'checkpoint', name: 'Check Point', proto: 'REST · Mgmt API', ...FW, defPort: '443', defProto: 'REST', model: 'CP-6200' },
      { id: 'forti', name: 'FortiGate', proto: 'REST · FortiOS', ...FW, defPort: '443', defProto: 'REST', model: 'FortiGate-200F' },
    ],
  },
  {
    label: 'Load Balancers',
    items: [
      { id: 'f5', name: 'F5 BIG-IP', proto: 'REST · iControl', ...LB, defPort: '443', defProto: 'REST', model: 'BIG-IP i5800' },
      { id: 'avi', name: 'VMware AVI', proto: 'REST · Avi API', ...LB, defPort: '443', defProto: 'REST', model: 'AVI-SE' },
    ],
  },
]
export const flatVendors: Vendor[] = vendorCatalog.flatMap((g) => g.items)

export const capDefs: [string, string, string, string, string][] = [
  ['B', 'Backup', ICON.backup, '#34D399', 'Versioned config capture, nightly + on-change'],
  ['C', 'Compliance', ICON.comp, '#5E9BFF', 'Scan against CIS / PCI / golden config'],
  ['H', 'Health Checks', ICON.health, '#A78BFA', 'Scheduled state checks & scoring'],
  ['M', 'SNMP + Synthetic', ICON.monitor, '#22D3EE', 'Telemetry polling and active probes'],
  ['A', 'AI Troubleshooting', ICON.ai, '#FBBF24', 'Agent diagnostics & remediation'],
]
// Drawer capability list (uses full names).
export const drawerCapMeta: [string, string, string, string][] = [
  ['B', 'Backup', ICON.backup, '#34D399'],
  ['C', 'Compliance', ICON.comp, '#5E9BFF'],
  ['H', 'Health Checks', ICON.health, '#A78BFA'],
  ['M', 'SNMP + Synthetic', ICON.monitor, '#22D3EE'],
  ['A', 'AI Troubleshooting', ICON.ai, '#FBBF24'],
]

export const stepLabels = ['Vendor', 'Connection', 'Vault', 'Capabilities', 'Verify']
export const onbSubtitles = ['Choose a vendor platform', 'Define how Aether reaches the device', 'Bind a secret vault', 'Select operations to run', 'Verify & finish']

// ----------------------------------------------------------------------------
// Onboarding → real Device
// ----------------------------------------------------------------------------
let onboardSeq = 20
export function buildDevice(v: Vendor, onb: {
  host: string; site: string; region: string; vault: string; vaultPath: string; caps: Record<string, boolean>
}): Device {
  const caps = (['B', 'C', 'H', 'M', 'A'] as const).filter((k) => onb.caps[k]).join('')
  const slug = v.id + '-' + (onb.site || onb.region).toLowerCase().replace(/[^a-z0-9]+/g, '') + '-' + String(++onboardSeq)
  const regionLabel = { NA: 'NA / us-east', EMEA: 'EMEA / eu-central', APAC: 'APAC / ap-se', LATAM: 'LATAM / sa-east' }[onb.region] || onb.region
  return {
    name: slug,
    role: 'Newly onboarded',
    vendor: v.name,
    model: v.model,
    type: v.type,
    site: onb.site || onb.region,
    region: regionLabel,
    vault: onb.vault === 'HashiCorp Vault' ? 'HashiCorp' : onb.vault,
    vaultPath: onb.vaultPath || 'secret/net/' + v.id + '/',
    status: 'healthy',
    backup: 'just now',
    caps,
    stats: [
      { label: 'CPU', value: '—', color: '#9DA9C0' },
      { label: 'Uptime', value: '0d', color: '#E6ECF5' },
      { label: 'Host', value: onb.host || '—', color: '#E6ECF5' },
      { label: 'Status', value: 'Onboarded', color: '#34D399' },
    ],
  }
}

// ----------------------------------------------------------------------------
// Change Management
// ----------------------------------------------------------------------------
export type ChangeStatus = 'Pending' | 'Approved' | 'Scheduled' | 'Applied' | 'Rejected'
export interface ChangeRequest {
  id: string
  title: string
  device: string
  vendor: string
  source: 'Agent' | 'Operator'
  risk: 'Low' | 'Medium' | 'High'
  window: string
  summary: string
  status: ChangeStatus
  requested: string
}
export const seedChanges: ChangeRequest[] = [
  { id: 'CHG-4821', title: 'Revert IPS sensor to default profile', device: 'fgt-syd-edge-09', vendor: 'FortiGate', source: 'Agent', risk: 'High', window: 'Tonight · 02:00 UTC', summary: 'Agent diagnosis: aggressive IPS + full UTM logging pushed the box into conserve mode. Revert affected policies and move UTM logging off-box.', status: 'Pending', requested: '8m ago' },
  { id: 'CHG-4820', title: 'Harden SNMP community on 8 devices', device: '6 FortiGate · 2 Catalyst', vendor: 'Mixed', source: 'Agent', risk: 'Medium', window: 'Immediate', summary: 'Replace weak SNMPv2 community "public" with rotated read-only credential pulled from Vault.', status: 'Pending', requested: '22m ago' },
  { id: 'CHG-4819', title: 'Disable TLS 1.0 on management plane', device: '3 F5 BIG-IP', vendor: 'F5', source: 'Operator', risk: 'Medium', window: 'Sat · maintenance', summary: 'PCI-DSS 4.0 remediation — restrict mgmt httpd to TLS 1.2+.', status: 'Scheduled', requested: '1h ago' },
  { id: 'CHG-4817', title: 'Restore route-map baseline', device: 'nexus-dc-fra-02', vendor: 'Cisco Nexus', source: 'Agent', risk: 'Low', window: 'Immediate', summary: 'Auto-remediation reverted RM-IN-V2 → golden v41 after BGP flap.', status: 'Applied', requested: '2h ago' },
  { id: 'CHG-4815', title: 'Authenticate NTP fleet-wide', device: '11 devices', vendor: 'Mixed', source: 'Operator', risk: 'Low', window: 'Nightly window', summary: 'Add NTP authentication keys to close CIS L1 finding.', status: 'Applied', requested: '5h ago' },
]
export const riskColor: Record<ChangeRequest['risk'], string> = { High: '#F87171', Medium: '#FBBF24', Low: '#34D399' }
export const changeStatusColor: Record<ChangeStatus, string> = {
  Pending: '#FBBF24', Approved: '#5E9BFF', Scheduled: '#A78BFA', Applied: '#34D399', Rejected: '#F87171',
}
export interface AuditEntry { time: string; actor: string; text: string; color: string }
export const seedAudit: AuditEntry[] = [
  { time: '02:14', actor: 'agent', text: 'Applied CHG-4817 — route-map restored on nexus-dc-fra-02, staged via HashiCorp Vault', color: '#34D399' },
  { time: '01:30', actor: 'operator · nkapoor', text: 'Approved CHG-4815 — NTP authentication, scheduled to nightly window', color: '#5E9BFF' },
  { time: '00:48', actor: 'agent', text: 'Drafted CHG-4820 — SNMP hardening across 8 devices, awaiting approval', color: '#FBBF24' },
  { time: 'Yesterday', actor: 'operator · rdiaz', text: 'Rejected CHG-4812 — bulk firmware push (outside change freeze)', color: '#F87171' },
]

// ----------------------------------------------------------------------------
// Topology — derive a core / region-hub / device graph from the fleet
// ----------------------------------------------------------------------------
export const regionHubs = ['NA', 'EMEA', 'APAC', 'LATAM'] as const
export type RegionCode = (typeof regionHubs)[number]
export function regionOf(device: Device): RegionCode {
  const head = device.region.split(' ')[0].toUpperCase()
  return (regionHubs as readonly string[]).includes(head) ? (head as RegionCode) : 'NA'
}

// ----------------------------------------------------------------------------
// Alerts — seed with a lifecycle status
// ----------------------------------------------------------------------------
export type AlertStatus = 'active' | 'acked' | 'snoozed'
