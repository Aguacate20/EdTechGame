import { useEffect, useRef, useState } from 'react'

/** El velo del tutorial (Tutorial.dc.html) sin depender de z-index: un SVG
 *  fijo que oscurece toda la pantalla y RECORTA las zonas destacadas midiendo
 *  sus rectángulos, con borde naranja pulsante y un conector curvo desde la
 *  burbuja de Andy hasta el recorte más cercano. Se re-mide cada cuadro
 *  mientras el tutorial está activo (las zonas se mueven al arrastrar). */
interface Rect { x: number; y: number; w: number; h: number }

export function TutorialVelo({ burbuja }: { burbuja: React.RefObject<HTMLElement | null> }) {
  const [rects, setRects] = useState<Rect[]>([])
  const [bubble, setBubble] = useState<Rect | null>(null)
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    const medir = () => {
      if (!vivo.current) return
      const els = Array.from(document.querySelectorAll<HTMLElement>('.batalla.con-foco .destacada'))
      const nuevos = els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } })
        .filter((r) => r.w > 20 && r.h > 20)
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(nuevos) ? prev : nuevos))
      const b = burbuja.current?.getBoundingClientRect()
      const nb = b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null
      setBubble((prev) => (JSON.stringify(prev) === JSON.stringify(nb) ? prev : nb))
      requestAnimationFrame(medir)
    }
    requestAnimationFrame(medir)
    return () => { vivo.current = false }
  }, [burbuja])

  const W = window.innerWidth, H = window.innerHeight
  // conector: del borde de la burbuja al punto más cercano del primer recorte
  let conector: string | null = null
  if (bubble && rects[0]) {
    const r = rects[0]
    const bx = bubble.x + bubble.w / 2, by = bubble.y + bubble.h / 2
    const tx = Math.max(r.x, Math.min(bx, r.x + r.w)), ty = Math.max(r.y, Math.min(by, r.y + r.h))
    const sx = bx > tx ? bubble.x : bubble.x + bubble.w
    const sy = Math.max(bubble.y + 12, Math.min(by, bubble.y + bubble.h - 12))
    const cx = (sx + tx) / 2
    conector = `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`
  }
  return (
    <svg className="velo-tutorial" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <mask id="velo-recortes">
          <rect x="0" y="0" width={W} height={H} fill="#fff" />
          {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="12" fill="#000" />)}
        </mask>
        <filter id="velo-glow"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="rgba(10,18,48,0.78)" mask="url(#velo-recortes)" />
      {rects.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="12" fill="none" stroke="#FF6A1A" strokeWidth="6" opacity="0.45" filter="url(#velo-glow)" className="recorte-pulso" />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="12" fill="none" stroke="#FF6A1A" strokeWidth="2" />
        </g>
      ))}
      {conector && (
        <g>
          <path d={conector} fill="none" stroke="#FF6A1A" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" className="conector-tutorial" />
          <circle r="3.5" fill="#FF6A1A"><animateMotion dur="1.6s" repeatCount="indefinite" path={conector} /></circle>
        </g>
      )}
    </svg>
  )
}
