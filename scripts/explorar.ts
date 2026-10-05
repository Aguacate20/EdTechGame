/* Exploración general del juez (v6.8): recorre TODO lo que un bundle permite jugar y
 * busca incoherencias — jugadas correctas que no se sostienen, etiquetas de veredicto que no
 * corresponden, callejones sin salida y cuánta flexibilidad tiene el lector que propone.
 *
 *   npm run explorar                         → bundle de muestra
 *   npm run explorar -- ruta/al/bundle.json  → cualquier bundle
 */
import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import type { Contenido } from '../src/content/types'
import { evaluarDiagrama, HERRAMIENTAS, aceptaEnRanura, atributoAfin, type HerramientaId, type Trazo, type Veredicto } from '../src/engine/tools'
import { piezaConcepto, piezaEtiqueta, piezaDefinicion, piezaCaso, piezaTesis, piezasCriterio, piezasSubdimension, piezaMarco, piezaIntuicion, type Pieza } from '../src/engine/pieces'
import { Rng } from '../src/engine/rng'

const ruta = process.argv[2] ?? 'public/bundles/demo.json'
const c: Contenido = adaptarBundle(JSON.parse(readFileSync(ruta, 'utf8')))
const rng = new Rng('explorar')
const ids = c.ordenConceptos.filter((x) => c.conceptos[x])
const K = (id: string) => piezaConcepto(c, id)!
const T = (id: string) => c.conceptos[id]?.titulo ?? id
const juzga = (tool: HerramientaId, piezas: Pieza[], param: string | null = null): Veredicto => {
  const t: Trazo = { uid: 't', tool, piezas: piezas.map((p) => p.uid), param }
  return evaluarDiagrama(c, piezas, [t]).veredictos[0]
}
const BUENOS = new Set(['sostenido', 'equivalente', 'compatible', 'derivado'])
type Cuenta = Record<string, number>
const sumar = (k: Cuenta, e: string) => { k[e] = (k[e] ?? 0) + 1 }
const fmt = (k: Cuenta) => Object.entries(k).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(' · ') || '—'
const hallazgos: { grav: 'BUG' | 'REVISAR' | 'DATO'; titulo: string; ejemplos: string[]; n: number }[] = []
const anotar = (grav: 'BUG' | 'REVISAR' | 'DATO', titulo: string, ej: string) => {
  let h = hallazgos.find((x) => x.titulo === titulo)
  if (!h) { h = { grav, titulo, ejemplos: [], n: 0 }; hallazgos.push(h) }
  h.n++; if (h.ejemplos.length < 6) h.ejemplos.push(ej)
}
const sec = (s: string) => console.log(`\n── ${s} ──`)

console.log(`\n${ruta}\n${ids.length} conceptos · ${c.aristas.length} aristas firmes · ${c.insinuadas.length} insinuadas · ${c.clusters.length} clusters · ${c.ejes.length} ejes · ${c.casos.length} casos · ${c.tesis.length} tesis · ${c.marcos.length} marcos · ${c.repertorios.length} intuiciones · ${ids.filter((x) => c.conceptos[x].subdimensiones.length).length} conceptos con atributos`)
const tipos = [...new Set([...Object.keys(c.frecuenciaRelacion), ...c.aristas.map((a) => a.tipo)])]

/* 1 · FLECHA: lo que el texto afirma debe sostenerse; al revés y con otro tipo, ¿qué pasa? */
sec('1 · Flecha sobre cada arista firme')
{
  const ok: Cuenta = {}, rev: Record<string, Cuenta> = {}, otro: Record<string, Record<string, Cuenta>> = {}
  for (const a of c.aristas) {
    if (!c.conceptos[a.from] || !c.conceptos[a.to]) { anotar('BUG', 'Arista que apunta a un concepto inexistente (contenido)', `${a.from} —${a.tipo}→ ${a.to}`); continue }
    const v = juzga('flecha', [K(a.from), K(a.to)], a.tipo)
    sumar(ok, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Flecha correcta (arista firme, tipo y dirección del texto) que NO se sostiene', `${T(a.from)} —${a.tipo}→ ${T(a.to)} ⇒ ${v.estado}: ${v.nota.slice(0, 90)}`)
    const r = juzga('flecha', [K(a.to), K(a.from)], a.tipo)
    rev[a.tipo] = rev[a.tipo] ?? {}; sumar(rev[a.tipo], r.estado)
    for (const t of tipos) if (t !== a.tipo) {
      const o = juzga('flecha', [K(a.from), K(a.to)], t)
      otro[a.tipo] = otro[a.tipo] ?? {}; otro[a.tipo][t] = otro[a.tipo][t] ?? {}; sumar(otro[a.tipo][t], o.estado)
      if (o.estado === 'error' || o.estado === 'invertido') anotar('REVISAR', 'Par correcto y dirección correcta, pero OTRO tipo de vínculo se castiga (resta) en vez de dar crédito parcial', `${T(a.from)} —${t}→ ${T(a.to)} (el texto dice ${a.tipo}) ⇒ ${o.estado}`)
    }
    // con cartas partidas (nombre o descripción) en vez de la carta entera
    const e1 = piezaEtiqueta(c, a.from), d2 = piezaDefinicion(c, a.to)
    if (e1 && d2) { const p = juzga('flecha', [e1, d2], a.tipo); if (BUENOS.has(v.estado) && !BUENOS.has(p.estado)) anotar('REVISAR', 'La misma flecha correcta falla si se traza con la carta de nombre o de descripción en vez de la entera', `${T(a.from)} —${a.tipo}→ ${T(a.to)} ⇒ ${p.estado}: ${p.nota.slice(0, 80)}`) }
  }
  console.log(' tal como el texto:  ' + fmt(ok))
  console.log(' misma arista AL REVÉS, por tipo:')
  for (const [t, k] of Object.entries(rev)) {
    console.log(`   ${t.padEnd(14)} ${fmt(k)}`)
    const tot = Object.values(k).reduce((a, b) => a + b, 0), bien = Object.entries(k).filter(([e]) => BUENOS.has(e)).reduce((a, [, n]) => a + n, 0)
    if (bien > 0 && bien < tot) anotar('REVISAR', 'Un mismo tipo de vínculo se acepta al revés unas veces y otras no', `${t}: ${fmt(k)}`)
  }
  console.log(' misma arista con OTRO tipo (filas: lo que dice el texto → lo que puso el jugador):')
  for (const [real, m] of Object.entries(otro)) console.log(`   ${real.padEnd(13)} ` + Object.entries(m).map(([t, k]) => `${t}: ${Object.entries(k).sort((a, b) => b[1] - a[1])[0][0]}`).join(' | '))
}

/* 2 · creatividad: insinuadas y pares sin vínculo */
sec('2 · Flexibilidad: insinuadas y conexiones propias')
{
  const ins: Cuenta = {}
  for (const a of c.insinuadas) if (c.conceptos[a.from] && c.conceptos[a.to]) {
    const v = juzga('flecha', [K(a.from), K(a.to)], a.tipo); sumar(ins, v.estado)
    if (['silencio', 'error', 'invertido', 'plausible'].includes(v.estado)) anotar('REVISAR', 'Conexión que el extractor infirió (insinuada) y que el juez no premia', `${T(a.from)} —${a.tipo}→ ${T(a.to)} ⇒ ${v.estado}`)
  }
  console.log(' insinuadas jugadas tal cual:  ' + fmt(ins))
  const unidos = new Set([...c.aristas, ...c.insinuadas].flatMap((a) => [`${a.from}|${a.to}`, `${a.to}|${a.from}`]))
  const libres: Cuenta = {}; let n = 0
  for (let i = 0; i < ids.length && n < 600; i++) for (let j = i + 1; j < ids.length && n < 600; j++) {
    if (unidos.has(`${ids[i]}|${ids[j]}`)) continue
    const t = tipos[(i + j) % tipos.length]; n++
    const v = juzga('flecha', [K(ids[i]), K(ids[j])], t); sumar(libres, v.estado)
    if (v.estado === 'error' || v.estado === 'invertido') anotar('BUG', 'Par SIN ningún vínculo en el texto que se castiga como falso o al revés (proponer no debería restar)', `${T(ids[i])} —${t}→ ${T(ids[j])} ⇒ ${v.estado}: ${v.nota.slice(0, 70)}`)
    if (BUENOS.has(v.estado) && v.estado !== 'derivado') anotar('REVISAR', 'Par sin arista que el juez da por sostenido', `${T(ids[i])} —${t}→ ${T(ids[j])} ⇒ ${v.estado}: ${v.nota.slice(0, 70)}`)
  }
  console.log(` ${n} pares sin vínculo, con un tipo cualquiera:  ` + fmt(libres))
}

/* 3 · cada herramienta sobre TODO su material */
sec('3 · Herramientas sobre todo su material')
const fila = (nombre: string, ok: Cuenta, extra = '') => console.log(` ${nombre.padEnd(34)} ${fmt(ok)}${extra ? '   ' + extra : ''}`)
{ // identidad
  const ok: Cuenta = {}, cruz: Cuenta = {}
  ids.forEach((id, i) => {
    const e = piezaEtiqueta(c, id), d = piezaDefinicion(c, id)
    if (!e || !d) { anotar('DATO', 'Concepto sin carta de nombre o de descripción', T(id)); return }
    const v = juzga('identidad', [e, d]); sumar(ok, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Identidad correcta (nombre + su descripción) que no se sostiene', `${T(id)} ⇒ ${v.estado}: ${v.nota.slice(0, 80)}`)
    const d2 = piezaDefinicion(c, ids[(i + 1) % ids.length]); if (d2 && ids.length > 1) { const x = juzga('identidad', [e, d2]); sumar(cruz, x.estado); if (BUENOS.has(x.estado)) anotar('BUG', 'Identidad cruzada (nombre con la descripción de OTRO concepto) que se sostiene', `${T(id)} + descripción de ${T(ids[(i + 1) % ids.length])}`) }
    const inv = juzga('identidad', [d, e]); if (inv.estado !== v.estado) anotar('BUG', 'Identidad: el orden de las cartas cambia el veredicto (no tiene dirección)', `${T(id)}: ${v.estado} vs ${inv.estado}`)
  })
  fila('Identidad correcta', ok); fila('Identidad cruzada', cruz)
}
{ // campo
  const ok: Cuenta = {}, mez: Cuenta = {}
  for (const k of c.clusters) {
    const m = k.conceptIds.filter((x) => c.conceptos[x])
    for (let n = 2; n <= Math.min(6, m.length); n++) { const v = juzga('campo', m.slice(0, n).map(K)); sumar(ok, v.estado); if (!BUENOS.has(v.estado)) anotar('BUG', 'Campo correcto (conceptos del mismo cluster) que no se sostiene', `${k.label} con ${n} ⇒ ${v.estado}: ${v.nota.slice(0, 70)}`) }
    const ajeno = ids.find((x) => !m.includes(x) && !c.clusters.some((q) => q !== k && q.conceptIds.includes(x) && m.some((y) => q.conceptIds.includes(y))))
    if (ajeno && m.length >= 2) { const v = juzga('campo', [...m.slice(0, 2).map(K), K(ajeno)]); sumar(mez, v.estado); if (v.estado === 'invertido') anotar('BUG', 'Campo marca «al revés» (no tiene dirección)', k.label) }
  }
  fila('Campo (2…6 del mismo cluster)', ok); fila('Campo con un intruso', mez)
}
{ // jerarquía
  const ok: Cuenta = {}, rev: Cuenta = {}
  for (const p of ids) {
    const hijos = [...c.aristas.filter((x) => x.tipo === 'ejemplifica' && x.to === p).map((x) => x.from), ...c.aristas.filter((x) => x.tipo === 'generaliza' && x.from === p).map((x) => x.to)].filter((x) => c.conceptos[x])
    if (!hijos.length) continue
    const v = juzga('jerarquia', [K(p), ...hijos.slice(0, 3).map(K)]); sumar(ok, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Jerarquía correcta (categoría + sus ejemplos) que no se sostiene', `${T(p)} ⊃ ${hijos.slice(0, 3).map(T).join(', ')} ⇒ ${v.estado}: ${v.nota.slice(0, 70)}`)
    const r = juzga('jerarquia', [K(hijos[0]), K(p)]); sumar(rev, r.estado)
    if (BUENOS.has(r.estado)) anotar('REVISAR', 'Jerarquía al revés (ejemplo como categoría) que se sostiene', `${T(hijos[0])} ⊃ ${T(p)}`)
  }
  fila('Jerarquía correcta', ok); fila('Jerarquía al revés', rev)
}
{ // eje
  const ok: Cuenta = {}, mal: Cuenta = {}
  for (const e of c.ejes) {
    const porValor = new Map<string, string[]>()
    for (const [id, val] of Object.entries(e.valores)) if (c.conceptos[id]) porValor.set(String(val), [...(porValor.get(String(val)) ?? []), id])
    const valores = [...porValor.keys()]
    for (const [val, xs] of porValor) {
      if (xs.length >= 2) { const v = juzga('eje', xs.slice(0, 4).map(K), `${e.id}::${val}`); sumar(ok, v.estado); if (!BUENOS.has(v.estado)) anotar('BUG', 'Eje correcto (conceptos que comparten el valor) que no se sostiene', `${e.nombre}=${val}: ${xs.slice(0, 4).map(T).join(', ')} ⇒ ${v.estado}: ${v.nota.slice(0, 60)}`) }
      const otroVal = valores.find((x) => x !== val)
      if (otroVal && xs.length >= 2) { const v = juzga('eje', xs.slice(0, 2).map(K), `${e.id}::${otroVal}`); sumar(mal, v.estado); if (v.estado === 'invertido') anotar('BUG', 'Eje marca «al revés» (no tiene dirección)', e.nombre) }
    }
    if ([...porValor.values()].every((xs) => xs.length < 2)) anotar('DATO', 'Eje sin ningún valor compartido por dos conceptos: no se puede jugar', e.nombre)
  }
  fila('Eje con el valor correcto', ok); fila('Eje con otro valor', mal)
}
{ // secuencia
  const ok: Cuenta = {}, rev: Cuenta = {}
  const vistas = new Set<string>()
  for (const a of ids) {
    const out = [a]
    for (let i = 0; i < 3; i++) { const s = c.aristas.find((x) => x.from === out[out.length - 1] && ['antecede', 'causa', 'requiere'].includes(x.tipo) && !out.includes(x.to) && c.conceptos[x.to]); if (!s) break; out.push(s.to) }
    if (out.length < 3 || vistas.has(out.join('>'))) continue
    vistas.add(out.join('>'))
    const v = juzga('secuencia', out.map(K)); sumar(ok, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Secuencia correcta (cadena del texto) que no se sostiene', `${out.map(T).join(' ⇢ ')} ⇒ ${v.estado}: ${v.nota.slice(0, 60)}`)
    const r = juzga('secuencia', [...out].reverse().map(K)); sumar(rev, r.estado)
    if (BUENOS.has(r.estado)) anotar('REVISAR', 'Secuencia invertida que se sostiene', out.map(T).reverse().join(' ⇢ '))
  }
  fila('Secuencia correcta', ok); fila('Secuencia al revés', rev)
}
{ // ancla y contraejemplo
  const an: Cuenta = {}, anMal: Cuenta = {}, ce: Cuenta = {}, ceMal: Cuenta = {}
  for (const k of c.casos) {
    const pc = piezaCaso(c, k.id); const suyos = k.conceptIds.filter((x) => c.conceptos[x])
    if (!pc) continue
    if (!suyos.length) { anotar('DATO', 'Caso sin conceptos asociados: Ancla y Contraejemplo no tienen con qué jugarse', k.descripcion.slice(0, 70)); continue }
    const v = juzga('ancla', [pc, ...suyos.slice(0, 3).map(K)]); sumar(an, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Ancla correcta (caso + sus conceptos) que no se sostiene', `${k.descripcion.slice(0, 50)}… ⇒ ${v.estado}: ${v.nota.slice(0, 60)}`)
    const ajeno = ids.find((x) => !suyos.includes(x))
    if (ajeno) {
      const m = juzga('ancla', [pc, K(ajeno)]); sumar(anMal, m.estado)
      if (m.estado === 'invertido') anotar('BUG', 'Ancla con un concepto ajeno responde «al revés» (no hay dirección que voltear: es falso)', `${k.descripcion.slice(0, 40)}… + ${T(ajeno)}`)
      const x = juzga('contraejemplo', [pc, K(ajeno)]); sumar(ce, x.estado)
      if (!BUENOS.has(x.estado) && x.estado !== 'aproximado') anotar('REVISAR', 'Contraejemplo razonable (caso + concepto que no opera en él) que no se sostiene', `${k.descripcion.slice(0, 40)}… ✗ ${T(ajeno)} ⇒ ${x.estado}: ${x.nota.slice(0, 60)}`)
    }
    const y = juzga('contraejemplo', [pc, K(suyos[0])]); sumar(ceMal, y.estado)
    if (y.estado === 'invertido') anotar('BUG', 'Contraejemplo con un concepto que sí opera responde «al revés» (es falso, no invertido)', T(suyos[0]))
    if (BUENOS.has(y.estado)) anotar('BUG', 'Contraejemplo con un concepto que SÍ opera en el caso, y se sostiene', `${k.descripcion.slice(0, 40)}… ✗ ${T(suyos[0])}`)
  }
  fila('Ancla (caso + sus conceptos)', an); fila('Ancla con concepto ajeno', anMal); fila('Contraejemplo (concepto ajeno)', ce); fila('Contraejemplo con concepto propio', ceMal)
}
{ // balanza
  const ok: Cuenta = {}, mal: Cuenta = {}
  for (const t of c.tesis) {
    const pt = piezaTesis(c, t.id); if (!pt) continue
    const crit = piezasCriterio(c, t.id, rng)
    if (!crit.length) { anotar('DATO', 'Tesis sin criterios: Balanza no se puede jugar', t.enunciado.slice(0, 70)); continue }
    for (const k of crit.filter((p) => p.sentido)) { const v = juzga('balanza', [pt, k]); sumar(ok, `${k.sentido}:${v.estado}`) }
    const real = crit.find((p) => p.sentido === 'refuta')
    if (real) { const v = juzga('balanza', [pt, real]); if (!BUENOS.has(v.estado)) anotar('BUG', 'Balanza correcta (tesis + un criterio que la refuta) que no se sostiene', `${t.enunciado.slice(0, 50)}… ⇒ ${v.estado}: ${v.nota.slice(0, 60)}`) }
    const otra = c.tesis.find((x) => x.id !== t.id); const pk = otra && piezasCriterio(c, otra.id, rng).find((p) => p.sentido === 'refuta')
    if (pk) { const v = juzga('balanza', [pt, pk]); sumar(mal, v.estado); if (BUENOS.has(v.estado)) anotar('REVISAR', 'Balanza con el criterio de OTRA tesis, y se sostiene', t.enunciado.slice(0, 60)) }
  }
  fila('Balanza (por sentido del criterio)', ok); fila('Balanza con criterio de otra tesis', mal)
}
{ // analogía y alcance
  const an: Cuenta = {}, cruz: Cuenta = {}; let n = 0
  for (const a1 of c.aristas) { if (n >= 150) break; for (const a2 of c.aristas) {
    if (a1 === a2 || new Set([a1.from, a1.to, a2.from, a2.to]).size < 4 || ![a1.from, a1.to, a2.from, a2.to].every((x) => c.conceptos[x])) continue
    if (a1.tipo === a2.tipo) { const v = juzga('analogia', [a1.from, a1.to, a2.from, a2.to].map(K)); sumar(an, v.estado); n++
      if (!BUENOS.has(v.estado)) anotar('BUG', 'Analogía correcta (dos pares con el mismo vínculo) que no se sostiene', `${T(a1.from)}:${T(a1.to)} :: ${T(a2.from)}:${T(a2.to)} (${a1.tipo}) ⇒ ${v.estado}: ${v.nota.slice(0, 50)}`)
      const x = juzga('analogia', [a1.from, a1.to, a2.to, a2.from].map(K)); sumar(cruz, x.estado)
    }
    if (n >= 150) break
  } }
  fila('Analogía (mismo vínculo)', an); fila('Analogía con el 2º par volteado', cruz)
  const al: Cuenta = {}, alRev: Cuenta = {}
  for (const m of c.aristas.filter((x) => x.tipo === 'matiza' && c.conceptos[x.from] && c.conceptos[x.to])) {
    const v = juzga('alcance', [K(m.to), K(m.from)]); sumar(al, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Alcance correcto (concepto + lo que lo matiza) que no se sostiene', `${T(m.to)} ⊣ ${T(m.from)} ⇒ ${v.estado}: ${v.nota.slice(0, 60)}`)
    const r = juzga('alcance', [K(m.from), K(m.to)]); sumar(alRev, r.estado)
  }
  fila('Alcance (sobre aristas «matiza»)', al); fila('Alcance al revés', alRev)
}
{ // descomposición
  const ok: Cuenta = {}, nom: Cuenta = {}, mez: Cuenta = {}
  const con = ids.filter((x) => c.conceptos[x].subdimensiones.length >= 1)
  for (const id of con) {
    const partes = piezasSubdimension(c, id).slice(0, 3)
    const v = juzga('descomposicion', [K(id), ...partes]); sumar(ok, v.estado)
    if (!BUENOS.has(v.estado)) anotar('BUG', 'Descomposición correcta (concepto + sus atributos) que no se sostiene', `${T(id)} ⇒ ${v.estado}: ${v.nota.slice(0, 70)}`)
    const e = piezaEtiqueta(c, id); if (e) { const x = juzga('descomposicion', [e, ...partes]); sumar(nom, x.estado); if (!BUENOS.has(x.estado)) anotar('REVISAR', 'Descomposición correcta falla si el todo es la carta de nombre en vez de la entera', `${T(id)} ⇒ ${x.estado}`) }
    const otro = con.find((x) => x !== id); if (otro) { const y = juzga('descomposicion', [K(id), partes[0], piezasSubdimension(c, otro)[0]]); sumar(mez, y.estado); if (y.estado === 'invertido') anotar('BUG', 'Descomposición marca «al revés» (no tiene dirección que voltear)', T(id)) }
    const tit = partes.map((p) => p.titulo.toLowerCase())
    if (new Set(tit).size < tit.length) anotar('DATO', 'Concepto con atributos de nombre repetido', T(id))
  }
  // atributos con el mismo nombre en conceptos distintos: el jugador no puede saber de quién es
  const dueños = new Map<string, string[]>()
  for (const id of con) for (const s of c.conceptos[id].subdimensiones) dueños.set(s.nombre.toLowerCase().trim(), [...(dueños.get(s.nombre.toLowerCase().trim()) ?? []), id])
  for (const [nombre, ds] of dueños) if (new Set(ds).size > 1) anotar('REVISAR', 'El mismo atributo aparece en varios conceptos: la carta no dice de cuál es y solo uno se acepta', `«${nombre}» en ${[...new Set(ds)].map(T).join(' / ')}`)
  // v6.9 · atributos cuyo nombre remite a OTRO concepto: el lector los pondrá allí con buena razón
  const afin: Cuenta = {}
  for (const id of con) for (const parte of piezasSubdimension(c, id)) for (const otro of ids) {
    if (otro === id || !atributoAfin(parte.titulo, K(otro), c)) continue
    const v = juzga('descomposicion', [K(otro), parte]); sumar(afin, v.estado)
    anotar(v.estado === 'error' || v.estado === 'invertido' ? 'BUG' : 'DATO', v.estado === 'error' || v.estado === 'invertido' ? 'Atributo cuyo nombre remite a otro concepto, y ponerlo allí se castiga' : 'Atributo cuyo nombre remite a otro concepto (ambiguo para el lector; el juez da crédito parcial)', `«${parte.titulo}» es de ${T(id)}, pero suena a ${T(otro)} ⇒ ${v.estado}`)
  }
  fila('Atributo afín a otro concepto', afin)
  fila('Descomposición (carta entera)', ok); fila('Descomposición (carta de nombre)', nom); fila('Descomposición con atributo ajeno', mez)
}

/* 4 · callejones sin salida: piezas que la ranura admite y el juez deja sin decir nada */
sec('4 · Ranuras y mensajes')
{
  const muestra: Pieza[] = [
    ...(ids[0] ? [K(ids[0]), piezaEtiqueta(c, ids[0]), piezaDefinicion(c, ids[0])] : []), ...(ids[1] ? [K(ids[1])] : []),
    ...(c.casos[0] ? [piezaCaso(c, c.casos[0].id)] : []), ...(c.tesis[0] ? [piezaTesis(c, c.tesis[0].id), ...piezasCriterio(c, c.tesis[0].id, rng).slice(0, 1)] : []),
    ...(c.marcos[0] ? [piezaMarco(c, c.marcos[0].id)] : []), ...(c.repertorios[0] ? [piezaIntuicion(c, c.repertorios[0].id)] : []),
    ...ids.filter((x) => c.conceptos[x].subdimensiones.length).slice(0, 1).flatMap((x) => piezasSubdimension(c, x).slice(0, 1))
  ].filter((p): p is Pieza => !!p)
  let mudas = 0, total = 0
  for (const tool of Object.keys(HERRAMIENTAS) as HerramientaId[]) {
    const h = HERRAMIENTAS[tool]; if (h.aridad[0] > 2) continue
    for (const a of muestra) for (const b of muestra) {
      if (a === b || !aceptaEnRanura(tool, 0, a) || !aceptaEnRanura(tool, 1, b)) continue
      const param = h.parametro === 'relacion' ? (tipos[0] ?? 'causa') : h.parametro === 'eje' ? (c.ejes[0] ? `${c.ejes[0].id}::${Object.values(c.ejes[0].valores)[0]}` : null) : null
      if (h.parametro === 'eje' && !param) continue
      total++
      let v: Veredicto
      try { v = juzga(tool, [a, b], param) } catch (err) { anotar('BUG', 'El juez LANZA UN ERROR con una combinación que la ranura admite', `${h.nombre}: ${a.clase} + ${b.clase} → ${(err as Error).message.slice(0, 60)}`); continue }
      if (!v.nota.trim()) { mudas++; anotar('REVISAR', 'Combinación que la ranura admite y el juez responde sin ninguna explicación', `${h.nombre}: ${a.clase} + ${b.clase} ⇒ ${v.estado}`) }
      if (v.estado === 'invertido' && !h.ordenada) anotar('BUG', 'Herramienta sin dirección que responde «al revés»', `${h.nombre}: ${a.clase} + ${b.clase}`)
    }
  }
  console.log(` ${total} combinaciones de dos cartas admitidas por las ranuras · ${mudas} sin explicación`)
}

/* 5 · contenido */
sec('5 · Material del bundle')
{
  const enArista = new Set(c.aristas.flatMap((a) => [a.from, a.to]))
  const sueltos = ids.filter((x) => !enArista.has(x))
  console.log(` conceptos sin ninguna arista firme: ${sueltos.length}/${ids.length}${sueltos.length ? ' — ' + sueltos.slice(0, 6).map(T).join(', ') : ''}`)
  if (sueltos.length) anotar('DATO', 'Conceptos sin ninguna arista firme (solo se juegan con Identidad o propuestas)', sueltos.slice(0, 8).map(T).join(', '))
  const grado = new Map<string, number>(); for (const a of c.aristas) for (const x of [a.from, a.to]) grado.set(x, (grado.get(x) ?? 0) + 1)
  const hub = [...grado.entries()].sort((a, b) => b[1] - a[1])[0]
  if (hub && c.aristas.length && hub[1] / c.aristas.length > 0.5) anotar('DATO', 'Grafo en estrella: un concepto concentra más de la mitad de las aristas', `${T(hub[0])}: ${hub[1]}/${c.aristas.length}`)
  console.log(' tipos de vínculo: ' + Object.entries(c.aristas.reduce((k: Cuenta, a) => (sumar(k, a.tipo), k), {})).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · '))
  const dup = new Map<string, string[]>(); for (const a of c.aristas) dup.set([a.from, a.to].sort().join('|'), [...(dup.get([a.from, a.to].sort().join('|')) ?? []), `${a.from === [a.from, a.to].sort()[0] ? '→' : '←'}${a.tipo}`])
  for (const [k, v] of dup) if (v.length > 1) anotar('DATO', 'Par de conceptos con más de una arista (el juez debe aceptar cualquiera)', `${k.split('|').map(T).join(' / ')}: ${v.join(', ')}`)
}

/* resumen */
console.log('\n════════ HALLAZGOS ════════')
const orden = { BUG: 0, REVISAR: 1, DATO: 2 }
for (const h of hallazgos.sort((a, b) => orden[a.grav] - orden[b.grav] || b.n - a.n)) {
  console.log(`\n[${h.grav}] ${h.titulo} — ${h.n} caso${h.n > 1 ? 's' : ''}`)
  for (const e of h.ejemplos) console.log(`     · ${e}`)
}
console.log(`\n${hallazgos.filter((h) => h.grav === 'BUG').length} tipos de bug · ${hallazgos.filter((h) => h.grav === 'REVISAR').length} por revisar · ${hallazgos.filter((h) => h.grav === 'DATO').length} datos del contenido\n`)
