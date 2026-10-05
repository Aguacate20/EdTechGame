import { useEffect, useRef, useState } from 'react'

/** El velo del tutorial (Tutorial.dc.html) sin depender de z-index: un SVG
 *  fijo que oscurece toda la pantalla y RECORTA las zonas destacadas midiendo
 *  sus rectángulos, con borde naranja pulsante y un conector curvo desde la
 *  burbuja de Andy hasta el recorte más cercano. Se re-mide cada cuadro
 *  mientras el tutorial está activo (las zonas se mueven al arrastrar). */
interface Rect { x: number; y: number; w: number; h: number }
interface Flecha { x: number; y: number; abajo: boolean }

/** el ancestro que recorta al elemento porque tiene desplazamiento vertical propio */
function contenedorConScroll(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p
  }
  return null
}

const ZONA_A_ANCLA: Record<string, string> = { lienzo: 'mesa', mesa: 'mesa', mano: 'mano', herramientas: 'herramientas', afirmar: 'afirmar', pozo: 'pozo', pasivas: 'pasivas', carril: 'carril', parametro: 'parametro' }

export function TutorialVelo({ burbuja, foco }: { burbuja: React.RefObject<HTMLElement | null>; foco: { zona?: string; piezas?: string[]; herramientas?: string[]; relaciones?: string[] } | null }) {
  const [rects, setRects] = useState<Rect[]>([])
  const [bubble, setBubble] = useState<Rect | null>(null)
  const [flecha, setFlecha] = useState<Flecha | null>(null)
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    const medir = () => {
      if (!vivo.current) return
      // anclas con nombre fijo (data-tutorial / data-uid / data-herramienta); si no hay, la clase de siempre
      const sel: string[] = []
      // v6.11 · si el paso señala cartas o herramientas concretas, se recortan ELLAS y no toda
      // la columna: iluminar la mano entera no dice cuál hay que jugar
      const concreto = (foco?.piezas?.length ?? 0) + (foco?.herramientas?.length ?? 0) > 0
      const zonaEsContenedor = foco?.zona === 'mano' || foco?.zona === 'herramientas'
      if (foco?.zona && ZONA_A_ANCLA[foco.zona] && !(concreto && zonaEsContenedor)) sel.push(`[data-tutorial="${ZONA_A_ANCLA[foco.zona]}"]`)
      for (const u of foco?.piezas ?? []) sel.push(`[data-uid="${u}"]`)
      for (const h of foco?.herramientas ?? []) sel.push(`[data-herramienta="${h}"]`)
      // v6.14 · el tipo de vínculo que pide el paso; el botón solo existe con la Flecha abierta
      for (const r of foco?.relaciones ?? []) sel.push(`[data-relacion="${r}"]`)
      // v6.12 · con una herramienta señalada, el botón «Trazar» también es parte del paso
      if (foco?.herramientas?.length) sel.push('[data-tutorial="trazar"]')
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel.length ? sel.join(',') : '.batalla.con-foco .destacada'))
      // v6.15 · lo que queda fuera de la vista de su columna (hay que desplazarse) no se recorta
      // en un sitio falso: se marca con una flecha en el borde por donde hay que ir
      const nuevos: Rect[] = []
      let nuevaFlecha: Flecha | null = null
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const caja = contenedorConScroll(el)?.getBoundingClientRect()
        if (caja && (r.top > caja.bottom - 8 || r.bottom < caja.top + 8)) {
          const abajo = r.top > caja.bottom - 8
          nuevaFlecha ??= { x: caja.left + caja.width / 2, y: abajo ? caja.bottom - 26 : caja.top + 26, abajo }
          continue
        }
        const top = caja ? Math.max(r.top, caja.top) : r.top, bottom = caja ? Math.min(r.bottom, caja.bottom) : r.bottom
        const q = { x: r.left - 6, y: top - 6, w: r.width + 12, h: bottom - top + 12 }
        if (q.w > 16 && q.h > 16) nuevos.push(q)
      }
      setFlecha((prev) => (JSON.stringify(prev) === JSON.stringify(nuevaFlecha) ? prev : nuevaFlecha))
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(nuevos) ? prev : nuevos))
      const b = burbuja.current?.getBoundingClientRect()
      const nb = b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null
      setBubble((prev) => (JSON.stringify(prev) === JSON.stringify(nb) ? prev : nb))
      requestAnimationFrame(medir)
    }
    requestAnimationFrame(medir)
    // v6.15 · al empezar el paso, se trae a la vista lo señalado si su columna lo tapa
    const t = window.setTimeout(() => {
      const z = foco?.zona && ZONA_A_ANCLA[foco.zona] ? document.querySelector<HTMLElement>(`[data-tutorial="${ZONA_A_ANCLA[foco.zona]}"]`) : null
      if (z && contenedorConScroll(z)) z.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 350)
    return () => { vivo.current = false; window.clearTimeout(t) }
  }, [burbuja, foco])

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
      {flecha && (
        <g transform={`translate(${flecha.x} ${flecha.y})`}><g className="flecha-tutorial">
          <circle r="18" fill="#FF6A1A" />
          <path d={flecha.abajo ? 'M -7 -3 L 0 6 L 7 -3' : 'M -7 3 L 0 -6 L 7 3'} fill="none" stroke="#0A1230" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g></g>
      )}
      {conector && (
        <g>
          <path d={conector} fill="none" stroke="#FF6A1A" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" className="conector-tutorial" />
          <circle r="3.5" fill="#FF6A1A"><animateMotion dur="1.6s" repeatCount="indefinite" path={conector} /></circle>
        </g>
      )}
    </svg>
  )
}
