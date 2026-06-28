// Color tokens — mirrors the C() / status palette from the original design.
export const C = {
  healthy: '#34D399',
  warning: '#FBBF24',
  critical: '#F87171',
  blue: '#5E9BFF',
  violet: '#A78BFA',
  cyan: '#22D3EE',
  muted: '#9DA9C0',
} as const

export type StatusKey = 'healthy' | 'warning' | 'critical'

// SVG path data for every glyph used across the app.
export const ICON = {
  switch: 'M3 7h18v4H3zM3 13h18v4H3zM7 9v0M7 15v0',
  firewall: 'M3 4h18v16H3zM3 9h18M9 4v5M15 9v5M3 14h18M9 14v6',
  lb: 'M12 3v6M12 9l-6 4M12 9l6 4M6 13v5M18 13v5M6 18h0M18 18h0M12 9h0',
  backup: 'M21 12a9 9 0 11-3-6.7M21 4v4h-4',
  comp: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  health: 'M22 12h-4l-3 9L9 3l-3 9H2',
  monitor: 'M3 3v18h18M7 14l3-4 3 3 4-6',
  ai: 'M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z',
} as const

export type DeviceType = 'switch' | 'firewall' | 'lb'

export function typeIcon(type: DeviceType): string {
  return type === 'firewall' ? ICON.firewall : type === 'lb' ? ICON.lb : ICON.switch
}
export function typeIconBg(type: DeviceType): string {
  return type === 'firewall' ? '#2A1F3A' : type === 'lb' ? '#1F3038' : '#15233A'
}
export function typeIconFg(type: DeviceType): string {
  return type === 'firewall' ? '#A78BFA' : type === 'lb' ? '#22D3EE' : '#5E9BFF'
}
