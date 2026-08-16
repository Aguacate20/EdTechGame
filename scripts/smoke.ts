/* Prueba de humo sin navegador.
 *   npm run smoke
 * Comprueba tres cosas:
 *   1. el adaptador lee el bundle de muestra sin perder capas
 *   2. una expedición completa se puede jugar sin romperse
 *   3. un bot de heurística fija (siempre la primera opción, siempre apuesta alta)
 *      NO gana: si ganara, el juego sería explotable sin leer. */

import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import { MAZO_INICIAL, porId } from '../src/engine/cards'
import {
  aplicar, armarMazo, robar, resolver, siguienteTurno, tamanoMano, sirve,
  type ContextoCombate, type EstadoCombate
} from '../src/engine/combat'
import { ARQUETIPOS, construirEmbate, itemsCandidatos, type Embate } from '../src/engine/encounters'
import { generarRuta, arquetiposViables, type Nodo } from '../src/engine/run'
import { Rng } from '../src/engine/rng'
import type { Contenido } from '../src/content/types'

const crudo = JSON.parse(readFileSync('public/bundles/demo.json', 'utf8'))
const contenido: Contenido = adaptarBundle(crudo)

console.log('— adaptador —')
console.log(' fuente        ', contenido.fuente)
console.log(' conceptos     ', Object.keys(contenido.conceptos).length)
console.log(' aristas       ', contenido.aristas.length, Object.keys(contenido.frecuenciaRelacion).join('/'))
console.log(' unidades      ', contenido.unidades.length)
console.log(' repertorios   ', contenido.repertorios.length)
console.log(' tesis         ', contenido.tesis.length)
console.log(' ejes          ', contenido.ejes.map((e) => `${e.nombre}(${Object.keys(e.valores).length})`).join(' · '))
console.log(' ítems         ', Object.entries(contenido.items).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`).join(' '))
for (const d of contenido.diagnostico) console.log(`   ${d.estado.padEnd(8)} ${d.clave}: ${d.detalle}`)

type Estrategia = 'informado' | 'fijo' | 'azar'

function jugarRun(semilla: string, estrategia: Estrategia) {
  const rng = new Rng(semilla)
  const ctx: ContextoCombate = { contenido, instrumentos: [], rng }
  const ruta = generarRuta(contenido, semilla)
  const mazo = [...MAZO_INICIAL]
  let lucidez = 70
  let anterior: string | null = null
  const usados = new Set<string>()
  let jugadas = 0, aciertos = 0, sinEmbate = 0

  const pedirEmbate = (nodo: Nodo): Embate | null => {
    const arq = ARQUETIPOS[nodo.arquetipo ?? 'vacio']
    for (const filtro of [
      { conceptIds: nodo.conceptIds, condicion: nodo.condicion, prev: anterior, rep: arq.id === 'eco' },
      { conceptIds: nodo.conceptIds, condicion: null, prev: null, rep: arq.id === 'eco' },
      { conceptIds: Object.keys(contenido.conceptos), condicion: null, prev: null, rep: false }
    ]) {
      const cands = itemsCandidatos(contenido, {
        mecanicas: arq.mecanicas, conceptIds: filtro.conceptIds,
        condicion: filtro.condicion, conceptoAnterior: filtro.prev, soloRepertorio: filtro.rep
      })
      if (!cands.length) continue
      const frescos = cands.filter((i) => !usados.has(i.id))
      const item = rng.pick(frescos.length ? frescos : cands)
      usados.add(item.id)
      const emb = construirEmbate(item, { rng, contenido, condicion: nodo.condicion, conceptoAnterior: anterior })
      if (emb) { anterior = emb.conceptoObjetivo; return emb }
    }
    return null
  }

  for (const acto of ruta.actos) {
    for (const capa of acto.capas) {
      const nodo = capa[0]
      if (nodo.tipo === 'refugio') { lucidez = Math.min(70, lucidez + 22); continue }
      if (nodo.tipo === 'taller') continue

      const arq = ARQUETIPOS[nodo.arquetipo ?? 'vacio']
      const emb0 = pedirEmbate(nodo)
      if (!emb0) { sinEmbate++; continue }
      const hpMax = Math.round(arq.vidaBase * (1 + acto.index * 0.12))
      const e: EstadoCombate = {
        arquetipo: arq, nombre: arq.nombre, hp: hpMax, hpMax, condicion: nodo.condicion,
        embate: emb0, mano: [], mazo: armarMazo(mazo, rng), descarte: [],
        manoBase: acto.manoSugerida, acciones: 2, seleccion: [], cartaJugada: null,
        apuesta: null, fase: 'eligiendo', ultima: null, turno: 1, consultas: 0,
        ayudaEnEmbate: false, tiposRelacionUsados: [], erroresEnCombate: 0,
        inicioEmbate: Date.now(), definicionAbierta: null, embatesResueltos: 0
      }
      robar(e, tamanoMano(e, ctx))

      let guardia = 0
      while (e.hp > 0 && lucidez > 0 && guardia++ < 40) {
        const emb = e.embate
        const util = e.mano.find((c) => sirve(porId(c.cardId), emb))
        e.cartaJugada = util?.uid ?? null
        if (!util) e.acciones = 0

        if (emb.multi) {
          e.seleccion = estrategia === 'informado'
            ? emb.opciones.filter((o) => o.correcta).map((o) => o.id)
            : emb.opciones.slice(0, Math.max(1, emb.nCorrectas)).map((o) => o.id)
        } else {
          const elegida = estrategia === 'informado'
            ? emb.opciones.find((o) => o.correcta)!
            : estrategia === 'fijo'
            ? emb.opciones[0]
            : rng.pick(emb.opciones)
          e.seleccion = [elegida.id]
        }
        e.apuesta = estrategia === 'informado' ? 'alta' : 'alta'

        const r = resolver(e, ctx)
        aplicar(e, ctx, r)
        lucidez -= r.autodano
        jugadas++; if (r.correcto) aciertos++
        if (e.hp <= 0 || lucidez <= 0) break
        const sig = pedirEmbate(nodo)
        if (!sig) break
        siguienteTurno(e, ctx, sig)
      }
      if (lucidez <= 0) return { gano: false, jugadas, aciertos, sinEmbate, lucidez }
    }
  }
  return { gano: true, jugadas, aciertos, sinEmbate, lucidez }
}

const semillas = ['ar-ka-mor', 'tel-sen-vi', 'lun-dro-fa', 'nex-ori-zel', 'zel-ka-vi']
console.log('\n— expediciones simuladas —')
const resumen: Record<Estrategia, { victorias: number; jugadas: number; aciertos: number }> = {
  informado: { victorias: 0, jugadas: 0, aciertos: 0 },
  fijo: { victorias: 0, jugadas: 0, aciertos: 0 },
  azar: { victorias: 0, jugadas: 0, aciertos: 0 }
}
for (const est of ['informado', 'fijo', 'azar'] as Estrategia[]) {
  for (const s of semillas) {
    const r = jugarRun(s, est)
    resumen[est].victorias += r.gano ? 1 : 0
    resumen[est].jugadas += r.jugadas
    resumen[est].aciertos += r.aciertos
    if (r.sinEmbate) console.log(`   aviso: ${r.sinEmbate} nodos sin embate instanciable (${est}/${s})`)
  }
  const x = resumen[est]
  console.log(` ${est.padEnd(10)} victorias ${x.victorias}/${semillas.length} · precisión ${(100 * x.aciertos / Math.max(1, x.jugadas)).toFixed(0)}% · ${x.jugadas} jugadas`)
}

console.log('\n— criterios de aceptación —')
const ok1 = resumen.informado.victorias >= 4
const ok2 = resumen.fijo.victorias === 0
const ok3 = resumen.azar.victorias === 0
console.log(` ${ok1 ? 'PASA' : 'FALLA'}  quien lee gana casi siempre`)
console.log(` ${ok2 ? 'PASA' : 'FALLA'}  la heurística fija (siempre la primera opción) nunca gana`)
console.log(` ${ok3 ? 'PASA' : 'FALLA'}  responder al azar nunca gana`)
if (!(ok1 && ok2 && ok3)) process.exit(1)
