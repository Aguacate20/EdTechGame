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

const ZONA_A_ANCLA: Record<string, string> = { lienzo: 'mesa', mesa: 'mesa', mano: 'mano', herramientas: 'herramientas', afirmar: 'afirmar', pozo: 'pozo', pasivas: 'pasivas', carril: 'carril', parametro: 'parametro', trazar: 'trazar', quemar: 'quemar', resultado: 'resultado' }

export function TutorialVelo({ burbuja, foco }: { burbuja: React.RefObject<HTMLElement | null>; foco: { zona?: string; piezas?: string[]; herramientas?: string[]; relaciones?: string[]; ilumina?: string[]; arrastrar?: boolean; grupo?: boolean } | null }) {
  const [rects, setRects] = useState<Rect[]>([])
  const [bubble, setBubble] = useState<Rect | null>(null)
  const [flecha, setFlecha] = useState<Flecha | null>(null)
  /** v6.60 · huecos sin borde para los números «Toca 1, 2, 3»: encendidos, pero el marco naranja ciñe solo la carta */
  const [extras, setExtras] = useState<Rect[]>([])
  /** v6.29 · «arrastra esto hasta aquí»: de la carta señalada en la mano al centro de la mesa */
  const [arrastre, setArrastre] = useState<string | null>(null)
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    const medir = () => {
      if (!vivo.current) return
      // anclas con nombre fijo (data-tutorial / data-uid / data-herramienta); si no hay, la clase de siempre
      const armar = (il?: string[]) => {
        const s: string[] = []
        const ve = (k: string) => !il || il.includes(k)
        // v6.11 · si el paso señala cartas o herramientas concretas, se recortan ELLAS y no toda
        // la columna: iluminar la mano entera no dice cuál hay que jugar
        const concreto = (foco?.piezas?.length ?? 0) + (foco?.herramientas?.length ?? 0) > 0
        const zonaEsContenedor = foco?.zona === 'mano' || foco?.zona === 'herramientas'
        if (ve('zona') && foco?.zona && ZONA_A_ANCLA[foco.zona] && !(concreto && zonaEsContenedor)) s.push(`[data-tutorial="${ZONA_A_ANCLA[foco.zona]}"]`)
        if (ve('piezas')) for (const u of foco?.piezas ?? []) s.push(`[data-uid="${u}"]`)
        // v6.60 · una herramienta ya elegida deja de señalarse: la atención pasa a las cartas
        if (ve('herramientas')) for (const h of foco?.herramientas ?? []) s.push(`[data-herramienta="${h}"]:not(.activa)`)
        // v6.14 · el tipo de vínculo que pide el paso; el botón solo existe con la Flecha abierta
        if (ve('relaciones')) for (const r of foco?.relaciones ?? []) s.push(`[data-relacion="${r}"]`)
        // v6.12 · con una herramienta señalada, el botón «Trazar» también es parte del paso
        if (il ? il.includes('trazar') : foco?.herramientas?.length) s.push('[data-tutorial="trazar"]')
        // v6.45 · al arrastrar, también se enciende el sitio donde va la carta
        if (foco?.arrastrar) s.push('[data-tutorial="silueta"]')
        return s
      }
      // v6.29 · un paso, una sola cosa encendida; si eso no está en pantalla (cerró la
      // herramienta, p. ej.), se enciende todo lo del foco para que nunca quede a oscuras
      let sel = armar(foco?.ilumina)
      if (foco?.ilumina && !(sel.length && document.querySelector(sel.join(',')))) sel = armar()
      // v6.61 · a qué apunta Andy ahora: la carta que toca; si ya están todas, el tipo de conexión
      // que falta elegir; y si no falta nada, el botón «Trazar»
      const activa = document.querySelector('.herr-v.activa')
      const objetivo: HTMLElement | null =
        document.querySelector<HTMLElement>('.toca-num.sigue')?.closest<HTMLElement>('[data-uid]') ??
        (activa
          ? ((foco?.relaciones ?? []).map((r) => document.querySelector<HTMLElement>(`[data-relacion="${r}"]:not(.activa)`)).find(Boolean) ??
             document.querySelector<HTMLElement>('[data-tutorial="trazar"]:not(:disabled)'))
          : null)
      const els0 = Array.from(document.querySelectorAll<HTMLElement>(sel.length ? sel.join(',') : '.batalla.con-foco .destacada'))
      let els = objetivo && !els0.includes(objetivo) ? [...els0, objetivo] : els0
      // un solo recuadro para el grupo de cartas de la mesa: así se ven también sus líneas
      let grupoRect: Rect | null = null
      if (foco?.grupo) {
        const enMesa = els.filter((x) => x.classList.contains('en-tablero'))
        if (enMesa.length) {
          const rs = enMesa.map((x) => x.getBoundingClientRect())
          const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top)), x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom))
          grupoRect = { x: x0 - 14, y: y0 - 14, w: x1 - x0 + 28, h: y1 - y0 + 28 }
          els = els.filter((x) => !x.classList.contains('en-tablero'))
        }
      }
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
        // v6.58 · las cartas de la mesa llevan su número encima: el recorte sube para que se vea encendido
        const q = { x: r.left - 6, y: top - 6, w: r.width + 12, h: bottom - top + 12 }
        // la carta que toca ahora va primero: hacia ella apunta la línea de Andy
        if (q.w > 16 && q.h > 16) { if (el === objetivo) nuevos.unshift(q); else nuevos.push(q) }
      }
      if (grupoRect) nuevos.push(grupoRect)
      let na: string | null = null
      if (foco?.arrastrar) {
        const origen = (foco.piezas ?? []).map((u) => document.querySelector<HTMLElement>(`[data-tutorial="mano"] [data-uid="${u}"]`)).find(Boolean)
        const mesa = document.querySelector<HTMLElement>('[data-tutorial="silueta"]') ?? document.querySelector<HTMLElement>('[data-tutorial="mesa"]')
        if (origen && mesa) {
          const o = origen.getBoundingClientRect(), m = mesa.getBoundingClientRect()
          const x0 = Math.round(o.left - 4), y0 = Math.round(o.top + o.height / 2)
          const x1 = Math.round(m.left + m.width * 0.5), y1 = Math.round(mesa.dataset.tutorial === 'silueta' ? m.top - 10 : m.top + m.height * 0.5)
          na = `M ${x0} ${y0} Q ${Math.round((x0 + x1) / 2)} ${Math.min(y0, y1) - 90}, ${x1} ${y1}`
        }
      }
      setArrastre((prev) => (prev === na ? prev : na))
      setFlecha((prev) => (JSON.stringify(prev) === JSON.stringify(nuevaFlecha) ? prev : nuevaFlecha))
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(nuevos) ? prev : nuevos))
      const ex = Array.from(document.querySelectorAll<HTMLElement>('.toca-num, .naipe.en-tablero.marcada .orden')).map((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.left - 4), y: Math.round(r.top - 8), w: Math.round(r.width + 8), h: Math.round(r.height + 18) } })
      setExtras((prev) => (JSON.stringify(prev) === JSON.stringify(ex) ? prev : ex))
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
      // v6.33 · la herramienta señalada se trae sola a la vista: nadie tiene que adivinar que hay que subir
      const h = foco?.herramientas?.[0] ? document.querySelector<HTMLElement>(`[data-herramienta="${foco.herramientas[0]}"]`) : null
      if (h && contenedorConScroll(h)) h.scrollIntoView({ block: 'center', behavior: 'smooth' })
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
          {extras.map((r, i) => <rect key={`x${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx="13" fill="#000" />)}
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
          <rect x="-58" y="-18" width="116" height="36" rx="18" fill="#FF6A1A" />
          <text x="12" y="5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0A1230">{flecha.abajo ? 'Baja aquí' : 'Sube aquí'}</text>
          <g transform="translate(-40 0)">
          <path d={flecha.abajo ? 'M -7 -3 L 0 6 L 7 -3' : 'M -7 3 L 0 -6 L 7 3'} fill="none" stroke="#0A1230" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g></g>
      )}
      {arrastre && (
        <g className="arrastre-tutorial">
          <defs><marker id="punta-arrastre" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M 1 1 L 8 5 L 1 9" fill="none" stroke="#FFD23F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
          <path d={arrastre} fill="none" stroke="#0A1230" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
          <path d={arrastre} fill="none" stroke="#FFD23F" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" markerEnd="url(#punta-arrastre)" />
          <g>
            <circle r="13" fill="#FFD23F" opacity="0.35" /><circle r="7" fill="#FFD23F" stroke="#0A1230" strokeWidth="2" />
            <animateMotion dur="1.5s" repeatCount="indefinite" path={arrastre} />
          </g>
        </g>
      )}
      {conector && !arrastre && (
        <g>
          <path d={conector} fill="none" stroke="#FF6A1A" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" className="conector-tutorial" />
          <circle r="3.5" fill="#FF6A1A"><animateMotion dur="1.6s" repeatCount="indefinite" path={conector} /></circle>
        </g>
      )}
    </svg>
  )
}
