/* Prueba de humo sin navegador:  npm run smoke
 *
 * Comprueba cuatro cosas:
 *   1. el adaptador lee el bundle sin perder capas
 *   2. una expedición completa se puede jugar por el grafo sin romperse
 *   3. un bot de heurística fija (siempre la primera opción) NO gana
 *   4. el balance: cuántos turnos dura un frente y cuánta lucidez cuesta
 */

import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import { MAZO_INICIAL, porId } from '../src/engine/cards'
import {
  aplicar, armarMazo, robar, resolver, siguienteTurno, sirve, tamanoMano, turnoEnemigo, vivos,
  type Apuesta, type ContextoCombate, type EstadoCombate
} from '../src/engine/combat'
import { ARQUETIPOS, construirEmbate, familiasDeArquetipo, itemsCandidatos, type Embate } from '../src/engine/encounters'
import { embateDeTesis } from '../src/engine/boss'
import { cartaIntuicion, embateDeContexto, esIntuicion, repertorioDe } from '../src/engine/intuition'
import { componerFrente } from '../src/engine/threats'
import { generarRuta, type Nodo } from '../src/engine/route'
import { OBJETIVOS } from '../src/engine/objectives'
import { Rng } from '../src/engine/rng'
import type { Contenido } from '../src/content/types'

const crudo = JSON.parse(readFileSync('public/bundles/demo.json', 'utf8'))
const contenido: Contenido = adaptarBundle(crudo)
const LUCIDEZ_MAX = 80

console.log('— adaptador —')
console.log(' fuente      ', contenido.fuente)
console.log(' conceptos   ', Object.keys(contenido.conceptos).length,
  '· aristas', contenido.aristas.length,
  '· unidades', contenido.unidades.length,
  '· repertorios', contenido.repertorios.length,
  '· tesis', contenido.tesis.length)
console.log(' ítems       ', Object.entries(contenido.items).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`).join(' '))
for (const d of contenido.diagnostico) console.log(`   ${d.estado.padEnd(8)} ${d.clave}: ${d.detalle}`)

console.log('\n— grafo de rutas —')
{
  const r = generarRuta(contenido, 'muestra')
  for (const acto of r.actos) {
    const forma = acto.columnas.map((c) => c.length).join('-')
    const etiquetas = [...new Set(acto.columnas.flat().map((n) => n.etiquetaRuta))].join('/')
    const enemigos = [...new Set(acto.columnas.flat().flatMap((n) => n.arquetipos))].length
    console.log(` acto ${acto.index + 1} · ${forma} · rutas ${etiquetas} · ${enemigos} arquetipos`)
  }
}

type Estrategia = 'informado' | 'fijo' | 'azar'

interface Reporte {
  gano: boolean; jugadas: number; aciertos: number; lucidez: number
  frentes: number; turnos: number; intuicionesRecibidas: number; intuicionesResueltas: number
  sinMaterial: number
}

function jugarRun(semilla: string, estrategia: Estrategia): Reporte {
  const rng = new Rng(semilla)
  const obj = OBJETIVOS[rng.int(OBJETIVOS.length)]
  const ctx: ContextoCombate = { contenido, instrumentos: [obj.instrumentoInicial], rng }
  const ruta = generarRuta(contenido, semilla)
  let mazo = [...MAZO_INICIAL, ...obj.cartasIniciales]
  let lucidez = LUCIDEZ_MAX
  let anterior: string | null = null
  const usados = new Set<string>()
  const rep: Reporte = {
    gano: false, jugadas: 0, aciertos: 0, lucidez, frentes: 0, turnos: 0,
    intuicionesRecibidas: 0, intuicionesResueltas: 0, sinMaterial: 0
  }

  const pedirEmbate = (nodo: Nodo, arqId: string, hpRatio: number): Embate | null => {
    const arq = ARQUETIPOS[arqId as keyof typeof ARQUETIPOS] ?? ARQUETIPOS.vacio
    if (arq.id === 'marco' && hpRatio <= 0.5) {
      const jefe = embateDeTesis(contenido, rng)
      if (jefe) return jefe
    }
    for (const f of [
      { ids: nodo.conceptIds, cond: nodo.condicion, prev: anterior },
      { ids: nodo.conceptIds, cond: null, prev: null },
      { ids: Object.keys(contenido.conceptos), cond: null, prev: null }
    ]) {
      const cands = itemsCandidatos(contenido, {
        mecanicas: arq.mecanicas, conceptIds: f.ids, condicion: f.cond,
        conceptoAnterior: f.prev, soloRepertorio: arq.id === 'eco'
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

  // recorrido del grafo: sigue una salida al azar en cada nodo
  for (const acto of ruta.actos) {
    let actuales = [rng.pick(acto.entradas)]
    const vistos = new Set<string>()
    while (actuales.length) {
      const id = actuales[0]
      if (vistos.has(id)) break
      vistos.add(id)
      const nodo = acto.columnas.flat().find((n) => n.id === id)
      if (!nodo) break

      if (nodo.tipo === 'refugio') lucidez = Math.min(LUCIDEZ_MAX, lucidez + 26)
      else if (nodo.tipo === 'taller') { /* recompensa: fuera del alcance del bot */ }
      else {
        rep.frentes += 1
        const tipo = nodo.tipo === 'jefe' ? 'jefe' : nodo.tipo === 'elite' ? 'elite' : 'combate'
        const escala = 1 + acto.index * 0.14
        const e: EstadoCombate = {
          tipo, enemigos: componerFrente(nodo.arquetipos, tipo, escala, rng),
          objetivo: null, condicion: nodo.condicion, embate: null,
          mano: [], mazo: armarMazo(mazo, rng), descarte: [],
          manoBase: acto.manoSugerida, acciones: 2, seleccion: [], cartaJugada: null,
          apuesta: null, fase: 'objetivo', ultima: null, turno: 1, consultas: 0,
          ayudaEnEmbate: false, tiposRelacionUsados: [], erroresEnCombate: 0,
          inicioEmbate: Date.now(), definicionAbierta: null,
          nieblaPendiente: false, superficiePendiente: false, ruidoPendiente: false,
          intuicionesRecibidas: []
        }
        robar(e, tamanoMano(e, ctx))

        let guardia = 0
        while (vivos(e).length && lucidez > 0 && guardia++ < 60) {
          // 1. apuntar: el objetivo decide de qué pool sale el embate.
          //    Un jugador que sabe lo que hace apunta a lo que su mano puede responder;
          //    si nada encaja, reajusta la mano antes de improvisar.
          let objetivo = rng.pick(vivos(e))
          if (estrategia === 'informado') {
            const familias = new Set(
              e.mano.filter((c) => !esIntuicion(c.cardId)).flatMap((c) => porId(c.cardId).familias)
            )
            const alcanzables = vivos(e).filter((x) =>
              familiasDeArquetipo(x.arquetipoId).some((f) => familias.has(f)))
            if (!alcanzables.length && e.acciones > 0) {
              e.descarte.push(...e.mano)
              e.mano = []
              robar(e, tamanoMano(e, ctx))
              e.acciones -= 1
            }
            const familias2 = new Set(
              e.mano.filter((c) => !esIntuicion(c.cardId)).flatMap((c) => porId(c.cardId).familias)
            )
            const pool = vivos(e).filter((x) =>
              familiasDeArquetipo(x.arquetipoId).some((f) => familias2.has(f)))
            objetivo = (pool.length ? pool : vivos(e)).sort((a, b) => a.hp - b.hp)[0]
          }
          const emb = pedirEmbate(nodo, objetivo.arquetipoId, objetivo.hp / objetivo.hpMax)
          if (!emb) { rep.sinMaterial += 1; break }
          e.objetivo = objetivo.uid
          e.embate = emb
          e.fase = 'eligiendo'

          // 2. jugar una carta: la intuición se resuelve si el bot lee
          const intu = e.mano.find((c) => esIntuicion(c.cardId))
          if (intu && estrategia === 'informado') {
            const sub = embateDeContexto(contenido, repertorioDe(intu.cardId), rng)
            if (sub) {
              e.embate = sub
              e.cartaJugada = intu.uid
              e.acciones -= 1
            }
          } else {
            const util = e.mano.find((c) => !esIntuicion(c.cardId) && sirve(porId(c.cardId), e.embate!))
            e.cartaJugada = util?.uid ?? null
            if (!util) e.acciones = 0
          }

          // 3. responder
          const cur = e.embate!
          if (cur.multi) {
            e.seleccion = estrategia === 'informado'
              ? cur.opciones.filter((o) => o.correcta).map((o) => o.id)
              : cur.opciones.slice(0, Math.max(1, cur.nCorrectas)).map((o) => o.id)
          } else {
            const op = estrategia === 'informado' ? cur.opciones.find((o) => o.correcta)!
              : estrategia === 'fijo' ? cur.opciones[0] : rng.pick(cur.opciones)
            e.seleccion = [op.id]
          }
          e.apuesta = (estrategia === 'informado' ? 'alta' : 'alta') as Apuesta

          const r = resolver(e, ctx)
          aplicar(e, r)
          const { dano, intuiciones } = turnoEnemigo(e, ctx, r)
          lucidez -= dano
          if (r.intuicionResuelta) {
            rep.intuicionesResueltas += 1
            lucidez = Math.min(LUCIDEZ_MAX, lucidez + 6)
            const i = mazo.indexOf(r.intuicionResuelta)
            if (i >= 0) mazo = [...mazo.slice(0, i), ...mazo.slice(i + 1)]
          }
          for (const rid of intuiciones) {
            rep.intuicionesRecibidas += 1
            const carta = cartaIntuicion(rid)
            mazo = [...mazo, carta]
            e.descarte.push({ uid: `${carta}#${rng.int(9999)}`, cardId: carta })
          }
          rep.jugadas += 1
          rep.turnos += 1
          if (r.correcto) rep.aciertos += 1
          if (!vivos(e).length || lucidez <= 0) break
          siguienteTurno(e, ctx)
        }
        if (lucidez <= 0) { rep.lucidez = 0; return rep }
      }
      actuales = nodo.salidas.length ? [rng.pick(nodo.salidas)] : []
    }
  }
  rep.gano = true
  rep.lucidez = lucidez
  return rep
}

const semillas = ['ar-ka-mor', 'tel-sen-vi', 'lun-dro-fa', 'nex-ori-zel', 'zel-ka-vi', 'mor-fa-ori']
console.log('\n— expediciones simuladas —')
const resumen: Record<Estrategia, Reporte[]> = { informado: [], fijo: [], azar: [] }
for (const est of ['informado', 'fijo', 'azar'] as Estrategia[]) {
  for (const s of semillas) {
    const r = jugarRun(s, est)
    resumen[est].push(r)
    if (process.env.TRAZA2 && est === 'informado') {
      console.log(`   ${s}: ${r.gano ? 'gana' : 'pierde'} · ${r.frentes} frentes · ${r.jugadas} jugadas · lucidez ${r.lucidez}`)
    }
  }
  const rs = resumen[est]
  const v = rs.filter((r) => r.gano).length
  const j = rs.reduce((n, r) => n + r.jugadas, 0)
  const ac = rs.reduce((n, r) => n + r.aciertos, 0)
  const luz = rs.filter((r) => r.gano).reduce((n, r) => n + r.lucidez, 0) / Math.max(1, v)
  const turnosPorFrente = j / Math.max(1, rs.reduce((n, r) => n + r.frentes, 0))
  console.log(
    ` ${est.padEnd(10)} victorias ${v}/${semillas.length}` +
    ` · precisión ${(100 * ac / Math.max(1, j)).toFixed(0)}%` +
    ` · ${turnosPorFrente.toFixed(1)} turnos/frente` +
    ` · lucidez final media ${luz.toFixed(0)}`
  )
  const sm = rs.reduce((n, r) => n + r.sinMaterial, 0)
  if (sm) console.log(`   aviso: ${sm} frentes se quedaron sin material instanciable`)
}
const inf = resumen.informado
console.log(` intuiciones: ${inf.reduce((n, r) => n + r.intuicionesRecibidas, 0)} recibidas · ${inf.reduce((n, r) => n + r.intuicionesResueltas, 0)} estabilizadas`)

console.log('\n— criterios de aceptación —')
const ok1 = inf.filter((r) => r.gano).length >= semillas.length - 1
const ok2 = resumen.fijo.filter((r) => r.gano).length === 0
const ok3 = resumen.azar.filter((r) => r.gano).length === 0
const turnos = inf.reduce((n, r) => n + r.jugadas, 0) / Math.max(1, inf.reduce((n, r) => n + r.frentes, 0))
const ok4 = turnos >= 2 && turnos <= 9
console.log(` ${ok1 ? 'PASA' : 'FALLA'}  quien lee gana casi siempre`)
console.log(` ${ok2 ? 'PASA' : 'FALLA'}  la heurística fija nunca gana`)
console.log(` ${ok3 ? 'PASA' : 'FALLA'}  responder al azar nunca gana`)
console.log(` ${ok4 ? 'PASA' : 'FALLA'}  un frente dura entre 2 y 9 turnos (medido: ${turnos.toFixed(1)})`)
if (!(ok1 && ok2 && ok3 && ok4)) process.exit(1)
