import { useId } from 'react'

// Small inline SVG chart primitives — direct ports of the prototype helpers.

export function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 70, h = 26
  const mx = Math.max(...data), mn = Math.min(...data)
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / (mx - mn || 1)) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Donut({ segs }: { segs: { v: number; color: string }[] }) {
  const r = 34, c = 2 * Math.PI * r
  let off = 0
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={48} cy={48} r={r} fill="none" stroke="#0A0F1E" strokeWidth={11} />
      {segs.map((s, i) => {
        const len = c * s.v
        const el = (
          <circle
            key={i}
            cx={48}
            cy={48}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={11}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-off}
            transform="rotate(-90 48 48)"
            strokeLinecap="round"
          />
        )
        off += len
        return el
      })}
      <text x={48} y={46} textAnchor="middle" fill="#E6ECF5" fontSize={18} fontWeight={700} fontFamily="Space Grotesk">
        96.2%
      </text>
      <text x={48} y={60} textAnchor="middle" fill="#5C6B85" fontSize={9}>
        HEALTHY
      </text>
    </svg>
  )
}

export function Area({ data, color }: { data: number[]; color: string }) {
  const w = 200, h = 46
  const mx = Math.max(...data), mn = Math.min(...data) * 0.9
  const xs = (i: number) => (i / (data.length - 1)) * w
  const ys = (v: number) => h - ((v - mn) / (mx - mn || 1)) * (h - 6) - 3
  const line = data.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')
  const fill = `0,${h} ${line} ${w},${h}`
  const id = useId().replace(/:/g, '')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  )
}

export function MiniBars({ data, color }: { data: number[]; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '22px' }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width: '4px',
            height: `${Math.max(15, v)}%`,
            background: color,
            borderRadius: '2px',
            opacity: 0.55 + (i / data.length) * 0.45,
          }}
        />
      ))}
    </div>
  )
}

export function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 18, c = 2 * Math.PI * r, len = (c * pct) / 100
  return (
    <svg width={46} height={46} viewBox="0 0 46 46">
      <circle cx={23} cy={23} r={r} fill="none" stroke="#11192B" strokeWidth={4} />
      <circle
        cx={23}
        cy={23}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${len} ${c - len}`}
        transform="rotate(-90 23 23)"
        strokeLinecap="round"
      />
      <text x={23} y={27} textAnchor="middle" fill="#E6ECF5" fontSize={13} fontWeight={700} fontFamily="Space Grotesk">
        {pct}
      </text>
    </svg>
  )
}

export function CapDots({ set }: { set: string }) {
  const cl: Record<string, string> = { B: '#34D399', C: '#5E9BFF', H: '#A78BFA', M: '#22D3EE', A: '#FBBF24' }
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {(['B', 'C', 'H', 'M', 'A'] as const).map((k) => (
        <span
          key={k}
          title={k}
          style={{ width: '7px', height: '7px', borderRadius: '2px', background: set.includes(k) ? cl[k] : '#26324B' }}
        />
      ))}
    </div>
  )
}

// Generic stroked-path icon used throughout.
export function Icon({
  d,
  size = 17,
  stroke = 'currentColor',
  width = 1.9,
  style,
}: {
  d: string
  size?: number
  stroke?: string
  width?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  )
}
