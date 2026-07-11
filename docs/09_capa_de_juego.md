# Capa de Juego — Runs Roguelite

> Versión 0.1. Define la capa de juego que envuelve las mecánicas del catálogo (`07_*`, `08_*`) en una experiencia tipo roguelite (referencia: The Binding of Isaac) para el modo de repaso individual.
> Principio rector: **la suerte varía el envoltorio y las recompensas; nunca la oportunidad de aprender.** El RNG decide skins, ítems y monedas. El selector pedagógico decide qué dimensión cognitiva se trabaja.

---

## 0. Separación de capas

```
┌─────────────────────────────────────────────┐
│  CAPA 3 · TEMA (skin pixel art)             │  ← cómo se ve
├─────────────────────────────────────────────┤
│  CAPA 2 · JUEGO (RunState, ítems, mapa)     │  ← este documento
├─────────────────────────────────────────────┤
│  CAPA 1 · MECÁNICAS (catálogo 07/08)        │  ← qué hace cognitivamente
│           emiten MechanicOutput universal    │
└─────────────────────────────────────────────┘
```

- La capa 1 **no sabe** que existe la capa 2. Una mecánica recibe `(config, materiaPrima)` y emite `MechanicOutput`.
- La capa 2 lee `MechanicOutput` para actualizar corazones, monedas, racha. Los ítems **mutan parámetros** declarados en las fichas técnicas (ej: `tiempo_limite_ms`), nunca la lógica interna de la mecánica.
- La capa 3 mapea patrones de interacción a metáforas visuales (elegir 1 de N → puertas; reveal J9 → cofre).

Esto preserva la propiedad Lego: cualquier mecánica nueva del catálogo entra a las runs sin tocar la capa de juego.

---

## 1. RunState

Estado completo de una run. Serializable (permite guardar/reanudar y reproducir con la misma seed).

```
RunState {
  run_id          : uuid
  student_id      : uuid | 'anon'
  course_id       : string
  seed            : number          // RNG sembrado — misma seed = mismo mapa
  status          : 'active' | 'won' | 'game_over' | 'abandoned'

  // Recursos (modificador J4 — costo de recurso)
  hearts          : int             // → 3. Error = -1. 0 = fin de run.
  max_hearts      : int
  coins           : int             // recompensa por acierto, moneda de apuestas G1

  // Momentum (modificador J5 — cadena)
  streak          : int             // aciertos consecutivos
  best_streak     : int
  multiplier      : float           // 1 + min(streak, 5) * 0.2

  // Inventario
  items           : ItemInstance[]

  // Progresión espacial
  map             : RoomNode[]      // generado al inicio con la seed
  current_room    : int             // índice en map
  chosen_paths    : int[]           // decisiones en bifurcaciones

  // Registro
  outputs         : MechanicOutput[]  // todo lo emitido en la run
  started_at      : timestamp
}
```

## 2. RoomNode — el mapa

Una run es una secuencia de salas con al menos una bifurcación. Cada sala instancia una mecánica con materia prima concreta.

```
RoomNode {
  room_index      : int
  kind            : 'encounter' | 'branch' | 'treasure' | 'devil_deal' | 'boss'
  mechanic_id     : string | null   // null para treasure
  mechanic_config : object          // parámetros de la ficha técnica (post-ítems)
  content_ref     : { concept_ids: string[] }
  modifiers       : string[]        // ['J1'] cronómetro, ['G1'] apuesta previa...
  branch_options  : RoomNode[][] | null  // solo kind='branch': caminos alternativos
  reward_coins    : int             // base, antes de multiplicador
}
```

**Reglas de generación (heredan las restricciones de composición de `07_*` §4.3):**

1. **Escalado cognitivo coherente**: la run va de recuperación (familia A) → discriminación (B) → evocación/transferencia. Nunca al revés.
2. El boss es la mecánica cognitivamente más exigente disponible, con modificadores apilados (J1 + recompensa doble).
3. La bifurcación ofrece riesgo/recompensa: camino difícil (producción, más monedas) vs camino seguro (reconocimiento con cronómetro, menos monedas). **Ambos caminos trabajan los mismos concept_ids** — la elección es de experiencia, no de contenido.
4. El RNG (seed) decide: qué conceptos caen en qué sala, orden de opciones, qué ítem hay en el cofre. El selector pedagógico decide: qué familia de mecánica toca en cada slot. En el MVP el selector es una plantilla fija; en Fase 4 del plan lo reemplaza el selector adaptativo leyendo el perfil cognitivo.

## 3. Ítems

Los ítems son **mutadores de parámetros** de las fichas técnicas. No introducen lógica nueva en las mecánicas.

```
ItemDef {
  item_id      : string
  nombre       : string
  descripcion  : string
  tipo         : 'pasivo' | 'consumible'
  efecto       : ParamMutation | ActiveEffect
}
```

Catálogo inicial (v0.1):

| ID | Nombre | Tipo | Efecto |
|----|--------|------|--------|
| `reloj_arena` | Reloj de Arena | pasivo | `tiempo_limite_ms += 5000` en toda sala con J1 |
| `amuleto` | Amuleto de Reintento | consumible (auto) | `permitir_segunda_oportunidad = true` una vez |
| `lupa` | Lupa Reveladora | consumible (manual) | elimina 1 distractor no-caracterizado en mecánicas de opción cerrada |

Regla de diseño: **ningún ítem puede responder por el estudiante ni eliminar el distractor caracterizado** (el que encarna un repertorio, capa 3) — ese distractor es señal cognitiva valiosa y debe seguir disponible.

## 4. Economía y consecuencias

- Acierto: `+reward_coins × multiplier`, `streak += 1`.
- Error: `-1 heart`, `streak = 0`. El `MechanicOutput` se emite igual (el error es la señal más valiosa).
- `partial_score` entre 0 y 1 (ej: A2 COMPLETAR): monedas proporcionales; pierde corazón solo si `< 0.5`.
- **Devil deal (G1 APOSTAR como sala)**: antes de responder, el estudiante declara confianza apostando monedas. Acierto con apuesta alta: pago 2×. Error: pierde lo apostado. Emite señal `srl_calibracion` — es la sala donde enganche y pedagogía coinciden.
- Fin de run (boss superado o hearts = 0): pantalla de síntesis — conceptos trabajados, precisión por concepto, monedas totales. Es el gancho para la mecánica I4 REFLEXIONAR en versiones futuras.

## 5. Persistencia de señal

Toda mecánica emite `MechanicOutput` (schema universal, `08_*` §0) hacia un `EventSink`:

```
EventSink { emit(output: MechanicOutput): Promise<void> }
```

Implementaciones: `LocalEventSink` (MVP: localStorage + consola) → `SupabaseEventSink` (tabla `event_log`, siguiente iteración). La capa de juego persiste además `RunSummary` al cierre para la meta-progresión (códice de cartas por concepto).

## 6. Mecánicas jugables en MVP solo (sin Juez en runtime)

Sin llamadas LLM durante la partida: A1 RECONOCER, A2 COMPLETAR (permisividad sinónimo), A3 EVOCAR, B1 DISTINGUIR, B2 CLASIFICAR, E1/E3 variante cerrada, G1 APOSTAR, G4/G5 categorías cerradas. Implementadas en v0.1: **A1, B1, A3, G1**.

## 7. Roadmap de esta capa

1. ✅ v0.1 — run jugable: 4 mecánicas, 3 ítems, mapa con bifurcación y boss, sink local.
2. Conectar `SupabaseEventSink` + materia prima real desde el pipeline de extracción (backend HF).
3. Códice de cartas (meta-progresión leyendo matriz de comprensión).
4. Selector adaptativo reemplaza la plantilla fija de generación de mapa.
5. Segunda skin para validar ortogonalidad de la capa 3.

---

## 8. Modos de interacción (v0.2) — habilidad sin contaminar la señal

Cada mecánica del catálogo puede renderizarse en más de un **modo de interacción** (decisión de Capa 3). El contrato cognitivo (`MechanicOutput`) es idéntico entre modos: cambia la experiencia, no la señal.

| Modo | Qué es |
|------|--------|
| `cards` | Presentación clásica de tarjetas/botones (v0.1) |
| `arena` | Dinámica de acción: elementos en movimiento, puntería, timing |

**Regla de integridad de señal (central):**

> La habilidad motriz (puntería, timing, reflejos) modula la **recompensa** (monedas, críticos). El conocimiento (a qué le apuntaste, qué elegiste) decide **is_correct** y las señales cognitivas. Nunca al revés.

Consecuencias operativas:
- En Cacería (A1 arena), fallar el clic no existe como concepto: el clic sobre un slime ES la intención. `is_correct` = si el slime portaba el concepto correcto.
- En Combate (E3), la barra de timing produce un **crítico** que se reporta como `mechanic_specific.bonus_coins` — la Capa 2 lo suma a las monedas y jamás toca `partial_score`.
- Las arenas siempre llevan reloj: la presión temporal ES la dinámica (J1 encarnado en física — la lluvia que cae, los slimes que huyen).

## 9. Mapeo materia prima → entidades de juego

Esta tabla es la regla generalizable que evita el "quiz con sprites": cada capa del extractor se encarna como un tipo de entidad, no como una pregunta.

| Capa del extractor | Entidad de juego | Ejemplo implementado |
|---|---|---|
| Conceptos (capa 1) | Hechizos / habilidades del grimorio | E3: lanzar el concepto correcto |
| Relaciones (capa 2) | Hilos entre runas; combos (futuro) | C1: encontrar el hilo verdadero |
| Repertorios (capa 3) | Señuelos / mimics | A1: slime-señuelo que encarna la intuición |
| Argumentos (capa 4) | Duelos verbales (futuro, requiere Juez) | — |
| Casos (capa 5) | **Enemigos** — su debilidad es el concepto que los explica | E3: combate; B2: escenas a sellar |
| Meta-pedagógico (capa 6) | Consejos del tabernero / NPC guía (futuro) | — |

## 10. Constructor de runs y sorteo (decisión Y jugable)

El menú principal permite elegir qué piezas componen la run (de 1 a n) o sortearlas (`shuffleConfig` = el `ShuffleResult` del doc 08 §14, vuelto experiencia de jugador). Reglas del generador dinámico:

- Las piezas elegidas se **ordenan por rango de escalado cognitivo** (A=1, B=2, C=3, E=4). La run nunca retrocede (doc 07 §4.3).
- El **boss** siempre es la pieza de mayor rango seleccionada, con reloj.
- La **encrucijada** (con ≥2 piezas) ofrece la pieza más exigente (arriesgada, más monedas) vs la más básica con reloj (segura) — **mismo contenido en ambas puertas**.
- Cada pieza declara en el registro (`registry.ts`) qué capa de materia prima requiere; el generador solo le asigna contenido que la satisface. Si un curso no tiene una capa poblada, sus piezas se desactivan (regla del doc 07 §4.3).

Agregar una pieza nueva al juego = 1 entrada en `registry.ts` + 1 componente (+ variante arena opcional). Esa es la validación Lego en frontend.

---

## 11. v0.3 — El crawler: cada familia cognitiva es un verbo de juego

La v0.3 abandona las tarjetas como modo principal: La Expedición es ahora un
dungeon crawler en tiempo real (linaje Binding of Isaac / Soul Knight) con
personaje controlable, 5 mazmorras procedurales de 4-8 salas, minimapa que se
descubre, y jefe final en el piso 5.

**El principio que resuelve "más piezas ≠ más preguntas":** cada familia del
catálogo se encarna en un verbo físico distinto del crawler. Agregar una pieza
cambia CÓMO se juega, no cuántos tipos de pregunta hay.

| Familia | Verbo | Encarnación v0.3 |
|---|---|---|
| A Recuperación | APUNTAR | A1 salas de caza (dispara al slime del concepto); A2 puertas rúnicas (conocimiento = llave); A3 santuarios (invocar el término = bendición) |
| B Discriminación | ESQUIVAR / ATRAPAR | B1 espectros lanzan pares de orbes-enunciado: toca el verdadero, esquiva el falso — discriminar ES moverse; B2 altares de clasificación |
| C Relación | TEJER | C1 puentes de runas (a futuro: combos de conceptos relacionados) |
| E Transferencia | CAZAR JEFES | E3: élites y jefe SON casos de la capa 5; solo el concepto-hechizo que los explica los daña |
| G Calibración | APOSTARTE | G1 mesa del trato (el golpe rompe el trato); G2 profecía de entrada; G4 autopsia del error; G5 trofeos al cierre |
| I Regulación | DESCANSAR / PLANEAR | I4 fogatas: reflexionar cura y enfoca el piso siguiente en tu punto débil |
| Repertorios (capa 3) | MIMICS | cofres que se defienden con tu propia intuición errada |
| D Estructura / F Producción | CONSTRUIR / FORJAR | mapeadas en el registro; esperan al Juez LLM (backend) |

El registro (`registry.ts`) contiene el catálogo completo no-multijugador (30
piezas) con su `rol` en el juego y su `estado`: `jugable` (12 en v0.3),
`taller` (mapeada, pendiente) o `requiere_juez`.

## 12. Reglas del crawler que protegen la señal

1. **Contacto = habilidad, decisión = conocimiento.** Tocar a un enemigo quita
   corazones (esquivar mal es señal de destreza, no cognitiva). Las señales
   cognitivas solo salen de decisiones de conocimiento: a qué slime disparaste,
   qué orbe tocaste, qué hechizo lanzaste, qué palabra escribiste.
2. **Las salas de combate se cierran (🔒) hasta resolverse; las de minijuego y
   tesoro son opcionales** — la agencia de saltarse contenido es en sí una
   señal de regulación.
3. **El guantelete generaliza al jefe.** Si E3 no está en la run, el élite/jefe
   es un guantelete de la pieza primaria más exigente seleccionada, en rondas
   con barra de vida: cualquier composición Lego tiene final de piso.
4. **Errores dentro del calabozo son baratos** (rompen racha, dan señal); los
   corazones solo se pierden por contacto, orbes falsos y errores en guantelete.
   Morir = fin de la run, no castigo sobre el perfil.

## 13. Generación procedural

- `generateDungeon(materia, {pieces, seed})`: 5 pisos; cada piso hace un random
  walk en grilla de 4-8 celdas → salas conectadas ortogonalmente (el minimapa
  usa las mismas coordenadas). Sala 0 = entrada (o fogata I4 en pisos 2-5);
  última = élite (1-4) o jefe (5); un tesoro garantizado por piso; el resto se
  sortea del pool de tipos habilitados por las piezas elegidas (combate pesa 2×).
- Cada tipo de sala exige su capa de materia prima y el generador solo asigna
  conceptos que la satisfacen (puertas → fragmento, élites/jefe/altares → caso,
  puentes → relación, tesoros-mimic → repertorio).
- Misma semilla ⇒ misma expedición (validado en smoke).

---

## 14. v0.4 — Señales cognitivas de segunda generación

Dos principios nuevos gobiernan la captura de señal en tiempo real:

**P1 — El comportamiento ES señal.** El quiz captura *qué* respondiste; el
crawler captura *cómo*: `latencia_ms` (fluidez de recuperación),
`intentos_previos` (primer disparo vale delta 0.08, re-reconocimiento 0.03),
`tiempo_compromiso_ms` ante orbes (duda medida), `deliberacion_ms` leyendo el
caso del jefe, timeouts como evasión (delta débil, confianza 0.55). Nada de
esto interrumpe el juego: se mide del movimiento mismo.

**P2 — La presión modula la CONFIANZA, nunca la dirección.** Todo evento
cognitivo registra `presion` (básicos vivos + jefe activo) y su `confidence`
baja hasta 0.55 bajo caos: fallar rodeado de murciélagos quizás fue pánico;
fallar en calma es señal firme. El caos de Soul Knight no contamina el perfil
— lo matiza.

Capturas nuevas por familia:
- **A/anclaje — Ecos**: si un repertorio te hizo caer (señuelo, mimic), el
  concepto entra a `ecos` y REAPARECE en una cacería posterior. Superarlo emite
  `anclaje` −0.08 (intuición debilitada); recaer lo confirma (+0.1). El anclaje
  deja de ser una foto y se vuelve una serie temporal.
- **C1 en tiempo real**: pilares de runas + orbes-hilo orbitando; atrapar el
  hilo correcto teje el puente. El error distingue `tipo` vs
  `direccion_invertida` — dos malentendidos distintos de la misma relación.
- **E3 — ventana de vulnerabilidad**: el caso se lee MIENTRAS se esquivan
  ráfagas radiales; el hechizo correcto no mata: hace VULNERABLE (el
  conocimiento abre la puerta; el arma la cruza). El jefe llega tras 5
  mazmorras de 4-6 salas y pelea de verdad.
- **G4 cotejada**: la categoría de la autopsia se compara con la evidencia
  (`fui_muy_rapido` vs latencia real observada) → `coincide_con_evidencia`
  gradúa la confianza de la autorreflexión (0.9 vs 0.65).
- **I4 con opciones reales**: la fogata ofrece tus 4 conceptos objetivamente
  peores de la run; elegir el peor real marca `coincide_con_sistema`.
- **I3 jugable**: usar la Lupa emite PEDIR AYUDA con timing y contexto — señal
  `srl_accion` positiva, jamás penalizada (ficha I3).

## 15. Anatomía de sala (Soul Knight) y capa de armas

Toda sala de contenido tiene **piso de habilidad**: 3-5 rocas de cobertura
(bloquean cuerpos y proyectiles) + enemigos básicos (murciélagos que persiguen,
babosas errantes) que mueren al arma, pagan monedas y emiten CERO señal.
Encima va la capa cognitiva de la pieza. Los props (puerta/santuario/altar)
están sellados hasta despejar a los guardianes básicos. El tesoro es el único
respiro. Las armas (piedra inicial → honda → arco → varita, por tier de piso)
modifican daño/cadencia/velocidad SOLO contra básicos y ventanas de
vulnerabilidad: los objetivos etiquetados mueren por conocimiento (un impacto
correcto), nunca por estadísticas.

---

## 16. v0.5 — La economía del run como instrumento de calibración

Integra las olas 1 y 2 de la matriz de capturas (doc `09_matriz_capturas_roguelike.md`).
Ninguna pieza nueva: son capturas sobre contratos existentes.

**Calibración (G) hecha economía:**
- **G2 Contrato de piso** (reemplaza la profecía única): al pisar cada mazmorra
  declaras tu % de aciertos (90/70/50 o sin contrato); el portal lo revela (J9)
  y paga si cumpliste. Cinco `calibration_error` por run en vez de uno.
- **G3 Mirilla**: tasas al guardián ANTES de pelear (fácil/parejo/difícil);
  tu tasación fija la recompensa y el sistema coteja con tu historial real
  sobre esos conceptos (`ratio_historial`) — anti-gaming por diseño.
- **G4 Campamento post-muerte**: al morir eliges qué te mató (concepto/caos/
  apuesta/prisa); el sistema calcula su propio veredicto desde la evidencia
  conductual (errores en calma vs bajo presión, latencias, apuestas rotas) y
  emite `coincide_con_evidencia`. Tu elección forja una bendición persistente
  contra esa causa (localStorage → siguiente run): lupa/amuleto/botas/monedas.
- **G5 Mapa del cartógrafo**: en la síntesis marcas hasta 2 presas difíciles y
  el cartógrafo revela las suyas (tu tally real) → `calibration_error_retrospectivo`.

**Regulación (I) hecha navegación:**
- **I1 Ruta del explorador**: en cada portal eliges el siguiente piso — acero
  (más combate, guardián FEROZ con +vida y +botín) o peregrino (fogata y tesoro
  extra). Se registra `siguio_sugerencia` (✨ sugiere peregrino con ≤1 ♥).
- **I5 Curaduría del mazo**: en el portal eliges ≤3 conceptos que LLEVAS
  (botín ×1.5 al reencontrarlos); los descartados son la señal honesta de lo
  que consideras consolidado.
- **I2 Catalejo**: botón 🔭 en el HUD; cada consulta de progreso emite
  `revisiones_de_progreso` — instrumentar lo que el jugador ya hace.

**Transferencia y grafo:**
- **E3 Munición conceptual**: el combate de élite/jefe ya no es "hechizo abre
  ventana": eliges munición y TODOS tus disparos cargan ese concepto. Correcto
  = daño pleno; relacionado en el grafo = medio daño (`partial_score: 0.5`,
  transferencia cercana); ajeno = cero + contraataque. Una señal por munición
  por fase (el primer impacto es la afirmación).
- **J5 Combo semántico**: aciertos consecutivos de conceptos RELACIONADOS
  multiplican ×1.5 y emiten `relacion` implícita — se premia jugar el grafo.
- **Cobertura por piso**: el generador garantiza que ningún piso sea 100%
  combate si hay piezas de otras familias (riesgo §5.1 de la matriz).

---

## 17. v0.6 — Modo APRENDIZAJE: la bajada de pisos es el retiro del andamio

El mismo Lego, la misma mazmorra, distinta política (doc 00: el andamiaje es el
propósito; doc 01 §6: política de fading). El modo evaluación quita el soporte
desde la entrada (doc 05: la fricción es la mecánica). El modo aprendizaje
arranca con andamio alto y lo retira piso a piso — el descenso es el arco de
fading hecho espacio, definido en la tabla declarativa de `scaffold.ts`:

| Piso | Andamio | Qué cambia |
|---|---|---|
| 1-2 (nivel `alto`) | El Archivo 📚 (biblioteca: pergaminos del piso ANTES de cazarlos), 3 slimes, orbes ×0.65, sin señuelos, errores gratis (orbes falsos no hieren), Lupa gratis, hint tras 2 errores (el objetivo brilla) | exposición → práctica protegida |
| 3 (`medio`) | Señuelos-repertorio entran, 4 slimes, orbes ×0.85, errores cuestan; Archivo y Lupa gratis siguen | la intuición ya puede traicionarte |
| 4-5 (`retirado`) | Parámetros de evaluación completos | llegas al jefe sin andamio, pero preparado |

Reglas del marco implementadas:
- **Feedback que contextualiza, no corrige** (Test 4): al fallar, el banner
  nombra QUÉ golpeaste con su definición intuitiva; si fue señuelo, enuncia el
  repertorio activado ("útil en lo cotidiano — aquí buscabas otra cosa").
- **Re-scaffold** (doc 01 §6): 3 errores en un piso sin hint → el andamio
  regresa para ese piso, anunciado ("🪜 el archivo notó que te está costando").
- **Integridad de señal**: todo output lleva `modo` y `andamiaje`; el éxito
  asistido emite delta y confianza reducidos (`scaffoldSignal`: hint activo →
  delta ×0.4, confianza ×0.6). El selector adaptativo futuro sabrá qué logros
  fueron con muletas.
- **Práctica espaciada**: en aprendizaje TODO error re-encola el concepto (el
  sistema de ecos generalizado) — reaparece salas después.
- **Leer no es saber**: el Archivo emite un evento de EXPOSICIÓN con
  `cognitive_signals: []` — la lectura no es evidencia de comprensión.
- La fogata I4 en aprendizaje muestra la ficha del concepto elegido
  (consolidación, no solo cura).
