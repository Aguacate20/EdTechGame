/* Enchufe del arte de LudusCog (Lista maestra v1.1) al manifiesto del juego.
 *
 *   npm run arte            → informe: qué tiras del manual están en public/art/luduscog y cuáles faltan
 *   npm run arte -- --aplicar → además escribe public/art/manifest.json con lo que SÍ está,
 *                              conservando lo provisional para lo que falta
 *
 * Los frames se calculan de la propia imagen (ancho / alto: frames cuadrados en una fila),
 * así que el artista no tiene que declarar nada: si la tira mide 576 × 96, son 6 frames.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CARPETA = 'public/art/luduscog'
const MANIFEST = 'public/art/manifest.json'

interface Tira { archivo: string; gesto: string; fps: number; loop?: boolean; frames?: number; fase: 1 | 2 }
const ANDY: Tira[] = [
  { archivo: 'andy-idle.png', gesto: 'quieto', fps: 6, loop: true, frames: 6, fase: 1 },
  { archivo: 'andy-attack.png', gesto: 'golpea', fps: 12, frames: 8, fase: 1 },
  { archivo: 'andy-connect.png', gesto: 'golpea_onda', fps: 12, frames: 10, fase: 1 },
  { archivo: 'andy-volley.png', gesto: 'golpea_lluvia', fps: 12, frames: 9, fase: 1 },
  { archivo: 'andy-hit.png', gesto: 'herido', fps: 12, frames: 5, fase: 1 },
  { archivo: 'andy-defeat.png', gesto: 'cae', fps: 6, loop: false, frames: 8, fase: 1 },
  { archivo: 'andy-beam.png', gesto: 'golpea_rayo', fps: 12, frames: 8, fase: 2 },
  { archivo: 'andy-slide.png', gesto: 'golpea_barrido', fps: 14, frames: 4, fase: 2 },
  { archivo: 'andy-slam.png', gesto: 'golpea_sello', fps: 12, frames: 8, fase: 2 },
  { archivo: 'andy-jab.png', gesto: 'golpea_perdigon', fps: 14, frames: 4, fase: 2 },
  { archivo: 'andy-run.png', gesto: 'avanza', fps: 10, loop: true, frames: 6, fase: 2 },
  { archivo: 'andy-think.png', gesto: 'piensa', fps: 6, loop: true, frames: 4, fase: 2 }
]
const ENEMIGOS_F1 = ['copista', 'errata', 'rumor', 'dogma', 'bibliografia', 'tratado']
const ENEMIGOS_F2 = ['apocrifo', 'eco', 'cita', 'palimpsesto', 'notaalpie', 'ortodoxia']
const GESTOS_ENEMIGO: { sufijo: string; gesto: string; fps: number; loop?: boolean }[] = [
  { sufijo: 'idle', gesto: 'quieto', fps: 8, loop: true },
  { sufijo: 'walk', gesto: 'avanza', fps: 10, loop: true },
  { sufijo: 'attack', gesto: 'golpea', fps: 12 },
  { sufijo: 'hit', gesto: 'herido', fps: 10 },
  { sufijo: 'death', gesto: 'cae', fps: 8, loop: false }
]
const FONDOS = ['acto1_back.png', 'acto1_middle.png', 'acto1_front.png', 'acto2_back.png', 'acto2_middle.png', 'acto2_front.png', 'acto3_back.png', 'acto3_far.png', 'acto3_middle.png', 'acto3_near.png']
const PROYECTILES = ['rayo', 'lluvia', 'tenaza', 'onda', 'gancho', 'maza', 'barrido', 'perdigon', 'sello']

function medidas(ruta: string): { w: number; h: number } | null {
  try {
    const b = readFileSync(ruta)
    if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  } catch { return null }
}

const aplicar = process.argv.includes('--aplicar')
const manifest: Record<string, Record<string, unknown>> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
let presentes = 0, faltan = 0, mal = 0
const fila = (estado: string, quien: string, archivo: string, nota = '') => console.log(` ${estado.padEnd(8)} ${quien.padEnd(24)} ${archivo.padEnd(28)} ${nota}`)

function enchufar(clave: string, subcarpeta: string, tira: Tira) {
  const ruta = join(CARPETA, subcarpeta, tira.archivo)
  if (!existsSync(ruta)) { faltan++; fila(`— fase ${tira.fase}`, clave, tira.archivo, tira.frames ? `(${tira.frames} frames, ${tira.fps} fps)` : ''); return }
  const m = medidas(ruta)
  if (!m || m.w % m.h !== 0) { mal++; fila('✗ MAL', clave, tira.archivo, m ? `${m.w}×${m.h}: el ancho no es múltiplo del alto (frames cuadrados en una fila)` : 'no es un PNG'); return }
  const frames = m.w / m.h
  presentes++
  fila('✓', clave, tira.archivo, `${frames} frames · ${m.h}px · ${tira.fps} fps${tira.frames && tira.frames !== frames ? ` (el manual esperaba ${tira.frames})` : ''}`)
  if (aplicar) {
    manifest[clave] = manifest[clave] ?? {}
    manifest[clave][tira.gesto] = { src: `luduscog/${subcarpeta}/${tira.archivo}`, frames, fps: tira.fps, ...(tira.loop === false ? { loop: false } : {}) }
  }
}

console.log(`\nArte de LudusCog · carpeta ${CARPETA}\n`)
console.log(' estado   ranura                   archivo                      detalle')
console.log(' ── Andy (jugador/copista) ──')
for (const t of ANDY) enchufar('jugador/copista', 'andy', t)
for (const [fase, lista] of [[1, ENEMIGOS_F1], [2, ENEMIGOS_F2]] as [1 | 2, string[]][]) {
  console.log(` ── Enemigos · fase ${fase} ──`)
  for (const en of lista) for (const g of GESTOS_ENEMIGO) enchufar(`enemigos/${en}`, en, { archivo: `${en}-${g.sufijo}.png`, gesto: g.gesto, fps: g.fps, loop: g.loop, fase })
}
console.log(' ── Fondos (por ahora solo se verifican: el carril los conecta en la siguiente entrega) ──')
for (const f of FONDOS) { const ok = existsSync(join(CARPETA, 'fondos', f)); ok ? presentes++ : faltan++; fila(ok ? '✓' : '—', 'fondos', f) }
console.log(' ── Proyectiles (32×32, se verifican; hoy se dibujan por código) ──')
for (const p of PROYECTILES) { const a = `${p}.png`; const ok = existsSync(join(CARPETA, 'proyectiles', a)); ok ? presentes++ : faltan++; fila(ok ? '✓' : '—', 'proyectiles', a) }
console.log(`\n ${presentes} presentes · ${faltan} faltan · ${mal} mal formadas`)
if (aplicar) { writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n'); console.log(` manifest escrito: ${MANIFEST}`) }
else console.log(' (con --aplicar se escribe el manifest con lo presente)')
console.log()
