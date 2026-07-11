# La Expedición — Motor de runs roguelite

Modo de repaso individual de la **Plataforma EdTech — Scaffolding con Gamificación**. Runs tipo roguelite (referencia: The Binding of Isaac) construidas sobre el catálogo de mecánicas Lego (`docs 07/08` del proyecto principal).

**Principio rector:** la suerte varía el envoltorio y las recompensas; nunca la oportunidad de aprender. El RNG (semilla) decide qué conceptos caen en qué sala, ítems y skins. La plantilla pedagógica decide qué dimensión cognitiva se trabaja.

## Arquitectura (3 capas)

```
src/
  game-core/     CAPA 2 · Juego — sin React, testeable en Node
    types.ts       Contratos: MechanicOutput universal, RunState, RoomNode, ítems
    rng.ts         RNG sembrado (mulberry32) — misma seed = misma run
    runGenerator.ts  Genera el mapa (plantilla pedagógica + RNG)
    engine.ts      Reducer puro: economía, corazones, racha, ítems
    items.ts       Catálogo de ítems (mutadores de parámetros)
    eventLog.ts    EventSink (localStorage → Supabase en la siguiente iteración)
  mechanics/     CAPA 1 · Mecánicas del catálogo — no conocen la run
    A1Reconocer.tsx / A1Caceria.tsx   A1 en cards y arena
    A2Completar.tsx                    A2 COMPLETAR (fragmento con blank)
    A3Evocar.tsx                       A3 EVOCAR
    B1Distinguir.tsx / B1Lluvia.tsx    B1 en cards y arena
    B2Clasificar.tsx                   B2 CLASIFICAR (casos → conceptos)
    C1Conectar.tsx                     C1 CONECTAR (relaciones, capa 2)
    E3Aplicar.tsx                      E3 APLICAR (combate: el enemigo ES un caso)
    G1Apostar.tsx                      G1 APOSTAR (wrapper — "devil deal")
  theme/         CAPA 3 · Skin "Calabozo" (pixel art CSS)
    GameRunner.tsx   Orquestador: renderiza salas, completa el envelope MechanicOutput
    Hud.tsx, MapTrail.tsx, Timer.tsx
  data/
    materiaPrima.ts  Curso demo (confianza en IA) — misma forma que emite el pipeline
docs/
  09_capa_de_juego.md  Especificación de esta capa (RunState, ítems, generación)
scripts/
  smoke.ts        Pruebas de humo del motor sin UI
```

La estructura de una run: `A1 entrada → B1 espejos → bifurcación (A3 arriesgado / A1+J1 seguro) → cofre → devil deal (G1∘B1) → boss (A3+J1)`. Toda mecánica emite el `MechanicOutput` universal del doc `08 §0` hacia el `event_log`.

## Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
npx tsx scripts/smoke.ts   # pruebas del motor sin UI
```

## Despliegue

1. **GitHub**: este repo → `https://github.com/Aguacate20/EdTechGame.git`
2. **Vercel**: importar el repo (framework: Next.js, sin configuración extra). Todo es estático + cliente; no requiere variables de entorno todavía.

## v0.6 — Modo Aprendizaje

- **Dos modos, mismo Lego**: 🪜 Aprender (andamio alto que se retira piso a piso — el descenso es el fading) y ⚔ Evaluar (fricción desde la entrada). Selector en el menú.
- **El Archivo 📚**: biblioteca al inicio de los pisos 1-3 con los pergaminos del piso (definición formal, intuitiva y caso). Leer emite exposición, no comprensión.
- **Feedback que contextualiza**: fallar nombra qué golpeaste y qué repertorio activaste. **Re-scaffold** si el piso te cuesta. **Errores re-encolan** (práctica espaciada). Señal modulada por nivel de andamio (`scaffold.ts`).
- Ver `docs/09` §17.

## v0.5 — Olas 1+2 de la matriz de capturas

- **Calibración como economía**: contrato de piso (G2, 5 calibraciones/run), mirilla pre-guardián cotejada con tu historial (G3), campamento post-muerte con veredicto por evidencia + bendición persistente (G4), mapa del cartógrafo en la síntesis (G5).
- **Regulación como navegación**: ruta del explorador en cada portal (I1, acero feroz vs peregrino), curaduría del mazo ≤3 conceptos con buff ×1.5 (I5), catalejo 🔭 que instrumenta consultar el progreso (I2).
- **Munición conceptual (E3)**: eliges el concepto que disparas; el relacionado en el grafo hace medio daño; el ajeno, contraataque. Una señal por munición por fase.
- **Combo semántico (J5)** y **cobertura de señal por piso** en el generador.
- Ver `docs/09` §16 y `docs/09_matriz_capturas_roguelike.md`.

## v0.4 — Soul Knight + señales de segunda generación

- **Anatomía de sala**: rocas de cobertura + enemigos básicos (piso de habilidad puro: mueren al arma, dan monedas, cero señal) en casi toda sala; la capa cognitiva de cada pieza va encima. Props sellados por guardianes.
- **Armas**: naces con piedras; los tesoros alternan armas por tier (honda→arco→varita) e ítems. Las armas jamás tocan la señal: los objetivos etiquetados mueren por conocimiento.
- **Jefe real**: 5 mazmorras de 4-6 salas; el caso se lee esquivando ráfagas radiales; el hechizo correcto abre una ventana de vulnerabilidad que se cruza a disparos. Fases con casos distintos.
- **Señales v2**: latencia/intentos/deliberación medidos del movimiento; la presión modula la confianza (nunca la dirección); ecos de anclaje (tu intuición fallida reaparece); C1 en tiempo real con error tipo-vs-dirección; G4 cotejada con evidencia; I4 sobre tus peores conceptos reales; I3 (Lupa) emite pedir-ayuda. Ver `docs/09` §14-15.
- Overlays ahora son modales sobre el escenario siempre montado (fix del bug de pantalla incompleta) + fallback de altura mínima.

## v0.3 — Dungeon crawler en tiempo real

- **Un solo modo: el calabozo.** Personaje controlable (WASD/flechas + D-pad táctil), disparo con click, contacto enemigo = daño con i-frames y knockback. 5 mazmorras procedurales de 4-8 salas conectadas, minimapa estilo Isaac que se descubre al explorar, jefe final en el piso 5.
- **Cada familia = un verbo de juego** (ver `docs/09` §11): A=apuntar (caza, puertas, santuarios), B=esquivar/atrapar (espectros de orbes, altares), C=tejer (puentes de runas), E=cazar jefes (los casos SON los enemigos), G=apostarte (trato, profecía, autopsia, trofeos), I=descansar (fogatas que curan y enfocan). Los repertorios son mimics.
- **Catálogo completo mapeado**: 30 piezas no-multijugador en `registry.ts` con su rol de juego; 12 jugables hoy, el resto marcadas `taller` o `requiere_juez` (visibles en el menú, en gris).
- **Guantelete**: si E3 no está en la run, el élite/jefe se pelea con la pieza más exigente que sí elegiste, en rondas con barra de vida — cualquier combinación Lego tiene final de piso.
- Integridad de señal reforzada: corazones = habilidad (esquivar); señal cognitiva = decisiones de conocimiento. Nada más.

## v0.2 — Piezas Lego jugables + arenas de acción

- **7 piezas** del catálogo implementadas: A1, A2, A3, B1, B2, C1, E3 (todas las jugables sin Juez con capas 1/2/3/5).
- **Menú constructor**: arma la run con 1 a n piezas, o usa 🎲 Sorteo (la decisión Y del doc 08 §14, jugable). Valida la propiedad Lego: un juego con una sola pieza funciona; uno con las 7 también.
- **Modos de interacción**: `cards` (clásico) y `arena` (acción) — Cacería de slimes (A1), Lluvia de enunciados (B1), Combate de hechizos con timing crítico (E3).
- **Mapeo materia prima → entidades**: conceptos = hechizos, casos (capa 5) = enemigos, repertorios (capa 3) = señuelos, relaciones (capa 2) = hilos entre runas. Ver `docs/09` §9.
- **Regla de integridad de señal**: la habilidad (timing, puntería) modula la recompensa; el conocimiento decide `is_correct`. Un crítico da monedas, nunca cambia la señal cognitiva.
- Sprites pixel art propios dibujados en CSS (`box-shadow`), sin assets externos.

## Roadmap

- [ ] `SupabaseEventSink`: persistir `MechanicOutput` en la tabla `event_log`
- [ ] Cargar materia prima real desde el backend de extracción (HF Space) por `course_id`
- [ ] Códice de cartas: meta-progresión leyendo la matriz de comprensión
- [ ] Selector adaptativo reemplaza la plantilla fija del generador
- [ ] Combos de relaciones (capa 2) en combate; duelos de argumentos (capa 4, requiere Juez)
