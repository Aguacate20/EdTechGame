/* Prueba de humo sin navegador:  npm run smoke
 *
 * 1. el adaptador lee el bundle sin perder capas
 * 2. un jugador que LEE puede despejar el carril
 * 3. un bot que traza al azar NO puede
 * 4. las nueve herramientas son instanciables sobre este texto
 * 5. balance: turnos por oleada y lucidez restante
 */
import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import {
  afirmar, cambiar, iniciarBatalla, quemar, sellar, siguienteTurno, trazar, turnoDelCarril, vivos,
  soltar, type Bolsa, type ContextoBatalla, type EstadoBatalla
} from '../src/engine/battle'
import { combinarLentes } from '../src/engine/powers'
import { HERRAMIENTAS, type HerramientaId } from '../src/engine/tools'
import { DUALES, FAMILIAS } from '../src/engine/graph'
import { generarRuta, hermanosPosibles, repartirEntreHermanos, solapeMedio, type Nodo } from '../src/engine/route'
import { Rng } from '../src/engine/rng'
import type { Pieza } from '../src/engine/pieces'
import type { Contenido } from '../src/content/types'

const contenido: Contenido = adaptarBundle(JSON.parse(readFileSync('public/bundles/demo.json', 'utf8')))
const LUCIDEZ_MAX = 80
const BASE: HerramientaId[] = ['identidad', 'identidad', 'flecha', 'flecha', 'flecha', 'campo']

console.log('— adaptador —')
console.log(' ', contenido.fuente)
console.log(' ', Object.keys(contenido.conceptos).length, 'conceptos ·', contenido.aristas.length, 'aristas ·',
  contenido.unidades.length, 'unidades ·', contenido.repertorios.length, 'repertorios ·',
  contenido.tesis.length, 'tesis ·', contenido.ejes.length, 'ejes ·', contenido.clusters.length, 'clusters')
for (const d of contenido.diagnostico) console.log(`   ${d.estado.padEnd(8)} ${d.clave}: ${d.detalle}`)

type Estrategia = 'informado' | 'aproximado' | 'azar'
interface Rep {
  gano: boolean; turnos: number; oleadas: number; lucidez: number
  sostenidos: number; trazos: number; herramientasUsadas: Set<string>
  quemasBuenas: number; quemasMalas: number; fusiones: number; combos: Set<string>
  estados: Record<string, number>; hallazgos: number; mejorGolpe: number; terrenos: number; descubiertos: number
  sellos: number
  sellosOk: number
}

/** Un jugador que lee: busca en su mano las piezas que sí sostienen algo.
 *  En modo `aproximado` sabe QUÉ se relaciona con qué, pero se equivoca de
 *  etiqueta (usa un tipo de la misma familia o la forma dual). Es el caso
 *  real: razonar bien sin recordar el nombre exacto del vínculo. */
function jugarInformado(e: EstadoBatalla, c: Contenido, rng: Rng, aprox = false): number {
  let trazados = 0
  const libres = () => {
    const r = [...e.herramientas]
    for (const u of e.usadas) { const i = r.indexOf(u); if (i >= 0) r.splice(i, 1) }
    return r
  }
  const poner = (p: Pieza) => {
    if (!e.tablero.some((t) => t.uid === p.uid)) soltar(e, p.uid, 20 + rng.int(60), 20 + rng.int(50))
  }

  // 2. identidades: emparejar nombre con su descripción
  for (const et of e.mano.filter((x) => x.clase === 'etiqueta')) {
    if (!libres().includes('identidad')) break
    const de = e.mano.find((x) => x.clase === 'definicion' && x.conceptId === et.conceptId)
    if (!de) continue
    poner(et); poner(de)
    if (trazar(e, 'identidad', [et.uid, de.uid], null)) trazados++
  }
  // 3. flechas sobre aristas reales que la mano permite
  const nodos = e.mano.filter((x) => x.conceptId && x.clase !== 'apocrifa' && x.clase !== 'definicion')
  for (const arista of c.aristas) {
    if (!libres().includes('flecha')) break
    let tipo = arista.tipo
    let from = arista.from, to = arista.to
    if (aprox) {
      // mismo par, etiqueta imprecisa: familia vecina, o la forma dual invertida
      const familia = Object.entries(FAMILIAS)
        .filter(([k, f]) => f === FAMILIAS[arista.tipo] && k !== arista.tipo)
        .map(([k]) => k)
        .filter((k) => e.relacionesDisponibles.includes(k))
      if (DUALES[arista.tipo] && e.relacionesDisponibles.includes(DUALES[arista.tipo])) {
        tipo = DUALES[arista.tipo]; from = arista.to; to = arista.from
      } else if (familia.length) {
        tipo = rng.pick(familia)
      }
    }
    if (!e.relacionesDisponibles.includes(tipo)) continue
    const a = nodos.find((x) => x.conceptId === from)
    const b = nodos.find((x) => x.conceptId === to && x.uid !== a?.uid)
    if (!a || !b) continue
    poner(a); poner(b)
    if (trazar(e, 'flecha', [a.uid, b.uid], tipo)) trazados++
  }
  // 4. ancla de caso
  const caso = e.mano.find((x) => x.clase === 'caso')
  if (caso && libres().includes('ancla')) {
    const dentro = nodos.filter((x) => x.conceptId && caso.conceptIds.includes(x.conceptId)).slice(0, 2)
    if (dentro.length) {
      poner(caso); dentro.forEach(poner)
      if (trazar(e, 'ancla', [caso.uid, ...dentro.map((x) => x.uid)], null)) trazados++
    }
  }
  // 5. balanza tesis + criterio válido
  const tesis = e.mano.find((x) => x.clase === 'tesis')
  const crit = e.mano.find((x) => x.clase === 'criterio' && x.sentido === 'refuta' && x.tesisId === tesis?.refId)
  if (tesis && crit && libres().includes('balanza')) {
    poner(tesis); poner(crit)
    if (trazar(e, 'balanza', [tesis.uid, crit.uid], null)) trazados++
  }
  // 6. campo semántico por cluster compartido
  if (libres().includes('campo')) {
    const porCluster = new Map<string, Pieza[]>()
    for (const p of nodos) {
      const cl = p.conceptId ? c.conceptos[p.conceptId]?.clusterId : null
      if (!cl) continue
      porCluster.set(cl, [...(porCluster.get(cl) ?? []), p])
    }
    const grupo = [...porCluster.values()].find((g) => g.length >= 2)
    if (grupo) {
      const sel = grupo.slice(0, 3)
      sel.forEach(poner)
      if (trazar(e, 'campo', sel.map((x) => x.uid), null)) trazados++
    }
  }
  // 7. jerarquía con generaliza
  if (libres().includes('jerarquia')) {
    const gen = c.aristas.find((x) => x.tipo === 'generaliza' &&
      nodos.some((p) => p.conceptId === x.from) && nodos.some((p) => p.conceptId === x.to))
    if (gen) {
      const a = nodos.find((p) => p.conceptId === gen.from)!
      const b = nodos.find((p) => p.conceptId === gen.to)!
      poner(a); poner(b)
      if (trazar(e, 'jerarquia', [a.uid, b.uid], null)) trazados++
    }
  }
  // 8. eje
  if (libres().includes('eje') && c.ejes.length) {
    for (const eje of c.ejes) {
      const porValor = new Map<string, Pieza[]>()
      for (const p of nodos) {
        const v = p.conceptId ? eje.valores[p.conceptId] : undefined
        if (v === undefined) continue
        porValor.set(String(v), [...(porValor.get(String(v)) ?? []), p])
      }
      const g = [...porValor.entries()].find(([, ps]) => ps.length >= 2)
      if (g) {
        g[1].slice(0, 3).forEach(poner)
        if (trazar(e, 'eje', g[1].slice(0, 3).map((x) => x.uid), `${eje.id}::${g[0]}`)) trazados++
        break
      }
    }
  }
  // 9. secuencia causal
  if (libres().includes('secuencia')) {
    for (const a1 of c.aristas.filter((x) => x.tipo === 'causa' || x.tipo === 'requiere')) {
      const a2 = c.aristas.find((x) => (x.tipo === 'causa' || x.tipo === 'requiere') && x.from === a1.to)
      if (!a2) continue
      const ps = [a1.from, a1.to, a2.to].map((id) => nodos.find((p) => p.conceptId === id))
      if (ps.every(Boolean)) {
        ps.forEach((p) => poner(p!))
        if (trazar(e, 'secuencia', ps.map((p) => p!.uid), null)) trazados++
        break
      }
    }
  }
  // 10. contraejemplo: un caso y un vecino que NO opera en él
  if (libres().includes('contraejemplo')) {
    const caso2 = e.mano.find((x) => x.clase === 'caso')
    if (caso2) {
      const vecinos = new Set(c.aristas
        .filter((a) => caso2.conceptIds.includes(a.from) || caso2.conceptIds.includes(a.to))
        .flatMap((a) => [a.from, a.to]))
      const fuera = nodos.find((p) => p.conceptId && vecinos.has(p.conceptId) && !caso2.conceptIds.includes(p.conceptId))
      if (fuera) {
        poner(caso2); poner(fuera)
        if (trazar(e, 'contraejemplo', [caso2.uid, fuera.uid], null)) trazados++
      }
    }
  }
  // 11. analogía: dos pares con el mismo tipo de vínculo
  if (libres().includes('analogia')) {
    for (const a1 of c.aristas) {
      const a2 = c.aristas.find((x) => x.tipo === a1.tipo && x.from !== a1.from && x.to !== a1.to)
      if (!a2) continue
      const ps = [a1.from, a1.to, a2.from, a2.to].map((id) => nodos.find((p) => p.conceptId === id))
      if (ps.every(Boolean)) {
        ps.forEach((p) => poner(p!))
        if (trazar(e, 'analogia', ps.map((p) => p!.uid), null)) trazados++
        break
      }
    }
  }
  // 12. descomposición: un concepto y sus subdimensiones
  if (libres().includes('descomposicion')) {
    const sub = e.mano.find((x) => x.clase === 'subdimension')
    const todo = sub ? nodos.find((p) => p.conceptId === sub.conceptId && p.clase !== 'subdimension') : null
    if (sub && todo) {
      const hermanas = e.mano.filter((x) => x.clase === 'subdimension' && x.conceptId === sub.conceptId)
      hermanas.forEach(poner); poner(todo)
      if (trazar(e, 'descomposicion', [todo.uid, ...hermanas.map((x) => x.uid)], null)) trazados++
    }
  }
  // si no salió nada, gestionar la mano
  if (trazados === 0 && e.cambiosRestantes > 0 && e.mano.length) cambiar(e, e.mano[0].uid)
  return trazados
}

function jugarAzar(e: EstadoBatalla, rng: Rng): number {
  const nodos = rng.shuffle(e.mano).slice(0, 4)
  nodos.forEach((p) => soltar(e, p.uid, 20 + rng.int(60), 20 + rng.int(50)))
  const disponibles = e.herramientas.filter((x) => HERRAMIENTAS[x])
  if (!disponibles.length) return 0
  const tool = rng.pick(disponibles)
  const h = HERRAMIENTAS[tool]
  const sel = nodos.slice(0, h.aridad[0]).map((p) => p.uid)
  const param = h.parametro === 'relacion' ? rng.pick(e.relacionesDisponibles)
    : h.parametro === 'eje' ? 'x::y' : null
  return trazar(e, tool, sel, param) ? 1 : 0
}

function jugarRun(semilla: string, estrategia: Estrategia, lentesIds: string[] = []): Rep {
  const rng = new Rng(semilla)
  const ctx: ContextoBatalla = { contenido, rng, lentes: combinarLentes(lentesIds) }
  const conocidas: string[] = ['apoya', 'contrasta']
  const ruta = generarRuta(contenido, semilla)
  let lucidez = LUCIDEZ_MAX
  const fusionados: string[] = []
  const rep: Rep = {
    gano: false, turnos: 0, oleadas: 0, lucidez, sostenidos: 0, trazos: 0,
    herramientasUsadas: new Set(), quemasBuenas: 0, quemasMalas: 0, fusiones: 0,
    combos: new Set(), estados: {}, hallazgos: 0, mejorGolpe: 0, terrenos: 0, descubiertos: 2,
    sellos: 0, sellosOk: 0
  }
  const herramientas: HerramientaId[] = [
    ...BASE, 'jerarquia', 'ancla', 'eje', 'secuencia', 'balanza',
    'contraejemplo', 'analogia', 'alcance', 'descomposicion'
  ]

  for (const acto of ruta.actos) {
    let id: string | null = rng.pick(acto.entradas)
    const vistos = new Set<string>()
    while (id) {
      if (vistos.has(id)) break
      vistos.add(id)
      const nodo = acto.columnas.flat().find((n) => n.id === id)
      if (!nodo) break

      if (nodo.tipo === 'refugio') lucidez = Math.min(LUCIDEZ_MAX, lucidez + 26)
      else if (nodo.tipo !== 'taller') {
        rep.oleadas += 1
        const bolsa: Bolsa = {
          sellos: [], terrenos: [], apoyo: false, sinTocar: [],
          herramientas,
          // el bot impreciso lleva todas las relaciones: así puede equivocarse
          // de etiqueta de verdad en vez de quedarse sin carta
          relaciones: estrategia === 'aproximado'
            ? Object.keys(contenido.frecuenciaRelacion)
            : conocidas,
          casos: nodo.casos, tesis: nodo.tesis, intuiciones: [], fusionados
        }
        const e = iniciarBatalla(ctx, nodo.conceptIds, bolsa, nodo.dificultad, acto.index, acto.manoSugerida)
        let guardia = 0
        while (vivos(e).length && lucidez > 0 && guardia++ < 40) {
          const n = estrategia === 'azar'
            ? jugarAzar(e, rng)
            : jugarInformado(e, contenido, rng, estrategia === 'aproximado')
          if (estrategia === 'informado' && e.quemasRestantes > 0) {
            const ap = e.mano.find((p) => p.clase === 'apocrifa')
            if (ap && !e.tablero.some((t) => t.uid === ap.uid)) {
              const ev = quemar(e, ctx, ap.uid)
              if (ev?.acertado) rep.quemasBuenas++; else if (ev) rep.quemasMalas++
            }
          }
          if (n === 0 && e.trazos.length === 0) { lucidez -= 4; rep.turnos++; siguienteTurno(e); continue }
          for (const t of e.trazos) rep.herramientasUsadas.add(t.tool)
          rep.trazos += e.trazos.length
          // sello de confianza: el informado y el azar sellan siempre; el sello
          // tiene que premiar al primero y castigar al segundo
          if (estrategia !== 'aproximado') sellar(e, true)
          const r = afirmar(e, ctx)
          if (r.sello) { rep.sellos++; if (r.sello.acertado) rep.sellosOk++ }
          turnoDelCarril(e, ctx, r)
          lucidez -= r.danoRecibido
          rep.sostenidos += r.diag.sostenidos
          for (const v of r.diag.veredictos) rep.estados[v.estado] = (rep.estados[v.estado] ?? 0) + 1
          rep.fusiones += r.diag.fusiona.length
          for (const c of r.diag.combos) rep.combos.add(c.nombre)
          fusionados.push(...r.diag.fusiona)
          for (const nuevo of r.descubiertos) {
            if (!conocidas.includes(nuevo)) conocidas.push(nuevo)
          }
          rep.descubiertos = conocidas.length
          rep.turnos++
          if (!vivos(e).length || lucidez <= 0) break
          siguienteTurno(e)
        }
        rep.hallazgos += e.hallazgos.vinculos.length + e.hallazgos.grupos.length
        rep.terrenos += e.terrenosGanados.length
        rep.mejorGolpe = Math.max(rep.mejorGolpe, e.mejorGolpe.dano)
        if (lucidez <= 0) { rep.lucidez = 0; return rep }
      }
      id = nodo.salidas.length ? rng.pick(nodo.salidas) : null
    }
  }
  rep.gano = true
  rep.lucidez = lucidez
  return rep
}

const semillas = ['ar-ka-mor', 'tel-sen-vi', 'lun-dro-fa', 'nex-ori-zel', 'zel-ka-vi', 'mor-fa-ori']
console.log('\n— reparto entre hermanos —')
const solapes: number[] = []
{
  const rng0 = new Rng('reparto')
  for (const u of contenido.unidades) {
    for (const k of [2, 3]) {
      if (k > hermanosPosibles(u.conceptIds.length)) continue
      solapes.push(solapeMedio(repartirEntreHermanos(contenido, u.conceptIds, k, rng0)))
    }
  }
  console.log(solapes.length
    ? ` solape medio entre nodos hermanos: ${(100 * solapes.reduce((a, b) => a + b, 0) / solapes.length).toFixed(0)}% en ${solapes.length} columnas ramificadas`
    : ' este texto no ramifica: las unidades son demasiado pequeñas')
}

console.log('\n— expediciones simuladas —')
const res: Record<Estrategia, Rep[]> = { informado: [], aproximado: [], azar: [] }
for (const est of ['informado', 'aproximado', 'azar'] as Estrategia[]) {
  for (const s of semillas) res[est].push(jugarRun(s, est))
  const rs = res[est]
  const v = rs.filter((r) => r.gano).length
  const t = rs.reduce((n, r) => n + r.turnos, 0)
  const o = rs.reduce((n, r) => n + r.oleadas, 0)
  const so = rs.reduce((n, r) => n + r.sostenidos, 0)
  const tz = rs.reduce((n, r) => n + r.trazos, 0)
  const luz = v ? rs.filter((r) => r.gano).reduce((n, r) => n + r.lucidez, 0) / v : 0
  console.log(` ${est.padEnd(10)} victorias ${v}/${semillas.length} · ${(t / Math.max(1, o)).toFixed(1)} turnos/oleada` +
    ` · ${(100 * so / Math.max(1, tz)).toFixed(0)}% de trazos sostenidos · lucidez final media ${luz.toFixed(0)}`)
}
const inf = res.informado
const usadas = new Set(inf.flatMap((r) => [...r.herramientasUsadas]))
const combos = new Set(inf.flatMap((r) => [...r.combos]))
console.log(` herramientas ejercidas: ${[...usadas].join(' · ')}`)
console.log(` combos vistos: ${[...combos].join(' · ') || 'ninguno'}`)
console.log(` pozo: ${inf.reduce((n, r) => n + r.quemasBuenas, 0)} quemas acertadas · ${inf.reduce((n, r) => n + r.quemasMalas, 0)} erradas`)
console.log(` fusiones nombre+descripción: ${inf.reduce((n, r) => n + r.fusiones, 0)}`)
console.log(` vínculos conocidos al final (media): ${(inf.reduce((n, r) => n + r.descubiertos, 0) / inf.length).toFixed(1)} de ${Object.keys(contenido.frecuenciaRelacion).length}`)
console.log(` terrenos ganados (total): ${inf.reduce((n, r) => n + r.terrenos, 0)}`)
console.log(` hallazgos por run (media): ${(inf.reduce((n, r) => n + r.hallazgos, 0) / inf.length).toFixed(0)}` +
  ` · mejor diagrama: ${Math.max(...inf.map((r) => r.mejorGolpe))}`)

const sumar = (rs: Rep[]) => rs.reduce<Record<string, number>>((acc, r) => {
  for (const [k, v] of Object.entries(r.estados)) acc[k] = (acc[k] ?? 0) + v
  return acc
}, {})
const escI = sumar(inf), escA = sumar(res.azar)
const pinta = (e: Record<string, number>) => {
  const t = Object.values(e).reduce((a, b) => a + b, 0) || 1
  return Object.entries(e).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(100 * v / t).toFixed(0)}%`).join(' · ')
}
const escX = sumar(res.aproximado)
console.log(` escalera (informado): ${pinta(escI)}`)
console.log(` escalera (aproximado):${pinta(escX)}`)
console.log(` escalera (azar):      ${pinta(escA)}`)

console.log('\n— criterios de aceptación —')
const ok1 = inf.filter((r) => r.gano).length >= semillas.length - 1
const ok2 = res.azar.filter((r) => r.gano).length === 0
const ok3 = usadas.size >= 9
const tpo = inf.reduce((n, r) => n + r.turnos, 0) / Math.max(1, inf.reduce((n, r) => n + r.oleadas, 0))
const ok4 = tpo >= 2 && tpo <= 9
const ok5 = combos.size >= 2
// la flexibilidad no puede volverse permisividad: al azar casi nada debe sostenerse
const totalAzar = Object.values(escA).reduce((a, b) => a + b, 0) || 1
const aciertaAzar = (escA.sostenido ?? 0) + (escA.equivalente ?? 0) + (escA.derivado ?? 0)
const ok6 = aciertaAzar / totalAzar < 0.2
// quien razona bien pero se equivoca de etiqueta debe recibir crédito parcial
const totalAprox = Object.values(escX).reduce((a, b) => a + b, 0) || 1
const creditoAprox = (escX.equivalente ?? 0) + (escX.aproximado ?? 0) + (escX.derivado ?? 0) + (escX.sostenido ?? 0)
// el mapa de cierre necesita material: sin hallazgos no hay nada que devolver
const hallMedia = inf.reduce((n, r) => n + r.hallazgos, 0) / Math.max(1, inf.length)
const ok8 = hallMedia >= 15
const solape = solapes.length ? solapes.reduce((a, b) => a + b, 0) / solapes.length : 1
const ok9 = solapes.length > 0 && solape < 0.5
const descMedia = inf.reduce((n, r) => n + r.descubiertos, 0) / Math.max(1, inf.length)
const ok10 = descMedia > 2 && descMedia <= Object.keys(contenido.frecuenciaRelacion).length
// la capa ×mult: la misma lectura, con las lentes mayores, tiene que
// multiplicar el mejor golpe varias veces — y al azar no debe regalarle nada
const MAYORES = ['anclista', 'polifonia', 'reliquia_traductor', 'catedral']
const conMayores = semillas.slice(0, 3).map((s) => jugarRun(s, 'informado', MAYORES))
const sinMayores = res.informado.slice(0, 3)
const golpeCon = Math.max(...conMayores.map((r) => r.mejorGolpe))
const golpeSin = Math.max(...sinMayores.map((r) => r.mejorGolpe))
const azarConMayores = semillas.slice(0, 2).map((s) => jugarRun(s, 'azar', MAYORES))
const golpeAzarX = Math.max(...azarConMayores.map((r) => r.mejorGolpe))
const ok12 = golpeCon >= golpeSin * 3 && golpeAzarX < golpeSin
const selloI = inf.reduce((n, r) => n + r.sellosOk, 0) / Math.max(1, inf.reduce((n, r) => n + r.sellos, 0))
const selloZ = res.azar.reduce((n, r) => n + r.sellosOk, 0) / Math.max(1, res.azar.reduce((n, r) => n + r.sellos, 0))
const ok11 = selloI > 0.8 && selloZ < 0.2
const ok7 = creditoAprox / totalAprox > 0.7 && res.aproximado.filter((r) => r.gano).length >= 3
console.log(` ${ok1 ? 'PASA' : 'FALLA'}  quien lee despeja el carril`)
console.log(` ${ok2 ? 'PASA' : 'FALLA'}  trazar al azar nunca gana`)
console.log(` ${ok3 ? 'PASA' : 'FALLA'}  al menos 9 de las 12 herramientas son instanciables (${usadas.size})`)
console.log(` ${ok4 ? 'PASA' : 'FALLA'}  una oleada dura entre 2 y 9 turnos (${tpo.toFixed(1)})`)
console.log(` ${ok5 ? 'PASA' : 'FALLA'}  los combos aparecen de verdad (${combos.size})`)
console.log(` ${ok6 ? 'PASA' : 'FALLA'}  la escalera no premia al azar (${(100 * aciertaAzar / totalAzar).toFixed(0)}% de aciertos al azar)`)
console.log(` ${ok7 ? 'PASA' : 'FALLA'}  quien razona bien y se equivoca de etiqueta recibe crédito (${(100 * creditoAprox / totalAprox).toFixed(0)}%, ${res.aproximado.filter((r) => r.gano).length}/${semillas.length} victorias)`)
console.log(` ${ok8 ? 'PASA' : 'FALLA'}  el mapa de cierre acumula aciertos (${hallMedia.toFixed(0)} vínculos y grupos por run)`)
console.log(` ${ok9 ? 'PASA' : 'FALLA'}  los nodos hermanos cubren temarios distintos (${(100 * solape).toFixed(0)}% en ${solapes.length} columnas)`)
console.log(` ${ok10 ? 'PASA' : 'FALLA'}  los vínculos se descubren derribando enemigos (${descMedia.toFixed(1)} conocidos al final)`)
console.log(` ${ok11 ? 'PASA' : 'FALLA'}  el sello de confianza distingue al calibrado del que adivina (${(100 * selloI).toFixed(0)}% vs ${(100 * selloZ).toFixed(0)}%)`)
console.log(` ${ok12 ? 'PASA' : 'FALLA'}  las lentes mayores multiplican y no se regalan (mejor golpe ${golpeSin} → ${golpeCon}; azar con mayores ${golpeAzarX})`)
if (!(ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7 && ok8 && ok9 && ok10 && ok11 && ok12)) process.exit(1)
