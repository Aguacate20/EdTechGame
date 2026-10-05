// scripts/explorar.ts
import { readFileSync } from "node:fs";

// src/content/adapter.ts
var any_ = (v) => v;
var str = (v, def = "") => typeof v === "string" ? v : def;
var num = (v, def = 0) => typeof v === "number" && !Number.isNaN(v) ? v : def;
var bool = (v, def = false) => typeof v === "boolean" ? v : def;
var arr = (v) => Array.isArray(v) ? v : [];
var strArr = (v) => arr(v).filter((x) => typeof x === "string");
function asList(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}
var CARGAS = ["memorizar", "discriminar", "inferir", "integrar"];
var DISTANCIAS = ["cercana", "media", "lejana"];
var clavePar = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
function leerCoocurrencias(b) {
  const crudo = b?.cooccurrences ?? b?.graph?.cooccurrences ?? b?.graph?.co_ocurrencias ?? [];
  const out = /* @__PURE__ */ new Set();
  for (const x of Array.isArray(crudo) ? crudo : []) {
    const a = x?.a ?? x?.from ?? x?.concept_a ?? x?.pair?.[0] ?? x?.concept_ids?.[0];
    const c2 = x?.b ?? x?.to ?? x?.concept_b ?? x?.pair?.[1] ?? x?.concept_ids?.[1];
    if (typeof a === "string" && typeof c2 === "string") out.add(clavePar(a, c2));
  }
  return out;
}
function leerPuentes(b) {
  const crudo = b?.latent_links ?? b?.puentes ?? b?.graph?.latent_links ?? b?.content?.latent_links ?? [];
  const out = {};
  for (const x of Array.isArray(crudo) ? crudo : []) {
    const a = x?.from ?? x?.a ?? x?.concept_ids?.[0], c2 = x?.to ?? x?.b ?? x?.concept_ids?.[1];
    const j = x?.justificacion ?? x?.justification ?? x?.reason ?? "";
    if (typeof a === "string" && typeof c2 === "string" && j) out[clavePar(a, c2)] = j;
  }
  return out;
}
function adaptarBundle(raw) {
  const b = any_(raw) ?? {};
  const diag = [];
  const nota = (clave, estado, detalle) => diag.push({ clave, estado, detalle });
  const conceptos = {};
  const clusterDe = {};
  const clustersRaw = arr(b.graph?.clusters);
  for (const c2 of clustersRaw) {
    for (const id of strArr(c2?.concept_ids)) clusterDe[id] = str(c2?.id, "cluster");
  }
  for (const c2 of asList(b.concepts)) {
    const id = str(c2?.id);
    if (!id) continue;
    if (str(c2?.status) === "rechazado") continue;
    const nDist = num(c2?.n_distractores, 0);
    const nOpt = num(c2?.n_opciones, 4);
    conceptos[id] = {
      id,
      titulo: str(c2?.titulo, id),
      definicion: str(c2?.definicion, str(c2?.definicion_corta)),
      definicionCorta: str(c2?.definicion_corta, str(c2?.definicion)),
      tipo: str(c2?.tipo, "teorico"),
      unidadId: str(c2?.unidad_id, "unidad_1"),
      clusterId: clusterDe[id] ?? null,
      importancia: num(c2?.importancia, 0.5),
      dificultad: num(c2?.dificultad_objetivo, 0.5),
      esPuerta: bool(c2?.es_puerta),
      esUmbral: bool(c2?.es_umbral),
      nEfectivo: num(c2?.n_efectivo, 1),
      // regla dura: nunca pedir más opciones de las que el pool sostiene
      nOpciones: Math.max(2, Math.min(nOpt, nDist + 1)),
      nDistractores: nDist,
      cargaCognitiva: strArr(c2?.carga_cognitiva).filter(
        (x) => CARGAS.includes(x)
      ),
      familias: strArr(c2?.familias_recomendadas),
      sinonimos: strArr(c2?.sinonimos),
      subdimensiones: arr(c2?.subdimensiones).map((s) => ({
        nombre: str(s?.name, str(s?.nombre)),
        descripcion: str(s?.description, str(s?.descripcion))
      })),
      tensiones: strArr(c2?.tensiones),
      paginas: arr(c2?.paginas).filter((x) => typeof x === "number"),
      fuentes: strArr(c2?.fuentes),
      evidencia: str(c2?.evidencia_textual, str(c2?.evidencia))
    };
  }
  const ordenConceptos = strArr(b.study_plan?.orden).filter((id) => conceptos[id]);
  for (const id of Object.keys(conceptos)) if (!ordenConceptos.includes(id)) ordenConceptos.push(id);
  const nConceptos = Object.keys(conceptos).length;
  const conCarga = Object.values(conceptos).filter((c2) => c2.cargaCognitiva.length > 0).length;
  nota(
    "carga_cognitiva",
    conCarga === 0 ? "ausente" : conCarga < nConceptos ? "parcial" : "ok",
    `${conCarga}/${nConceptos} conceptos con causa de dificultad declarada`
  );
  const pobres = Object.values(conceptos).filter((c2) => c2.nDistractores < 3).length;
  nota(
    "pools de distractores",
    pobres === 0 ? "ok" : "parcial",
    `${pobres}/${nConceptos} conceptos con menos de 3 distractores utilizables`
  );
  const UMBRAL_AFIRMADA = 0.6;
  const aristas = [];
  const insinuadas = [];
  const vistas = /* @__PURE__ */ new Set();
  const empujar = (e) => {
    const from = str(e?.from), to = str(e?.to), tipo = str(e?.tipo);
    if (!from || !to || !tipo) return;
    if (bool(e?.invertida)) return;
    if (str(e?.status) === "rechazado") return;
    const k = `${from}|${to}|${tipo}`;
    if (vistas.has(k)) return;
    vistas.add(k);
    const confianza = num(e?.confianza, num(e?.confidence_extraction, 0.8));
    const anclajeRaw = str(e?.anclaje, str(e?.anclaje_textual, "verificado"));
    const arista = {
      from,
      to,
      tipo,
      descripcion: str(e?.descripcion),
      confianza,
      anclaje: anclajeRaw === "inferida" ? "inferida" : "verificado",
      veces: Math.max(1, num(e?.veces, num(e?.veces_afirmada, 1)))
    };
    if (confianza < UMBRAL_AFIRMADA) insinuadas.push(arista);
    else aristas.push(arista);
  };
  const noVinculos = arr(b.graph?.no_vinculos).map((n2) => ({ a: str(n2?.a), b: str(n2?.b), motivo: str(n2?.motivo) })).filter((n2) => n2.a && n2.b);
  const porTipo = b.graph?.por_tipo;
  if (porTipo && typeof porTipo === "object") {
    for (const lista of Object.values(porTipo)) arr(lista).forEach(empujar);
  }
  const ady = b.graph?.adyacencia;
  if (ady && typeof ady === "object") {
    for (const lista of Object.values(ady)) arr(lista).forEach(empujar);
  }
  const frecuenciaRelacion = {};
  for (const a of aristas) frecuenciaRelacion[a.tipo] = (frecuenciaRelacion[a.tipo] ?? 0) + 1;
  nota(
    "grafo",
    aristas.length > 0 ? "ok" : "ausente",
    `${aristas.length} aristas afirmadas en ${Object.keys(frecuenciaRelacion).length} tipos` + (insinuadas.length ? ` \xB7 ${insinuadas.length} insinuadas (el extractor las infiere: no son evidencia, son creatividad respaldada)` : "")
  );
  const clusters = clustersRaw.map((c2, i) => ({
    id: str(c2?.id, `cluster_${i}`),
    label: str(c2?.label, `Grupo ${i + 1}`),
    conceptIds: strArr(c2?.concept_ids)
  }));
  const mayor = clusters.reduce((m, c2) => Math.max(m, c2.conceptIds.length), 0);
  nota(
    "clusters",
    clusters.length > 1 ? "ok" : "parcial",
    `${clusters.length} clusters \xB7 mayor con ${mayor} conceptos`
  );
  const ejes = [];
  for (const [i, e] of arr(b.graph?.ejes).entries()) {
    const nombre = str(e?.nombre, str(e?.label, str(e?.titulo, `Eje ${i + 1}`)));
    const valores = {};
    const fuente = e?.valores ?? e?.asignaciones ?? e?.conceptos ?? e?.concept_values;
    if (fuente && typeof fuente === "object" && !Array.isArray(fuente)) {
      for (const [k, v] of Object.entries(fuente)) {
        if (typeof v === "string" || typeof v === "number") valores[k] = v;
      }
    } else if (Array.isArray(fuente)) {
      for (const it of fuente) {
        const cid = str(it?.concept_id, str(it?.id));
        const val = it?.valor ?? it?.value ?? it?.polo;
        if (cid && (typeof val === "string" || typeof val === "number")) valores[cid] = val;
      }
    } else if (Array.isArray(e?.polos)) {
      for (const polo of e.polos) {
        const etiqueta = str(polo?.label, str(polo?.nombre, "polo"));
        for (const cid of strArr(polo?.concept_ids)) valores[cid] = etiqueta;
      }
    }
    if (Object.keys(valores).length >= 4) {
      ejes.push({ id: str(e?.id, `eje_${i}`), nombre, provisional: bool(e?.provisional), valores });
    }
  }
  nota(
    "ejes de atributos",
    ejes.length >= 2 ? "ok" : ejes.length === 1 ? "parcial" : "ausente",
    ejes.length >= 2 ? `${ejes.length} ejes legibles \xB7 habilita EL ARQUITECTO` : "sin dos ejes legibles: EL ARQUITECTO queda fuera de la rotaci\xF3n"
  );
  const curva = arr(b.study_plan?.curva_dificultad);
  const curvaDe = (id) => curva.find((c2) => str(c2?.unidad_id) === id);
  const unidades = arr(b.study_plan?.unidades).map((u, i) => {
    const id = str(u?.id, `unidad_${i + 1}`);
    const cu = curvaDe(id);
    return {
      id,
      numero: num(u?.numero, i + 1),
      titulo: str(u?.titulo, `Unidad ${i + 1}`),
      conceptIds: strArr(u?.concept_ids).filter((c2) => conceptos[c2]),
      dificultadObjetivo: num(cu?.dificultad_objetivo, 0.5),
      nOpcionesSugerido: num(cu?.n_opciones_sugerido, 4),
      andamiaje: str(cu?.andamiaje_sugerido, "medio"),
      tienePuerta: bool(u?.tiene_puerta),
      tieneUmbral: bool(u?.tiene_umbral)
    };
  });
  if (unidades.length === 0 && nConceptos > 0) {
    unidades.push({
      id: "unidad_1",
      numero: 1,
      titulo: "Expedici\xF3n \xFAnica",
      conceptIds: Object.keys(conceptos),
      dificultadObjetivo: 0.5,
      nOpcionesSugerido: 4,
      andamiaje: "medio",
      tienePuerta: false,
      tieneUmbral: false
    });
  }
  const items = { A1: [], A3: [], B1: [], B2: [], C1: [], E1: [], E2: [], E3: [] };
  const src = b.items ?? {};
  for (const it of arr(src.A1)) {
    const conceptId = str(it?.concept_id);
    if (!conceptos[conceptId]) continue;
    const opciones = arr(it?.opciones).map((o) => ({
      id: str(o?.id, Math.random().toString(36).slice(2)),
      texto: str(o?.texto),
      esCorrecta: bool(o?.es_correcta),
      feedback: str(o?.feedback),
      conceptoConfundido: str(o?.concepto_confundido) || null,
      repertoireId: str(o?.repertoire_id) || null
    })).filter((o) => o.texto);
    if (opciones.length < 2 || !opciones.some((o) => o.esCorrecta)) continue;
    const item = {
      id: str(it?.id),
      mecanica: "A1",
      conceptId,
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      opciones
    };
    items.A1.push(item);
  }
  for (const it of arr(src.A3)) {
    const conceptId = str(it?.concept_id);
    if (!conceptos[conceptId]) continue;
    const item = {
      id: str(it?.id),
      mecanica: "A3",
      conceptId,
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      respuestasAceptadas: strArr(it?.respuestas_aceptadas)
    };
    if (item.respuestasAceptadas.length === 0) continue;
    items.A3.push(item);
  }
  for (const it of arr(src.B1)) {
    const conceptId = str(it?.concept_id);
    if (!conceptos[conceptId]) continue;
    const item = {
      id: str(it?.id),
      mecanica: "B1",
      conceptId,
      enunciado: str(it?.enunciado),
      afirmacion: str(it?.afirmacion),
      dificultad: num(it?.dificultad, 0.5),
      respuestaCorrecta: bool(it?.respuesta_correcta),
      conceptoConfundido: str(it?.concepto_confundido) || null,
      feedback: str(it?.feedback),
      repertoireId: str(it?.repertoire_id) || null
    };
    if (!item.afirmacion) continue;
    if (!item.respuestaCorrecta && !item.conceptoConfundido) continue;
    items.B1.push(item);
  }
  for (const it of arr(src.B2)) {
    const opciones = strArr(it?.opciones).filter((o) => conceptos[o]);
    const correcta = str(it?.respuesta_correcta);
    if (opciones.length < 2 || !opciones.includes(correcta)) continue;
    const item = {
      id: str(it?.id),
      mecanica: "B2",
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      opciones,
      respuestaCorrecta: correcta,
      casoId: str(it?.case_id) || null
    };
    items.B2.push(item);
  }
  for (const it of arr(src.C1)) {
    const par = strArr(it?.par);
    const opciones = strArr(it?.opciones);
    const correcta = str(it?.respuesta_correcta);
    if (par.length !== 2 || !conceptos[par[0]] || !conceptos[par[1]]) continue;
    if (opciones.length < 2 || !opciones.includes(correcta)) continue;
    const item = {
      id: str(it?.id),
      mecanica: "C1",
      par: [par[0], par[1]],
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      opciones,
      respuestaCorrecta: correcta,
      explicacion: str(it?.explicacion)
    };
    items.C1.push(item);
  }
  for (const it of arr(src.E1)) {
    const variables = strArr(it?.variables_clave);
    if (variables.length === 0) continue;
    const item = {
      id: str(it?.id),
      mecanica: "E1",
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      conceptIds: strArr(it?.concept_ids).filter((c2) => conceptos[c2]),
      variablesClave: variables,
      resolucionEsperada: str(it?.resolucion_esperada),
      origenId: str(it?.origen_id) || null
    };
    items.E1.push(item);
  }
  for (const it of arr(src.E3)) {
    const conceptIds = strArr(it?.concept_ids).filter((c2) => conceptos[c2]);
    if (conceptIds.length === 0) continue;
    const d = str(it?.distancia, "cercana");
    const item = {
      id: str(it?.id),
      mecanica: "E3",
      enunciado: str(it?.enunciado),
      dificultad: num(it?.dificultad, 0.5),
      conceptIds,
      distancia: DISTANCIAS.includes(d) ? d : "cercana",
      resolucionEsperada: str(it?.resolucion_esperada),
      dominio: str(it?.dominio)
    };
    items.E3.push(item);
  }
  const totalItems = Object.values(items).reduce((n2, l) => n2 + l.length, 0);
  nota(
    "\xEDtems jugables",
    totalItems > 40 ? "ok" : totalItems > 0 ? "parcial" : "ausente",
    Object.keys(items).filter((k) => items[k].length).map((k) => `${k}:${items[k].length}`).join(" \xB7 ") || "ninguno"
  );
  const repertorios = asList(b.content?.repertoires).filter((r) => str(r?.status) !== "rechazado").map((r) => ({
    id: str(r?.id),
    conceptId: str(r?.concept_id),
    etiqueta: str(r?.label, "Intuici\xF3n previa"),
    descripcion: str(r?.description),
    ejemplo: str(r?.example),
    contrasteCientifico: str(r?.contraste_cientifico),
    contextoDondeFunciona: str(r?.contexto_donde_funciona),
    conceptoConfundido: str(r?.concepto_confundido) || null,
    revisado: str(r?.status) === "aprobado" || str(r?.origin) === "documentado_en_corpus"
  })).filter((r) => r.id && r.ejemplo && r.contrasteCientifico);
  const sinRevisar = repertorios.filter((r) => !r.revisado).length;
  nota(
    "repertorios",
    repertorios.length >= 8 ? "ok" : repertorios.length ? "parcial" : "ausente",
    `${repertorios.length} intuiciones previas \xB7 alimenta a EL ECO` + (sinRevisar ? ` \xB7 ${sinRevisar} sin revisar por el profesor (se muestran marcadas)` : "")
  );
  const casos = asList(b.content?.cases).map((c2) => ({
    id: str(c2?.id),
    descripcion: str(c2?.description),
    conceptIds: strArr(c2?.concept_ids).filter((x) => conceptos[x]),
    conceptoPrincipal: str(c2?.primary_concept_id) || null,
    dominio: str(c2?.dominio),
    resolucionEsperada: str(c2?.resolucion_esperada),
    variablesClave: strArr(c2?.variables_clave),
    prediccionHabilitada: bool(c2?.prediction_enabled)
  }));
  const escenarios = asList(b.content?.scenarios).map((s) => {
    const d = str(s?.distancia, "cercana");
    return {
      id: str(s?.id),
      descripcion: str(s?.description),
      conceptIds: strArr(s?.concept_ids).filter((x) => conceptos[x]),
      distancia: DISTANCIAS.includes(d) ? d : "cercana",
      dominio: str(s?.dominio),
      resolucionEsperada: str(s?.resolucion_esperada),
      errorEmbebido: str(s?.error_embebido) || null
    };
  });
  const porDistancia = escenarios.reduce((acc, e) => {
    acc[e.distancia] = (acc[e.distancia] ?? 0) + 1;
    return acc;
  }, {});
  nota(
    "escalera de transferencia",
    (porDistancia.media ?? 0) >= 3 ? "ok" : "parcial",
    `cercana ${porDistancia.cercana ?? 0} \xB7 media ${porDistancia.media ?? 0} \xB7 lejana ${porDistancia.lejana ?? 0}`
  );
  const tesis = asList(b.content?.theses).map((t) => ({
    id: str(t?.id),
    enunciado: str(t?.statement),
    conceptIds: strArr(t?.concept_ids).filter((x) => conceptos[x]),
    marcoId: str(t?.framework_id) || null,
    argumentosApoyo: strArr(t?.supporting_arguments),
    contraargumentos: strArr(t?.counterarguments),
    criteriosDefensa: strArr(t?.criterios_defensa_valida),
    criteriosRefutacion: strArr(t?.criterios_refutacion_valida),
    criteriosConceptos: arr(t?.criterios_conceptos).map((x) => strArr(x).filter((id) => conceptos[id])),
    contraargumentosConceptos: arr(t?.contraargumentos_conceptos).map((x) => strArr(x).filter((id) => conceptos[id]))
  })).filter((t) => t.enunciado && t.criteriosRefutacion.length > 0);
  nota(
    "tesis con r\xFAbrica",
    tesis.length >= 3 ? "ok" : tesis.length ? "parcial" : "ausente",
    `${tesis.length} tesis con criterios de refutaci\xF3n \xB7 alimenta al jefe`
  );
  const marcos = asList(b.content?.frameworks).map((f) => ({
    id: str(f?.id),
    etiqueta: str(f?.label, str(f?.id)),
    conceptIds: strArr(f?.concept_ids),
    principios: strArr(f?.principios_centrales),
    rivales: strArr(f?.rivales)
  }));
  {
    const palabras = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter((x) => x.length > 4);
    const encaja = (a) => {
      const d = palabras(a.descripcion);
      const cerca = (t) => t.length === 0 || t.some((w) => d.some((x) => x.startsWith(w.slice(0, 5))));
      return cerca(palabras(conceptos[a.from]?.titulo ?? "")) && cerca(palabras(conceptos[a.to]?.titulo ?? ""));
    };
    const malas = aristas.filter((a) => !encaja(a));
    nota(
      "descripciones de los v\xEDnculos",
      malas.length === 0 ? "ok" : malas.length <= aristas.length * 0.15 ? "parcial" : "ausente",
      malas.length === 0 ? `las ${aristas.length} hablan de sus dos extremos` : `${malas.length} de ${aristas.length} no mencionan a uno de sus extremos; el feedback saldr\xE1 confuso en esos casos (p. ej. ${conceptos[malas[0].from]?.titulo} \u2192 ${conceptos[malas[0].to]?.titulo})`
    );
  }
  const distractores = {};
  const pools = b.distractor_pools;
  if (pools && typeof pools === "object") {
    for (const [cid, lista] of Object.entries(pools)) {
      if (!conceptos[cid]) continue;
      const d = arr(lista).map((x) => ({
        texto: str(x?.texto),
        explicacion: str(x?.explicacion),
        conceptoConfundido: str(x?.concepto_confundido) || null,
        fuente: str(x?.fuente, "desconocida"),
        repertorioId: str(x?.repertoire_id) || null
      })).filter((x) => x.texto);
      if (d.length) distractores[cid] = d;
    }
  }
  const conPool = Object.keys(distractores).length;
  nota(
    "pools del extractor",
    conPool >= nConceptos * 0.8 ? "ok" : conPool ? "parcial" : "ausente",
    `${conPool}/${nConceptos} conceptos con distractores propios \xB7 ${Object.values(distractores).flat().filter((d) => d.explicacion).length} con explicaci\xF3n`
  );
  const dominios = [.../* @__PURE__ */ new Set([
    ...casos.map((c2) => c2.dominio),
    ...escenarios.map((e) => e.dominio)
  ])].filter(Boolean);
  nota("dominios de aplicaci\xF3n", dominios.length ? "ok" : "ausente", dominios.join(" \xB7 ") || "ninguno");
  const condicionesDisponibles = leerCondiciones(b);
  nota(
    "condiciones instanciables",
    condicionesDisponibles.length ? "ok" : "parcial",
    condicionesDisponibles.join(" \xB7 ") || "ninguna declarada: se deducen del contenido"
  );
  return {
    coocurrencias: leerCoocurrencias(b),
    puentes: leerPuentes(b),
    fuente: str(b.source_filename, "fuente sin nombre"),
    bundleVersion: str(b.bundle_version, "\u2014"),
    schema: str(b.compiled_from_schema, "\u2014"),
    conceptos,
    ordenConceptos,
    aristas,
    insinuadas,
    frecuenciaRelacion,
    unidades,
    clusters,
    items,
    repertorios,
    casos,
    escenarios,
    tesis,
    marcos,
    ejes,
    noVinculos,
    distractores,
    dominios,
    condicionesDisponibles,
    diagnostico: diag
  };
}
function leerCondiciones(b) {
  const cap = b?.capabilities;
  const salida = /* @__PURE__ */ new Set();
  const recoger = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string") salida.add(x);
        else if (x && typeof x === "object") {
          const id = str(x.id, str(x.nombre, str(x.condicion)));
          const ok = x.instanciable ?? x.disponible ?? true;
          if (id && ok) salida.add(id);
        }
      }
      return;
    }
    if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (val === true) salida.add(k);
        else if (val && typeof val === "object") {
          const ok = val.instanciable ?? val.disponible ?? val.ok;
          if (ok !== false) salida.add(k);
        }
      }
    }
  };
  recoger(cap?.condiciones);
  recoger(cap?.conditions);
  if (salida.size === 0) recoger(cap);
  return [...salida];
}

// src/engine/flexibilidad.ts
var TRANSITIVOS = /* @__PURE__ */ new Set(["causa", "generaliza", "requiere", "antecede", "es_parte_de"]);
var vecinos = (c2, id) => new Set(c2.aristas.filter((a) => a.from === id || a.to === id).map((a) => a.from === id ? a.to : a.from));
var padres = (c2, id) => new Set(c2.aristas.filter((a) => a.tipo === "generaliza" && a.to === id || a.tipo === "ejemplifica" && a.from === id).map((a) => a.tipo === "generaliza" ? a.from : a.to));
var zona = (c2, id) => c2.conceptos[id]?.clusterId ?? null;
var T = (c2, id) => c2.conceptos[id]?.titulo ?? id;
var hayArista = (c2, a, b, tipos2) => c2.aristas.some((x) => (x.from === a && x.to === b || x.from === b && x.to === a) && (!tipos2 || tipos2.has(x.tipo)));
var insinuada = (c2, a, b) => (c2.insinuadas ?? []).some((x) => x.from === a && x.to === b || x.from === b && x.to === a);
var noVinculo = (c2, a, b) => (c2.noVinculos ?? []).some((n2) => n2.a === a && n2.b === b || n2.a === b && n2.b === a);
function caminoTransitivo(c2, from, to, tipo, max = 3) {
  if (!TRANSITIVOS.has(tipo)) return null;
  const paso = (x) => c2.aristas.filter((a) => a.from === x && a.tipo === tipo).map((a) => a.to);
  let frente = [[from]];
  for (let d = 0; d < max; d++) {
    const sig = [];
    for (const cam of frente) for (const n2 of paso(cam[cam.length - 1])) {
      if (cam.includes(n2)) continue;
      const nuevo = [...cam, n2];
      if (n2 === to && nuevo.length > 2) return nuevo;
      sig.push(nuevo);
    }
    frente = sig;
  }
  return null;
}
function abrir(v, estado, fichas, mult, nota) {
  v.estado = estado;
  v.fichas = fichas;
  v.mult = mult;
  v.nota = nota;
  v.inferencia = true;
}
function flexibilizar(c2, veredictos, piezas) {
  const pz = (uid2) => piezas.find((p) => p.uid === uid2);
  for (const v of veredictos) {
    if (v.estado !== "error" && v.estado !== "silencio" && v.estado !== "plausible" && v.estado !== "convive") continue;
    const ps = v.trazo.piezas.map(pz).filter((p) => !!p);
    const ids2 = [...new Set(ps.map((p) => p.conceptId).filter((x) => !!x))];
    const tool = v.trazo.tool;
    if (tool === "flecha" && ids2.length === 2 && v.trazo.param && v.estado !== "plausible") {
      const [a, b] = ids2;
      if (noVinculo(c2, a, b)) continue;
      const cam = caminoTransitivo(c2, a, b, v.trazo.param) ?? caminoTransitivo(c2, b, a, v.trazo.param);
      if (cam) {
        abrir(v, "derivado", 12, 0.9, `Se sigue del texto por cadena: ${cam.map((x) => `\xAB${T(c2, x)}\xBB`).join(" \u2192 ")}. Inferencia v\xE1lida.`);
        continue;
      }
    }
    if (tool === "ancla") {
      const caso = ps.find((p) => p.clase === "caso");
      const fuera = ids2.filter((id) => caso && !caso.conceptIds.includes(id));
      if (caso && fuera.length) {
        const ilustrados = caso.conceptIds;
        const vecinoDirecto = fuera.filter((id) => ilustrados.some((k) => hayArista(c2, id, k)));
        if (vecinoDirecto.length === fuera.length) {
          abrir(v, "aproximado", 9, 0.8, `El caso no nombra ${fuera.map((x) => `\xAB${T(c2, x)}\xBB`).join(" ni ")}, pero opera al lado: es vecino directo de lo que el caso s\xED ilustra. Inferencia con apoyo.`);
          continue;
        }
        const mismaZona = fuera.filter((id) => ilustrados.some((k) => zona(c2, id) && zona(c2, id) === zona(c2, k)));
        if (mismaZona.length === fuera.length) {
          abrir(v, "plausible", 4, 0.5, `Comparte zona con lo que el caso ilustra, pero el texto no los pone a operar juntos ah\xED. Propuesta anotada.`);
          continue;
        }
      }
    }
    if (tool === "contraejemplo" && v.estado !== "error") continue;
    if (tool === "contraejemplo") {
      const caso = ps.find((p) => p.clase === "caso");
      if (caso && ids2.some((id) => !caso.conceptIds.includes(id) && caso.conceptIds.some((k) => noVinculo(c2, id, k)))) {
        abrir(v, "sostenido", 30, 1.6, "El texto contrapone a prop\xF3sito ese concepto con lo que el caso ilustra: contraejemplo de manual, vale doble.");
        continue;
      }
    }
    if (tool === "campo" && ids2.length >= 2) {
      const [a, ...resto] = ids2;
      const padreComun = resto.every((b) => [...padres(c2, a)].some((p) => padres(c2, b).has(p)));
      if (padreComun) {
        abrir(v, "aproximado", 8 + 2 * ids2.length, 0.8, "No est\xE1n en la misma zona, pero tienen un padre com\xFAn en el texto: agrupaci\xF3n que el mapa no marc\xF3 y t\xFA s\xED. Inferencia con apoyo.");
        continue;
      }
      const vecinoComun = resto.every((b) => [...vecinos(c2, a)].some((n2) => vecinos(c2, b).has(n2)));
      if (vecinoComun) {
        abrir(v, "plausible", 4 + ids2.length, 0.5, "Comparten un vecino en el texto; el campo es defendible aunque el mapa no lo agrupe. Propuesta anotada.");
        continue;
      }
    }
    if (tool === "jerarquia" && ids2.length >= 2) {
      const [padre, ...hijos] = ids2;
      const ok = hijos.every((h) => hayArista(c2, padre, h, /* @__PURE__ */ new Set(["generaliza", "ejemplifica", "requiere"])) || !!caminoTransitivo(c2, padre, h, "generaliza"));
      if (ok && hijos.some((h) => !hayArista(c2, padre, h))) {
        abrir(v, "derivado", 10 + 3 * hijos.length, 0.9, "Jerarqu\xEDa por transitividad: el texto la afirma en dos pasos y t\xFA la cerraste en uno. Inferencia v\xE1lida.");
        continue;
      }
    }
    if (tool === "secuencia" && ids2.length >= 3) {
      const eslabones = ids2.slice(1).map((b, i) => ({ a: ids2[i], b }));
      const firmes = eslabones.filter((e) => hayArista(c2, e.a, e.b, /* @__PURE__ */ new Set(["causa", "antecede", "requiere"]))).length;
      const sugeridos = eslabones.filter((e) => !hayArista(c2, e.a, e.b) && insinuada(c2, e.a, e.b)).length;
      if (firmes + sugeridos === eslabones.length && sugeridos > 0) {
        abrir(v, "aproximado", 6 + 3 * ids2.length, 0.8, `Cadena con ${sugeridos} eslab${sugeridos === 1 ? "\xF3n" : "ones"} que el texto sugiere sin afirmar. Inferencia con apoyo.`);
        continue;
      }
    }
  }
}

// src/engine/graph.ts
var SIMETRICOS = /* @__PURE__ */ new Set(["contrasta"]);
var DUALES = {
  generaliza: "ejemplifica",
  ejemplifica: "generaliza"
};
var FAMILIAS = {
  apoya: "respaldo",
  extiende: "respaldo",
  matiza: "respaldo",
  causa: "dependencia",
  requiere: "dependencia",
  generaliza: "taxonomia",
  ejemplifica: "taxonomia",
  contrasta: "oposicion"
};
var IMPLICA = {
  extiende: ["requiere"],
  ejemplifica: ["apoya"],
  matiza: ["contrasta"],
  generaliza: ["requiere"]
};
var razonDeCompatible = {
  requiere: "no se ampl\xEDa ni se especializa lo que no est\xE1 antes: si lo extiende, lo necesita",
  apoya: "un caso concreto respalda aquello de lo que es caso",
  contrasta: "precisar los l\xEDmites de algo es una forma de distinguirlo"
};
var ANTISIMETRICOS = /* @__PURE__ */ new Set(["causa", "requiere", "generaliza", "ejemplifica"]);
var familiaDe = (tipo) => FAMILIAS[tipo] ?? tipo;
var mismaFamilia = (a, b) => familiaDe(a) === familiaDe(b);
var TRANSITIVOS2 = {
  causa: ["causa"],
  requiere: ["requiere"],
  generaliza: ["generaliza"],
  ejemplifica: ["ejemplifica"],
  apoya: ["apoya", "extiende"]
};
function derivacion(c2, from, to, tipo) {
  const admitidos = TRANSITIVOS2[tipo];
  if (!admitidos) return null;
  const primeros = c2.aristas.filter((a) => a.from === from && admitidos.includes(a.tipo));
  for (const p1 of primeros) {
    const p2 = c2.aristas.find((a) => a.from === p1.to && a.to === to && admitidos.includes(a.tipo));
    if (p2) return { pasos: [p1, p2] };
  }
  for (const p1 of primeros) {
    for (const p2 of c2.aristas.filter((a) => a.from === p1.to && admitidos.includes(a.tipo))) {
      const p3 = c2.aristas.find((a) => a.from === p2.to && a.to === to && admitidos.includes(a.tipo));
      if (p3) return { pasos: [p1, p2, p3] };
    }
  }
  return null;
}
function gemelosDe(c2, id) {
  const k = c2.conceptos[id];
  if (!k) return [];
  const mios = new Set([k.titulo, ...k.sinonimos ?? []].map((x) => x.toLowerCase()));
  return c2.ordenConceptos.filter((otro) => {
    if (otro === id) return false;
    const o = c2.conceptos[otro];
    if (!o) return false;
    const suyos = [o.titulo, ...o.sinonimos ?? []].map((x) => x.toLowerCase());
    return suyos.some((n2) => n2.length >= 5 && mios.has(n2));
  });
}
function definicionNombra(c2, a, b) {
  const ka = c2.conceptos[a], kb = c2.conceptos[b];
  if (!ka || !kb) return null;
  const texto = `${ka.definicion} ${ka.definicionCorta ?? ""}`.toLowerCase();
  const nombres = [kb.titulo, ...kb.sinonimos ?? []].filter((n2) => n2 && n2.length >= 5);
  const hallado = nombres.find((n2) => texto.includes(n2.toLowerCase()));
  return hallado ? `La definici\xF3n de \xAB${ka.titulo}\xBB nombra a \xAB${kb.titulo}\xBB: el autor los enlaza al definir, aunque no diga de qu\xE9 tipo es el v\xEDnculo.` : null;
}
function convivencia(c2, a, b) {
  const caso = c2.casos.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b));
  if (caso) return `El texto los pone a operar juntos en el mismo caso: ${caso.descripcion.slice(0, 120)}\u2026`;
  const esc = c2.escenarios.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b));
  if (esc) return `Los dos operan en la misma situaci\xF3n (${esc.dominio}): ${esc.descripcion.slice(0, 110)}\u2026`;
  const t = c2.tesis.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b));
  if (t) return `La misma tesis del texto se apoya en los dos: \xAB${t.enunciado.slice(0, 120)}\u2026\xBB`;
  const m = c2.marcos.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b));
  if (m) return `Los dos pertenecen al mismo marco te\xF3rico (${m.etiqueta}).`;
  return null;
}
function mismaPagina(c2, a, b) {
  const pa = c2.conceptos[a]?.paginas ?? [];
  const pb = c2.conceptos[b]?.paginas ?? [];
  return pa.filter((x) => pb.includes(x));
}
function conceptosEje(c2) {
  const grado = /* @__PURE__ */ new Map();
  for (const x of c2.aristas) {
    grado.set(x.from, (grado.get(x.from) ?? 0) + 1);
    grado.set(x.to, (grado.get(x.to) ?? 0) + 1);
  }
  const n2 = Math.max(1, c2.aristas.length);
  return new Set([...grado.entries()].filter(([, g]) => g >= 4 && g >= n2 * 0.5).map(([id]) => id));
}
function proximidad(c2, a, b) {
  const todas = [...c2.aristas, ...c2.insinuadas ?? []];
  const ejes = conceptosEje(c2);
  const vec = (id) => new Set(
    todas.filter((x) => x.from === id || x.to === id).map((x) => x.from === id ? x.to : x.from).filter((x) => !ejes.has(x))
  );
  const va = vec(a), vb = vec(b);
  for (const x of va) if (vb.has(x)) return "vecino_comun";
  const ca = c2.conceptos[a]?.clusterId;
  const cb = c2.conceptos[b]?.clusterId;
  if (ca && cb && ca === cb) return "mismo_cluster";
  return null;
}
function admisibleComoPropuesta(c2, a, b) {
  const cerca = proximidad(c2, a, b);
  if (cerca === "vecino_comun") return "ambos cuelgan de un mismo concepto";
  if (cerca === "mismo_cluster") return "est\xE1n en la misma zona del texto";
  return null;
}
function distanciaPropuesta(c2, a, b) {
  const ca = c2.conceptos[a]?.clusterId, cb = c2.conceptos[b]?.clusterId;
  const mismaZona = !!ca && ca === cb;
  const cerca = proximidad(c2, a, b);
  if (mismaZona && cerca === "vecino_comun") return 0;
  if (mismaZona) return 1;
  return 2;
}
function juzgarVinculo(c2, from, to, tipo, opciones = {}) {
  const T3 = (id) => c2.conceptos[id]?.titulo ?? id;
  const nv = (c2.noVinculos ?? []).find((n2) => n2.a === from && n2.b === to || n2.a === to && n2.b === from);
  if (nv) return { estado: "invertida", tipoReal: null, camino: null, nota: `El texto los distingue a prop\xF3sito: ${nv.motivo}` };
  const directa = c2.aristas.filter((x) => x.from === from && x.to === to);
  const inversa = c2.aristas.filter((x) => x.from === to && x.to === from);
  const disponibles = opciones.tiposDisponibles;
  const bloqueado = (t) => !!disponibles && disponibles.length > 0 && !disponibles.includes(t);
  const exacta = directa.find((x) => x.tipo === tipo);
  if (exacta) return { estado: "sostenida", tipoReal: exacta.tipo, nota: exacta.descripcion, camino: null };
  if (SIMETRICOS.has(tipo)) {
    const sim = inversa.find((x) => x.tipo === tipo);
    if (sim) {
      return {
        estado: "equivalente",
        tipoReal: tipo,
        nota: `${sim.descripcion} (Contrastar no tiene direcci\xF3n: da igual desde cu\xE1l lo mires.)`,
        camino: null
      };
    }
  }
  const dual = DUALES[tipo];
  if (dual) {
    const d = inversa.find((x) => x.tipo === dual);
    if (d) {
      return {
        estado: "equivalente",
        tipoReal: dual,
        nota: `${d.descripcion} (El texto lo dice como \xAB${T3(to)} ${dual} ${T3(from)}\xBB: es la misma afirmaci\xF3n vista del otro lado.)`,
        camino: null
      };
    }
  }
  const compatible = directa.find((x) => (IMPLICA[x.tipo] ?? []).includes(tipo));
  if (compatible) {
    return {
      estado: "compatible",
      tipoReal: compatible.tipo,
      camino: null,
      nota: `El texto lo enuncia como \xAB${compatible.tipo}\xBB, pero lo tuyo tambi\xE9n se sostiene: ${razonDeCompatible[tipo] ?? "las dos cosas son ciertas del mismo par"}. ${compatible.descripcion}`
    };
  }
  const pariente = directa.find((x) => mismaFamilia(x.tipo, tipo));
  if (pariente) {
    if (bloqueado(pariente.tipo)) {
      return {
        estado: "compatible",
        tipoReal: pariente.tipo,
        camino: null,
        nota: `El texto lo dice como \xAB${pariente.tipo}\xBB, un verbo que todav\xEDa no has descubierto: viste el v\xEDnculo y eso es lo que cuenta. ${pariente.descripcion}`
      };
    }
    return {
      estado: "aproximada",
      tipoReal: pariente.tipo,
      nota: `Vas bien: el texto lo dice como \xAB${pariente.tipo}\xBB. ${pariente.descripcion}`,
      camino: null
    };
  }
  if (directa.length) {
    if (bloqueado(directa[0].tipo)) {
      return {
        estado: "compatible",
        tipoReal: directa[0].tipo,
        camino: null,
        nota: `El texto lo dice como \xAB${directa[0].tipo}\xBB, un verbo que todav\xEDa no has descubierto: viste el v\xEDnculo y eso es lo que cuenta. ${directa[0].descripcion}`
      };
    }
    return {
      estado: "aproximada",
      tipoReal: directa[0].tipo,
      lejana: true,
      nota: `El v\xEDnculo existe, pero es de otra clase: \xAB${directa[0].tipo}\xBB. ${directa[0].descripcion}`,
      camino: null
    };
  }
  const der = derivacion(c2, from, to, tipo);
  if (der) {
    const cadena = T3(der.pasos[0].from) + der.pasos.map((p) => ` ${p.tipo} ${T3(p.to)}`).join("");
    return {
      estado: "derivada",
      tipoReal: tipo,
      camino: der,
      nota: `El texto no lo dice directamente, pero se sigue${der.pasos.length === 3 ? " (en tres pasos)" : ""}: ${cadena}.`
    };
  }
  const invExacta = inversa.find((x) => x.tipo === tipo);
  if (invExacta && ANTISIMETRICOS.has(tipo)) {
    return {
      estado: "invertida",
      tipoReal: tipo,
      camino: null,
      nota: `Va al contrario: el texto dice \xAB${T3(to)} ${tipo} ${T3(from)}\xBB. ${invExacta.descripcion}`
    };
  }
  if (inversa.length && ANTISIMETRICOS.has(inversa[0].tipo) && ANTISIMETRICOS.has(tipo)) {
    return {
      estado: "invertida",
      tipoReal: inversa[0].tipo,
      camino: null,
      nota: `Hay v\xEDnculo, pero en la otra direcci\xF3n y como \xAB${inversa[0].tipo}\xBB.`
    };
  }
  if (inversa.length) {
    return {
      estado: "aproximada",
      tipoReal: inversa[0].tipo,
      camino: null,
      nota: `El texto los relaciona, pero desde el otro lado: \xAB${T3(to)} ${inversa[0].tipo} ${T3(from)}\xBB.`
    };
  }
  for (const [f2, t2] of [
    ...gemelosDe(c2, from).map((g) => [g, to]),
    ...gemelosDe(c2, to).map((g) => [from, g])
  ]) {
    const ex = c2.aristas.find((x) => x.from === f2 && x.to === t2 && x.tipo === tipo);
    const sim = SIMETRICOS.has(tipo) && c2.aristas.find((x) => x.from === t2 && x.to === f2 && x.tipo === tipo);
    const du = DUALES[tipo] && c2.aristas.find((x) => x.from === t2 && x.to === f2 && x.tipo === DUALES[tipo]);
    const hit = ex || sim || du;
    if (hit) {
      return {
        estado: "compatible",
        tipoReal: hit.tipo,
        camino: null,
        nota: `El texto lo afirma de \xAB${T3(f2)} \u2192 ${T3(t2)}\xBB: el mismo concepto con otro nombre. ${hit.descripcion}`
      };
    }
    const fam = c2.aristas.find((x) => x.from === f2 && x.to === t2 && mismaFamilia(x.tipo, tipo));
    if (fam) {
      return {
        estado: "aproximada",
        tipoReal: fam.tipo,
        camino: null,
        nota: `Bajo su otro nombre, el texto lo dice como \xAB${fam.tipo}\xBB. ${fam.descripcion}`
      };
    }
  }
  const insinuada2 = c2.insinuadas.find((x) => x.from === from && x.to === to || (SIMETRICOS.has(x.tipo) || SIMETRICOS.has(tipo)) && x.from === to && x.to === from || DUALES[tipo] && x.from === to && x.to === from && x.tipo === DUALES[tipo]);
  if (insinuada2) {
    const mismo = insinuada2.tipo === tipo || DUALES[tipo] === insinuada2.tipo;
    return {
      estado: "insinuada",
      tipoReal: insinuada2.tipo,
      camino: null,
      nota: mismo ? `El texto no lo enuncia, pero lo insin\xFAa \u2014 y lo viste t\xFA: ${insinuada2.descripcion}` : `El texto no lo enuncia, pero deja entrever un v\xEDnculo (como \xAB${insinuada2.tipo}\xBB) \u2014 y lo viste t\xFA: ${insinuada2.descripcion}`
    };
  }
  const juntos = convivencia(c2, from, to);
  if (juntos) {
    return { estado: "convive", tipoReal: null, camino: null, nota: juntos };
  }
  const nombra = definicionNombra(c2, from, to) ?? definicionNombra(c2, to, from);
  if (nombra) {
    return { estado: "convive", tipoReal: null, camino: null, nota: nombra };
  }
  const puente = c2.puentes[from < to ? `${from}|${to}` : `${to}|${from}`];
  if (puente) {
    return {
      estado: "convive",
      tipoReal: null,
      camino: null,
      nota: `El texto los deja conectados sin decirlo: ${puente}`
    };
  }
  if (c2.coocurrencias.has(from < to ? `${from}|${to}` : `${to}|${from}`)) {
    return {
      estado: "convive",
      tipoReal: null,
      camino: null,
      nota: "El autor los hace aparecer juntos una y otra vez a lo largo del texto, aunque nunca enuncie el v\xEDnculo."
    };
  }
  const cerca = proximidad(c2, from, to);
  const paginas = mismaPagina(c2, from, to);
  if (cerca) {
    return {
      estado: "plausible",
      tipoReal: null,
      camino: null,
      nota: cerca === "vecino_comun" ? "Esto lo pones t\xFA: el autor no los enlaza, pero los dos cuelgan de lo mismo. Queda anotado en tu lectura." : "Esto lo pones t\xFA: el autor los deja en la misma zona sin llegar a enlazarlos. Queda anotado en tu lectura."
    };
  }
  if (paginas.length) {
    return {
      estado: "plausible",
      tipoReal: null,
      camino: null,
      nota: `Esto lo pones t\xFA: el autor los expone juntos en la p\xE1gina ${paginas.join(", ")} pero no da el paso. Queda anotado en tu lectura.`
    };
  }
  return { estado: "muda", tipoReal: null, camino: null, nota: "El mapa del texto no registra ning\xFAn v\xEDnculo entre esos dos." };
}

// src/engine/tools.ts
var HERRAMIENTAS = {
  flecha: {
    id: "flecha",
    nombre: "Flecha",
    glifo: "\u2192",
    afirma: "Que existe este v\xEDnculo, con este tipo y en esta direcci\xF3n.",
    aridad: [2, 2],
    rolesExigidos: ["nodo", "nodo"],
    parametro: "relacion",
    dimension: "relacion",
    ordenada: true,
    ejemplo: "\xABSequ\xEDa\xBB \u2014causa\u2192 \xABMigraci\xF3n de las aves\xBB. Una idea empuja a la otra."
  },
  identidad: {
    id: "identidad",
    nombre: "Identidad",
    glifo: "=",
    afirma: "Que este nombre y esta descripci\xF3n son la misma cosa.",
    aridad: [2, 2],
    rolesExigidos: ["nodo", "nodo"],
    parametro: null,
    dimension: "recuperacion",
    ordenada: false,
    ejemplo: "\xABBallena\xBB = \xABmam\xEDfero marino que filtra kril\xBB. El nombre y su descripci\xF3n."
  },
  campo: {
    id: "campo",
    nombre: "Campo sem\xE1ntico",
    glifo: "\u25EF",
    afirma: "Que todo lo que encierro pertenece a la misma zona del texto.",
    aridad: [2, 6],
    rolesExigidos: ["nodo"],
    parametro: null,
    dimension: "estructura",
    ordenada: false,
    ejemplo: "\u25EF ( \xABLobo\xBB \xB7 \xABZorro\xBB \xB7 \xABCoyote\xBB ) \u2014 todos son c\xE1nidos: la misma zona del mapa."
  },
  jerarquia: {
    id: "jerarquia",
    nombre: "Jerarqu\xEDa",
    glifo: "\u2283",
    afirma: "Que el primero es la categor\xEDa que contiene al segundo.",
    aridad: [2, 4],
    rolesExigidos: ["nodo"],
    parametro: null,
    dimension: "estructura",
    ordenada: true,
    ejemplo: "\xABAve\xBB \u2283 \xABPing\xFCino\xBB. El primero es la categor\xEDa que contiene al segundo."
  },
  eje: {
    id: "eje",
    nombre: "Eje",
    glifo: "\u22A2",
    afirma: "Que todo esto cae en el mismo extremo de un eje del dominio.",
    aridad: [2, 5],
    rolesExigidos: ["nodo"],
    parametro: "eje",
    dimension: "relacion",
    ordenada: false,
    ejemplo: "\u22A2 vuela: ( \xAB\xC1guila\xBB \xB7 \xABColibr\xED\xBB ). Los dos caen en el mismo extremo del eje."
  },
  secuencia: {
    id: "secuencia",
    nombre: "Secuencia",
    glifo: "\u21E2",
    afirma: "Que esto ocurre en este orden, cada paso llevando al siguiente.",
    aridad: [3, 4],
    rolesExigidos: ["nodo"],
    parametro: null,
    dimension: "estructura",
    ordenada: true,
    ejemplo: "\xABHuevo\xBB \u21E2 \xABOruga\xBB \u21E2 \xABMariposa\xBB. Cada paso lleva al siguiente, en ese orden."
  },
  ancla: {
    id: "ancla",
    nombre: "Ancla",
    glifo: "\u2316",
    afirma: "Que estos conceptos son los que operan en este caso.",
    aridad: [2, 4],
    rolesExigidos: ["caso", "nodo"],
    parametro: null,
    dimension: "transferencia",
    ordenada: true,
    ejemplo: "\u2316 \xABUn jard\xEDn sin abejas no da fruto\xBB + ( \xABPolinizaci\xF3n\xBB \xB7 \xABMutualismo\xBB )."
  },
  balanza: {
    id: "balanza",
    nombre: "Balanza",
    glifo: "\u2696",
    afirma: "Que esto es lo que obligar\xEDa a revisar la tesis.",
    aridad: [2, 3],
    rolesExigidos: ["tesis", "criterio"],
    parametro: null,
    dimension: "produccion",
    ordenada: true,
    ejemplo: "\u2696 \xABLos cuervos usan herramientas\xBB + \xABUn cuervo criado aislado no las usar\xEDa\xBB."
  },
  contraejemplo: {
    id: "contraejemplo",
    nombre: "Contraejemplo",
    glifo: "\u2298",
    afirma: "Que este concepto NO opera en este caso, aunque lo parezca.",
    aridad: [2, 3],
    rolesExigidos: ["caso", "nodo"],
    parametro: null,
    dimension: "discriminacion",
    ordenada: true,
    ejemplo: "\u2298 \xABUn ping\xFCino no vuela\xBB + \xABAerodin\xE1mica del vuelo batido\xBB. Se le parece, pero ah\xED no aplica."
  },
  analogia: {
    id: "analogia",
    nombre: "Analog\xEDa",
    glifo: "\u2248",
    afirma: "Que A es a B lo que C es a D, en dos zonas distintas del texto.",
    aridad: [4, 4],
    rolesExigidos: ["nodo"],
    parametro: null,
    dimension: "transferencia",
    ordenada: true,
    ejemplo: "\u2248 \xABCoraz\xF3n\xBB es a \xABSangre\xBB lo que \xABRa\xEDz\xBB es a \xABSavia\xBB. Misma estructura, otro reino."
  },
  alcance: {
    id: "alcance",
    nombre: "Alcance",
    glifo: "\u22A3",
    afirma: "Que lo primero solo vale bajo la condici\xF3n que pone lo segundo.",
    aridad: [2, 2],
    rolesExigidos: ["nodo", "nodo"],
    parametro: null,
    dimension: "discriminacion",
    ordenada: true,
    ejemplo: "\u22A3 \xABLos osos hibernan\xBB vale bajo \xABClimas con invierno marcado\xBB. Fuera de ah\xED, no."
  },
  descomposicion: {
    id: "descomposicion",
    nombre: "Descomposici\xF3n",
    glifo: "\u229F",
    afirma: "Que lo primero se compone de las partes que siguen.",
    aridad: [2, 4],
    rolesExigidos: ["nodo"],
    parametro: null,
    dimension: "estructura",
    ordenada: true,
    ejemplo: "\u229F \xABColmena\xBB \u229F ( \xABObreras\xBB \xB7 \xABZ\xE1nganos\xBB \xB7 \xABReina\xBB ). El todo y sus partes."
  }
};
function aceptaEnRanura(h, ranura, p) {
  switch (h) {
    case "ancla":
    case "contraejemplo":
      return ranura === 0 ? p.clase === "caso" : p.roles.includes("nodo") && p.clase !== "caso";
    case "balanza":
      return ranura === 0 ? p.clase === "tesis" : p.clase === "criterio";
    case "descomposicion":
      return ranura === 0 ? !!p.conceptId && p.clase !== "subdimension" : p.clase === "subdimension";
    case "identidad":
      return p.roles.includes("etiqueta") || p.roles.includes("definicion");
    case "eje":
      return !!p.conceptId && p.clase !== "subdimension";
    default:
      return p.roles.includes("nodo");
  }
}
var listaHerramientas = Object.values(HERRAMIENTAS);
var ACIERTA = ["sostenido", "equivalente", "compatible", "derivado"];
var esAcierto = (e) => ACIERTA.includes(e);
var LOGRA = [...ACIERTA, "insinuado"];
var CREA = ["insinuado", "propuesta"];
var esCreacion = (e) => CREA.includes(e);
var SIN_LENTES = {
  multPorTipo: {},
  multPorHerramienta: {},
  multPorCombo: {},
  fichasPorSostenido: 0,
  multPorUmbral: 0,
  multGlobal: 0,
  alcanceExtra: 0,
  manoExtra: 0,
  herramientasExtra: [],
  quemasExtra: 0,
  cambiosExtra: 0,
  robarPorAcierto: 0,
  fichasPorInferencia: 0,
  multPorAproximado: 0,
  plausibleCuenta: false,
  sinCastigoInvertido: false,
  revelaApocrifas: 0,
  xmults: []
};
var NOMBRE_COMBO = {
  articulacion: "Articulaci\xF3n",
  constelacion: "Constelaci\xF3n",
  cierre: "Cierre",
  doble_registro: "Doble registro",
  refutacion_completa: "Refutaci\xF3n completa",
  traduccion: "Traducci\xF3n",
  coherencia: "Coherencia",
  veta: "Veta",
  mestizaje: "Mestizaje",
  hallazgo: "Hallazgo"
};
function rarezaRelacion(c2, tipo) {
  const freqs = Object.values(c2.frecuenciaRelacion);
  const max = Math.max(1, ...freqs);
  const f = c2.frecuenciaRelacion[tipo] ?? 1;
  return 0.35 + (1 - f / max) * 1.05;
}
var vacio = (t, d) => ({
  trazo: t,
  estado: "silencio",
  fichas: 0,
  mult: 0,
  nota: "",
  dimension: d,
  conceptIds: [],
  aristas: [],
  fusiona: [],
  apocrifaDetectada: null,
  repertorioReubicado: null,
  reserva: null,
  inferencia: false,
  propuesta: null
});
function resolver(p) {
  if (p.clase === "apocrifa") {
    return {
      id: p.conceptId,
      reserva: `Ojo: esa carta lleva el t\xEDtulo de \xAB${p.titulo}\xBB con una descripci\xF3n que no es suya. ${p.explicacion}`
    };
  }
  return { id: p.conceptId, reserva: null };
}
var PESO = {
  sostenido: { f: 1, m: 1 },
  equivalente: { f: 1, m: 1 },
  compatible: { f: 0.9, m: 0.85 },
  derivado: { f: 0.7, m: 0.65 },
  // lo insinuado paga casi como una inferencia: el texto lo deja entrever y
  // el lector lo vio. Determinista, como toda recompensa a la creatividad.
  insinuado: { f: 0.65, m: 0.55 },
  convive: { f: 0.55, m: 0.45 },
  aproximado: { f: 0.5, m: 0.35 },
  // una conexión propia entre conceptos cercanos vale el doble que antes:
  // proponer con criterio es lo que hace un lector crítico
  propuesta: { f: 0.35, m: 0.2 },
  plausible: { f: 0.18, m: 0 },
  silencio: { f: 0, m: 0 },
  invertido: { f: 0, m: -1 },
  error: { f: 0, m: -0.6 }
};
var PESO_APROXIMADO_LEJANO = { f: 0.3, m: 0.2 };
var PESO_PROPUESTA = [
  { f: 0.35, m: 0.2 },
  { f: 0.42, m: 0.28 },
  { f: 0.5, m: 0.35 }
];
var titulo = (c2, id) => id && c2.conceptos[id]?.titulo || "\u2014";
function reservaDe(ps) {
  const mala = ps.find((p) => p.clase === "apocrifa");
  return mala ? `Ojo: usaste \xAB${mala.titulo}\xBB con una descripci\xF3n que no es suya. ${mala.explicacion}` : null;
}
function pertenece(c2, ids2, cid) {
  if (!cid) return false;
  if (ids2.includes(cid)) return true;
  return gemelosDe(c2, cid).some((g) => ids2.includes(g));
}
var T_MEMBRESIA = /* @__PURE__ */ new Set(["ejemplifica", "apoya", "extiende", "generaliza", "requiere"]);
var T_TENSION = /* @__PURE__ */ new Set(["contrasta", "matiza"]);
function juzgarCriterio(c2, k, otro, tipo, lentes, v) {
  const t = c2.tesis.find((x) => x.id === k.tesisId);
  if (!t) return { ...v, nota: "Ese criterio no pertenece a ninguna tesis del texto." };
  const que = k.sentido === "refuta" ? "El criterio" : "La objeci\xF3n";
  const marcoTesis = t.marcoId ? c2.marcos.find((m) => m.id === t.marcoId) ?? null : null;
  const conceptosDe = (p) => p.conceptId ? [p.conceptId] : p.conceptIds ?? [];
  const propios = k.conceptIds?.length ? k.conceptIds : t.conceptIds;
  const comunes = propios.filter((x) => conceptosDe(otro).includes(x));
  const convive = (con) => ({
    ...v,
    estado: "convive",
    fichas: 5,
    mult: 0.4,
    conceptIds: comunes,
    nota: `${que} y ${con} trabajan sobre ${comunes.length > 1 ? "los mismos conceptos" : "el mismo concepto"} (${comunes.map((x) => titulo(c2, x)).join(", ")}).`
  });
  if (otro.clase === "marco") {
    const esSuyo = marcoTesis?.id === otro.refId;
    const esRival = !!marcoTesis && marcoTesis.rivales.includes(otro.refId ?? "");
    if (esSuyo && T_TENSION.has(tipo)) {
      return {
        ...v,
        estado: "sostenido",
        fichas: 12 + lentes.fichasPorSostenido,
        mult: 1.2,
        conceptIds: t.conceptIds,
        nota: `${que} tensiona el marco desde dentro: pone a prueba una tesis que el marco \xAB${otro.titulo}\xBB sostiene. Es la lectura cr\xEDtica que el texto mismo abre.`
      };
    }
    if (esSuyo) {
      return {
        ...v,
        estado: "aproximado",
        fichas: 6,
        mult: 0.5,
        conceptIds: t.conceptIds,
        nota: `${que} s\xED toca el marco \xAB${otro.titulo}\xBB \u2014 pero como tensi\xF3n, no como ${tipo}.`
      };
    }
    if (esRival && !T_TENSION.has(tipo)) {
      return {
        ...v,
        estado: "sostenido",
        fichas: 14 + lentes.fichasPorSostenido,
        mult: 1.4,
        conceptIds: t.conceptIds,
        nota: `${que} es la voz del marco rival: lo que el marco \xAB${otro.titulo}\xBB dir\xEDa contra la tesis.`
      };
    }
    if (esRival) {
      return {
        ...v,
        estado: "aproximado",
        fichas: 6,
        mult: 0.5,
        conceptIds: t.conceptIds,
        nota: `${que} nace del marco \xAB${otro.titulo}\xBB: no se opone a \xE9l, habla por \xE9l.`
      };
    }
    return comunes.length ? convive(`el marco \xAB${otro.titulo}\xBB`) : { ...v, nota: `El mapa del texto no conecta esa ${k.sentido === "refuta" ? "refutaci\xF3n" : "objeci\xF3n"} con el marco \xAB${otro.titulo}\xBB.` };
  }
  if (otro.clase === "tesis") {
    if (otro.refId === t.id && T_TENSION.has(tipo)) {
      return {
        ...v,
        estado: "sostenido",
        fichas: 12 + lentes.fichasPorSostenido,
        mult: 1.2,
        conceptIds: t.conceptIds,
        nota: `${que} es exactamente lo que esa tesis tiene que responder.`
      };
    }
    if (otro.refId === t.id) {
      return {
        ...v,
        estado: "aproximado",
        fichas: 6,
        mult: 0.5,
        conceptIds: t.conceptIds,
        nota: `${que} pertenece a esa tesis, pero para tensionarla, no para ${tipo === "apoya" ? "apoyarla" : tipo}.`
      };
    }
    return comunes.length ? convive("esa tesis") : { ...v, nota: "El mapa del texto no conecta ese criterio con esa tesis." };
  }
  if (otro.clase === "caso") {
    return comunes.length ? convive(`el caso (${otro.titulo})`) : { ...v, nota: `El mapa del texto no conecta ese criterio con el caso (${otro.titulo}).` };
  }
  const cid = otro.clase === "apocrifa" ? null : otro.conceptId ?? null;
  if (!cid) return { ...v, nota: "El mapa del texto no tiene con qu\xE9 juzgar ese par." };
  if (pertenece(c2, propios, cid)) {
    if (T_TENSION.has(tipo)) {
      return {
        ...v,
        estado: "sostenido",
        fichas: 14 + lentes.fichasPorSostenido,
        mult: 1.2,
        conceptIds: [cid],
        nota: `${que} pone a prueba \xAB${otro.titulo}\xBB, uno de los conceptos que ${k.conceptIds?.length ? "invoca" : "la tesis reclama"}.`
      };
    }
    return {
      ...v,
      estado: "compatible",
      fichas: 11,
      mult: 1,
      conceptIds: [cid],
      nota: `${que} y \xAB${otro.titulo}\xBB est\xE1n enlazados por la tesis, aunque el tipo exacto sea tensi\xF3n.`
    };
  }
  const vecino = c2.aristas.some((x) => propios.includes(x.from) && x.to === cid || propios.includes(x.to) && x.from === cid);
  if (vecino) {
    return {
      ...v,
      estado: "convive",
      fichas: 5,
      mult: 0.4,
      conceptIds: [cid],
      nota: `\xAB${otro.titulo}\xBB no est\xE1 en la tesis, pero cuelga de lo que la tesis reclama.`
    };
  }
  return { ...v, nota: `El mapa del texto no conecta ese criterio con \xAB${otro.titulo}\xBB.` };
}
function juzgarMixto(c2, a, b, tipo, lentes, v) {
  if (a.clase === "criterio" || b.clase === "criterio") {
    const k = a.clase === "criterio" ? a : b;
    const otro2 = k === a ? b : a;
    if (otro2.clase === "criterio") return { ...v, nota: "Dos criterios no se enlazan entre s\xED: cada uno se mide contra su tesis." };
    return juzgarCriterio(c2, k, otro2, tipo, lentes, v);
  }
  const esp = ["caso", "tesis", "marco"].includes(a.clase) ? a : b;
  const otro = esp === a ? b : a;
  const nombre = esp.clase === "marco" ? `el marco \xAB${esp.titulo}\xBB` : esp.clase === "tesis" ? "la tesis" : `el caso (${esp.titulo})`;
  if (["caso", "tesis", "marco"].includes(otro.clase)) {
    const comunes = esp.conceptIds.filter((x) => otro.conceptIds.includes(x));
    return comunes.length ? {
      ...v,
      estado: "convive",
      fichas: 5,
      mult: 0.4,
      conceptIds: comunes,
      nota: `Comparten ${comunes.length} concepto${comunes.length > 1 ? "s" : ""}: el texto los hace trabajar sobre el mismo material.`
    } : { ...v, estado: "silencio", nota: "No comparten conceptos en el texto." };
  }
  const cid = otro.clase === "apocrifa" ? null : otro.conceptId;
  const miembro = pertenece(c2, esp.conceptIds, cid);
  const rival = pertenece(c2, esp.conceptIdsRivales, cid);
  const base2 = esp.clase === "tesis" ? 14 : 12;
  if (miembro) {
    if (T_MEMBRESIA.has(tipo)) {
      return {
        ...v,
        estado: "sostenido",
        fichas: base2 + lentes.fichasPorSostenido,
        mult: 1.2,
        conceptIds: cid ? [cid] : [],
        nota: esp.cierre || `\xAB${otro.titulo}\xBB es uno de los conceptos que ${nombre} reclama como suyos.`
      };
    }
    if (tipo === "contrasta") {
      return {
        ...v,
        estado: "aproximado",
        fichas: Math.round(base2 / 2),
        mult: 0.5,
        conceptIds: cid ? [cid] : [],
        nota: `Lo contrastas con ${nombre}\u2026 que lo reclama entre los suyos. Al derecho, esto es pertenencia, no oposici\xF3n.`
      };
    }
    return {
      ...v,
      estado: "compatible",
      fichas: Math.round(base2 * 0.9),
      mult: 1,
      conceptIds: cid ? [cid] : [],
      nota: `El v\xEDnculo existe \u2014 ${nombre} lo reclama \u2014 aunque el tipo exacto sea otro.`
    };
  }
  if (rival && tipo === "contrasta") {
    return {
      ...v,
      estado: "sostenido",
      fichas: base2 + 2 + lentes.fichasPorSostenido,
      mult: 1.4,
      conceptIds: cid ? [cid] : [],
      nota: `Pertenece al marco rival: la oposici\xF3n que trazas es la del propio texto.`
    };
  }
  const duenos = cid ? [
    ...c2.marcos.filter((m) => pertenece(c2, m.conceptIds, cid)).map((m) => `el marco \xAB${m.etiqueta}\xBB`),
    ...c2.tesis.filter((t) => pertenece(c2, t.conceptIds, cid)).map(() => "una tesis")
  ].slice(0, 2) : [];
  return {
    ...v,
    estado: "silencio",
    nota: duenos.length ? `El texto no pone \xAB${otro.titulo}\xBB dentro de ${nombre}; s\xED lo reclama${duenos.length > 1 ? "n" : ""} ${duenos.join(" y ")}.` : `El mapa del texto no registra un v\xEDnculo entre \xAB${otro.titulo}\xBB y ${nombre}.`
  };
}
function validarFlecha(c2, t, ps, lentes, opciones = {}) {
  const v = vacio(t, "relacion");
  const [a, b] = ps;
  const tipo = t.param ?? "apoya";
  if (!a || !b || !t.param) return { ...v, nota: "Falta el tipo de v\xEDnculo." };
  const ESPECIALES = /* @__PURE__ */ new Set(["caso", "tesis", "marco", "criterio"]);
  if (ESPECIALES.has(a.clase) || ESPECIALES.has(b.clase)) {
    return juzgarMixto(c2, a, b, tipo, lentes, v);
  }
  if (a.clase === "contexto") {
    const ok = tipo === "contrasta" && b.conceptId === a.conceptId;
    return ok ? {
      ...v,
      estado: "sostenido",
      fichas: 6 + lentes.fichasPorSostenido,
      mult: 0.5,
      nota: `${a.explicacion} Su terreno: ${a.cierre}`,
      conceptIds: a.conceptId ? [a.conceptId] : []
    } : { ...v, estado: "plausible", nota: "El terreno de una intuici\xF3n se contrasta con el concepto que ocupaba su lugar." };
  }
  if (a.clase === "intuicion") {
    const ok = tipo === "contrasta" && b.conceptId === a.conceptId;
    return ok ? {
      ...v,
      estado: "sostenido",
      fichas: 12 + lentes.fichasPorSostenido,
      mult: 1.2,
      nota: `${a.explicacion} Donde s\xED funcionaba: ${a.cierre}`,
      conceptIds: a.conceptId ? [a.conceptId] : [],
      repertorioReubicado: a.refId
    } : { ...v, estado: "plausible", nota: "Una intuici\xF3n se reubica contrast\xE1ndola con el concepto que ocupaba su lugar." };
  }
  const ra = resolver(a);
  const rb = resolver(b);
  if (!ra.id || !rb.id) return { ...v, nota: "El mapa del texto no tiene con qu\xE9 juzgar ese par: una de las piezas no es un nodo." };
  let h = juzgarVinculo(c2, ra.id, rb.id, tipo, opciones);
  let desde = ra.id;
  let hasta = rb.id;
  let porContenido = false;
  const ACIERTA_H = ["sostenida", "equivalente", "derivada"];
  if ((a.clase === "apocrifa" || b.clase === "apocrifa") && !ACIERTA_H.includes(h.estado)) {
    const alt = {
      from: a.clase === "apocrifa" ? a.duenoReal ?? ra.id : ra.id,
      to: b.clase === "apocrifa" ? b.duenoReal ?? rb.id : rb.id
    };
    const h2 = juzgarVinculo(c2, alt.from, alt.to, tipo, opciones);
    if (ACIERTA_H.includes(h2.estado)) {
      h = h2;
      desde = alt.from;
      hasta = alt.to;
      porContenido = true;
    }
  }
  const MAPA = {
    sostenida: "sostenido",
    equivalente: "equivalente",
    compatible: "compatible",
    derivada: "derivado",
    insinuada: "insinuado",
    aproximada: "aproximado",
    convive: "convive",
    plausible: "plausible",
    muda: "silencio",
    invertida: "invertido"
  };
  const motivoPropuesta = h.estado === "plausible" && !ra.reserva && !rb.reserva ? admisibleComoPropuesta(c2, ra.id, rb.id) : null;
  const estado = h.estado === "plausible" && motivoPropuesta ? "propuesta" : MAPA[h.estado] ?? "silencio";
  const imp = (a.importancia + b.importancia) / 2;
  const peso = estado === "aproximado" && h.lejana ? PESO_APROXIMADO_LEJANO : estado === "propuesta" ? PESO_PROPUESTA[distanciaPropuesta(c2, ra.id, rb.id)] : PESO[estado];
  const fichasBase = 8 + Math.round(12 * imp) + lentes.fichasPorSostenido;
  const multBase = rarezaRelacion(c2, h.tipoReal ?? tipo) + (lentes.multPorTipo[tipo] ?? 0);
  const reserva = ra.reserva ?? rb.reserva;
  return {
    ...v,
    estado,
    fichas: Math.round(fichasBase * peso.f),
    mult: peso.m < 0 ? peso.m : multBase * peso.m,
    nota: (() => {
      const sueltas = ps.filter((p) => p.clase === "definicion" && p.conceptId);
      const duenos = sueltas.length ? sueltas.map((p) => `La descripci\xF3n suelta pertenece a \xAB${titulo(c2, p.conceptId)}\xBB.`).join(" ") + " " : "";
      return porContenido ? `Fuiste por la descripci\xF3n y no por el t\xEDtulo, y ah\xED acertaste: ${h.nota}` : duenos + h.nota;
    })(),
    reserva,
    inferencia: estado === "derivado",
    // la capa propia del lector: lo insinuado (respaldado por el extractor) y
    // las propuestas entre conceptos cercanos. Ni lo uno ni lo otro es
    // evidencia, y por eso viven aparte; pero se guardan, se cuentan y pagan.
    propuesta: estado === "insinuado" && !ra.reserva && !rb.reserva ? {
      from: desde,
      to: hasta,
      tipo,
      respaldo: "texto_insinua",
      motivo: `el texto lo deja entrever (como \xAB${h.tipoReal ?? tipo}\xBB)`
    } : estado === "propuesta" && motivoPropuesta ? {
      from: desde,
      to: hasta,
      tipo,
      motivo: motivoPropuesta,
      respaldo: motivoPropuesta.startsWith("ambos") ? "vecino_comun" : "misma_zona"
    } : null,
    conceptIds: [desde, hasta],
    // el Atlas solo recoge lo que el texto afirma literalmente, no lo inferido
    aristas: estado === "sostenido" || estado === "equivalente" || estado === "compatible" ? [{ from: desde, to: hasta, tipo: h.tipoReal ?? tipo }] : []
  };
}
function validarIdentidad(c2, t, ps, lentes) {
  const v = vacio(t, "recuperacion");
  const [a, b] = ps;
  if (!a || !b) return v;
  const apocrifa = [a, b].find((p) => p.clase === "apocrifa");
  if (apocrifa) {
    return { ...v, estado: "error", nota: `No son lo mismo. ${apocrifa.explicacion}` };
  }
  const nombre = [a, b].find((p) => p.roles.includes("etiqueta"));
  const desc = [a, b].find((p) => p.roles.includes("definicion") && p !== nombre);
  if (!nombre || !desc) {
    return { ...v, nota: "La identidad empareja un nombre con una descripci\xF3n." };
  }
  const mismo = nombre.conceptId && nombre.conceptId === desc.conceptId;
  if (mismo) {
    const k = c2.conceptos[nombre.conceptId];
    return {
      ...v,
      estado: "sostenido",
      fichas: 6 + Math.round(8 * (k?.importancia ?? 0.5)) + lentes.fichasPorSostenido,
      mult: 0.6,
      nota: `${k?.titulo}: ${k?.definicion}`,
      conceptIds: [nombre.conceptId],
      fusiona: [nombre.conceptId]
    };
  }
  return {
    ...v,
    estado: "error",
    nota: `Esa descripci\xF3n es de \xAB${titulo(c2, desc.conceptId)}\xBB, no de \xAB${nombre.titulo}\xBB.`,
    conceptIds: [nombre.conceptId, desc.conceptId].filter((x) => !!x)
  };
}
function validarCampo(c2, t, ps, lentes) {
  const v = vacio(t, "estructura");
  const reserva = reservaDe(ps);
  const marco = ps.find((p) => p.clase === "marco");
  const terrenos = ps.filter((p) => p.clase === "contexto");
  const portadores = ps.filter((p) => (p.clase === "caso" || p.clase === "tesis") && p.conceptIds.length);
  const conceptos = ps.filter(
    (p) => p.conceptId && p.clase !== "marco" && p.clase !== "contexto" && p.clase !== "caso" && p.clase !== "tesis"
  );
  if (conceptos.length + portadores.length < 2) {
    return { ...v, reserva, nota: "Un campo necesita al menos dos piezas que hablen de conceptos." };
  }
  if (marco) {
    const dentro = conceptos.filter((p) => marco.conceptIds.includes(p.conceptId));
    const ok = dentro.length === conceptos.length;
    return ok ? {
      ...v,
      estado: "sostenido",
      fichas: 8 * conceptos.length + lentes.fichasPorSostenido,
      mult: 1.4,
      nota: `Todos pertenecen a ${marco.titulo}.`,
      conceptIds: conceptos.map((p) => p.conceptId)
    } : {
      ...v,
      estado: "aproximado",
      fichas: 4 * dentro.length,
      nota: `${conceptos.length - dentro.length} de esos conceptos no pertenecen a ${marco.titulo}.`,
      conceptIds: dentro.map((p) => p.conceptId)
    };
  }
  const clusterDe = (p) => p.conceptId ? [c2.conceptos[p.conceptId]?.clusterId ?? "\u2014"] : [...new Set(p.conceptIds.map((id) => c2.conceptos[id]?.clusterId ?? "\u2014"))];
  const clustersConcepto = conceptos.flatMap(clusterDe);
  const clustersPortador = portadores.map(clusterDe);
  const clusters = new Set(clustersConcepto);
  const portadoresDentro = clustersPortador.filter(
    (cl) => clustersConcepto.length === 0 || cl.some((x) => clusters.has(x))
  ).length;
  if (portadores.length && !clustersConcepto.length) {
    const comunes = clustersPortador.reduce(
      (acc, cl) => acc.length ? acc.filter((x) => cl.includes(x)) : cl,
      []
    );
    return comunes.length && comunes[0] !== "\u2014" ? {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 9 * portadores.length + lentes.fichasPorSostenido,
      mult: 1.3,
      nota: "Los dos hablan de la misma zona del texto.",
      conceptIds: portadores.flatMap((p) => p.conceptIds)
    } : { ...v, reserva, nota: "Esos casos no comparten zona del texto." };
  }
  if (clusters.size === 1 && !clusters.has("\u2014") && portadoresDentro === portadores.length) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 7 * conceptos.length + 5 * terrenos.length + 9 * portadores.length + lentes.fichasPorSostenido,
      mult: 0.9 + 0.25 * conceptos.length + 0.5 * terrenos.length + 0.4 * portadores.length,
      nota: portadores.length ? "Comparten zona del texto, y el caso que has metido opera justo ah\xED." : terrenos.length ? "Comparten zona del texto, y sabes qu\xE9 intuici\xF3n convive con ellos." : "Comparten zona del texto.",
      conceptIds: [
        ...conceptos.map((p) => p.conceptId),
        ...portadores.flatMap((p) => p.conceptIds)
      ]
    };
  }
  const ids2 = conceptos.map((p) => p.conceptId);
  const conectado = ids2.length >= 2 && ids2.every((a) => ids2.some((b) => b !== a && c2.aristas.some((x) => x.from === a && x.to === b || x.from === b && x.to === a)));
  if (conectado) {
    return {
      ...v,
      estado: "plausible",
      fichas: 4 * ids2.length,
      mult: 0.3,
      nota: `Agrupaci\xF3n tuya: cruza ${clusters.size} zonas del texto, pero cada pieza est\xE1 enlazada con otra del grupo. El autor no dibuja esa zona; t\xFA s\xED.`,
      conceptIds: ids2
    };
  }
  return {
    ...v,
    estado: "silencio",
    nota: `Esos conceptos viven en ${clusters.size} zonas distintas del texto y no se enlazan entre s\xED.`
  };
}
function validarJerarquia(c2, t, ps, lentes) {
  const v = vacio(t, "estructura");
  const reserva = reservaDe(ps);
  const ids2 = ps.map((p) => p.conceptId).filter((x) => !!x);
  if (ids2.length < 2) return { ...v, reserva, nota: "La jerarqu\xEDa necesita dos conceptos." };
  let ok = 0;
  const aristas = [];
  for (let i = 0; i + 1 < ids2.length; i++) {
    const arriba = ids2[i], abajo = ids2[i + 1];
    const gen = c2.aristas.find((x) => x.from === arriba && x.to === abajo && (x.tipo === "generaliza" || x.tipo === "requiere")) ?? c2.aristas.find((x) => x.from === abajo && x.to === arriba && x.tipo === "ejemplifica");
    if (gen) {
      ok++;
      aristas.push({ from: gen.from, to: gen.to, tipo: gen.tipo });
    }
  }
  if (ok === ids2.length - 1) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 10 * ok + lentes.fichasPorSostenido,
      mult: 1.1 * ok,
      nota: "La contenci\xF3n categ\xF3rica se sostiene de arriba abajo.",
      conceptIds: ids2,
      aristas
    };
  }
  if (ok > 0) return { ...v, reserva, estado: "aproximado", fichas: 5 * ok, nota: "Parte de la jerarqu\xEDa se sostiene.", conceptIds: ids2, aristas };
  const alReves = c2.aristas.some((x) => x.from === ids2[1] && x.to === ids2[0] && x.tipo === "generaliza" || x.from === ids2[0] && x.to === ids2[1] && x.tipo === "ejemplifica");
  return alReves ? { ...v, estado: "invertido", mult: -1, nota: `\xAB${titulo(c2, ids2[1])}\xBB es la categor\xEDa, no lo contrario.`, conceptIds: ids2 } : { ...v, nota: "El texto no establece esa contenci\xF3n." };
}
function validarEje(c2, t, ps, lentes) {
  const v = vacio(t, "relacion");
  const reserva = reservaDe(ps);
  if (!t.param) return { ...v, reserva, nota: "Elige un eje y un extremo." };
  const [ejeId, valor] = t.param.split("::");
  const eje = c2.ejes.find((e) => e.id === ejeId);
  if (!eje) return { ...v, reserva, nota: "Este texto no trae ese eje." };
  const ids2 = ps.map((p) => p.conceptId).filter((x) => !!x);
  if (ids2.length < 2) return { ...v, reserva, nota: "Coloca al menos dos piezas en el eje." };
  const aciertos = ids2.filter((id) => String(eje.valores[id] ?? "") === valor);
  if (aciertos.length === ids2.length) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 9 * ids2.length + lentes.fichasPorSostenido,
      mult: 1.2 + 0.2 * ids2.length,
      nota: `Todos son \xAB${valor}\xBB en el eje ${eje.nombre}.`,
      conceptIds: ids2
    };
  }
  if (aciertos.length) {
    return {
      ...v,
      reserva,
      estado: "aproximado",
      fichas: 4 * aciertos.length,
      nota: `${ids2.length - aciertos.length} de esas piezas est\xE1n en el otro extremo de ${eje.nombre}.`,
      conceptIds: aciertos
    };
  }
  return { ...v, reserva, estado: "error", mult: -1, nota: `Ninguno es \xAB${valor}\xBB en ${eje.nombre}.`, conceptIds: ids2 };
}
function validarSecuencia(c2, t, ps, lentes) {
  const v = vacio(t, "estructura");
  const reserva = reservaDe(ps);
  const ids2 = ps.map((p) => p.conceptId).filter((x) => !!x);
  if (ids2.length < 3) return { ...v, reserva, nota: "Una secuencia necesita tres pasos." };
  const aristas = [];
  let ok = 0;
  for (let i = 0; i + 1 < ids2.length; i++) {
    const paso = c2.aristas.find((x) => x.from === ids2[i] && x.to === ids2[i + 1] && (x.tipo === "causa" || x.tipo === "requiere" || x.tipo === "extiende"));
    if (paso) {
      ok++;
      aristas.push({ from: ids2[i], to: ids2[i + 1], tipo: paso.tipo });
    }
  }
  if (ok === ids2.length - 1) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 12 * ok + lentes.fichasPorSostenido,
      mult: 1.4 * ok,
      nota: "El proceso ocurre en ese orden.",
      conceptIds: ids2,
      aristas
    };
  }
  if (ok > 0) return { ...v, reserva, estado: "aproximado", fichas: 6 * ok, nota: "Parte del orden se sostiene.", conceptIds: ids2, aristas };
  return { ...v, reserva, nota: "El texto no encadena esos pasos as\xED." };
}
function validarAncla(_c, t, ps, lentes) {
  const v = vacio(t, "transferencia");
  const caso = ps.find((p) => p.clase === "caso");
  const resto = ps.filter((p) => p !== caso);
  const reserva = reservaDe(resto);
  if (!caso) return { ...v, reserva, nota: "El ancla necesita un caso." };
  const ids2 = resto.map((p) => p.conceptId).filter((x) => !!x);
  if (!ids2.length) return { ...v, reserva, nota: "Ancla el caso a los conceptos que operan en \xE9l." };
  const aciertos = ids2.filter((id) => caso.conceptIds.includes(id));
  const m = caso.distancia === "lejana" ? 2.2 : caso.distancia === "media" ? 1.6 : 1.1;
  if (aciertos.length === ids2.length) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 10 * ids2.length + 8 + lentes.fichasPorSostenido,
      mult: m + 0.2 * ids2.length,
      nota: caso.cierre,
      conceptIds: ids2
    };
  }
  if (aciertos.length) {
    return {
      ...v,
      reserva,
      estado: "aproximado",
      fichas: 5 * aciertos.length,
      mult: m * 0.5,
      nota: `${ids2.length - aciertos.length} de esos conceptos no operan en este caso. ${caso.cierre}`,
      conceptIds: aciertos
    };
  }
  return { ...v, reserva, estado: "error", mult: -1, nota: `Ninguno opera ah\xED. ${caso.cierre}`, conceptIds: ids2 };
}
function validarBalanza(_c, t, ps, lentes) {
  const v = vacio(t, "produccion");
  const tesis = ps.find((p) => p.clase === "tesis");
  const criterios = ps.filter((p) => p.clase === "criterio");
  if (!tesis) return { ...v, nota: "La balanza necesita una tesis." };
  if (!criterios.length) return { ...v, nota: "Pon un criterio en el otro platillo." };
  const validos = criterios.filter((k) => k.tesisId === tesis.refId && k.sentido === "refuta");
  const objeciones = criterios.filter((k) => k.sentido !== "refuta");
  const ajenos = criterios.filter((k) => k.sentido === "refuta" && k.tesisId !== tesis.refId);
  const operacionalizable = (k) => /evidencia|dato|datos|cifra|porcentaje|mayor[ií]a|encuesta|medici[oó]n|si se observa|si se compr|estad[ií]stic|registro|estudio/i.test(`${k.titulo} ${k.cuerpo ?? ""}`);
  if (validos.length) {
    const nota = objeciones.length ? `Cumple la r\xFAbrica con ${validos.length === 1 ? "un criterio" : `${validos.length} criterios`}; la objeci\xF3n no cuenta: dice por qu\xE9 la tesis podr\xEDa fallar, no qu\xE9 observaci\xF3n lo mostrar\xEDa.` : "Cumple la r\xFAbrica: fija qu\xE9 evidencia obligar\xEDa a revisar la tesis.";
    return { ...v, estado: "sostenido", fichas: 18 * validos.length + lentes.fichasPorSostenido, mult: 1.6 + 0.4 * validos.length, nota, conceptIds: tesis.conceptIds };
  }
  if (objeciones.length) {
    const op = objeciones.filter(operacionalizable);
    if (op.length) {
      return {
        ...v,
        estado: "aproximado",
        fichas: 10,
        mult: 1.2,
        nota: "Casi: es una objeci\xF3n que nombra algo observable. Para que sea criterio, dilo como condici\xF3n: \xABsi se observara que\u2026, la tesis tendr\xEDa que revisarse\xBB.",
        conceptIds: tesis.conceptIds
      };
    }
    return {
      ...v,
      estado: "plausible",
      fichas: 5,
      mult: 1,
      nota: `Es una objeci\xF3n razonable, no un criterio: dice por qu\xE9 la tesis podr\xEDa fallar, pero no qu\xE9 observaci\xF3n lo mostrar\xEDa. ${objeciones[0].explicacion ? `(${objeciones[0].explicacion})` : ""}`.trim(),
      conceptIds: tesis.conceptIds
    };
  }
  if (ajenos.length) return { ...v, estado: "plausible", fichas: 4, mult: 1, nota: "Es un criterio de refutaci\xF3n v\xE1lido, pero de otra tesis: ponlo en su balanza.", conceptIds: tesis.conceptIds };
  return { ...v, nota: "Ese criterio pertenece a otra tesis." };
}
function validarContraejemplo(c2, t, ps, lentes) {
  const v = vacio(t, "discriminacion");
  const reserva = reservaDe(ps);
  const caso = ps.find((p) => p.clase === "caso");
  const resto = ps.filter((p) => p !== caso && p.conceptId);
  if (!caso) return { ...v, reserva, nota: "El contraejemplo necesita un caso." };
  if (!resto.length) return { ...v, reserva, nota: "Se\xF1ala qu\xE9 concepto NO opera ah\xED." };
  const dentro = new Set(caso.conceptIds);
  const vecinosDelCaso = new Set(
    c2.aristas.filter((a) => dentro.has(a.from) || dentro.has(a.to)).flatMap((a) => [a.from, a.to])
  );
  const errados = resto.filter((p) => dentro.has(p.conceptId));
  if (errados.length) {
    return {
      // v6.8 · tampoco aquí hay dirección: el concepto SÍ opera en el caso, la afirmación es falsa
      ...v,
      reserva,
      estado: "error",
      mult: -1,
      nota: `\xAB${errados[0].titulo}\xBB s\xED opera en ese caso: ${caso.cierre}`,
      conceptIds: errados.map((p) => p.conceptId)
    };
  }
  const finos = resto.filter((p) => vecinosDelCaso.has(p.conceptId));
  if (finos.length === resto.length) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 14 * resto.length + lentes.fichasPorSostenido,
      mult: 1.5 + 0.3 * resto.length,
      nota: `Buena distinci\xF3n: se le parece, pero el texto no lo pone a operar ah\xED. ${caso.cierre}`,
      conceptIds: resto.map((p) => p.conceptId)
    };
  }
  return {
    ...v,
    reserva,
    estado: "plausible",
    fichas: 4,
    nota: "Cierto, pero demasiado f\xE1cil: ese concepto ni siquiera rondaba el caso.",
    conceptIds: resto.map((p) => p.conceptId)
  };
}
function validarAnalogia(c2, t, ps, lentes) {
  const v = vacio(t, "transferencia");
  const reserva = reservaDe(ps);
  const ids2 = ps.map((p) => p.conceptId).filter((x) => !!x);
  if (ids2.length < 4) return { ...v, reserva, nota: "La analog\xEDa necesita cuatro conceptos: A, B, C y D." };
  const [a, b, cc, d] = ids2;
  const tipos1 = c2.aristas.filter((x) => x.from === a && x.to === b).map((x) => x.tipo);
  const tipos2 = c2.aristas.filter((x) => x.from === cc && x.to === d).map((x) => x.tipo);
  const comun = tipos1.find((x) => tipos2.includes(x));
  if (!comun) {
    const hayAlgo = tipos1.length && tipos2.length;
    return {
      ...v,
      reserva,
      estado: hayAlgo ? "aproximado" : "silencio",
      fichas: hayAlgo ? 6 : 0,
      nota: hayAlgo ? `Los dos pares existen, pero no con el mismo v\xEDnculo: \xAB${tipos1[0]}\xBB frente a \xAB${tipos2[0]}\xBB. La analog\xEDa exige la misma forma.` : "Al menos uno de los dos pares no est\xE1 en el texto.",
      conceptIds: ids2
    };
  }
  const zona2 = (id) => c2.conceptos[id]?.clusterId ?? "\u2014";
  const lejos = zona2(a) !== zona2(cc) || zona2(b) !== zona2(d);
  return {
    ...v,
    reserva,
    estado: "sostenido",
    fichas: 26 + lentes.fichasPorSostenido,
    mult: lejos ? 3 : 1.4,
    nota: lejos ? `Misma estructura en dos zonas distintas del texto: ambos pares se unen por \xAB${comun}\xBB. Eso es transferencia de verdad.` : `Los dos pares se unen por \xAB${comun}\xBB, pero son de la misma zona: la analog\xEDa es correcta y algo f\xE1cil.`,
    conceptIds: ids2
  };
}
function validarAlcance(c2, t, ps, lentes) {
  const v = vacio(t, "discriminacion");
  const reserva = reservaDe(ps);
  const [a, b] = ps;
  if (!a?.conceptId || !b?.conceptId) return { ...v, reserva, nota: "El alcance necesita dos conceptos." };
  const matiza = c2.aristas.find(
    (x) => x.tipo === "matiza" && (x.from === b.conceptId && x.to === a.conceptId || x.from === a.conceptId && x.to === b.conceptId)
  );
  if (matiza) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 16 + lentes.fichasPorSostenido,
      mult: 1.8,
      nota: `${matiza.descripcion} Saber d\xF3nde deja de valer algo es tan importante como saber qu\xE9 es.`,
      conceptIds: [a.conceptId, b.conceptId],
      aristas: [{ from: b.conceptId, to: a.conceptId, tipo: "matiza" }]
    };
  }
  const tension = (c2.conceptos[a.conceptId]?.tensiones ?? []).some(
    (x) => x.toLowerCase().includes((c2.conceptos[b.conceptId]?.titulo ?? "").toLowerCase())
  );
  if (tension) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 14 + lentes.fichasPorSostenido,
      mult: 1.5,
      nota: "El texto reconoce esa tensi\xF3n: ah\xED est\xE1 el l\xEDmite de lo que afirma.",
      conceptIds: [a.conceptId, b.conceptId]
    };
  }
  const requiere = c2.aristas.find(
    (x) => x.tipo === "requiere" && x.from === a.conceptId && x.to === b.conceptId
  );
  if (requiere) {
    return {
      ...v,
      reserva,
      estado: "aproximado",
      fichas: 7,
      nota: `Va por ah\xED: el texto lo dice como prerrequisito, no como l\xEDmite. ${requiere.descripcion}`,
      conceptIds: [a.conceptId, b.conceptId]
    };
  }
  return { ...v, reserva, nota: "El texto no pone esa condici\xF3n sobre ese concepto." };
}
function validarDescomposicion(_c, t, ps, lentes) {
  const v = vacio(t, "estructura");
  const reserva = reservaDe(ps);
  const todo = ps[0];
  const partes = ps.slice(1);
  if (!todo?.conceptId || !partes.length) {
    return { ...v, reserva, nota: "Pon primero el todo y despu\xE9s sus partes." };
  }
  const buenas = partes.filter((p) => p.clase === "subdimension" && p.conceptId === todo.conceptId);
  const ajenas = partes.filter((p) => p.clase === "subdimension" && p.conceptId !== todo.conceptId);
  if (buenas.length === partes.length) {
    return {
      ...v,
      reserva,
      estado: "sostenido",
      fichas: 11 * buenas.length + lentes.fichasPorSostenido,
      mult: 1.2 + 0.35 * buenas.length,
      nota: `El texto desglosa \xAB${todo.titulo}\xBB exactamente en esas partes.`,
      conceptIds: [todo.conceptId]
    };
  }
  if (ajenas.length) {
    return {
      // v6.7 · no es una inversión (la Descomposición no tiene dirección que voltear): es un
      // atributo de OTRO concepto. Se dice cuál, para que el jugador sepa dónde va.
      ...v,
      reserva,
      estado: "error",
      mult: -1,
      nota: `\xAB${ajenas[0].titulo}\xBB no es parte de \xAB${todo.titulo}\xBB: es un atributo de \xAB${ajenas[0].conceptId && _c.conceptos[ajenas[0].conceptId]?.titulo || "otro concepto"}\xBB. Descomp\xF3n ese concepto con \xE9l.`,
      conceptIds: [todo.conceptId]
    };
  }
  if (buenas.length) {
    return {
      ...v,
      reserva,
      estado: "aproximado",
      fichas: 6 * buenas.length,
      nota: "Parte del desglose se sostiene; el resto no son componentes de eso.",
      conceptIds: [todo.conceptId]
    };
  }
  return { ...v, reserva, nota: "Las partes se toman de las subdimensiones que el texto declara." };
}
var VALIDADORES = {
  flecha: validarFlecha,
  identidad: validarIdentidad,
  campo: validarCampo,
  jerarquia: validarJerarquia,
  eje: validarEje,
  secuencia: validarSecuencia,
  ancla: validarAncla,
  balanza: validarBalanza,
  contraejemplo: validarContraejemplo,
  analogia: validarAnalogia,
  alcance: validarAlcance,
  descomposicion: validarDescomposicion
};
function evaluarDiagrama(c2, piezas, trazos, lentes = SIN_LENTES, opciones = {}) {
  const porUid = new Map(piezas.map((p) => [p.uid, p]));
  const veredictos = [];
  for (const t of trazos) {
    const ps = t.piezas.map((u) => porUid.get(u)).filter((p) => !!p);
    const h = HERRAMIENTAS[t.tool];
    if (ps.length < h.aridad[0]) {
      veredictos.push({ ...vacio(t, h.dimension), nota: `${h.nombre} necesita al menos ${h.aridad[0]} piezas.` });
      continue;
    }
    const ver = VALIDADORES[t.tool](c2, t, ps, lentes, opciones);
    const extra = lentes.multPorHerramienta[t.tool] ?? 0;
    veredictos.push({ ...ver, mult: ver.mult + (ver.estado === "sostenido" ? extra : 0) });
  }
  const anclas = veredictos.filter((v) => v.trazo.tool === "ancla" && esAcierto(v.estado));
  if (anclas.length) {
    for (const v of veredictos) {
      if (v.estado !== "plausible" && v.estado !== "propuesta" || v.conceptIds.length < 2) continue;
      const [a, b] = v.conceptIds;
      const sostenida = anclas.some((x) => x.conceptIds.includes(a) && x.conceptIds.includes(b));
      if (!sostenida) continue;
      v.estado = "convive";
      v.fichas = Math.round(v.fichas * 3);
      v.mult = 0.8;
      v.propuesta = null;
      v.nota = "Lo has sostenido con un caso: los dos operan ah\xED, as\xED que ya no es una corazonada.";
    }
  }
  flexibilizar(c2, veredictos, piezas);
  const sostenidos = veredictos.filter((v) => esAcierto(v.estado));
  const aproximados = veredictos.filter((v) => v.estado === "aproximado");
  const errores = veredictos.filter((v) => v.estado === "error");
  const invertidos = veredictos.filter((v) => v.estado === "invertido");
  const reservas = veredictos.map((v) => v.reserva).filter((x) => !!x);
  let fichas = veredictos.reduce((n2, v) => n2 + v.fichas, 0);
  let mult = 1 + veredictos.reduce((n2, v) => n2 + v.mult, 0);
  const combos = [];
  const anadir = (id, f, m, detalle) => {
    const bonus = lentes.multPorCombo[id] ?? 0;
    combos.push({ id, nombre: NOMBRE_COMBO[id], fichas: f, mult: m + bonus, detalle });
    fichas += f;
    mult += m + bonus;
  };
  if (sostenidos.length >= 2) {
    const uso = /* @__PURE__ */ new Map();
    for (const v of sostenidos) for (const u of v.trazo.piezas) uso.set(u, (uso.get(u) ?? 0) + 1);
    const articuladas = [...uso.values()].filter((n2) => n2 >= 3).length;
    if (articuladas > 0) {
      anadir(
        "articulacion",
        10 * articuladas,
        1.2 * articuladas,
        `${articuladas} pieza(s) sostienen tres afirmaciones a la vez.`
      );
    }
    if (sostenidos.length >= 4 && errores.length === 0) {
      anadir("constelacion", 25, 2, "Cuatro afirmaciones sostenidas y ning\xFAn derrumbe.");
    }
    const campos = sostenidos.filter((v) => v.trazo.tool === "campo");
    for (const campo of campos) {
      const dentro = new Set(campo.trazo.piezas);
      const enlaces = sostenidos.filter((v) => v.trazo.tool === "flecha" && v.trazo.piezas.every((u) => dentro.has(u)));
      if (enlaces.length >= dentro.size - 1) {
        anadir("cierre", 18, 1.8, "El campo no solo agrupa: adem\xE1s est\xE1 tejido por dentro.");
        break;
      }
    }
    const identificados = new Set(sostenidos.filter((v) => v.trazo.tool === "identidad").flatMap((v) => v.conceptIds));
    const enlazados = new Set(sostenidos.filter((v) => v.trazo.tool === "flecha").flatMap((v) => v.conceptIds));
    const dobles = [...identificados].filter((id) => enlazados.has(id)).length;
    if (dobles > 0) {
      anadir(
        "doble_registro",
        12 * dobles,
        1 * dobles,
        "Sabes qu\xE9 es y adem\xE1s qu\xE9 hace: reconocimiento y relaci\xF3n sobre el mismo concepto."
      );
    }
    if (sostenidos.some((v) => v.trazo.tool === "balanza") && sostenidos.some((v) => v.trazo.tool === "campo")) {
      anadir("refutacion_completa", 22, 2.2, "Sit\xFAas la tesis y adem\xE1s delimitas el marco al que responde.");
    }
    if (sostenidos.some((v) => v.trazo.tool === "ancla") && identificados.size > 0) {
      anadir("traduccion", 14, 1.4, "Llevas el concepto al caso sin perder de vista qu\xE9 era.");
    }
    const freqs = Object.values(c2.frecuenciaRelacion).sort((a, b) => a - b);
    const umbral = freqs[Math.floor(freqs.length / 3)] ?? 0;
    const vetas = sostenidos.filter(
      (v) => v.trazo.tool === "flecha" && v.trazo.param && (c2.frecuenciaRelacion[v.trazo.param] ?? 99) <= umbral
    ).length;
    if (vetas > 0) {
      anadir(
        "veta",
        8 * vetas,
        1.1 * vetas,
        `${vetas} v\xEDnculo(s) de los que el autor casi no usa.`
      );
    }
    const clases = new Set(
      sostenidos.flatMap((v) => v.trazo.piezas).map((u) => porUid.get(u)?.clase).filter((x) => !!x).map((cl) => cl === "apocrifa" ? "concepto" : cl)
    );
    if (clases.size >= 3 && sostenidos.length >= 2) {
      anadir(
        "mestizaje",
        12 * (clases.size - 2),
        1.2 * (clases.size - 2),
        `${clases.size} clases de pieza distintas en la misma afirmaci\xF3n.`
      );
    }
    const tipos2 = new Set(sostenidos.filter((v) => v.trazo.tool === "flecha").map((v) => v.trazo.param));
    if (tipos2.size === 1 && sostenidos.filter((v) => v.trazo.tool === "flecha").length >= 2) {
      anadir("coherencia", 0, 0.9, `Todo el diagrama es \xAB${[...tipos2][0]}\xBB.`);
    }
  }
  const creaciones = veredictos.filter((v) => esCreacion(v.estado));
  if (creaciones.length && sostenidos.length >= 1) {
    const respaldadas = creaciones.filter((v) => v.estado === "insinuado").length;
    anadir(
      "hallazgo",
      6 * creaciones.length + 6 * respaldadas,
      0.6 + 0.3 * respaldadas,
      respaldadas ? `${creaciones.length} conexi\xF3n(es) tuya(s), ${respaldadas} que el texto insin\xFAa, junto a lo que s\xED sostiene.` : `${creaciones.length} conexi\xF3n(es) tuya(s) junto a lo que el texto s\xED sostiene.`
    );
  }
  const umbrales = new Set(
    sostenidos.flatMap((v) => v.conceptIds).filter((id) => c2.conceptos[id]?.esUmbral)
  ).size;
  if (umbrales > 0) {
    anadir("articulacion", 0, umbrales * (0.5 + lentes.multPorUmbral), `${umbrales} concepto(s) umbral.`);
    combos[combos.length - 1].nombre = "Umbral";
  }
  const nInf = veredictos.filter((v) => v.inferencia).length;
  if (nInf) fichas += lentes.fichasPorInferencia * nInf;
  if (aproximados.length) mult += lentes.multPorAproximado * aproximados.length;
  if (lentes.plausibleCuenta) {
    const pl = veredictos.filter((v) => v.estado === "plausible" || v.estado === "propuesta").length;
    fichas += pl * 6;
  }
  if (errores.length) mult = Math.max(0.4, mult - 0.5 * errores.length);
  if (reservas.length) mult = Math.max(0.4, mult * (1 - 0.15 * reservas.length));
  mult = Math.max(0, mult + lentes.multGlobal);
  const clasesN = (() => {
    const cs = new Set(
      sostenidos.flatMap((v) => v.trazo.piezas).map((u) => porUid.get(u)?.clase).filter((x) => !!x).map((cl) => cl === "apocrifa" ? "concepto" : cl)
    );
    return cs.size;
  })();
  const toolsSostenidas = new Set(sostenidos.map((v) => v.trazo.tool));
  const cumpleX = (c3) => {
    switch (c3) {
      case "ancla":
        return sostenidos.some((v) => v.trazo.tool === "ancla");
      case "analogia":
        return sostenidos.some((v) => v.trazo.tool === "analogia");
      case "variedad":
        return toolsSostenidas.size >= 3;
      case "oposicion":
        return sostenidos.filter((v) => v.trazo.param === "contrasta").length >= 2 && !trazos.some((t) => t.param === "apoya");
      case "constelacion":
        return combos.some((x) => x.id === "constelacion");
      case "mestizaje4":
        return combos.some((x) => x.id === "mestizaje") && clasesN >= 4;
    }
  };
  let xmult = 1;
  const xmultsActivos = [];
  for (const x of lentes.xmults) {
    if (!cumpleX(x.cuando)) continue;
    xmult *= x.factor;
    xmultsActivos.push({ nombre: x.nombre, factor: x.factor });
  }
  const dano = Math.max(0, Math.round(fichas * mult * xmult));
  const dims = [...new Set(sostenidos.map((v) => v.dimension))];
  return {
    veredictos,
    combos,
    ajustes: [],
    fichas,
    mult,
    xmult,
    xmultsActivos,
    dano,
    alcance: Math.min(4, 1 + Math.floor(sostenidos.length / 1.5) + lentes.alcanceExtra),
    sostenidos: sostenidos.length,
    aproximados: aproximados.length,
    inferencias: veredictos.filter((v) => v.inferencia).length,
    reservas,
    errores: errores.length,
    invertidos: invertidos.length,
    dimensiones: dims,
    conceptIds: [...new Set(veredictos.flatMap((v) => v.conceptIds))],
    aristas: sostenidos.flatMap((v) => v.aristas),
    fusiona: [...new Set(sostenidos.flatMap((v) => v.fusiona))],
    propuestas: veredictos.map((v) => v.propuesta).filter((x) => !!x),
    creaciones: creaciones.length,
    apocrifasDetectadas: sostenidos.map((v) => v.apocrifaDetectada).filter((x) => !!x),
    repertoriosReubicados: sostenidos.map((v) => v.repertorioReubicado).filter((x) => !!x),
    autodano: errores.length * 4 + (lentes.sinCastigoInvertido ? 0 : invertidos.length * 3),
    cierre: sostenidos.length ? sostenidos[sostenidos.length - 1].nota : null
  };
}

// src/engine/pieces.ts
var n = 0;
var uid = (p) => `${p}${(n++).toString(36)}`;
var base = () => ({
  uid: uid("p"),
  clase: "concepto",
  roles: ["nodo"],
  titulo: "",
  cuerpo: "",
  conceptId: null,
  refId: null,
  conceptIds: [],
  conceptIdsRivales: [],
  distancia: null,
  umbral: false,
  importancia: 0.5,
  duenoReal: null,
  explicacion: "",
  cierre: "",
  tesisId: null,
  sentido: null,
  sinonimos: []
});
function piezaEtiqueta(c2, conceptId) {
  const k = c2.conceptos[conceptId];
  if (!k) return null;
  return {
    ...base(),
    clase: "etiqueta",
    roles: ["nodo", "etiqueta"],
    titulo: k.titulo,
    cuerpo: "",
    conceptId,
    umbral: k.esUmbral,
    importancia: k.importancia,
    sinonimos: k.sinonimos
  };
}
function piezaDefinicion(c2, conceptId) {
  const k = c2.conceptos[conceptId];
  if (!k) return null;
  return {
    ...base(),
    clase: "definicion",
    roles: ["nodo", "definicion"],
    titulo: "Definici\xF3n sin due\xF1o",
    cuerpo: k.definicionCorta,
    conceptId,
    umbral: k.esUmbral,
    importancia: k.importancia
  };
}
function piezaConcepto(c2, conceptId) {
  const k = c2.conceptos[conceptId];
  if (!k) return null;
  return {
    ...base(),
    clase: "concepto",
    roles: ["nodo", "etiqueta", "definicion"],
    titulo: k.titulo,
    cuerpo: k.definicionCorta,
    conceptId,
    umbral: k.esUmbral,
    importancia: k.importancia,
    sinonimos: k.sinonimos
  };
}
function piezaCaso(c2, id) {
  const k = c2.casos.find((x) => x.id === id);
  if (k) {
    return {
      ...base(),
      clase: "caso",
      roles: ["nodo", "caso"],
      titulo: k.dominio || "Caso",
      cuerpo: k.descripcion,
      refId: k.id,
      conceptIds: k.conceptIds,
      distancia: "cercana",
      cierre: k.resolucionEsperada
    };
  }
  const e = c2.escenarios.find((x) => x.id === id);
  if (!e) return null;
  return {
    ...base(),
    clase: "caso",
    roles: ["nodo", "caso"],
    titulo: e.dominio || "Escenario",
    cuerpo: e.descripcion,
    refId: e.id,
    conceptIds: e.conceptIds,
    distancia: e.distancia,
    cierre: e.resolucionEsperada
  };
}
function piezaTesis(c2, id) {
  const t = c2.tesis.find((x) => x.id === id);
  if (!t) return null;
  const marco = t.marcoId ? c2.marcos.find((m) => m.id === t.marcoId) : void 0;
  const rivales = (marco?.rivales ?? []).flatMap((rid) => c2.marcos.find((m) => m.id === rid)?.conceptIds ?? []).filter((cid) => c2.conceptos[cid] && !t.conceptIds.includes(cid));
  return {
    ...base(),
    clase: "tesis",
    roles: ["nodo", "tesis"],
    titulo: "Tesis",
    cuerpo: t.enunciado,
    refId: t.id,
    conceptIds: t.conceptIds,
    conceptIdsRivales: [...new Set(rivales)],
    cierre: t.criteriosDefensa[0] ?? ""
  };
}
function piezasCriterio(c2, tesisId, rng2) {
  const t = c2.tesis.find((x) => x.id === tesisId);
  if (!t) return [];
  const conceptosDe = (lista, texto, fuente) => lista[fuente.indexOf(texto)] ?? [];
  const validos = rng2.sample(t.criteriosRefutacion, 2).map((texto) => ({
    ...base(),
    clase: "criterio",
    roles: ["nodo", "criterio"],
    titulo: "Criterio",
    cuerpo: texto,
    refId: t.id,
    tesisId: t.id,
    conceptIds: conceptosDe(t.criteriosConceptos, texto, t.criteriosRefutacion),
    sentido: "refuta",
    cierre: ""
  }));
  const falsos = rng2.sample(t.contraargumentos, 1).map((texto) => ({
    ...base(),
    clase: "criterio",
    roles: ["nodo", "criterio"],
    titulo: "Objeci\xF3n",
    cuerpo: texto,
    refId: t.id,
    tesisId: t.id,
    conceptIds: conceptosDe(t.contraargumentosConceptos, texto, t.contraargumentos),
    sentido: null,
    explicacion: "Suena razonable, pero no dice qu\xE9 observaci\xF3n obligar\xEDa a revisar la tesis: no es un criterio de refutaci\xF3n."
  }));
  return [...validos, ...falsos];
}
function piezaMarco(c2, id) {
  const m = c2.marcos.find((x) => x.id === id);
  if (!m) return null;
  return {
    ...base(),
    clase: "marco",
    roles: ["nodo", "campo"],
    titulo: m.etiqueta,
    cuerpo: m.principios[0] ?? "",
    refId: m.id,
    conceptIds: m.conceptIds,
    conceptIdsRivales: m.rivales.flatMap((r) => c2.marcos.find((x) => x.id === r)?.conceptIds ?? [])
  };
}
function piezaIntuicion(c2, id) {
  const r = c2.repertorios.find((x) => x.id === id);
  if (!r) return null;
  return {
    ...base(),
    clase: "intuicion",
    roles: ["nodo"],
    titulo: r.etiqueta,
    cuerpo: r.ejemplo,
    refId: r.id,
    conceptId: r.conceptId,
    explicacion: r.contrasteCientifico,
    cierre: r.contextoDondeFunciona
  };
}
function piezasSubdimension(c2, conceptId) {
  const k = c2.conceptos[conceptId];
  if (!k) return [];
  return k.subdimensiones.map((s) => ({
    ...base(),
    clase: "subdimension",
    roles: ["nodo", "atributo"],
    titulo: s.nombre,
    cuerpo: s.descripcion,
    conceptId
  }));
}

// src/engine/rng.ts
var Rng = class {
  s;
  constructor(seed) {
    this.s = typeof seed === "number" ? seed >>> 0 : hash(seed);
    if (this.s === 0) this.s = 2654435769;
  }
  next() {
    this.s = this.s + 1831565813 >>> 0;
    let t = this.s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(maxExclusive) {
    return Math.floor(this.next() * Math.max(1, maxExclusive));
  }
  pick(list) {
    return list[this.int(list.length)];
  }
  shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  sample(list, n2) {
    return this.shuffle(list).slice(0, Math.max(0, n2));
  }
};
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// scripts/explorar.ts
var ruta = process.argv[2] ?? "public/bundles/demo.json";
var c = adaptarBundle(JSON.parse(readFileSync(ruta, "utf8")));
var rng = new Rng("explorar");
var ids = c.ordenConceptos.filter((x) => c.conceptos[x]);
var K = (id) => piezaConcepto(c, id);
var T2 = (id) => c.conceptos[id]?.titulo ?? id;
var juzga = (tool, piezas, param = null) => {
  const t = { uid: "t", tool, piezas: piezas.map((p) => p.uid), param };
  return evaluarDiagrama(c, piezas, [t]).veredictos[0];
};
var BUENOS = /* @__PURE__ */ new Set(["sostenido", "equivalente", "compatible", "derivado"]);
var sumar = (k, e) => {
  k[e] = (k[e] ?? 0) + 1;
};
var fmt = (k) => Object.entries(k).sort((a, b) => b[1] - a[1]).map(([e, n2]) => `${e} ${n2}`).join(" \xB7 ") || "\u2014";
var hallazgos = [];
var anotar = (grav, titulo2, ej) => {
  let h = hallazgos.find((x) => x.titulo === titulo2);
  if (!h) {
    h = { grav, titulo: titulo2, ejemplos: [], n: 0 };
    hallazgos.push(h);
  }
  h.n++;
  if (h.ejemplos.length < 4) h.ejemplos.push(ej);
};
var sec = (s) => console.log(`
\u2500\u2500 ${s} \u2500\u2500`);
console.log(`
${ruta}
${ids.length} conceptos \xB7 ${c.aristas.length} aristas firmes \xB7 ${c.insinuadas.length} insinuadas \xB7 ${c.clusters.length} clusters \xB7 ${c.ejes.length} ejes \xB7 ${c.casos.length} casos \xB7 ${c.tesis.length} tesis \xB7 ${c.marcos.length} marcos \xB7 ${c.repertorios.length} intuiciones \xB7 ${ids.filter((x) => c.conceptos[x].subdimensiones.length).length} conceptos con atributos`);
var tipos = [.../* @__PURE__ */ new Set([...Object.keys(c.frecuenciaRelacion), ...c.aristas.map((a) => a.tipo)])];
sec("1 \xB7 Flecha sobre cada arista firme");
{
  const ok = {}, rev = {}, otro = {};
  for (const a of c.aristas) {
    if (!c.conceptos[a.from] || !c.conceptos[a.to]) {
      anotar("BUG", "Arista que apunta a un concepto inexistente (contenido)", `${a.from} \u2014${a.tipo}\u2192 ${a.to}`);
      continue;
    }
    const v = juzga("flecha", [K(a.from), K(a.to)], a.tipo);
    sumar(ok, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Flecha correcta (arista firme, tipo y direcci\xF3n del texto) que NO se sostiene", `${T2(a.from)} \u2014${a.tipo}\u2192 ${T2(a.to)} \u21D2 ${v.estado}: ${v.nota.slice(0, 90)}`);
    const r = juzga("flecha", [K(a.to), K(a.from)], a.tipo);
    rev[a.tipo] = rev[a.tipo] ?? {};
    sumar(rev[a.tipo], r.estado);
    for (const t of tipos) if (t !== a.tipo) {
      const o = juzga("flecha", [K(a.from), K(a.to)], t);
      otro[a.tipo] = otro[a.tipo] ?? {};
      otro[a.tipo][t] = otro[a.tipo][t] ?? {};
      sumar(otro[a.tipo][t], o.estado);
      if (o.estado === "error" || o.estado === "invertido") anotar("REVISAR", "Par correcto y direcci\xF3n correcta, pero OTRO tipo de v\xEDnculo se castiga (resta) en vez de dar cr\xE9dito parcial", `${T2(a.from)} \u2014${t}\u2192 ${T2(a.to)} (el texto dice ${a.tipo}) \u21D2 ${o.estado}`);
    }
    const e1 = piezaEtiqueta(c, a.from), d2 = piezaDefinicion(c, a.to);
    if (e1 && d2) {
      const p = juzga("flecha", [e1, d2], a.tipo);
      if (BUENOS.has(v.estado) && !BUENOS.has(p.estado)) anotar("REVISAR", "La misma flecha correcta falla si se traza con la carta de nombre o de descripci\xF3n en vez de la entera", `${T2(a.from)} \u2014${a.tipo}\u2192 ${T2(a.to)} \u21D2 ${p.estado}: ${p.nota.slice(0, 80)}`);
    }
  }
  console.log(" tal como el texto:  " + fmt(ok));
  console.log(" misma arista AL REV\xC9S, por tipo:");
  for (const [t, k] of Object.entries(rev)) {
    console.log(`   ${t.padEnd(14)} ${fmt(k)}`);
    const tot = Object.values(k).reduce((a, b) => a + b, 0), bien = Object.entries(k).filter(([e]) => BUENOS.has(e)).reduce((a, [, n2]) => a + n2, 0);
    if (bien > 0 && bien < tot) anotar("REVISAR", "Un mismo tipo de v\xEDnculo se acepta al rev\xE9s unas veces y otras no", `${t}: ${fmt(k)}`);
  }
  console.log(" misma arista con OTRO tipo (filas: lo que dice el texto \u2192 lo que puso el jugador):");
  for (const [real, m] of Object.entries(otro)) console.log(`   ${real.padEnd(13)} ` + Object.entries(m).map(([t, k]) => `${t}: ${Object.entries(k).sort((a, b) => b[1] - a[1])[0][0]}`).join(" | "));
}
sec("2 \xB7 Flexibilidad: insinuadas y conexiones propias");
{
  const ins = {};
  for (const a of c.insinuadas) if (c.conceptos[a.from] && c.conceptos[a.to]) {
    const v = juzga("flecha", [K(a.from), K(a.to)], a.tipo);
    sumar(ins, v.estado);
    if (["silencio", "error", "invertido", "plausible"].includes(v.estado)) anotar("REVISAR", "Conexi\xF3n que el extractor infiri\xF3 (insinuada) y que el juez no premia", `${T2(a.from)} \u2014${a.tipo}\u2192 ${T2(a.to)} \u21D2 ${v.estado}`);
  }
  console.log(" insinuadas jugadas tal cual:  " + fmt(ins));
  const unidos = new Set([...c.aristas, ...c.insinuadas].flatMap((a) => [`${a.from}|${a.to}`, `${a.to}|${a.from}`]));
  const libres = {};
  let n2 = 0;
  for (let i = 0; i < ids.length && n2 < 600; i++) for (let j = i + 1; j < ids.length && n2 < 600; j++) {
    if (unidos.has(`${ids[i]}|${ids[j]}`)) continue;
    const t = tipos[(i + j) % tipos.length];
    n2++;
    const v = juzga("flecha", [K(ids[i]), K(ids[j])], t);
    sumar(libres, v.estado);
    if (v.estado === "error" || v.estado === "invertido") anotar("BUG", "Par SIN ning\xFAn v\xEDnculo en el texto que se castiga como falso o al rev\xE9s (proponer no deber\xEDa restar)", `${T2(ids[i])} \u2014${t}\u2192 ${T2(ids[j])} \u21D2 ${v.estado}: ${v.nota.slice(0, 70)}`);
    if (BUENOS.has(v.estado) && v.estado !== "derivado") anotar("REVISAR", "Par sin arista que el juez da por sostenido", `${T2(ids[i])} \u2014${t}\u2192 ${T2(ids[j])} \u21D2 ${v.estado}: ${v.nota.slice(0, 70)}`);
  }
  console.log(` ${n2} pares sin v\xEDnculo, con un tipo cualquiera:  ` + fmt(libres));
}
sec("3 \xB7 Herramientas sobre todo su material");
var fila = (nombre, ok, extra = "") => console.log(` ${nombre.padEnd(34)} ${fmt(ok)}${extra ? "   " + extra : ""}`);
{
  const ok = {}, cruz = {};
  ids.forEach((id, i) => {
    const e = piezaEtiqueta(c, id), d = piezaDefinicion(c, id);
    if (!e || !d) {
      anotar("DATO", "Concepto sin carta de nombre o de descripci\xF3n", T2(id));
      return;
    }
    const v = juzga("identidad", [e, d]);
    sumar(ok, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Identidad correcta (nombre + su descripci\xF3n) que no se sostiene", `${T2(id)} \u21D2 ${v.estado}: ${v.nota.slice(0, 80)}`);
    const d2 = piezaDefinicion(c, ids[(i + 1) % ids.length]);
    if (d2 && ids.length > 1) {
      const x = juzga("identidad", [e, d2]);
      sumar(cruz, x.estado);
      if (BUENOS.has(x.estado)) anotar("BUG", "Identidad cruzada (nombre con la descripci\xF3n de OTRO concepto) que se sostiene", `${T2(id)} + descripci\xF3n de ${T2(ids[(i + 1) % ids.length])}`);
    }
    const inv = juzga("identidad", [d, e]);
    if (inv.estado !== v.estado) anotar("BUG", "Identidad: el orden de las cartas cambia el veredicto (no tiene direcci\xF3n)", `${T2(id)}: ${v.estado} vs ${inv.estado}`);
  });
  fila("Identidad correcta", ok);
  fila("Identidad cruzada", cruz);
}
{
  const ok = {}, mez = {};
  for (const k of c.clusters) {
    const m = k.conceptIds.filter((x) => c.conceptos[x]);
    for (let n2 = 2; n2 <= Math.min(6, m.length); n2++) {
      const v = juzga("campo", m.slice(0, n2).map(K));
      sumar(ok, v.estado);
      if (!BUENOS.has(v.estado)) anotar("BUG", "Campo correcto (conceptos del mismo cluster) que no se sostiene", `${k.label} con ${n2} \u21D2 ${v.estado}: ${v.nota.slice(0, 70)}`);
    }
    const ajeno = ids.find((x) => !m.includes(x) && !c.clusters.some((q) => q !== k && q.conceptIds.includes(x) && m.some((y) => q.conceptIds.includes(y))));
    if (ajeno && m.length >= 2) {
      const v = juzga("campo", [...m.slice(0, 2).map(K), K(ajeno)]);
      sumar(mez, v.estado);
      if (v.estado === "invertido") anotar("BUG", "Campo marca \xABal rev\xE9s\xBB (no tiene direcci\xF3n)", k.label);
    }
  }
  fila("Campo (2\u20266 del mismo cluster)", ok);
  fila("Campo con un intruso", mez);
}
{
  const ok = {}, rev = {};
  for (const p of ids) {
    const hijos = [...c.aristas.filter((x) => x.tipo === "ejemplifica" && x.to === p).map((x) => x.from), ...c.aristas.filter((x) => x.tipo === "generaliza" && x.from === p).map((x) => x.to)].filter((x) => c.conceptos[x]);
    if (!hijos.length) continue;
    const v = juzga("jerarquia", [K(p), ...hijos.slice(0, 3).map(K)]);
    sumar(ok, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Jerarqu\xEDa correcta (categor\xEDa + sus ejemplos) que no se sostiene", `${T2(p)} \u2283 ${hijos.slice(0, 3).map(T2).join(", ")} \u21D2 ${v.estado}: ${v.nota.slice(0, 70)}`);
    const r = juzga("jerarquia", [K(hijos[0]), K(p)]);
    sumar(rev, r.estado);
    if (BUENOS.has(r.estado)) anotar("REVISAR", "Jerarqu\xEDa al rev\xE9s (ejemplo como categor\xEDa) que se sostiene", `${T2(hijos[0])} \u2283 ${T2(p)}`);
  }
  fila("Jerarqu\xEDa correcta", ok);
  fila("Jerarqu\xEDa al rev\xE9s", rev);
}
{
  const ok = {}, mal = {};
  for (const e of c.ejes) {
    const porValor = /* @__PURE__ */ new Map();
    for (const [id, val] of Object.entries(e.valores)) if (c.conceptos[id]) porValor.set(String(val), [...porValor.get(String(val)) ?? [], id]);
    const valores = [...porValor.keys()];
    for (const [val, xs] of porValor) {
      if (xs.length >= 2) {
        const v = juzga("eje", xs.slice(0, 4).map(K), `${e.id}::${val}`);
        sumar(ok, v.estado);
        if (!BUENOS.has(v.estado)) anotar("BUG", "Eje correcto (conceptos que comparten el valor) que no se sostiene", `${e.nombre}=${val}: ${xs.slice(0, 4).map(T2).join(", ")} \u21D2 ${v.estado}: ${v.nota.slice(0, 60)}`);
      }
      const otroVal = valores.find((x) => x !== val);
      if (otroVal && xs.length >= 2) {
        const v = juzga("eje", xs.slice(0, 2).map(K), `${e.id}::${otroVal}`);
        sumar(mal, v.estado);
        if (v.estado === "invertido") anotar("BUG", "Eje marca \xABal rev\xE9s\xBB (no tiene direcci\xF3n)", e.nombre);
      }
    }
    if ([...porValor.values()].every((xs) => xs.length < 2)) anotar("DATO", "Eje sin ning\xFAn valor compartido por dos conceptos: no se puede jugar", e.nombre);
  }
  fila("Eje con el valor correcto", ok);
  fila("Eje con otro valor", mal);
}
{
  const ok = {}, rev = {};
  const vistas = /* @__PURE__ */ new Set();
  for (const a of ids) {
    const out = [a];
    for (let i = 0; i < 3; i++) {
      const s = c.aristas.find((x) => x.from === out[out.length - 1] && ["antecede", "causa", "requiere"].includes(x.tipo) && !out.includes(x.to) && c.conceptos[x.to]);
      if (!s) break;
      out.push(s.to);
    }
    if (out.length < 3 || vistas.has(out.join(">"))) continue;
    vistas.add(out.join(">"));
    const v = juzga("secuencia", out.map(K));
    sumar(ok, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Secuencia correcta (cadena del texto) que no se sostiene", `${out.map(T2).join(" \u21E2 ")} \u21D2 ${v.estado}: ${v.nota.slice(0, 60)}`);
    const r = juzga("secuencia", [...out].reverse().map(K));
    sumar(rev, r.estado);
    if (BUENOS.has(r.estado)) anotar("REVISAR", "Secuencia invertida que se sostiene", out.map(T2).reverse().join(" \u21E2 "));
  }
  fila("Secuencia correcta", ok);
  fila("Secuencia al rev\xE9s", rev);
}
{
  const an = {}, anMal = {}, ce = {}, ceMal = {};
  for (const k of c.casos) {
    const pc = piezaCaso(c, k.id);
    const suyos = k.conceptIds.filter((x) => c.conceptos[x]);
    if (!pc) continue;
    if (!suyos.length) {
      anotar("DATO", "Caso sin conceptos asociados: Ancla y Contraejemplo no tienen con qu\xE9 jugarse", k.descripcion.slice(0, 70));
      continue;
    }
    const v = juzga("ancla", [pc, ...suyos.slice(0, 3).map(K)]);
    sumar(an, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Ancla correcta (caso + sus conceptos) que no se sostiene", `${k.descripcion.slice(0, 50)}\u2026 \u21D2 ${v.estado}: ${v.nota.slice(0, 60)}`);
    const ajeno = ids.find((x) => !suyos.includes(x));
    if (ajeno) {
      const m = juzga("ancla", [pc, K(ajeno)]);
      sumar(anMal, m.estado);
      if (m.estado === "invertido") anotar("BUG", "Ancla con un concepto ajeno responde \xABal rev\xE9s\xBB (no hay direcci\xF3n que voltear: es falso)", `${k.descripcion.slice(0, 40)}\u2026 + ${T2(ajeno)}`);
      const x = juzga("contraejemplo", [pc, K(ajeno)]);
      sumar(ce, x.estado);
      if (!BUENOS.has(x.estado) && x.estado !== "aproximado") anotar("REVISAR", "Contraejemplo razonable (caso + concepto que no opera en \xE9l) que no se sostiene", `${k.descripcion.slice(0, 40)}\u2026 \u2717 ${T2(ajeno)} \u21D2 ${x.estado}: ${x.nota.slice(0, 60)}`);
    }
    const y = juzga("contraejemplo", [pc, K(suyos[0])]);
    sumar(ceMal, y.estado);
    if (y.estado === "invertido") anotar("BUG", "Contraejemplo con un concepto que s\xED opera responde \xABal rev\xE9s\xBB (es falso, no invertido)", T2(suyos[0]));
    if (BUENOS.has(y.estado)) anotar("BUG", "Contraejemplo con un concepto que S\xCD opera en el caso, y se sostiene", `${k.descripcion.slice(0, 40)}\u2026 \u2717 ${T2(suyos[0])}`);
  }
  fila("Ancla (caso + sus conceptos)", an);
  fila("Ancla con concepto ajeno", anMal);
  fila("Contraejemplo (concepto ajeno)", ce);
  fila("Contraejemplo con concepto propio", ceMal);
}
{
  const ok = {}, mal = {};
  for (const t of c.tesis) {
    const pt = piezaTesis(c, t.id);
    if (!pt) continue;
    const crit = piezasCriterio(c, t.id, rng);
    if (!crit.length) {
      anotar("DATO", "Tesis sin criterios: Balanza no se puede jugar", t.enunciado.slice(0, 70));
      continue;
    }
    for (const k of crit.filter((p) => p.sentido)) {
      const v = juzga("balanza", [pt, k]);
      sumar(ok, `${k.sentido}:${v.estado}`);
    }
    const real = crit.find((p) => p.sentido === "refuta");
    if (real) {
      const v = juzga("balanza", [pt, real]);
      if (!BUENOS.has(v.estado)) anotar("BUG", "Balanza correcta (tesis + un criterio que la refuta) que no se sostiene", `${t.enunciado.slice(0, 50)}\u2026 \u21D2 ${v.estado}: ${v.nota.slice(0, 60)}`);
    }
    const otra = c.tesis.find((x) => x.id !== t.id);
    const pk = otra && piezasCriterio(c, otra.id, rng).find((p) => p.sentido === "refuta");
    if (pk) {
      const v = juzga("balanza", [pt, pk]);
      sumar(mal, v.estado);
      if (BUENOS.has(v.estado)) anotar("REVISAR", "Balanza con el criterio de OTRA tesis, y se sostiene", t.enunciado.slice(0, 60));
    }
  }
  fila("Balanza (por sentido del criterio)", ok);
  fila("Balanza con criterio de otra tesis", mal);
}
{
  const an = {}, cruz = {};
  let n2 = 0;
  for (const a1 of c.aristas) {
    if (n2 >= 150) break;
    for (const a2 of c.aristas) {
      if (a1 === a2 || (/* @__PURE__ */ new Set([a1.from, a1.to, a2.from, a2.to])).size < 4 || ![a1.from, a1.to, a2.from, a2.to].every((x) => c.conceptos[x])) continue;
      if (a1.tipo === a2.tipo) {
        const v = juzga("analogia", [a1.from, a1.to, a2.from, a2.to].map(K));
        sumar(an, v.estado);
        n2++;
        if (!BUENOS.has(v.estado)) anotar("BUG", "Analog\xEDa correcta (dos pares con el mismo v\xEDnculo) que no se sostiene", `${T2(a1.from)}:${T2(a1.to)} :: ${T2(a2.from)}:${T2(a2.to)} (${a1.tipo}) \u21D2 ${v.estado}: ${v.nota.slice(0, 50)}`);
        const x = juzga("analogia", [a1.from, a1.to, a2.to, a2.from].map(K));
        sumar(cruz, x.estado);
      }
      if (n2 >= 150) break;
    }
  }
  fila("Analog\xEDa (mismo v\xEDnculo)", an);
  fila("Analog\xEDa con el 2\xBA par volteado", cruz);
  const al = {}, alRev = {};
  for (const m of c.aristas.filter((x) => x.tipo === "matiza" && c.conceptos[x.from] && c.conceptos[x.to])) {
    const v = juzga("alcance", [K(m.to), K(m.from)]);
    sumar(al, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Alcance correcto (concepto + lo que lo matiza) que no se sostiene", `${T2(m.to)} \u22A3 ${T2(m.from)} \u21D2 ${v.estado}: ${v.nota.slice(0, 60)}`);
    const r = juzga("alcance", [K(m.from), K(m.to)]);
    sumar(alRev, r.estado);
  }
  fila("Alcance (sobre aristas \xABmatiza\xBB)", al);
  fila("Alcance al rev\xE9s", alRev);
}
{
  const ok = {}, nom = {}, mez = {};
  const con = ids.filter((x) => c.conceptos[x].subdimensiones.length >= 1);
  for (const id of con) {
    const partes = piezasSubdimension(c, id).slice(0, 3);
    const v = juzga("descomposicion", [K(id), ...partes]);
    sumar(ok, v.estado);
    if (!BUENOS.has(v.estado)) anotar("BUG", "Descomposici\xF3n correcta (concepto + sus atributos) que no se sostiene", `${T2(id)} \u21D2 ${v.estado}: ${v.nota.slice(0, 70)}`);
    const e = piezaEtiqueta(c, id);
    if (e) {
      const x = juzga("descomposicion", [e, ...partes]);
      sumar(nom, x.estado);
      if (!BUENOS.has(x.estado)) anotar("REVISAR", "Descomposici\xF3n correcta falla si el todo es la carta de nombre en vez de la entera", `${T2(id)} \u21D2 ${x.estado}`);
    }
    const otro = con.find((x) => x !== id);
    if (otro) {
      const y = juzga("descomposicion", [K(id), partes[0], piezasSubdimension(c, otro)[0]]);
      sumar(mez, y.estado);
      if (y.estado === "invertido") anotar("BUG", "Descomposici\xF3n marca \xABal rev\xE9s\xBB (no tiene direcci\xF3n que voltear)", T2(id));
    }
    const tit = partes.map((p) => p.titulo.toLowerCase());
    if (new Set(tit).size < tit.length) anotar("DATO", "Concepto con atributos de nombre repetido", T2(id));
  }
  const due\u00F1os = /* @__PURE__ */ new Map();
  for (const id of con) for (const s of c.conceptos[id].subdimensiones) due\u00F1os.set(s.nombre.toLowerCase().trim(), [...due\u00F1os.get(s.nombre.toLowerCase().trim()) ?? [], id]);
  for (const [nombre, ds] of due\u00F1os) if (new Set(ds).size > 1) anotar("REVISAR", "El mismo atributo aparece en varios conceptos: la carta no dice de cu\xE1l es y solo uno se acepta", `\xAB${nombre}\xBB en ${[...new Set(ds)].map(T2).join(" / ")}`);
  fila("Descomposici\xF3n (carta entera)", ok);
  fila("Descomposici\xF3n (carta de nombre)", nom);
  fila("Descomposici\xF3n con atributo ajeno", mez);
}
sec("4 \xB7 Ranuras y mensajes");
{
  const muestra = [
    ...ids[0] ? [K(ids[0]), piezaEtiqueta(c, ids[0]), piezaDefinicion(c, ids[0])] : [],
    ...ids[1] ? [K(ids[1])] : [],
    ...c.casos[0] ? [piezaCaso(c, c.casos[0].id)] : [],
    ...c.tesis[0] ? [piezaTesis(c, c.tesis[0].id), ...piezasCriterio(c, c.tesis[0].id, rng).slice(0, 1)] : [],
    ...c.marcos[0] ? [piezaMarco(c, c.marcos[0].id)] : [],
    ...c.repertorios[0] ? [piezaIntuicion(c, c.repertorios[0].id)] : [],
    ...ids.filter((x) => c.conceptos[x].subdimensiones.length).slice(0, 1).flatMap((x) => piezasSubdimension(c, x).slice(0, 1))
  ].filter((p) => !!p);
  let mudas = 0, total = 0;
  for (const tool of Object.keys(HERRAMIENTAS)) {
    const h = HERRAMIENTAS[tool];
    if (h.aridad[0] > 2) continue;
    for (const a of muestra) for (const b of muestra) {
      if (a === b || !aceptaEnRanura(tool, 0, a) || !aceptaEnRanura(tool, 1, b)) continue;
      const param = h.parametro === "relacion" ? tipos[0] ?? "causa" : h.parametro === "eje" ? c.ejes[0] ? `${c.ejes[0].id}::${Object.values(c.ejes[0].valores)[0]}` : null : null;
      if (h.parametro === "eje" && !param) continue;
      total++;
      let v;
      try {
        v = juzga(tool, [a, b], param);
      } catch (err) {
        anotar("BUG", "El juez LANZA UN ERROR con una combinaci\xF3n que la ranura admite", `${h.nombre}: ${a.clase} + ${b.clase} \u2192 ${err.message.slice(0, 60)}`);
        continue;
      }
      if (!v.nota.trim()) {
        mudas++;
        anotar("REVISAR", "Combinaci\xF3n que la ranura admite y el juez responde sin ninguna explicaci\xF3n", `${h.nombre}: ${a.clase} + ${b.clase} \u21D2 ${v.estado}`);
      }
      if (v.estado === "invertido" && !h.ordenada) anotar("BUG", "Herramienta sin direcci\xF3n que responde \xABal rev\xE9s\xBB", `${h.nombre}: ${a.clase} + ${b.clase}`);
    }
  }
  console.log(` ${total} combinaciones de dos cartas admitidas por las ranuras \xB7 ${mudas} sin explicaci\xF3n`);
}
sec("5 \xB7 Material del bundle");
{
  const enArista = new Set(c.aristas.flatMap((a) => [a.from, a.to]));
  const sueltos = ids.filter((x) => !enArista.has(x));
  console.log(` conceptos sin ninguna arista firme: ${sueltos.length}/${ids.length}${sueltos.length ? " \u2014 " + sueltos.slice(0, 6).map(T2).join(", ") : ""}`);
  if (sueltos.length) anotar("DATO", "Conceptos sin ninguna arista firme (solo se juegan con Identidad o propuestas)", sueltos.slice(0, 8).map(T2).join(", "));
  const grado = /* @__PURE__ */ new Map();
  for (const a of c.aristas) for (const x of [a.from, a.to]) grado.set(x, (grado.get(x) ?? 0) + 1);
  const hub = [...grado.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hub && c.aristas.length && hub[1] / c.aristas.length > 0.5) anotar("DATO", "Grafo en estrella: un concepto concentra m\xE1s de la mitad de las aristas", `${T2(hub[0])}: ${hub[1]}/${c.aristas.length}`);
  console.log(" tipos de v\xEDnculo: " + Object.entries(c.aristas.reduce((k, a) => (sumar(k, a.tipo), k), {})).sort((a, b) => b[1] - a[1]).map(([t, n2]) => `${t} ${n2}`).join(" \xB7 "));
  const dup = /* @__PURE__ */ new Map();
  for (const a of c.aristas) dup.set([a.from, a.to].sort().join("|"), [...dup.get([a.from, a.to].sort().join("|")) ?? [], `${a.from === [a.from, a.to].sort()[0] ? "\u2192" : "\u2190"}${a.tipo}`]);
  for (const [k, v] of dup) if (v.length > 1) anotar("DATO", "Par de conceptos con m\xE1s de una arista (el juez debe aceptar cualquiera)", `${k.split("|").map(T2).join(" / ")}: ${v.join(", ")}`);
}
console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 HALLAZGOS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
var orden = { BUG: 0, REVISAR: 1, DATO: 2 };
for (const h of hallazgos.sort((a, b) => orden[a.grav] - orden[b.grav] || b.n - a.n)) {
  console.log(`
[${h.grav}] ${h.titulo} \u2014 ${h.n} caso${h.n > 1 ? "s" : ""}`);
  for (const e of h.ejemplos) console.log(`     \xB7 ${e}`);
}
console.log(`
${hallazgos.filter((h) => h.grav === "BUG").length} tipos de bug \xB7 ${hallazgos.filter((h) => h.grav === "REVISAR").length} por revisar \xB7 ${hallazgos.filter((h) => h.grav === "DATO").length} datos del contenido
`);
