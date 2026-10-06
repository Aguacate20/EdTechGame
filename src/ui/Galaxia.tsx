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
  // v5.94 · nada encimado: relajación en el plano (x,y) hasta una distancia mínima
  // v6.55 · más aire entre estrellas: los nombres necesitan sitio
  const minimo = Math.min(0.34, Math.max(0.07, 0.34 / Math.sqrt(Math.max(1, estrellas.length / 12))))
  for (let it = 0; it < 40; it++) {
    for (let i = 0; i < estrellas.length; i++) for (let j = i + 1; j < estrellas.length; j++) {
      const A = estrellas[i], B = estrellas[j]
      // en 3D: así la separación se mantiene aunque la galaxia gire
      let dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z
      const d = Math.hypot(dx, dy, dz) || 1e-4
      if (d < minimo) { const f = ((minimo - d) / d) * 0.5; dx *= f; dy *= f; dz *= f; A.x -= dx; A.y -= dy; A.z -= dz; B.x += dx; B.y += dy; B.z += dz }
    }
  }
  // si al separarlas alguna se salió, todo se encoge lo justo para caber
  const fuera = Math.max(0.001, ...estrellas.map((q) => Math.hypot(q.x, q.y, q.z)))
  if (fuera > 0.95) for (const q of estrellas) { q.x *= 0.95 / fuera; q.y *= 0.95 / fuera; q.z *= 0.95 / fuera }
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
    // v5.79 · lo cristalizado: pares de conceptos de constelaciones consolidadas (oro permanente)
    const cristalizadas = new Set<string>()
    const estrellasCristalizadas = new Set<string>()
    for (const k of atlas?.constelaciones ?? []) {
      for (const id of k.conceptIds) estrellasCristalizadas.add(id)
      for (const f of k.aristas) { const [tool, ids] = f.split('|'); if (tool && ids) cristalizadas.add(ids) }
    }
    const parCristalizado = (a: string, b: string) => cristalizadas.has([a, b].sort().join(','))
    for (const s of estrellas) s.estado = estadoDe(atlas, s.id)
    for (const s of estrellas) if (estrellasCristalizadas.has(s.id) && s.estado < 4) s.estado = 4
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
      return { x: w / 2 + x * k * Math.min(w, h) * 0.66 * Math.min(1.7, Math.max(1, w / Math.max(1, h))), y: h / 2 + y * k * Math.min(w, h) * 0.66, k, z: zz }
    }
    const zonaFocoIdx = zonaFoco ? contenido.clusters.findIndex((z) => z.id === zonaFoco) : -1
    const densa = estrellas.length > 60
    // presupuesto de etiquetas: con muchas estrellas solo se nombran las que más brillan
    const importancia = (id: string) => contenido.conceptos[id]?.importancia ?? 0
    const conEtiqueta = new Set(
      [...estrellas].sort((a, b) => b.estado - a.estado || importancia(b.id) - importancia(a.id)).slice(0, densa ? 22 : 40).map((s) => s.id)
    )
    // v6.55 · polvo de estrellas de fondo: posiciones fijas que giran más despacio (profundidad)
    let semilla = 20260
    const azar = () => { semilla = (semilla + 0x6D2B79F5) | 0; let x = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
    const polvo = Array.from({ length: 140 }, () => ({
      a: azar() * Math.PI * 2, d: 0.15 + azar() * 1.25, y: (azar() - 0.5) * 1.5,
      r: 0.4 + azar() * 1.1, f: 400 + azar() * 1600, c: azar()
    }))
    const encendidasTotal = estrellas.filter((x) => x.estado >= 2).length
    const avanceTotal = encendidasTotal / Math.max(1, estrellas.length)
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
      // etiquetas sin encimarse: cada una reserva su rectángulo; la que no cabe prueba otro lado o se calla
      const ocupados: { x: number; y: number; w: number; h: number }[] = []
      const libre = (q: { x: number; y: number; w: number; h: number }) =>
        q.x >= 2 && q.y >= 2 && q.x + q.w <= w - 2 && q.y + q.h <= h - 2 &&
        !ocupados.some((o) => q.x < o.x + o.w && q.x + q.w > o.x && q.y < o.y + o.h && q.y + q.h > o.y)
      const pendientes: { texto: string; x: number; y: number; r: number; color: string; fuente: string; prio: number }[] = []
      // fondo: polvo que titila y un núcleo que crece con lo que llevas encendido
      {
        const m = Math.min(w, h)
        const nuc = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, m * (0.18 + 0.22 * avanceTotal))
        nuc.addColorStop(0, `rgba(255,214,140,${0.05 + 0.2 * avanceTotal})`); nuc.addColorStop(0.5, `rgba(120,150,255,${0.04 + 0.08 * avanceTotal})`); nuc.addColorStop(1, 'rgba(120,150,255,0)')
        g.fillStyle = nuc; g.beginPath(); g.arc(w / 2, h / 2, m * 0.45, 0, 7); g.fill()
        for (const q of polvo) {
          const ang = q.a + st.rot * 0.35
          const x = w / 2 + Math.cos(ang) * q.d * m * 0.55, y = h / 2 + q.y * m * 0.42 + Math.sin(ang) * q.d * m * 0.12
          if (x < 0 || x > w || y < 0 || y > h) continue
          g.globalAlpha = reducido ? 0.35 : 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t / q.f + q.a * 7))
          g.fillStyle = q.c > 0.85 ? '#FFD9A0' : q.c > 0.7 ? '#A9C8FF' : '#DCE6FF'
          g.beginPath(); g.arc(x, y, q.r, 0, 7); g.fill()
        }
        g.globalAlpha = 1
      }
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
      const litZona = new Map<number, number>()
      for (const { s, p } of pos) { const z = porZona.get(s.zona) ?? { x: 0, y: 0, n: 0 }; z.x += p.x; z.y += p.y; z.n++; porZona.set(s.zona, z); if (s.estado >= 2) litZona.set(s.zona, (litZona.get(s.zona) ?? 0) + 1) }
      for (const [z, c] of porZona) {
        const cx = c.x / c.n, cy = c.y / c.n, r = Math.min(w, h) * (0.16 + 0.05 * Math.min(4, c.n))
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r)
        // la zona se enciende a medida que la estudias: de apenas visible a nebulosa viva
        const lit = (litZona.get(z) ?? 0) / c.n
        const fuerza = 0.07 + 0.22 * lit + (reducido ? 0 : 0.02 * Math.sin(t / 1800 + z))
        grad.addColorStop(0, `rgba(${NEBULOSAS[z % NEBULOSAS.length]},${fuerza})`); grad.addColorStop(0.6, `rgba(${NEBULOSAS[z % NEBULOSAS.length]},${fuerza * 0.35})`); grad.addColorStop(1, `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0)`)
        g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill()
        if (!st.quieto && w > 480 && c.n >= 2 && nombreZona(z)) {
          const texto = `${nombreZona(z).replace(/^Zona de /, '').toUpperCase()} · ${litZona.get(z) ?? 0}/${c.n}`
          g.font = '800 10.5px Manrope, sans-serif'
          const tw = g.measureText(texto).width + 16
          // el rótulo de zona busca sitio arriba de su nebulosa; si choca con otro, baja
          for (const dy of [-r * 0.62, -r * 0.85, r * 0.7, -r * 0.4]) {
            const q = { x: cx - tw / 2, y: cy + dy - 10, w: tw, h: 19 }
            if (!libre(q)) continue
            ocupados.push(q)
            g.fillStyle = 'rgba(8,14,40,0.72)'; g.beginPath(); g.roundRect(q.x, q.y, q.w, q.h, 9); g.fill()
            g.strokeStyle = `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0.55)`; g.lineWidth = 1; g.stroke()
            g.fillStyle = `rgba(${NEBULOSAS[z % NEBULOSAS.length]},0.95)`; g.textAlign = 'center'; g.fillText(texto, cx, q.y + 13)
            break
          }
        }
      }
      // hilos: de atrás hacia adelante
      const P = new Map(pos.map(({ s, p }) => [s.id, p]))
      const hilo = (a: string, b: string, clase: 'firme' | 'propuesta' | 'nuevo', avance = 1) => {
        const pa = P.get(a), pb = P.get(b); if (!pa || !pb || avance <= 0) return
        g.save()
        if (clase === 'nuevo') { g.strokeStyle = C.dom; g.lineWidth = 2.2; g.shadowColor = C.dom; g.shadowBlur = 10 }
        else if (clase === 'firme' && parCristalizado(a, b)) { g.strokeStyle = C.dom; g.lineWidth = 2; g.shadowColor = C.dom; g.shadowBlur = 8 }
        else if (clase === 'firme') { g.strokeStyle = `rgba(56,182,255,${0.45 + 0.25 * Math.max(0, (pa.z + pb.z) / 2)})`; g.lineWidth = 1.6 }
        else { g.strokeStyle = C.trans; g.lineWidth = 1.4; g.setLineDash([4, 5]) }
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pa.x + (pb.x - pa.x) * avance, pa.y + (pb.y - pa.y) * avance); g.stroke()
        if (clase === 'firme' && !reducido && !st.quieto) {
          // un destello recorre cada conexión que ya dominas
          const u = ((t / 2600) + hash(a + b)) % 1
          g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillStyle = 'rgba(255,255,255,0.9)'
          g.beginPath(); g.arc(pa.x + (pb.x - pa.x) * u, pa.y + (pb.y - pa.y) * u, 1.6, 0, 7); g.fill()
        }
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
        if (s.estado >= 2 && s.estado <= 4) {
          // halo: las estrellas encendidas iluminan su alrededor
          const hr = r * (s.estado === 4 ? 5.5 : 4)
          const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr)
          halo.addColorStop(0, s.estado === 4 ? 'rgba(255,194,61,0.38)' : 'rgba(56,182,255,0.30)'); halo.addColorStop(1, 'rgba(0,0,0,0)')
          g.save(); g.shadowBlur = 0; g.fillStyle = halo; g.beginPath(); g.arc(p.x, p.y, hr, 0, 7); g.fill(); g.restore()
        }
        if (s.estado === 0) { g.strokeStyle = 'rgba(180,195,235,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 1.5, 0, 7); g.stroke() }
        g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill()
        if (s.estado === 4) {
          // destello en cruz de las dominadas
          const L = r * (2.6 + (reducido ? 0 : 0.7 * Math.sin(t / 500 + p.x)))
          g.strokeStyle = 'rgba(255,236,180,0.85)'; g.lineWidth = 1.1
          g.beginPath(); g.moveTo(p.x - L, p.y); g.lineTo(p.x + L, p.y); g.moveTo(p.x, p.y - L); g.lineTo(p.x, p.y + L); g.stroke()
        }
        if (label && w > 360 && (!st.quieto || s.estado >= 2)) {
          const n = s.nombre.length > 24 ? s.nombre.slice(0, 22) + '…' : s.nombre
          pendientes.push({ texto: n, x: p.x, y: p.y, r, color: label, fuente: `${s.estado >= 4 ? 700 : 600} ${Math.round(10 + 2 * p.k)}px Manrope, sans-serif`,
            prio: (st.foco === s.id ? 1000 : 0) + s.estado * 10 + importancia(s.id) * 5 + p.z })
        }
        g.restore()
      }
      // segunda pasada: los nombres, del más importante al menos, cada uno donde quepa
      pendientes.sort((a, b) => b.prio - a.prio)
      for (const e of pendientes) {
        g.font = e.fuente
        const tw = g.measureText(e.texto).width + 6, th = 15
        const sitios = [
          { x: e.x - tw / 2, y: e.y + e.r + 3, ax: 'center' as const, tx: e.x, ty: e.y + e.r + 14 },
          { x: e.x - tw / 2, y: e.y - e.r - th - 3, ax: 'center' as const, tx: e.x, ty: e.y - e.r - 6 },
          { x: e.x + e.r + 5, y: e.y - th / 2, ax: 'left' as const, tx: e.x + e.r + 8, ty: e.y + 4 },
          { x: e.x - e.r - 5 - tw, y: e.y - th / 2, ax: 'right' as const, tx: e.x - e.r - 8, ty: e.y + 4 }
        ]
        const sitio = sitios.find((q) => libre({ x: q.x, y: q.y, w: tw, h: th }))
        if (!sitio) continue
        ocupados.push({ x: sitio.x, y: sitio.y, w: tw, h: th })
        g.textAlign = sitio.ax; g.lineJoin = 'round'
        g.strokeStyle = 'rgba(6,11,32,0.9)'; g.lineWidth = 3.5; g.strokeText(e.texto, sitio.tx, sitio.ty)
        g.fillStyle = e.color; g.fillText(e.texto, sitio.tx, sitio.ty)
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
