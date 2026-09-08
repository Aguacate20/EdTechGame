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
  modo?: 'vivo' | 'quieto' | 'cierre'
  soloUnidad?: string | null
  alto?: number
  onEstrella?: (conceptId: string) => void
  /** modo cierre: lo ganado en esta expedición, que se dibuja delante del estudiante */
  nuevos?: { aristas: string[]; conceptos: string[] }
  /** id del cluster en foco: se acerca la cámara, el resto se atenúa */
  zonaFoco?: string | null
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

/** Disposición estable y escalable. Las zonas van sobre un anillo con el ángulo
 *  áureo (nunca se encima una con otra, aunque haya 20); el radio de cada zona
 *  crece con la raíz de su tamaño; cada estrella tiene una posición fija que
 *  sale de su id. Al final todo se normaliza para que la estrella más lejana
 *  quede en el borde: con 18 o con 400 conceptos la galaxia ocupa el mismo
 *  lienzo, solo cambia la densidad. No cambia entre sesiones ni al entrar
 *  lecturas nuevas: las estrellas nuevas aparecen apagadas donde les toca. */
const ANGULO_AUREO = 2.399963
function disponer(c: Contenido, soloUnidad: string | null): Estrella[] {
  const ids = c.ordenConceptos.filter((id) => !soloUnidad || c.conceptos[id].unidadId === soloUnidad)
  const zonaDe = (id: string) => { const k = c.conceptos[id]; const i = k.clusterId ? c.clusters.findIndex((z) => z.id === k.clusterId) : -1; return i >= 0 ? i : c.clusters.length + ((hash(id + 'z') * 3) | 0) }
  const tam = new Map<number, number>()
  for (const id of ids) tam.set(zonaDe(id), (tam.get(zonaDe(id)) ?? 0) + 1)
  const nz = Math.max(1, tam.size)
  const total = Math.max(1, ids.length)
  const centros = new Map<number, { x: number; y: number; z: number; r: number }>()
  ;[...tam.keys()].sort((a, b) => a - b).forEach((z, i) => {
    const ang = i * ANGULO_AUREO
    const anillo = nz === 1 ? 0 : 0.55 + 0.25 * ((i % 2) - 0.5)
    const r = 0.16 + 0.55 * Math.sqrt((tam.get(z) ?? 1) / total)
    centros.set(z, { x: Math.cos(ang) * anillo, y: (hash(`zona${z}`) - 0.5) * 0.5, z: Math.sin(ang) * anillo, r })
  })
  const estrellas = ids.map((id) => {
    const k = c.conceptos[id], z = zonaDe(id), cz = centros.get(z)!
    const a = hash(id + 'a') * Math.PI * 2, b = (hash(id + 'b') - 0.5) * Math.PI, rr = cz.r * (0.25 + 0.75 * Math.sqrt(hash(id + 'r')))
    return { id, nombre: k.titulo, zona: z, estado: 0, x: cz.x + Math.cos(a) * Math.cos(b) * rr, y: cz.y + Math.sin(b) * rr * 0.6, z: cz.z + Math.sin(a) * Math.cos(b) * rr }
  })
  const lejos = Math.max(0.001, ...estrellas.map((s) => Math.hypot(s.x, s.y, s.z)))
  for (const s of estrellas) { s.x = (s.x / lejos) * 0.92; s.y = (s.y / lejos) * 0.92; s.z = (s.z / lejos) * 0.92 }
  return estrellas
}

export function Galaxia({ contenido, atlas, modo = 'vivo', soloUnidad = null, alto = 420, onEstrella, nuevos, zonaFoco = null }: Props) {
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
    // cierre: qué es nuevo, y en qué orden se revela (700 ms por hilo, tras 500 ms)
    const nuevasAristas = new Set(nuevos?.aristas ?? [])
    const nuevosConceptos = new Set(nuevos?.conceptos ?? [])
    const ordenNuevas = [...firmes.filter((x) => nuevasAristas.has(`${x.from}>${x.to}>${x.tipo}`) || nuevasAristas.has(`${x.from}|${x.to}`) || nuevasAristas.has(`${x.from}>${x.to}`))]
    const tInicio = performance.now()
    const revelado = (i: number, t: number) => modo !== 'cierre' ? 1 : Math.max(0, Math.min(1, (t - tInicio - 500 - i * 700) / 600))
    const nombreZona = (z: number) => contenido.clusters[z]?.label ?? ''
    let vivo = true, t0 = performance.now()
    const proyectar = (s: Estrella, w: number, h: number) => {
      const st = estado.current
      const cr = Math.cos(st.rot), sr = Math.sin(st.rot)
      const x = s.x * cr - s.z * sr, z = s.x * sr + s.z * cr
      const y = s.y * Math.cos(st.tilt) + z * Math.sin(st.tilt)
      const zz = z * Math.cos(st.tilt) - s.y * Math.sin(st.tilt)
      const k = 1 / (1.9 - zz)
      return { x: w / 2 + x * k * Math.min(w, h) * 0.66, y: h / 2 + y * k * Math.min(w, h) * 0.66, k, z: zz }
    }
    const zonaFocoIdx = zonaFoco ? contenido.clusters.findIndex((z) => z.id === zonaFoco) : -1
    const densa = estrellas.length > 60
    // presupuesto de etiquetas: con muchas estrellas solo se nombran las que más brillan
    const importancia = (id: string) => contenido.conceptos[id]?.importancia ?? 0
    const conEtiqueta = new Set(
      [...estrellas].sort((a, b) => b.estado - a.estado || importancia(b.id) - importancia(a.id)).slice(0, densa ? 22 : 40).map((s) => s.id)
    )
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
      let pos = estrellas.map((s) => ({ s, p: proyectar(s, w, h) }))
      if (zonaFocoIdx >= 0) {
        // la cámara se acerca a la zona: se centra en su centroide y amplía ×1.6
        const enFoco = pos.filter(({ s }) => s.zona === zonaFocoIdx)
        if (enFoco.length) {
          const cx = enFoco.reduce((n, { p }) => n + p.x, 0) / enFoco.length, cy = enFoco.reduce((n, { p }) => n + p.y, 0) / enFoco.length
          pos = pos.map(({ s, p }) => ({ s, p: { ...p, x: w / 2 + (p.x - cx) * 1.6, y: h / 2 + (p.y - cy) * 1.6 } }))
        }
      }
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
      const hilo = (a: string, b: string, clase: 'firme' | 'propuesta' | 'nuevo', avance = 1) => {
        const pa = P.get(a), pb = P.get(b); if (!pa || !pb || avance <= 0) return
        g.save()
        if (clase === 'nuevo') { g.strokeStyle = C.dom; g.lineWidth = 2.2; g.shadowColor = C.dom; g.shadowBlur = 10 }
        else if (clase === 'firme') { g.strokeStyle = `rgba(56,182,255,${0.45 + 0.25 * Math.max(0, (pa.z + pb.z) / 2)})`; g.lineWidth = 1.6 }
        else { g.strokeStyle = C.trans; g.lineWidth = 1.4; g.setLineDash([4, 5]) }
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pa.x + (pb.x - pa.x) * avance, pa.y + (pb.y - pa.y) * avance); g.stroke()
        if (clase === 'nuevo' && avance < 1) { g.fillStyle = '#fff'; g.beginPath(); g.arc(pa.x + (pb.x - pa.x) * avance, pa.y + (pb.y - pa.y) * avance, 3, 0, 7); g.fill() }
        g.restore()
      }
      const esNueva = (x: { from: string; to: string; tipo: string }) => ordenNuevas.includes(x as never)
      for (const x of firmes) if (!esNueva(x)) hilo(x.from, x.to, 'firme')
      for (const x of propuestas) hilo(x.from, x.to, 'propuesta')
      ordenNuevas.forEach((x, i) => hilo(x.from, x.to, 'nuevo', revelado(i, t)))
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
        if (densa && s.estado === 0) { r *= 0.8; alfa *= 0.7 }
        if (zonaFocoIdx >= 0 && s.zona !== zonaFocoIdx) { alfa *= 0.3; label = null }
        if (!conEtiqueta.has(s.id) && st.foco !== s.id) label = null
        g.save(); g.globalAlpha = alfa
        if (s.estado === 3) { g.strokeStyle = 'rgba(56,182,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 5, 0, 7); g.stroke() }
        if (s.estado === 4) { g.shadowColor = C.dom; g.shadowBlur = st.quieto || reducido ? 10 : 14 + 6 * Math.sin(t / 700 + p.x) }
        if (nuevosConceptos.has(s.id)) {
          // subió de estado en esta expedición: destello blanco que se apaga en 2 s
          const d = modo === 'cierre' ? Math.max(0, 1 - (t - tInicio - 500) / 2000) : 0
          if (d > 0) { g.shadowColor = '#fff'; g.shadowBlur = 40 * d; r += 6 * d; label = C.texto }
        }
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
  }, [contenido, atlas, soloUnidad, onEstrella, modo, nuevos, zonaFoco])

  return <canvas ref={ref} className={`galaxia ${modo}`} style={{ height: alto }} role="img" aria-label="Tu galaxia de conocimiento" />
}
