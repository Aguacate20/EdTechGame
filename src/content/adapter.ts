import type {
  Arista, Carga, Caso, Concepto, Contenido, Diagnostico, Distancia, Distractor, Eje, Escenario,
  Item, ItemA1, ItemA3, ItemB1, ItemB2, ItemC1, ItemE1, ItemE3, Marco, MecanicaId,
  Repertorio, Tesis, Unidad
} from './types'

/* ------------------------------------------------------------------ */
/* Lectores tolerantes: el bundle evoluciona, el juego no debe romperse */
/* ------------------------------------------------------------------ */

const any_ = (v: unknown): any => v as any
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def)
const num = (v: unknown, def = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : def)
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def)
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const strArr = (v: unknown): string[] => arr(v).filter((x) => typeof x === 'string')

/** Acepta objeto-diccionario o lista con .id */
function asList(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>)
  return []
}

const CARGAS: Carga[] = ['memorizar', 'discriminar', 'inferir', 'integrar']
const DISTANCIAS: Distancia[] = ['cercana', 'media', 'lejana']

/* ------------------------------------------------------------------ */

export function adaptarBundle(raw: unknown): Contenido {
  const b = any_(raw) ?? {}
  const diag: Diagnostico[] = []
  const nota = (clave: string, estado: Diagnostico['estado'], detalle: string) =>
    diag.push({ clave, estado, detalle })

  /* ---- conceptos ---- */
  const conceptos: Record<string, Concepto> = {}
  const clusterDe: Record<string, string> = {}
  const clustersRaw = arr(b.graph?.clusters)
  for (const c of clustersRaw) {
    for (const id of strArr(c?.concept_ids)) clusterDe[id] = str(c?.id, 'cluster')
  }

  for (const c of asList(b.concepts)) {
    const id = str(c?.id)
    if (!id) continue
    const nDist = num(c?.n_distractores, 0)
    const nOpt = num(c?.n_opciones, 4)
    conceptos[id] = {
      id,
      titulo: str(c?.titulo, id),
      definicion: str(c?.definicion, str(c?.definicion_corta)),
      definicionCorta: str(c?.definicion_corta, str(c?.definicion)),
      tipo: str(c?.tipo, 'teorico'),
      unidadId: str(c?.unidad_id, 'unidad_1'),
      clusterId: clusterDe[id] ?? null,
      importancia: num(c?.importancia, 0.5),
      dificultad: num(c?.dificultad_objetivo, 0.5),
      esPuerta: bool(c?.es_puerta),
      esUmbral: bool(c?.es_umbral),
      nEfectivo: num(c?.n_efectivo, 1),
      // regla dura: nunca pedir más opciones de las que el pool sostiene
      nOpciones: Math.max(2, Math.min(nOpt, nDist + 1)),
      nDistractores: nDist,
      cargaCognitiva: strArr(c?.carga_cognitiva).filter((x): x is Carga =>
        (CARGAS as string[]).includes(x)
      ),
      familias: strArr(c?.familias_recomendadas),
      sinonimos: strArr(c?.sinonimos),
      subdimensiones: arr(c?.subdimensiones).map((s) => ({
        nombre: str(s?.name, str(s?.nombre)),
        descripcion: str(s?.description, str(s?.descripcion))
      })),
      tensiones: strArr(c?.tensiones),
      paginas: arr(c?.paginas).filter((x) => typeof x === 'number')
    }
  }
  const ordenConceptos = strArr(b.study_plan?.orden).filter((id) => conceptos[id])
  for (const id of Object.keys(conceptos)) if (!ordenConceptos.includes(id)) ordenConceptos.push(id)

  const nConceptos = Object.keys(conceptos).length
  const conCarga = Object.values(conceptos).filter((c) => c.cargaCognitiva.length > 0).length
  nota(
    'carga_cognitiva',
    conCarga === 0 ? 'ausente' : conCarga < nConceptos ? 'parcial' : 'ok',
    `${conCarga}/${nConceptos} conceptos con causa de dificultad declarada`
  )
  const pobres = Object.values(conceptos).filter((c) => c.nDistractores < 3).length
  nota(
    'pools de distractores',
    pobres === 0 ? 'ok' : 'parcial',
    `${pobres}/${nConceptos} conceptos con menos de 3 distractores utilizables`
  )

  /* ---- grafo ---- */
  const aristas: Arista[] = []
  const vistas = new Set<string>()
  const empujar = (e: any) => {
    const from = str(e?.from), to = str(e?.to), tipo = str(e?.tipo)
    if (!from || !to || !tipo) return
    if (bool(e?.invertida)) return
    const k = `${from}|${to}|${tipo}`
    if (vistas.has(k)) return
    vistas.add(k)
    aristas.push({ from, to, tipo, descripcion: str(e?.descripcion) })
  }
  const porTipo = b.graph?.por_tipo
  if (porTipo && typeof porTipo === 'object') {
    for (const lista of Object.values(porTipo as Record<string, unknown>)) arr(lista).forEach(empujar)
  }
  const ady = b.graph?.adyacencia
  if (ady && typeof ady === 'object') {
    for (const lista of Object.values(ady as Record<string, unknown>)) arr(lista).forEach(empujar)
  }

  const frecuenciaRelacion: Record<string, number> = {}
  for (const a of aristas) frecuenciaRelacion[a.tipo] = (frecuenciaRelacion[a.tipo] ?? 0) + 1
  nota(
    'grafo',
    aristas.length > 0 ? 'ok' : 'ausente',
    `${aristas.length} aristas en ${Object.keys(frecuenciaRelacion).length} tipos`
  )

  const clusters = clustersRaw.map((c, i) => ({
    id: str(c?.id, `cluster_${i}`),
    label: str(c?.label, `Grupo ${i + 1}`),
    conceptIds: strArr(c?.concept_ids)
  }))
  const mayor = clusters.reduce((m, c) => Math.max(m, c.conceptIds.length), 0)
  nota(
    'clusters',
    clusters.length > 1 ? 'ok' : 'parcial',
    `${clusters.length} clusters · mayor con ${mayor} conceptos`
  )

  /* ---- ejes (forma desconocida: se intentan varias) ---- */
  const ejes: Eje[] = []
  for (const [i, e] of arr(b.graph?.ejes).entries()) {
    const nombre = str(e?.nombre, str(e?.label, str(e?.titulo, `Eje ${i + 1}`)))
    const valores: Record<string, string | number> = {}
    const fuente = e?.valores ?? e?.asignaciones ?? e?.conceptos ?? e?.concept_values
    if (fuente && typeof fuente === 'object' && !Array.isArray(fuente)) {
      for (const [k, v] of Object.entries(fuente as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number') valores[k] = v
      }
    } else if (Array.isArray(fuente)) {
      for (const it of fuente) {
        const cid = str(it?.concept_id, str(it?.id))
        const val = it?.valor ?? it?.value ?? it?.polo
        if (cid && (typeof val === 'string' || typeof val === 'number')) valores[cid] = val
      }
    } else if (Array.isArray(e?.polos)) {
      for (const polo of e.polos) {
        const etiqueta = str(polo?.label, str(polo?.nombre, 'polo'))
        for (const cid of strArr(polo?.concept_ids)) valores[cid] = etiqueta
      }
    }
    if (Object.keys(valores).length >= 4) {
      ejes.push({ id: str(e?.id, `eje_${i}`), nombre, provisional: bool(e?.provisional), valores })
    }
  }
  nota(
    'ejes de atributos',
    ejes.length >= 2 ? 'ok' : ejes.length === 1 ? 'parcial' : 'ausente',
    ejes.length >= 2
      ? `${ejes.length} ejes legibles · habilita EL ARQUITECTO`
      : 'sin dos ejes legibles: EL ARQUITECTO queda fuera de la rotación'
  )

  /* ---- unidades ---- */
  const curva = arr(b.study_plan?.curva_dificultad)
  const curvaDe = (id: string) => curva.find((c) => str(c?.unidad_id) === id)
  const unidades: Unidad[] = arr(b.study_plan?.unidades).map((u, i) => {
    const id = str(u?.id, `unidad_${i + 1}`)
    const cu = curvaDe(id)
    return {
      id,
      numero: num(u?.numero, i + 1),
      titulo: str(u?.titulo, `Unidad ${i + 1}`),
      conceptIds: strArr(u?.concept_ids).filter((c) => conceptos[c]),
      dificultadObjetivo: num(cu?.dificultad_objetivo, 0.5),
      nOpcionesSugerido: num(cu?.n_opciones_sugerido, 4),
      andamiaje: str(cu?.andamiaje_sugerido, 'medio'),
      tienePuerta: bool(u?.tiene_puerta),
      tieneUmbral: bool(u?.tiene_umbral)
    }
  })
  if (unidades.length === 0 && nConceptos > 0) {
    unidades.push({
      id: 'unidad_1', numero: 1, titulo: 'Expedición única',
      conceptIds: Object.keys(conceptos), dificultadObjetivo: 0.5,
      nOpcionesSugerido: 4, andamiaje: 'medio', tienePuerta: false, tieneUmbral: false
    })
  }

  /* ---- ítems ---- */
  const items: Record<MecanicaId, Item[]> = { A1: [], A3: [], B1: [], B2: [], C1: [], E1: [], E2: [], E3: [] }
  const src = b.items ?? {}

  for (const it of arr(src.A1)) {
    const conceptId = str(it?.concept_id)
    if (!conceptos[conceptId]) continue
    const opciones = arr(it?.opciones)
      .map((o) => ({
        id: str(o?.id, Math.random().toString(36).slice(2)),
        texto: str(o?.texto),
        esCorrecta: bool(o?.es_correcta),
        feedback: str(o?.feedback),
        conceptoConfundido: str(o?.concepto_confundido) || null,
        repertoireId: str(o?.repertoire_id) || null
      }))
      .filter((o) => o.texto)
    if (opciones.length < 2 || !opciones.some((o) => o.esCorrecta)) continue
    const item: ItemA1 = {
      id: str(it?.id), mecanica: 'A1', conceptId, enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5), opciones
    }
    items.A1.push(item)
  }

  for (const it of arr(src.A3)) {
    const conceptId = str(it?.concept_id)
    if (!conceptos[conceptId]) continue
    const item: ItemA3 = {
      id: str(it?.id), mecanica: 'A3', conceptId, enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      respuestasAceptadas: strArr(it?.respuestas_aceptadas)
    }
    if (item.respuestasAceptadas.length === 0) continue
    items.A3.push(item)
  }

  for (const it of arr(src.B1)) {
    const conceptId = str(it?.concept_id)
    if (!conceptos[conceptId]) continue
    const item: ItemB1 = {
      id: str(it?.id), mecanica: 'B1', conceptId,
      enunciado: str(it?.enunciado), afirmacion: str(it?.afirmacion),
      dificultad: num(it?.dificultad, 0.5),
      respuestaCorrecta: bool(it?.respuesta_correcta),
      conceptoConfundido: str(it?.concepto_confundido) || null,
      feedback: str(it?.feedback),
      repertoireId: str(it?.repertoire_id) || null
    }
    if (!item.afirmacion) continue
    // en atribución hace falta saber a quién describe de verdad
    if (!item.respuestaCorrecta && !item.conceptoConfundido) continue
    items.B1.push(item)
  }

  for (const it of arr(src.B2)) {
    const opciones = strArr(it?.opciones).filter((o) => conceptos[o])
    const correcta = str(it?.respuesta_correcta)
    if (opciones.length < 2 || !opciones.includes(correcta)) continue
    const item: ItemB2 = {
      id: str(it?.id), mecanica: 'B2', enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5), opciones, respuestaCorrecta: correcta,
      casoId: str(it?.case_id) || null
    }
    items.B2.push(item)
  }

  for (const it of arr(src.C1)) {
    const par = strArr(it?.par)
    const opciones = strArr(it?.opciones)
    const correcta = str(it?.respuesta_correcta)
    if (par.length !== 2 || !conceptos[par[0]] || !conceptos[par[1]]) continue
    if (opciones.length < 2 || !opciones.includes(correcta)) continue
    const item: ItemC1 = {
      id: str(it?.id), mecanica: 'C1', par: [par[0], par[1]], enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5), opciones, respuestaCorrecta: correcta,
      explicacion: str(it?.explicacion)
    }
    items.C1.push(item)
  }

  for (const it of arr(src.E1)) {
    const variables = strArr(it?.variables_clave)
    if (variables.length === 0) continue
    const item: ItemE1 = {
      id: str(it?.id), mecanica: 'E1', enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      conceptIds: strArr(it?.concept_ids).filter((c) => conceptos[c]),
      variablesClave: variables, resolucionEsperada: str(it?.resolucion_esperada),
      origenId: str(it?.origen_id) || null
    }
    items.E1.push(item)
  }

  for (const it of arr(src.E3)) {
    const conceptIds = strArr(it?.concept_ids).filter((c) => conceptos[c])
    if (conceptIds.length === 0) continue
    const d = str(it?.distancia, 'cercana')
    const item: ItemE3 = {
      id: str(it?.id), mecanica: 'E3', enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5), conceptIds,
      distancia: (DISTANCIAS as string[]).includes(d) ? (d as Distancia) : 'cercana',
      resolucionEsperada: str(it?.resolucion_esperada), dominio: str(it?.dominio)
    }
    items.E3.push(item)
  }

  const totalItems = (Object.values(items) as Item[][]).reduce((n, l) => n + l.length, 0)
  nota(
    'ítems jugables',
    totalItems > 40 ? 'ok' : totalItems > 0 ? 'parcial' : 'ausente',
    (Object.keys(items) as MecanicaId[])
      .filter((k) => items[k].length)
      .map((k) => `${k}:${items[k].length}`)
      .join(' · ') || 'ninguno'
  )

  /* ---- capas de contenido ---- */
  const repertorios: Repertorio[] = asList(b.content?.repertoires)
    .map((r) => ({
      id: str(r?.id),
      conceptId: str(r?.concept_id),
      etiqueta: str(r?.label, 'Intuición previa'),
      descripcion: str(r?.description),
      ejemplo: str(r?.example),
      contrasteCientifico: str(r?.contraste_cientifico),
      contextoDondeFunciona: str(r?.contexto_donde_funciona),
      conceptoConfundido: str(r?.concepto_confundido) || null
    }))
    .filter((r) => r.id && r.ejemplo && r.contrasteCientifico)
  nota(
    'repertorios',
    repertorios.length >= 8 ? 'ok' : repertorios.length ? 'parcial' : 'ausente',
    `${repertorios.length} intuiciones previas · alimenta a EL ECO`
  )

  const casos: Caso[] = asList(b.content?.cases).map((c) => ({
    id: str(c?.id),
    descripcion: str(c?.description),
    conceptIds: strArr(c?.concept_ids).filter((x) => conceptos[x]),
    conceptoPrincipal: str(c?.primary_concept_id) || null,
    dominio: str(c?.dominio),
    resolucionEsperada: str(c?.resolucion_esperada),
    variablesClave: strArr(c?.variables_clave),
    prediccionHabilitada: bool(c?.prediction_enabled)
  }))

  const escenarios: Escenario[] = asList(b.content?.scenarios).map((s) => {
    const d = str(s?.distancia, 'cercana')
    return {
      id: str(s?.id),
      descripcion: str(s?.description),
      conceptIds: strArr(s?.concept_ids).filter((x) => conceptos[x]),
      distancia: (DISTANCIAS as string[]).includes(d) ? (d as Distancia) : 'cercana',
      dominio: str(s?.dominio),
      resolucionEsperada: str(s?.resolucion_esperada),
      errorEmbebido: str(s?.error_embebido) || null
    }
  })
  const porDistancia = escenarios.reduce<Record<string, number>>((acc, e) => {
    acc[e.distancia] = (acc[e.distancia] ?? 0) + 1
    return acc
  }, {})
  nota(
    'escalera de transferencia',
    (porDistancia.media ?? 0) >= 3 ? 'ok' : 'parcial',
    `cercana ${porDistancia.cercana ?? 0} · media ${porDistancia.media ?? 0} · lejana ${porDistancia.lejana ?? 0}`
  )

  const tesis: Tesis[] = asList(b.content?.theses)
    .map((t) => ({
      id: str(t?.id),
      enunciado: str(t?.statement),
      conceptIds: strArr(t?.concept_ids).filter((x) => conceptos[x]),
      marcoId: str(t?.framework_id) || null,
      argumentosApoyo: strArr(t?.supporting_arguments),
      contraargumentos: strArr(t?.counterarguments),
      criteriosDefensa: strArr(t?.criterios_defensa_valida),
      criteriosRefutacion: strArr(t?.criterios_refutacion_valida)
    }))
    .filter((t) => t.enunciado && t.criteriosRefutacion.length > 0)
  nota(
    'tesis con rúbrica',
    tesis.length >= 3 ? 'ok' : tesis.length ? 'parcial' : 'ausente',
    `${tesis.length} tesis con criterios de refutación · alimenta al jefe`
  )

  const marcos: Marco[] = asList(b.content?.frameworks).map((f) => ({
    id: str(f?.id),
    etiqueta: str(f?.label, str(f?.id)),
    conceptIds: strArr(f?.concept_ids),
    principios: strArr(f?.principios_centrales),
    rivales: strArr(f?.rivales)
  }))

  /* ---- pools de distractores: el extractor ya sabe con qué se confunde cada cosa ---- */
  const distractores: Record<string, Distractor[]> = {}
  const pools = b.distractor_pools
  if (pools && typeof pools === 'object') {
    for (const [cid, lista] of Object.entries(pools as Record<string, unknown>)) {
      if (!conceptos[cid]) continue
      const d = arr(lista).map((x) => ({
        texto: str(x?.texto),
        explicacion: str(x?.explicacion),
        conceptoConfundido: str(x?.concepto_confundido) || null,
        fuente: str(x?.fuente, 'desconocida'),
        repertorioId: str(x?.repertoire_id) || null
      })).filter((x) => x.texto)
      if (d.length) distractores[cid] = d
    }
  }
  const conPool = Object.keys(distractores).length
  nota(
    'pools del extractor',
    conPool >= nConceptos * 0.8 ? 'ok' : conPool ? 'parcial' : 'ausente',
    `${conPool}/${nConceptos} conceptos con distractores propios · ` +
    `${Object.values(distractores).flat().filter((d) => d.explicacion).length} con explicación`
  )

  /* ---- dominios: para qué sirve esto fuera del texto ---- */
  const dominios = [...new Set([
    ...casos.map((c) => c.dominio),
    ...escenarios.map((e) => e.dominio)
  ])].filter(Boolean)
  nota('dominios de aplicación', dominios.length ? 'ok' : 'ausente', dominios.join(' · ') || 'ninguno')

  /* ---- capacidades declaradas por el compilador ---- */
  const condicionesDisponibles = leerCondiciones(b)
  nota(
    'condiciones instanciables',
    condicionesDisponibles.length ? 'ok' : 'parcial',
    condicionesDisponibles.join(' · ') || 'ninguna declarada: se deducen del contenido'
  )

  return {
    fuente: str(b.source_filename, 'fuente sin nombre'),
    bundleVersion: str(b.bundle_version, '—'),
    schema: str(b.compiled_from_schema, '—'),
    conceptos, ordenConceptos, aristas, frecuenciaRelacion, unidades, clusters,
    items, repertorios, casos, escenarios, tesis, marcos, ejes,
    distractores, dominios, condicionesDisponibles, diagnostico: diag
  }
}

/** `capabilities` cambia de forma entre versiones: lista, diccionario o anidado. */
function leerCondiciones(b: any): string[] {
  const cap = b?.capabilities
  const salida = new Set<string>()
  const recoger = (v: unknown) => {
    if (!v) return
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string') salida.add(x)
        else if (x && typeof x === 'object') {
          const id = str((x as any).id, str((x as any).nombre, str((x as any).condicion)))
          const ok = (x as any).instanciable ?? (x as any).disponible ?? true
          if (id && ok) salida.add(id)
        }
      }
      return
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val === true) salida.add(k)
        else if (val && typeof val === 'object') {
          const ok = (val as any).instanciable ?? (val as any).disponible ?? (val as any).ok
          if (ok !== false) salida.add(k)
        }
      }
    }
  }
  recoger(cap?.condiciones)
  recoger(cap?.conditions)
  if (salida.size === 0) recoger(cap)
  return [...salida]
}
