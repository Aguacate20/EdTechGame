# El Archivo Infinito — v3.3

Roguelike deckbuilder cognitivo. Consume el `bundle.json` del extractor como materia
prima y lo convierte en una expedición jugable: rutas, encuentros, mazo de verbos,
apuestas de confianza y un Atlas que persiste entre partidas.

Sustituye al explorador de mazmorras anterior. El repositorio se reconstruye desde cero.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:5173
```

En la pantalla de carga hay tres caminos:

1. **Traer del backend** — pega la URL del extractor y tu ID de estudiante.
   Si el backend bloquea al navegador por CORS, usa la opción 2.
2. **Subir `bundle.json` a mano** — el archivo se lee en el navegador, no se sube a ningún lado.
3. **Bundle de muestra** — 12 conceptos, 16 aristas, 75 ítems. Sirve para jugar sin backend.

Antes de entrar, el juego muestra **qué sostiene ese texto y qué no**. Esa tabla no es
decorativa: si una capa falta, el encuentro que dependía de ella no aparece en la rotación.

```bash
npm run smoke        # simula 15 expediciones sin navegador
npm run build        # producción -> dist/
npm run demo:bundle  # regenera public/bundles/demo.json
```

---

## Las cinco reglas que no se negocian

1. **El daño nunca está impreso en la carta.** Se calcula después de comprobar la
   afirmación. Si se puede optimizar sin leer, el juego falló.
2. **La build modula la recompensa, nunca la corrección.** Ninguna carta, instrumento
   o apuesta entra en la función que decide si acertaste. La potencia sale de la
   estrategia; la señal cognitiva, solo de la decisión de conocimiento.
3. **La mano se reparte después de elegir el ítem.** No existe la mano muerta: las
   opciones que trae el ítem precompilado son las cartas que se ponen sobre la mesa.
4. **Improvisar siempre está permitido.** Si no tienes el verbo adecuado puedes
   responder igual, con mucha menos recompensa. Nunca te bloqueas; sí pagas.
5. **Perder no borra el Atlas.** La expedición se pierde; la evidencia se conserva.

`npm run smoke` verifica la regla 1 de forma automática: un bot que siempre elige la
primera opción y otro que responde al azar deben perder todas las expediciones.

---

## Arquitectura

```
src/
  content/
    types.ts        formas normalizadas (el motor no conoce el JSON crudo)
    adapter.ts      bundle del extractor -> Contenido, con lectores tolerantes
  engine/
    rng.ts          RNG por semilla: misma semilla, misma ruta
    cards.ts        catálogo de verbos e instrumentos
    encounters.ts   arquetipos, condiciones y constructores de embate por mecánica
    boss.ts         fase final del jefe a partir de tesis y marcos rivales
    combat.ts       máquina de combate, modelo de daño y resolución
    run.ts          generación de ruta, actos y recompensas
    atlas.ts        persistencia del Atlas y registro de señales
  ui/               pantallas (carga, mapa, combate, recompensa, refugio, Atlas)
```

### Tres mazos, no uno

| Mazo | Contiene | Quién decide |
|---|---|---|
| Contenido | conceptos y relaciones del bundle | el currículo: llega al avanzar por la ruta |
| Operaciones | verbos (Definir, Conectar, Transferir, Refutar…) | el jugador: aquí está el deckbuilding |
| Instrumentos | reliquias y condiciones | el jugador, con contrapartida |

Resuelve la tensión de fondo: en un deckbuilder lo divertido es especializarse, pero
en educación no puedes esquivar contenido. Se especializa el **cómo piensas**, no el
**qué te tocó**.

### De campo del bundle a sistema de juego

| Campo | Sistema | Si falta |
|---|---|---|
| `concepts` | cartas de concepto, peso del daño | no hay juego |
| `graph.por_tipo` / `adyacencia` | EL ESPEJO, Atlas, rareza de relación | sin encuentros de relación |
| `graph.ejes` | EL ARQUITECTO | sale de la rotación |
| `graph.clusters` | biomas | los actos salen solo de las unidades |
| `carga_cognitiva` | qué condición aplica cada nodo | los combates van sin condición |
| `distractor_pools` | opciones sobre la mesa y feedback | menos opciones, feedback más pobre |
| `content.repertoires` | EL ECO | ese enemigo no aparece |
| `content.scenarios.distancia` | portales cercano/medio/lejano | se repite el mismo peldaño |
| `content.theses` + criterios | jefe EL MARCO | el jefe cae a un encuentro de relación |
| `study_plan.unidades` + curva | actos, tamaño de mano, andamiaje | acto único |
| `capabilities.condiciones` | qué condiciones son instanciables | se deducen de la carga cognitiva |

### La carga cognitiva se vuelve mecánica

La causa de dificultad del nodo elige la condición del combate:

| `carga_cognitiva` | Condición | Efecto |
|---|---|---|
| `memorizar` | Mano corta | menos cartas por turno |
| `discriminar` | Enjambre | todas las opciones plausibles que el texto sostiene |
| `inferir` | Niebla | la dificultad del embate queda oculta |
| `integrar` | Cadena | cada embate parte del concepto donde terminó el anterior |

Si el bundle declara `capabilities.condiciones`, esa lista manda sobre la deducción.

### B1 se juega como atribución

Los ítems de discriminación no se presentan como verdadero/falso: una moneda al aire
da 50 % a quien no lee. Se pregunta **de qué concepto habla realmente la afirmación**,
y la respuesta correcta se deriva del propio ítem —`concept_id` si la afirmación es
verdadera, `concepto_confundido` si es falsa— con los vecinos del grafo como distractores.

### El Atlas

La metaprogresión no son números mayores: es el mapa conceptual que el jugador
reconstruyó jugando. Cada vínculo que sostiene se dibuja; cada concepto sube de nivel
cuando acumula aciertos **desde mecánicas distintas**, no por repetición. La misma
pantalla sirve de resultados, de material de repaso y de panel docente, y cada nodo
conserva sus páginas de origen.

Se guarda en `localStorage`, con clave por fuente: cambiar de texto no mezcla Atlas.

### Señales

El botón **Señales** exporta el registro de la sesión en JSON: ítem, mecánica,
conceptos, verbo jugado, si improvisó, selección, acierto, apuesta declarada,
calibración, latencia, ayuda pedida y repertorio tocado. Es el insumo para conectar
con Supabase sin cambiar nada del juego.

---

## Conectar con la plataforma

Hoy el juego es cliente puro. Los tres puntos de enganche están aislados a propósito:

- **Entrada**: `adaptarBundle()` en `src/content/adapter.ts`.
- **Salida**: `registrar()` en `src/engine/atlas.ts` — cambiar el cuerpo por un POST.
- **Persistencia**: `cargarAtlas` / `guardarAtlas`, hoy contra `localStorage`.

---

## Pendientes conocidos

- `E2 DIAGNOSTICAR`, `A4`, `C5` y la familia F completa necesitan juez de texto abierto.
- `C4 MAPEAR` tiene los ejes leídos pero todavía no un tablero propio: EL ARQUITECTO
  usa `B2` mientras tanto.
- La familia H (colaborar) requiere un segundo estudiante; la dimensión `persistencia`
  no es medible en solitario.
- Ver `docs/PEGLIN.md` para el tablero de tiradas propuesto para v3.4.
