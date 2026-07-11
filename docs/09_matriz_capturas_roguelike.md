# Matriz de Capturas Roguelike

> Versión 0.1. Mapeo completo entre las 30 mecánicas no-sociales del catálogo (`07_*`, `08_*`, `registry.ts`) y **formas de captura roguelike**: skins de juego que emiten la misma señal cognitiva sin interrumpir el verbo.
> Asume el principio ya establecido en La Expedición: *cada familia cognitiva es un verbo de juego distinto*. Este documento lo extiende: *cada mecánica admite varios verbos*, y la diversidad de verbos es lo que evita que el dungeon se sienta como un quiz con sprites.

---

## 0. Convenciones de lectura

Cada mecánica tiene **2-3 capturas** clasificadas por su *modo de juego*:

| Modo | Qué es | Inspiración madre |
|---|---|---|
| 🗡️ **Acción** | La señal se emite moviéndose, apuntando, esquivando. Cero pausa. | Isaac, Soul Knight, NecroDancer |
| 🎲 **Economía/Riesgo** | La señal se emite gastando, apostando, eligiendo bajo escasez. | Isaac (devil deals), Darkest Dungeon, Balatro |
| 🧩 **Espacial/Puzzle** | La señal se emite colocando, organizando, resolviendo en el espacio. | Backpack Hero, Into the Breach, Loop Hero |
| 🔥 **Diegético pausado** | La señal requiere texto/reflexión; vive en espacios donde detenerse es natural. | Hades (campamento), FTL (pausa), fogatas |

**Regla de oro heredada del análisis**: capturar la señal *en* el verbo, nunca pausando el verbo. Las mecánicas `requiere_juez` (texto libre) van SIEMPRE en modo 🔥 — nunca en medio del combate.

**Columna "Costo"**: alineada con los estados de `registry.ts` — `jugable` (corrección automática, implementable ya), `taller` (necesita diseño de interacción nueva), `juez` (requiere rol 3 del LLM).

---

## 1. Inventario de señales cognitivas

### 1.1 Señales actuales (enum de `cognitive_signals.dimension`)

`recuperacion` · `relacion` · `transferencia` · `produccion` · `anclaje` · `srl_planeacion` · `srl_accion` · `srl_autorreflexion` · `engagement` (+ `calibration_error` como derivada de G1/G2).

### 1.2 Señal nueva propuesta: `automatizacion`

**Qué mide**: fluidez de recuperación — la diferencia entre *saber* (respuesta correcta con deliberación) y *tener consolidado* (respuesta correcta sin esfuerzo aparente). Hoy `duration_ms` la insinúa pero no la formaliza.

**Por qué merece ser dimensión y no solo latencia cruda**: la latencia solo es interpretable con línea base personal y bajo un tempo controlado. Las capturas rítmicas (NecroDancer) crean exactamente esa condición: el beat normaliza el tiempo esperado, así que "respondió en compás" vs. "perdió el beat pero acertó" es una medición limpia de fluidez, no de velocidad de lectura.

**Prueba del andamio (doc 00, implicación 1)**: el selector adaptativo la usa para decidir *fading temporal* — solo aprieta J1 (cronómetro/tempo) sobre conceptos con `automatizacion` alta; un concepto con `recuperacion` alta pero `automatizacion` baja recibe más repetición espaciada, no más presión. Sin esta señal, el fading temporal es ciego.

**Emisión**: `{dimension: 'automatizacion', target: concept_id, delta: f(respondió_en_beat, latencia_vs_baseline), confidence: alta solo en skins de tempo}`.

### 1.3 Propuestas evaluadas y resueltas como *atributos*, no dimensiones

Estas ideas surgieron del análisis pero **no** pasan limpias la prueba del andamio como dimensiones nuevas; se incorporan como cualificadores dentro del envelope existente:

- **`autoseleccion_de_reto`** (antorcha, pactos, herederos): es señal valiosa pero el motor adaptativo ya decide con `srl_planeacion`. Se registra como `mechanic_specific.reto_elegido` + delta sobre `srl_planeacion`. Crear dimensión aparte duplicaría la decisión.
- **`distancia_de_transferencia`** (caso cercano vs. lejano al corpus): cualifica la señal `transferencia`, no es otra señal. Se agrega campo opcional `target_distance: float` al objeto de `cognitive_signals` (viene de `distancia_en_grafo` o del dominio del caso). Permite al selector distinguir transferencia cercana consolidada de transferencia lejana pendiente.
- **`persistencia` / tolerancia al error**: descartada por ahora — huele a "métrica por métrica" (doc 00): no hay decisión adaptativa clara que la consuma y se reconstruye desde `errors[]` + reintentos si algún día hace falta.

---

## 2. Matriz maestra — Familias primarias

### Familia A — Recuperación (verbo base: **apuntar**)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **A1 RECONOCER** | **Tiro al blanco** (actual): dianas con opciones, disparas la correcta; distractores caracterizados brillan distinto tras error | 🗡️ | La puntería ES la elección; `duration_ms` viene del tiempo hasta el disparo | Isaac / Soul Knight | `recuperacion` + `anclaje` si eligió distractor caracterizado | jugable |
| | **Poción no identificada**: artefacto sin nombre cuyo efecto dramatiza la definición al usarlo; para *equiparlo* eliges su identidad entre 4 pergaminos | 🎲 | Identificar tras observar el efecto = reconocimiento con evidencia; equivocarse hace que el ítem se comporte como el repertorio erróneo (consecuencia mecánica, no ❌ rojo) | NetHack / Isaac | `recuperacion` + `anclaje` con `confidence` alta (hubo evidencia) | taller |
| | **Diana rítmica**: las dianas aparecen al beat; acertar en compás mantiene el combo | 🗡️ | Único skin que emite `automatizacion` limpia: en-beat vs. fuera-de-beat con acierto | Crypt of the NecroDancer | `recuperacion` + `automatizacion` | taller |
| **A2 COMPLETAR** | **Puente de tablones**: cada blank es un tablón faltante; colocas la palabra correcta de un montón para cruzar; tablón falso cruje y cae (daño leve) | 🧩 | Cada tablón = un blank del envelope; `modo_aceptacion` visible en el material del tablón | Zelda-likes / Isaac (puentes) | `recuperacion` por concepto del fragmento | jugable |
| | **Conjuro interrumpido**: un hechizo del corpus con runas faltantes; completarlo lo lanza contra el enemigo de la sala (fragmento correcto = daño proporcional a `partial_score`) | 🗡️ | El texto se vuelve munición; permisividad (exact/sinónimo) = potencia del hechizo | Noita | `recuperacion` | taller |
| **A3 EVOCAR** | **Bautizar el artefacto**: tras ver el efecto de un ítem, escribir su nombre lo *bindea* permanentemente (con `edit_distance_2` de tolerancia) | 🎲 | El input de texto tiene recompensa diegética: ítem sin bautizar se pierde al morir | Isaac + tradición de identificación | `recuperacion` (producción > reconocimiento) | jugable |
| | **Contraseña del guardián**: la puerta recita la definición; tecleas el término con un tempo suave de fondo | 🗡️ | Latencia contra beat de fondo → `automatizacion` secundaria | NecroDancer (suave) | `recuperacion` + `automatizacion` | jugable |
| **A4 DEFINIR** | **Mercader de sabiduría**: el mercader compra "explicaciones"; escribes la definición, el Juez la tasa y paga oro proporcional a `judge_evaluation.score` | 🔥 | Vender es voluntario y repetible; el precio hace visible la rúbrica sin mostrarla | Mercaderes de Isaac/Soul Knight | `recuperacion` + `produccion` + `anclaje` si el Juez detecta repertorio | juez |
| | **Estela del jefe**: tras vencer un jefe-concepto, inscribes su definición en la estela para reclamar el trofeo (momento de adrenalina baja natural) | 🔥 | Post-combate = pausa diegética; el trofeo queda en el campamento con tu texto | Hades (trofeos narrativos) | `recuperacion` + `produccion` | juez |

### Familia B — Discriminación (verbo base: **esquivar/atrapar**)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **B1 DISTINGUIR** | **Proyectiles gemelos** (actual): dos enunciados vuelan; atrapas el verdadero, esquivas el falso | 🗡️ | Atrapar/esquivar = elección binaria + posición corporal como confianza implícita (atrapa de frente vs. dudó) | Isaac (patrones de balas) | `recuperacion` + `relacion` | jugable |
| | **Puertas gemelas**: dos puertas con un enunciado cada una; tras la falsa hay un mimic-repertorio | 🎲 | La elección tiene consecuencia espacial; el mimic ES el repertorio de capa 3 (patrón ya establecido en La Expedición) | Isaac (curse rooms) | `recuperacion` + `anclaje` | jugable |
| | **Duelo al compás**: pares encadenados (`n_pares: 1→5`) que alternan al beat; el combo multiplica | 🗡️ | Cadena de pares + tempo = `automatizacion` sobre discriminación | NecroDancer + J5 | `recuperacion` + `relacion` + `automatizacion` | taller |
| **B2 CLASIFICAR** | **Pastoreo**: criaturas-caso deambulan por la sala; las empujas físicamente a corrales-concepto | 🧩 | La `matriz_confusion` sale de a qué corral empujó cada criatura; el pastoreo es táctil, no dropdown | Everything is Crab (ecosistema vivo) | `recuperacion` + `relacion` por concepto | taller |
| | **Cinta y palancas**: los items pasan en cinta transportadora; accionas palancas para desviarlos a canales-concepto; la velocidad de la cinta es el fading de J1 | 🗡️ | Clasificación bajo flujo continuo; errores visibles al final de la cinta (J9 natural) | Factorio-likes / minijuegos de Isaac | `recuperacion` + `relacion` + `automatizacion` (a cinta rápida) | taller |
| **B3 TAGGEAR** | **Linterna de aceite**: un mural/pasaje del corpus en la pared; iluminas y marcas dónde se manifiesta el concepto; cada marca gasta aceite | 🎲 | El costo de aceite convierte precision/recall en decisión estratégica: marcar todo = quedarse a oscuras (F1 del envelope intacto) | Darkest Dungeon (antorcha) + J4 | `recuperacion` + `transferencia` | taller |
| | **Rastreo de huellas**: el texto es el suelo de un corredor; caminas sobre él y plantas banderines donde "pasó" el concepto | 🧩 | Marcar caminando integra el taggeo al desplazamiento normal del dungeon | Juegos de rastreo (Witcher-likes) | `recuperacion` + `transferencia` | taller |

### Familia C — Relación (verbo base: **tejer puentes de runas**)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **C1 CONECTAR** | **Puente de runas** (actual): el tipo de relación es el tipo de runa; un puente mal tejido se rompe al cruzarlo (caída = daño leve + reveal del tipo gold) | 🗡️🧩 | `distancia_semantica` mapea a cuánto aguanta el puente antes de romper (primo cercano = cruje, lejano = colapsa) | La Expedición (ya diseñado) + Death Stranding | `relacion[par]` | jugable |
| | **Circuito de pilares**: conectar dos pilares con el cable del tipo correcto abre la puerta; cable equivocado da feedback eléctrico proporcional a la distancia semántica | 🧩 | Igual contrato que el puente, estética alternativa para variedad entre pisos | Into the Breach (circuitos) | `relacion[par]` | jugable |
| **C2 ORDENAR** | **Plataformas ascendentes**: los conceptos son plataformas; saltarlas en el orden correcto te eleva a la salida; orden malo te devuelve al inicio con las `inversiones` marcadas | 🗡️🧩 | El orden se declara con el cuerpo (recorrido), no con drag-drop; `scaffold_inicial_pct` = plataformas ya iluminadas | Celeste-likes / NecroDancer | `relacion` + `transferencia` (si causal) | taller |
| | **Ritual de velas**: encender velas-evento en secuencia causal; secuencia errada invoca un minion menor (el error pelea contigo, literalmente) | 🎲 | Cada inversión tiene costo inmediato y temático | Isaac (rituales) | `relacion` + `transferencia` | jugable |
| **C3 AGRUPAR** | **Constelaciones**: sala-observatorio; arrastras estrellas-concepto en el cielo; los clusters correctos se encienden como constelación (ARI visible como brillo) | 🧩 | Agrupación libre con feedback estético continuo; `permitir_etiquetar_grupos` = nombrar la constelación | Observatorios de Hades/Isaac | `relacion[cluster]` (+ mini-F4 si nombra) | taller |
| | **Biomas**: sueltas criaturas-concepto en biomas del terrario; las que comparten cluster real prosperan juntas, las mal ubicadas enferman | 🧩 | El ecosistema da feedback de cluster sin mostrar el gold (las criaturas "votan" con su salud) | Everything is Crab | `relacion[cluster]` | taller |
| **C4 MAPEAR** | **El piso es el mapa**: la sala entera es el plano 2D con ejes en las paredes; cargas cada tótem-concepto caminando y lo plantas donde crees | 🧩🗡️ | La posición emerge del desplazamiento; `concept_id_mas_desviado` = el tótem que tiembla al cerrar | Superliminal / salas de puzzle | `relacion` (atributos abstractos) | taller |
| | **Catapulta de precisión**: lanzas el concepto a la región del mapa-diana; puntería = posición declarada | 🗡️ | Reusa el verbo "apuntar" de la familia A con semántica de C4 (economía de assets) | Angry Birds-likes | `relacion` | taller |
| **C5 CONTRASTAR** | **Forja de gemelos**: ante dos estatuas-concepto, grabas similitudes en el pedestal común y diferencias en cada estatua; el Juez tasa y la mejor estatua te da su bendición (buff temático) | 🔥 | Espacio de altar = pausa natural para texto; la rúbrica (cobertura/precision/profundidad) paga en calidad del buff | Altares de Isaac / Hades (boons) | `relacion` + `produccion` | juez |

### Familia D — Estructura (verbo base: **construir**)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **D1 CONSTRUIR** | **Mochila espacial**: los conceptos son ítems con forma; colocarlos *adyacentes* en el inventario activa sinergias solo si la arista existe en el grafo gold de capa 2 (bono real de stats) | 🧩 | El estudiante construye el grafo por avaricia, no por obligación; cada reorganización emite F1 sobre aristas — el envelope de D1 intacto, sin mostrar jamás un "mapa conceptual" | Backpack Hero | `relacion` estructural, señal continua durante todo el run | taller ⭐ |
| | **Campamento**: entre pisos, conectas edificios-concepto con caminos tipados; conexiones correctas dan buffs de campamento persistentes | 🔥🧩 | Versión pausada y acumulativa de D1: el grafo crece run tras run (meta-progresión = conocimiento) | Hades (casa) / Darkest Dungeon (aldea) | `relacion` estructural | taller |
| **D2 EXTENDER** | **Injerto evolutivo**: un concepto nuevo = una mutación; eliges a qué parte del cuerpo-build la conectas; conexión válida (arista real) = la mutación funciona, inválida = *fizzle* visual | 🧩🎲 | La exclusión de caminos evolutivos fuerza decidir DÓNDE integra el concepto nuevo — exactamente lo que D2 mide | Everything is Crab | `relacion[concepto_nuevo]` | taller |
| | **Nueva ala del minimapa**: al descubrir un concepto, decides a qué salas del minimapa conceptual se conecta; el mapa progresivo (ya implementado) se vuelve doble: espacial y semántico | 🧩 | Reusa el minimapa existente de La Expedición como superficie de señal | La Expedición (minimapa) + Loop Hero | `relacion` | taller |
| **D3 CRITICAR** | **Grafo corrupto**: un mapa infectado en la sala; golpear aristas corruptas las purga (con razón elegida en menú radial rápido), golpear aristas sanas te daña (falsos positivos con costo) | 🗡️🧩 | precision/recall del envelope sale de qué golpeó; el daño por falso positivo hace que "marcar todo" no sea estrategia | Into the Breach (puzzle de consecuencias) | `relacion` + `transferencia` | taller |
| | **Mimic estructural**: el cofre real está detrás del grafo bien criticado; errores no detectados = el cofre es mimic | 🎲 | Extiende el patrón mimic=repertorio ya establecido, ahora a nivel de estructura | La Expedición (mimics) + Isaac | `relacion` + `transferencia` + `anclaje` | taller |

### Familia E — Transferencia (verbo base: **cazar jefes** — los enemigos SON casos de capa 5)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **E1 PREDECIR** | **Intents telegrafiados**: el enemigo-caso "carga" un escenario visible 3s; tu posicionamiento antes de que ejecute ES la predicción (pararte en la baldosa "canasta" vs "caja") | 🗡️ | Predicción capturada en movimiento puro, cero UI de pregunta; acierto = esquiva perfecta/parry con recompensa | Slay the Spire (intents) ⭐ | `transferencia` (+ `target_distance` según el caso) | taller ⭐ |
| | **Apuesta del oráculo**: el oráculo muestra un escenario congelado; apuestas moneda a un desenlace y ves el replay animado (J9 integrado) | 🎲 | Formato cerrado de E1 con calibración implícita en el tamaño de la apuesta | Isaac (máquinas de apuestas) | `transferencia` + `srl_planeacion` | jugable |
| **E2 DIAGNOSTICAR** | **Punto débil del jefe** (actual): el jefe-caso tiene el error embebido como núcleo entre `n_errores_plausibles` nodos brillantes; solo dañarlo en el error real funciona | 🗡️ | Ya es el diseño de La Expedición: transfer = boss hunting; la razón se pide en el menú radial al golpear | La Expedición / Shadow of the Colossus | `transferencia` + `relacion` | taller |
| | **Máquina averiada**: un argumento-máquina no funciona; localizas la pieza defectuosa y eliges por qué falla; repararla abre la puerta | 🧩 | E2 como puzzle determinista con undo limitado (I3 integrado) | Into the Breach / FTL (reparaciones) | `transferencia` + `relacion` | taller |
| **E3 APLICAR** | **Munición conceptual**: tu arma cambia entre conceptos (rueda de selección); el enemigo-caso solo recibe daño del concepto que lo explica; concepto de cluster cercano hace medio daño (`partial_score: 0.5`) | 🗡️ | Piedra-papel-tijera semántico: elegir munición ES aplicar el concepto; `distancia_en_grafo` = daño parcial | Soul Knight (armas) + Isaac | `transferencia` amplia | taller ⭐ |
| | **La llave correcta**: el caso es una cerradura que narra su situación; tu llavero son los conceptos del universo; llave cercana gira a medias | 🧩 | Versión calmada del mismo contrato para salas no-combate | Zelda-likes | `transferencia` | jugable |
| **E4 GENERAR EJEMPLO** | **Taller de especímenes**: en la forja, describes un caso propio del concepto; si el Juez lo valida (aplicabilidad+originalidad), se convierte en *compañero/summon* del run | 🔥 | El ejemplo original literalmente pelea contigo — producción con recompensa persistente máxima | Noita (crafteo de varitas) + Isaac (familiares) | `transferencia` + `produccion` | juez ⭐ |
| | **Cebo para mimic**: escribes un caso; si instancia bien el concepto, atrae y neutraliza al mimic-repertorio de la sala | 🔥🎲 | Conecta E4 con el sistema de mimics existente: el buen ejemplo desactiva el malentendido | La Expedición (mimics) | `transferencia` + `produccion` | juez |
| **E5 RESOLVER** | **Sala sellada**: puzzle determinista que exige combinar 2+ conceptos-herramienta para abrir; un rebobinado disponible por sala | 🧩 | Información perfecta + consecuencias encadenadas; el uso del rebobinado emite `srl_accion` (I3 integrado) | Into the Breach ⭐ | `transferencia` + `relacion` (+ `srl_accion`) | taller |
| | **Contrato del gremio**: aceptas un problema complejo en el mercader, lo resuelves en la fogata (texto/pasos), lo cobras al cerrar el piso | 🔥 | Problema largo distribuido en los espacios pausados del run — nunca interrumpe combate | FTL (misiones) / Darkest Dungeon | `transferencia` + `relacion` + `produccion` | juez |

### Familia F — Producción (toda requiere Juez → vive SIEMPRE en modo 🔥, encarnada en NPCs)

El hallazgo del análisis: F no necesita verbos de acción — necesita **interlocutores diegéticos**. Cada NPC del dungeon es una mecánica F disfrazada.

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **F1 EXPLICAR** | **El prisionero rescatado**: liberas a un NPC que "no entiende dónde está"; explicarle el concepto (con `audiencia` según el NPC: niño perdido, erudito escéptico) lo convierte en aliado del run | 🔥 | La audiencia del parámetro se encarna en el personaje; buena explicación = aliado más fuerte | Hades (NPCs) / Soul Knight (mercenarios) | `produccion` | juez |
| **F2 ARGUMENTAR** | **El tribunal del mini-boss**: el mini-jefe "acusa" una tesis de capa 4; defenderla con N argumentos carga tu ataque especial para la pelea que sigue | 🔥→🗡️ | El texto precede y potencia el combate: argumentar bien se siente en el DPS | Griftlands (combate por negociación) | `produccion` | juez |
| **F3 REFUTAR** | **El Abogado del Diablo**: un espectro recita una tesis defectuosa en loop; solo una refutación válida lo disipa (J10 hecho enemigo) | 🔥 | El contraataque del catálogo convertido en criatura; refutación débil = el espectro responde (segunda ronda natural) | Hades (Tánatos) + J10 | `produccion` + `transferencia` | juez |
| **F4 REFORMULAR** | **El espejo distorsionado**: la puerta-espejo repite tu frase; solo te deja pasar si dices lo mismo "con otra cara" (divergencia léxica medida, semántica preservada) | 🔥 | La métrica de paráfrasis (similitud semántica + divergencia léxica) es automática — este es el F más barato | Puzzles de espejos clásicos | `produccion` | jugable* |
| **F5 TRADUCIR** | **El aldeano de otro reino**: traduces el pergamino técnico al registro del NPC; si "entiende" (Juez valida cambio de registro + precisión), comercia contigo con descuento | 🔥 | Registros y audiencias como reinos/razas del dungeon; el descuento hace repetible la mecánica | Mercaderes de Isaac + F5 | `produccion` + `transferencia` | juez |

*F4 puede correr con embeddings sin Juez completo si la similitud semántica se calcula localmente.

### Familia G — Calibración (verbo base: **apostar** — la familia más roguelike de todas)

Principio rector del análisis: *la apuesta con moneda del juego hace honesta la calibración*. Toda G se implementa sobre la economía del run, nunca como slider aislado.

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **G1 APOSTAR** | **Devil deal** (actual): antes de una sala/reto, apuestas HP u oro a tu desempeño; pagar con vida hace la confianza sincera | 🎲 | `confidence_declared` = tamaño de la apuesta normalizado; nadie apuesta 5/5 por cortesía cuando cuesta un corazón | Isaac (devil deals) | `srl_planeacion` → `calibration_error` | jugable |
| | **Doble o nada de cofres**: tras acertar, el cofre ofrece duplicar si aciertas la siguiente del mismo concepto | 🎲 | Calibración encadenada (G1+J5): cuándo se retira el estudiante = autoconocimiento del límite | Balatro / juegos de azar de Isaac | `srl_planeacion` + `calibration_error` | jugable |
| **G2 ESTIMAR** | **Contrato de piso**: al entrar al piso, declaras "lo cierro con X% de aciertos / sin daño en salas conceptuales"; cumplirlo paga multiplicador de botín al cierre | 🎲 | Estimación global con stake real y horizonte largo; el reveal al cierre del piso es J9 natural | Hades (Pact of Punishment) + Isaac (challenges) ⭐ | `srl_planeacion` + `calibration_error` global | jugable ⭐ |
| **G3 ANTICIPAR DIFICULTAD** | **La mirilla del explorador**: antes de abrir una puerta, ves la silueta del reto y tasas su dificultad; tasarlo difícil y superarlo paga más; tasarlo fácil y fallar duele | 🎲 | La anticipación fija la recompensa ANTES del intento — anti-gaming por diseño (declarar todo difícil no paga si era fácil: el sistema compara con dificultad real del ítem) | Darkest Dungeon (scouting) | `srl_planeacion` | jugable |
| | **Condicionantes por botín**: activas voluntariamente restricciones ("distractores sutiles", "sin hints") a cambio de +% de recompensa | 🎲 | Autoselección de reto = declaración anticipada de dónde el estudiante cree que está su frontera | Hades (Pact) / Isaac (curses voluntarios) | `srl_planeacion` + `mechanic_specific.reto_elegido` | jugable |
| **G4 EXPLICAR ERROR PROPIO** | **El campamento post-muerte**: al morir, en el campamento eliges la lápida — "qué me mató": ¿el concepto?, ¿la presión?, ¿la mala apuesta? La elección desbloquea una mejora persistente *contra esa causa* | 🔥 | La muerte como ritual de regreso, no castigo; la categoría elegida alimenta directamente al selector adaptativo (si dice "presión" y el sistema ve concepto débil → discrepancia = señal de autoconocimiento) | Hades (muerte narrativa) ⭐ | `srl_autorreflexion` | jugable ⭐ |
| **G5 MARCAR DIFICULTAD** | **El mapa del cartógrafo**: al cerrar el piso, marcas en el minimapa las salas-concepto que te costaron; luego el mapa revela las marcas del "cartógrafo" (el sistema) y compara | 🔥🎲 | Reusa el minimapa progresivo existente; la comparación estudiante-vs-sistema es J9 y produce el `calibration_error` retrospectivo | La Expedición (minimapa) + J9 | `srl_autorreflexion` | jugable |

### Familia I — Regulación (verbo base: **descansar/navegar** — fogatas y mapa)

| Mec. | Captura | Modo | Cómo emite la señal | Inspiración | Señales | Costo |
|---|---|---|---|---|---|---|
| **I1 PLANEAR** | **La ruta del explorador**: el interpiso es un mapa ramificado donde cada nodo declara su tipo (combate-concepto, tesoro, fogata, élite); elegir la ruta ES el plan de sesión | 🧩 | `plan_inicial` = la ruta trazada; `siguio_sugerencia_sistema` = si tomó el camino que brilla; los desvíos son `ajustes_a_la_ruta` | Slay the Spire (mapa) ⭐ | `srl_planeacion` | jugable ⭐ |
| | **Arquitecto del piso**: colocas cartas-sala para componer tu propio piso siguiente (qué conceptos, cuántas fogatas, dónde el reto) | 🧩 | Planeación como construcción: el estudiante diseña su propia dificultad | Loop Hero | `srl_planeacion` | taller |
| **I2 MONITOREAR** | **Pausa táctica**: botón de "tiempo bala" con usos limitados por piso; congela la sala y muestra el estado | 🗡️🔥 | Cada uso emite `pausas_voluntarias` con contexto (ante qué ítem, con cuánta vida); la pausa se siente inteligente, no lenta | FTL (pausa) | `srl_accion` | jugable |
| | **El catalejo**: consultar el minimapa/grafo en medio del piso cuenta como `revisiones_de_progreso` (señal pasiva ya emitible) | 🧩 | Cero fricción: instrumentar lo que el jugador ya hace | La Expedición (minimapa) | `srl_accion` | jugable |
| **I3 PEDIR AYUDA** | **El rebobinado**: un undo por sala-puzzle; usarlo no penaliza, se registra timing y contexto | 🧩 | Pedir ayuda con dignidad: es una herramienta estratégica, no una confesión | Into the Breach ⭐ | `srl_accion` | jugable |
| | **El familiar consejero**: una mascota que da hints tipados (`recordar_definicion`, `eliminar_distractor`...) a cambio de comida encontrada en el piso | 🎲 | J4 diegético: el costo del hint es un recurso que también sirve para curarte → decisión real | Isaac (familiares) | `srl_accion` | jugable |
| **I4 REFLEXIONAR** | **La fogata** (actual, extendida): descansar cura, pero la curación completa requiere el ritual — marcar qué quedó claro / qué sigue confuso (checkbox → frase libre con fading) | 🔥 | La curación ES la reflexión: incentivo perfecto sin coerción (puedes irte a media vida) | Darkest Dungeon / Hades + La Expedición | `srl_autorreflexion` | jugable |
| **I5 CONSOLIDAR** | **Curaduría del mazo**: al cerrar el piso, eliges qué 3 conceptos "llevas" al siguiente (buffs activos) y cuáles descartas | 🎲🧩 | El descarte es la señal: qué considera consolidado vs. qué sigue cargando — más honesto que cualquier checkbox | Slay the Spire (remover cartas) ⭐ | `srl_autorreflexion` + `relacion` | jugable |
| | **El sello del piso**: forjar el trofeo del piso = armar `bullet_principal_y_3_apoyos` con fragmentos ganados; el sello queda como ítem pasivo del run | 🔥 | Consolidación con formato scaffoldeado y recompensa persistente | Trofeos de Hades | `produccion` + `srl_autorreflexion` | juez |

---

## 3. Matriz de modificadores J → sistemas roguelike

| Mod. | Sistema roguelike | Cómo funciona | Inspiración | Nota |
|---|---|---|---|---|
| **J1 CRONÓMETRO** | **Tempo musical** / lava que sube / antorcha que se consume | El tiempo límite como beat, marea o combustible — nunca como reloj digital que juzga | NecroDancer / Isaac | Habilita `automatizacion`; fading = subir BPM |
| **J2 STAKES PÚBLICOS** | — | Fuera de alcance en el juego individual | — | Reservado para modo social futuro |
| **J3 RANKING** | **Fantasmas de runs pasados** | Compites contra tu propio fantasma (ghost data): el run anterior corre en paralelo semitransparente | Racing games / speedrun ghosts | Convierte ranking en competencia intra-personal — sin costo social, coherente con doc 05 |
| **J4 COSTO DE RECURSO** | **Aceite, corazones, munición, comida** | Cada recurso del run puede ser la moneda de una decisión cognitiva (marcar, apostar, pedir hint) | Isaac / Darkest Dungeon | El J más transversal: aparece en B3, G1, I3 |
| **J5 CADENA** | **Combo semántico** | Encadenar aciertos de conceptos del *mismo cluster* multiplica más que aciertos inconexos | Balatro (mult) ⭐ | Recompensa jugar el grafo, no la racha bruta; emite `relacion` implícita |
| **J6/J7/J8** | — | Cooperativo/competitivo/anónimo: fuera del alcance individual | — | Nota: J6 asíncrono ("mapa colectivo" del curso) es viable a futuro sin co-presencia |
| **J9 CICLO REVELACIÓN** | **Cofre post-sala / replay del oráculo / mapa del cartógrafo** | Todo reveal es un objeto que se abre, no una pantalla de resultados | Isaac (cofres) / Hades | El cliffhanger micro ya es idioma nativo del género |
| **J10 CONTRAATAQUE** | **Segunda fase del jefe / el Abogado del Diablo** | Tras tu respuesta, el enemigo "muta" atacando el punto débil de tu argumento | Fases de jefes / Griftlands | F2→J10→F3 = pelea de jefe de 3 fases completa |

---

## 4. Matriz de espacios del dungeon × mecánicas que albergan

El dungeon como arquitectura de captura: cada tipo de sala es un contenedor natural para ciertas familias. Esto permite que el generador procedural garantice cobertura de señales por piso (extensión natural del sistema de gauntlet ya implementado).

| Espacio | Mecánicas nativas | Modo dominante | Señales del espacio |
|---|---|---|---|
| **Sala de combate** | A1, B1, E1, E2, E3 | 🗡️ | recuperacion, transferencia, automatizacion |
| **Sala rítmica** | A1, A3, B1, C2 (variantes de tempo) | 🗡️ | automatizacion ⭐ (única fuente confiable) |
| **Sala-puzzle sellada** | C1, C2, C4, D3, E5 + I3 (rebobinado) | 🧩 | relacion, transferencia, srl_accion |
| **Tesoro / cofres** | A1 (poción no identificada), A3 (bautizar), G1 (doble o nada) | 🎲 | recuperacion, calibration_error |
| **Sala mimic** | B1 (puertas), D3 (estructural), E4 (cebo) | 🎲 | anclaje ⭐ (los mimics SON repertorios) |
| **Devil deal / altar** | G1, G3, C5 (forja de gemelos) | 🎲🔥 | srl_planeacion, calibration_error |
| **Fogata** | I4, I2, E5 (contrato), G5 | 🔥 | srl_autorreflexion |
| **Mercader** | A4 (vender definiciones), F5 (traducir), E5 (contratos), I3 (comprar hints) | 🔥 | produccion |
| **Taller / forja** | E4 (especímenes), I5 (sello), D2 (injertos) | 🔥🧩 | transferencia, produccion |
| **Observatorio** | C3 (constelaciones), C4 (mapeo) | 🧩 | relacion |
| **Jefe** | E2 (punto débil), F2→J10→F3 (tribunal de 3 fases), A4 (estela post-jefe) | 🗡️🔥 | transferencia ⭐, produccion |
| **Campamento post-muerte** | G4, I4, D1 (campamento) | 🔥 | srl_autorreflexion ⭐ |
| **Mapa interpiso** | I1 (ruta), I5 (curaduría), G2 (contrato de piso) | 🧩🎲 | srl_planeacion ⭐ |
| **Inventario (siempre activo)** | D1 (mochila espacial) | 🧩 | relacion continua ⭐ |

**Lectura clave**: la mochila espacial y el mapa interpiso son los dos únicos espacios que emiten señal *fuera de las salas* — señal de fondo continua durante todo el run. Son la mayor palanca de densidad de datos por minuto de juego.

---

## 5. Cobertura, huecos y prioridades

### 5.1 Cobertura por señal

| Señal | # capturas | Estado |
|---|---|---|
| `recuperacion` | 12+ | Sobrada — riesgo de sobre-representación en el sorteo |
| `relacion` | 11+ | Sobrada, con la novedad de señal continua (mochila) |
| `transferencia` | 10 | Buena — y es LA métrica última (doc 00, implicación 4) |
| `produccion` | 7 | Suficiente, toda en modo 🔥 (correcto) |
| `anclaje` | 5 | Concentrada en mimics y distractores caracterizados — coherente |
| `srl_planeacion` | 6 | Transformada: de formularios a economía del run |
| `srl_accion` | 4 | Suficiente (mucha es pasiva/gratis) |
| `srl_autorreflexion` | 5 | Bien anclada en muerte/fogata/cierre |
| `automatizacion` (nueva) | 4 | Solo en salas rítmicas y cinta — por diseño (necesita tempo controlado) |
| `engagement` | pasiva | Se deriva de telemetría (salas opcionales visitadas, re-runs) |

### 5.2 Recomendación de secuencia (⭐ del documento)

1. **G2 Contrato de piso + G4 Campamento post-muerte** — `jugable` hoy, cero Juez, tocan la tesis central (calibración honesta + muerte como metacognición) y se montan sobre sistemas que ya existen (pisos, muerte).
2. **I1 Ruta del explorador + I5 Curaduría del mazo** — `jugable`, convierten el interpiso (que ya existe como transición) en superficie de señal SRL.
3. **D1 Mochila espacial** — `taller` pero es la idea de mayor densidad de señal por minuto; prototipo aislado antes de integrar.
4. **E1 Intents + E3 Munición conceptual** — `taller`, profundizan el verbo de caza de jefes ya establecido.
5. **La antorcha-scaffold** (transversal, no es una mecánica del catálogo sino la encarnación de la política de fading del doc 00 §5) — diseñarla cuando 1-4 estén estables, porque modula a todas.

### 5.3 Nota para el registry

Ninguna captura de este documento crea una pieza nueva: son **skins de captura** sobre los contratos existentes. Sugerencia de esquema: agregar a `registry.ts` un campo `capturas: Array<{skin_id, modo, estado}>` por pieza, de modo que el generador procedural elija skin según el tipo de sala disponible — misma pieza, mismo envelope, verbo distinto por piso. Eso preserva el principio Lego y le da al jugador la sensación de variedad sin duplicar lógica de señal.
