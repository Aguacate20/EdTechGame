import { useEffect, useRef } from 'react'
import type { Contenido } from '../content/types'
import { nivelDe, type Atlas } from '../engine/atlas'

/** La galaxia de conocimiento (canvas 2D con profundidad), según
 *  docs/diseno/galaxia.js: estrellas = conceptos, hilos = vínculos sostenidos,
 *  nebulosas = zonas del texto. Los estados salen del Atlas real:
 *  0 no tocada · 1 vista · 2 reconocida · 3 relacionada · 4 consolidada · 5 se te resiste.
 *  Modo «vivo» orbita y responde al arrastre; «quieto» es una miniatura. */
interface Props {
  contenido: Contenido
  atlas: Atlas | null
  modo?: 'vivo' | 'quieto'
  soloUnidad?: string | null
  alto?: number
  onEstrella?: (conceptId: string) => void
}

const C = { desc: '#38B6FF', sost: '#5BD36F', trans: '#9B6CFF', dom: '#FFC23D', texto: '#F3F6FF', t2: '#9AA7C7', rojo: '#FF5A5A', ambar: '#E0A33A' }
const NEBULOSAS = ['56,182,255', '91,211,111', '155,108,255', '255,194,61', '255,106,26', '224,163,58']

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967295 }

interface Estrella { id: string; nombre: string; zona: number; estado: number; x: number; y: number; z: number }

function estadoDe(a: Atlas | null, id: string): number {
  if (!a) return 0
  const e = a.conceptos[id]
  if (!e) return 0
  const fallos = e.fallos ?? 0, aciertos = e.aciertos ?? 0
  if (fallos > 0 && fallos >= aciertos) return 5
  const n = nivelDe(e)
  if (n >= 3) return 4
  if (n === 2) return 3
  if (n === 1) return 2
  return 1
}

/** Disposición estable: cada zona ocupa un sector; cada estrella una posición
 *  fija derivada de su id. No cambia entre sesiones ni entre lecturas nuevas. */
function disponer(c: Contenido, soloUnidad: string | null): Estrella[] {
  const zonas = new Map<string, number>()
  c.clusters.forEach((k, i) => zonas.set(k.id, i))
  const ids = c.ordenConceptos.filter((id) => !soloUnidad || c.conceptos[id].unidadId === soloUnidad)
  const nz = Math.max(1, c.clusters.length)
  return ids.map((id) => {
    const k = c.conceptos[id]
    const z = k.clusterId && zonas.has(k.clusterId) ? zonas.get(k.clusterId)! : (hash(id + 'z') * nz) | 0
    const ang = (z / nz) * Math.PI * 2 + (hash(id + 'a') - 0.5) * (Math.PI * 2 / nz) * 0.85
    const rad = 0.35 + hash(id + 'r') * 0.5
    return { id, nombre: k.titulo, zona: z, estado: 0, x: Math.cos(ang) * rad, y: (hash(id + 'y') - 0.5) * 0.7, z: Math.sin(ang) * rad }
  })
}

export function Galaxia({ contenido, atlas, modo = 'vivo', soloUnidad = null, alto = 420, onEstrella }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const estado = useRef({ rot: 0.6, tilt: 0.35, arrastre: null as null | { x: number; rot: number }, foco: null as string | null, quieto: modo === 'quieto' })

  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const g = cv.getContext('2d'); if (!g) return
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const estrellas = disponer(contenido, soloUnidad)
    for (const s of estrellas) s.estado = estadoDe(atlas, s.id)
    const idx = new Map(estrellas.map((s) => [s.id, s]))
    const firmes = atlas ? Object.values(atlas.aristas).filter((x) => (x.aciertos ?? 0) > 0) : []
    const propuestas = atlas ? Object.values(atlas.propuestas) : []
    const nombreZona = (z: number) => contenido.clusters[z]?.label ?? ''
    let vivo = true, t0 = performance.now()
    const proyectar = (s: Estrella, w: number, h: number) => {
      const st = estado.current
      const cr = Math.cos(st.rot), sr = Math.sin(st.rot)
      const x = s.x * cr - s.z * sr, z = s.x * sr + s.z * cr
      const y = s.y * Math.cos(st.tilt) + z * Math.sin(st.tilt)
      const zz = z * Math.cos(st.tilt) - s.y * Math.sin(st.tilt)
      const k = 1 / (1.9 - zz)
      return { x: w / 2 + x * k * Math.min(w, h) * 0.78, y: h / 2 + y * k * Math.min(w, h) * 0.78, k, z: zz }
    }
    const dibujar = (t: number) => {
      if (!vivo) return
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const st = estado.current
      if (!st.quieto && !st.arrastre && !reducido) st.rot += 0.00035 * Math.min(32, t - t0)
      t0 = t
      // nebulosas: una por zona, en el centroide proyectado
      const porZona = new Map<number, { x: number; y: number; n: number }>()
      const pos = estrellas.map((s) => ({ s, p: proyectar(s, w, h) }))
      for (const { s, p } of pos) { const z = porZona.get(s.zona) ?? { x: 0, y: 0, n: 0 }; z.x += p.x; z.y += p.y; z.n++; porZona.set(s.zona, z) }
      for (const [z, c] of porZona) {
        const cx = c.x / c.n, cy = c.y / c.n, r = Math.min(w, h) * (0.16 + 0.05 * Math.min(4, c.n))
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0.16)`); grad.addColorStop(1, `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0)`)
        g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill()
        if (!st.quieto && w > 480 && c.n >= 2) { g.font = '500 11px Manrope, sans-serif'; g.fillStyle = `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0.75)`; g.textAlign = 'center'; g.fillText(nombreZona(z), cx, cy - r * 0.55) }
      }
      // hilos: de atrás hacia adelante
      const P = new Map(pos.map(({ s, p }) => [s.id, p]))
      const hilo = (a: string, b: string, clase: 'firme' | 'propuesta') => {
        const pa = P.get(a), pb = P.get(b); if (!pa || !pb) return
        g.save()
        if (clase === 'firme') { g.strokeStyle = `rgba(56,182,255,${0.45 + 0.25 * Math.max(0, (pa.z + pb.z) / 2)})`; g.lineWidth = 1.6 }
        else { g.strokeStyle = C.trans; g.lineWidth = 1.4; g.setLineDash([4, 5]) }
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke(); g.restore()
      }
      for (const x of firmes) hilo(x.from, x.to, 'firme')
      for (const x of propuestas) hilo(x.from, x.to, 'propuesta')
      // estrellas
      pos.sort((a, b) => a.p.z - b.p.z)
      for (const { s, p } of pos) {
        let r = 2, col: string = C.t2, alfa = 1, label: string | null = null
        switch (s.estado) {
          case 0: r = 1.4; col = C.t2; alfa = 0.45; break
          case 1: r = 2; col = C.t2; label = C.t2; break
          case 2: r = 3; col = C.desc; label = C.texto; break
          case 3: r = 3.4; col = C.desc; label = C.texto; break
          case 4: r = 4.2; col = C.dom; label = C.texto; break
          case 5: r = 3; col = C.rojo; label = C.rojo; alfa = reducido ? 0.85 : 0.7 + 0.3 * Math.sin(t / 260); break
        }
        r *= 0.7 + p.k * 0.6
        g.save(); g.globalAlpha = alfa
        if (s.estado === 3) { g.strokeStyle = 'rgba(56,182,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 5, 0, 7); g.stroke() }
        if (s.estado === 4) { g.shadowColor = C.dom; g.shadowBlur = st.quieto || reducido ? 10 : 14 + 6 * Math.sin(t / 700 + p.x) }
        if (st.foco === s.id) { g.strokeStyle = '#FF6A1A'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, r + 8, 0, 7); g.stroke(); label = C.texto }
        g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill()
        if (label && w > 360 && (!st.quieto || s.estado >= 2)) {
          g.shadowBlur = 0; g.font = `${s.estado >= 4 ? 700 : 500} ${Math.round(10 + 2 * p.k)}px Manrope, sans-serif`; g.fillStyle = label; g.textAlign = 'center'
          const n = s.nombre.length > 26 ? s.nombre.slice(0, 24) + '…' : s.nombre
          g.fillText(n, p.x, p.y + r + 13)
        }
        g.restore()
      }
      if (!(st.quieto && reducido)) requestAnimationFrame(dibujar)
    }
    requestAnimationFrame(dibujar)
    const st = estado.current
    const cerca = (ev: PointerEvent) => {
      const rect = cv.getBoundingClientRect(); const mx = ev.clientX - rect.left, my = ev.clientY - rect.top
      let mejor: string | null = null, d0 = 18 * 18
      for (const s of estrellas) { const p = proyectar(s, rect.width, rect.height); const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < d0) { d0 = d; mejor = s.id } }
      return mejor
    }
    const abajo = (ev: PointerEvent) => { if (st.quieto) return; st.arrastre = { x: ev.clientX, rot: st.rot }; cv.setPointerCapture(ev.pointerId) }
    const mueve = (ev: PointerEvent) => { if (st.arrastre) { st.rot = st.arrastre.rot + (ev.clientX - st.arrastre.x) * 0.006 } else st.foco = cerca(ev) }
    const arriba = (ev: PointerEvent) => {
      if (st.arrastre && Math.abs(ev.clientX - st.arrastre.x) < 4) { const id = cerca(ev); if (id && onEstrella) onEstrella(id) }
      st.arrastre = null
    }
    cv.addEventListener('pointerdown', abajo); cv.addEventListener('pointermove', mueve); cv.addEventListener('pointerup', arriba)
    void idx
    return () => { vivo = false; cv.removeEventListener('pointerdown', abajo); cv.removeEventListener('pointermove', mueve); cv.removeEventListener('pointerup', arriba) }
  }, [contenido, atlas, soloUnidad, onEstrella])

  return <canvas ref={ref} className={`galaxia ${modo}`} style={{ height: alto }} role="img" aria-label="Tu galaxia de conocimiento" />
}
