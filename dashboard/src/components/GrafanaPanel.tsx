import { card, sectionTitle } from './ui'

const GRAFANA_URL: string = import.meta.env.VITE_GRAFANA_URL ?? ''

export function GrafanaPanel({ panelId, title, height = 220 }: { panelId: number; title?: string; height?: number }) {
  if (!GRAFANA_URL) {
    return (
      <div style={{ ...card, padding: 16 }}>
        {title && <div style={{ ...sectionTitle, marginBottom: 8 }}>{title}</div>}
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            border: '1px dashed #1B2740',
            borderRadius: 10,
            background: '#0A0F1E',
            color: '#7A88A3',
            fontSize: 12.5,
            padding: 16,
          }}
        >
          Grafana is not configured (set VITE_GRAFANA_URL)
        </div>
      </div>
    )
  }

  const src = `${GRAFANA_URL}/d-solo/netops-overview/netops-overview?orgId=1&panelId=${panelId}&theme=dark&kiosk`

  return (
    <div style={{ ...card, padding: 16 }}>
      {title && <div style={{ ...sectionTitle, marginBottom: 8 }}>{title}</div>}
      <iframe
        src={src}
        title={title ?? `Grafana panel ${panelId}`}
        width="100%"
        height={height}
        frameBorder={0}
        style={{ border: '1px solid #1B2740', borderRadius: 10, background: '#0A0F1E', display: 'block' }}
      />
    </div>
  )
}
