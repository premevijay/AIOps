// Render a trusted HTML snippet (mock data uses <b>/<code> inline markup).
export function Html({ html, style, as = 'span' }: { html: string; style?: React.CSSProperties; as?: 'span' | 'div' }) {
  const Tag = as
  return <Tag style={style} dangerouslySetInnerHTML={{ __html: html }} />
}

export const card: React.CSSProperties = {
  background: '#0E1426',
  border: '1px solid #1B2740',
  borderRadius: 14,
  padding: 18,
}

export const sectionTitle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  fontFamily: 'Space Grotesk',
}
