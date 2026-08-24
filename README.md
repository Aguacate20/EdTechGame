# El Archivo Infinito — v4.1

Roguelike de **diagramas**. No hay preguntas: hay materiales y herramientas.
Consume el `bundle.json` del extractor y lo convierte en un tablero libre donde el
jugador afirma cosas sobre el texto, y lo que afirma le hace daño a lo que se le acerca.

v4 cambia el átomo del juego. En v3 había un enunciado y opciones (un quiz con capas).
Ahora el átomo es **componer un diagrama y que el sistema lo evalúe en cascada**.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:5173
npm run smoke        # simula 12 expediciones sin navegador
npm run build
```

Tres formas de cargar contenido: traerlo del backend del extractor, subir el
`bundle.json` a mano, o el bundle de muestra incluido. Antes de entrar, el juego
muestra qué sostiene ese texto y qué no.

---

## Cómo se juega

**Arriba, el carril.** Tu personaje a la izquierda; los enemigos entran por la derecha
y avanzan una casilla (o dos, o saltan) cada vez que tú afirmas algo. Cuando llegan a
su alcance, golpean.

**Abajo, el tablero libre.** Arrastras piezas y las relacionas con herramientas.
Pulsas *Afirmar el diagrama* y todo se evalúa contra el grafo del texto:
`fichas × multiplicador = daño`. Un diagrama sencillo hace 20; uno bien articulado, 400.

El daño **nunca** se conoce antes de resolver, y el alcance depende de cuántas
afirmaciones sostengas: la complejidad de lo que dices es su alcance en el carril.

### Las doce herramientas cognitivas

| | Herramienta | Afirma | Señal |
|---|---|---|---|
| `=` | Identidad | que este nombre y esta descripción son lo mismo | recuperación |
| `→` | Flecha | que existe este vínculo, con este tipo y esta dirección | relación |
| `◯` | Campo semántico | que todo lo encerrado pertenece a la misma zona | estructura |
| `⊃` | Jerarquía | que el primero es la categoría que contiene al segundo | estructura |
| `⊢` | Eje | que todo esto cae en el mismo extremo de un eje del dominio | relación |
| `⇢` | Secuencia | que esto ocurre en este orden, cada paso llevando al siguiente | estructura |
| `⌖` | Ancla | que estos conceptos son los que operan en este caso | transferencia |
| `⚖` | Balanza | que esto es lo que obligaría a revisar la tesis | producción |

| `⊘` | Contraejemplo | que este concepto NO opera en este caso, aunque lo parezca |
| `≈` | Analogía | que A es a B lo que C es a D, en zonas distintas del texto |
| `⊣` | Alcance | que lo primero solo vale bajo la condición que pone lo segundo |
| `⊟` | Descomposición | que lo primero se compone de las partes que siguen |

Las cuatro últimas cubren lo que faltaba: **falsar**, **analogizar**, **acotar** y
**descomponer**. El Contraejemplo solo puntúa si el concepto era candidato plausible
—vecino de lo que sí opera en el caso—: negar algo que nadie habría afirmado no
demuestra nada. La Analogía es la jugada más difícil y la única que mide transferencia
estructural, y triplica si los dos pares viven en zonas distintas del texto. El Alcance
usa las aristas `matiza` y el campo `tensiones`, que estaban sin usar.

La discriminación se mide también en el pozo: **quemar** afirma que la carta es falsa.

Las herramientas son **el mazo del jugador**: se acumulan, se gastan por turno y son
lo que define tu estilo. El contenido lo reparte el currículo.

### Las piezas no tienen tipo rígido

Cada carta declara **roles**, no una clase cerrada. Un criterio de refutación puede
usarse como nodo suelto de una flecha; un marco teórico puede usarse como campo
semántico. La flexibilidad no viene de tener muchos tipos, viene de que cada pieza
diga qué papeles admite.

Y el título y la definición **viajan en cartas separadas**. Emparejarlas con la
Identidad es la jugada más sencilla del juego y la puerta de entrada del novato — y
cuando aciertas, las dos cartas se **fusionan** en un concepto completo para el resto
de la expedición. El mazo mejora al aprender.

Entre las piezas se cuelan **apócrifas**: el título de un concepto con la definición de
otro, sacadas del propio grafo de vecindad. Nadie te pregunta si son falsas: tienes que
notarlo. Si la usas como nodo, el diagrama entero se derrumba.

### La escalera de veredictos

El juego **no puede exigir memoria de etiquetas**. Puede exigir que lo que afirmas sea
verdad. Por eso un vínculo no se juzga como acierto o error, sino en una escalera:

| Veredicto | Cuándo | Crédito |
|---|---|---|
| **Sostenido** | el texto lo dice, con ese tipo y esa dirección | completo |
| **Equivalente** | forma dual o simétrica (`generaliza`↔`ejemplifica`, `contrasta`) | completo |
| **Derivado** | no lo dice, pero **se sigue** de dos vínculos que sí están | 70% y se marca como inferencia |
| **Aproximado** | el vínculo existe; tu tipo es de la misma familia | 50% |
| **Plausible** | vecino común o misma zona del texto, sin camino | 18%, sin castigo |
| **Mudo** | nada | cero, sin castigo |
| **Invertido** | el texto dice lo contrario, con un tipo que sí tiene dirección | castigo |

`contrasta` es simétrica: afirmarla en cualquier dirección vale igual.
`generaliza` y `ejemplifica` son duales: decir *A generaliza B* o *B ejemplifica A* es
la misma afirmación. `apoya`, `extiende` y `matiza` son una familia; confundirlas es
impreciso, no falso. Solo `causa`, `requiere`, `generaliza` y `ejemplifica` castigan al
invertirse, porque ahí la dirección **es** la afirmación.

**Derivado** es lo que convierte el juego en razonamiento y no en recuerdo: si trazas
*A → C* y el texto tiene *A → B → C*, el juego responde «no lo dice directamente, pero
se sigue», te da crédito y lo registra como inferencia. El Atlas, en cambio, solo recoge
lo que el texto afirma literalmente.

### Las apócrifas ya no derrumban el diagrama

Una falsificación corrompe la **identidad**, no la **relación**. Si la usas en una
flecha, el vínculo se evalúa igual sobre el concepto que la titula, con una reserva
anotada y una pérdida de rendimiento — pero el diagrama sigue en pie.

Y hay una segunda oportunidad: si la relación que trazaste es cierta del **dueño real de
esa descripción**, el juego te lo dice y te da el crédito. Razonaste por contenido en
vez de por etiqueta, y eso merece premio, no castigo.

### La corrección ocurre sobre tu propio diagrama

Al resolver, el tablero **se queda en pantalla**. Cada trazo recibe su marca (`✓`, `≈`,
`~`, `↺`) y su color; los derivados se dibujan con línea larga y los plausibles con
puntos. Tocas un trazo y lees por qué. El feedback deja de ser una lista de párrafos
sueltos y vuelve al lugar donde el estudiante pensó.

### Los combos son la adicción

Salen de que varios trazos **compartan piezas**, no de una lista de recetas:

- **Articulación** — una pieza sostiene tres afirmaciones a la vez
- **Cierre** — un campo que además está tejido por dentro con flechas
- **Doble registro** — un concepto identificado *y* enlazado en el mismo diagrama
- **Constelación** — cuatro afirmaciones sostenidas sin un solo error
- **Refutación completa** — balanza más el campo del marco al que responde
- **Traducción** — un caso anclado cuyos conceptos además están definidos
- **Coherencia** — todo el diagrama del mismo tipo de vínculo

### El pozo: dos gestos, cuatro resultados, dos señales

| | La carta era falsa | La carta era legítima |
|---|---|---|
| **Quemar** «esto es falso» | acierto de discriminación | destruyes material bueno |
| **Cambiar** «es cierto, aquí no me sirve» | no la notaste | gestión de mano (regulación) |

Es la fuente de señal más barata y más rica del juego: el mismo botón dice cosas
distintas de ti según lo que estabas tirando.

### Las lentes dicen qué buscar en el texto

Son los jokers. La *Lente del disidente* multiplica los contrastes y anula los apoyos:
una run con ella te convierte en alguien que caza oposiciones en el paper. La *Lente
del topógrafo* premia campos y jerarquías. **La build es un plan de lectura**, y cada
partida te hace leer el mismo texto con otros ojos.

### El carril: once enemigos

| Enemigo | Avanza | Alcance | Rasgo |
|---|---|---|---|
| El Copista | 1 | cuerpo a cuerpo | base |
| La Errata | 2 | cuerpo a cuerpo | frágil y rápida |
| El Rumor | no avanza | todo el carril | te alcanza siempre |
| El Apócrifo | 1 | cuerpo a cuerpo | deja falsificaciones en tu mazo |
| La Nota al Pie | 1 | 2 | no hiere: se lleva cartas de tu mano |
| El Dogma | 1 | 2 | solo lo hieren diagramas de 2+ afirmaciones |
| El Eco | 1 | cuerpo a cuerpo | retrocede en vez de caer; deja intuiciones |
| La Cita Descontextualizada | 1 (+2 salto) | cuerpo a cuerpo | salta cada dos turnos |
| El Palimpsesto | 1 | cuerpo a cuerpo | se cura si no lo tocas |
| La Bibliografía | 1 | cuerpo a cuerpo | al caer se divide en dos |
| La Ortodoxia | 1 | 2 | solo cede ante cierres y contrastes |
| El Tratado (jefe) | no avanza | todo el carril | exige una jugada distinta por fase |

Las oleadas se compran con un **presupuesto de amenaza** que crece por acto: una
casilla ligera del acto 1 son dos Copistas; una dura del acto 3 puede ser Dogma +
Errata + Rumor.

---

## Las reglas que no se negocian

1. **El daño nunca está impreso.** Se calcula después de comprobar el diagrama.
2. **Las lentes y los blindajes modulan la recompensa, nunca la corrección.** Se puede
   acertar y no herir, porque ese enemigo pide otra clase de trabajo.
3. **Lo que el texto no dice no castiga.** Silencio ≠ error. Solo la inversión de un
   tipo direccional y el tachón injusto duelen.
   Y **nunca se exige recordar la etiqueta exacta**: la escalera da crédito a quien
   acierta el vínculo aunque falle el matiz.
4. **Perder no borra el Atlas.** La expedición se pierde; la evidencia se conserva.
5. **Nunca te bloqueas.** Si nada encaja, cambiar cartas es barato y siempre disponible.

`npm run smoke` verifica esto: un bot que traza al azar tiene que perder las doce
expediciones, quien lee tiene que ganarlas casi todas, y las nueve herramientas y los
combos tienen que ser instanciables sobre el bundle. Si algo se rompe, el script falla.

---

## Arquitectura

```
src/
  content/
    types.ts        formas normalizadas
    adapter.ts      bundle del extractor -> Contenido, con lectores tolerantes
  engine/
    weapons.ts      qué arma resulta de cada diagrama
    graph.ts        semántica del grafo: simetrías, duales, familias y derivaciones
    pieces.ts       una sola forma de carta con roles; fábricas desde el bundle
    tools.ts        las nueve herramientas, su validación, los combos y el marcador
    powers.ts       22 lentes pasivas y 6 sellos activos
    economy.ts      la tinta y las ofertas de El Archivo
    lane.ts         el carril, los once enemigos y el presupuesto de oleada
    battle.ts       tablero, trazos, pozo y turno del carril
    route.ts        grafo de rutas ramificado y recompensas
    objectives.ts   planes de expedición y sellado de unidades
    atlas.ts        Atlas persistente y registro de señales
    export.ts       edición crítica en markdown
    rng.ts          RNG por semilla
  ui/
    LaneView.tsx    el carril horizontal
    BoardView.tsx   el tablero libre, las herramientas y el pozo
    Screens.tsx     plan, grafo, recompensa, refugio, Atlas y cierre
```

### Qué campo del bundle alimenta qué

| Campo | Se convierte en |
|---|---|
| `concepts.titulo` / `definicion_corta` | cartas de Nombre y Descripción separadas |
| `graph.por_tipo` / `adyacencia` | la verdad contra la que se valida cada flecha |
| `graph.clusters` | campos semánticos |
| `graph.ejes` | la herramienta Eje |
| aristas `generaliza` / `requiere` | Jerarquía y Secuencia |
| `distractor_pools` (vecindad) | las cartas apócrifas |
| `content.cases` / `scenarios` | cartas de Caso y el Ancla |
| `content.theses` + criterios | Balanza y el jefe |
| `content.frameworks` | cartas de Marco usables como campo |
| `content.repertoires` | Intuiciones que se reubican contrastándolas |
| `concepts.subdimensiones` | atributos colocables en un eje |
| `study_plan.unidades` | actos y sellado |

**Nota honesta:** v4 valida contra el grafo y las capas de contenido, no contra
`items`. Los 278 ítems precompilados ya no se consumen — la corrección sale de las
aristas y de los campos de contenido. Eso simplifica el contrato y hace el juego
independiente del compilador de ítems, pero conviene decidir si el extractor debe
seguir produciéndolos.

---

## Pendientes

- Sello de confianza sobre el diagrama completo (calibración explícita, G1/G2).
- Reserva de una pieza entre turnos (señal de planeación).
- Familia H (colaborar) requiere un segundo estudiante.
- `docs/PEGLIN.md` describe la Mesa de Tiradas, que sigue sin implementar y que ahora
  encaja mejor: las clavijas serían las piezas del tablero.### El modo Aprendizaje

Se activa al salir de expedición, y no es un modo fácil: es **otra vía al mismo sitio**.

- Los conceptos que nunca has tocado llegan **enteros** (nombre y descripción juntos)
  en vez de partidos: primero se aprende qué es algo, después se pone a prueba.
- Las falsificaciones llegan **señaladas** en los dos primeros actos.
- La expedición **no se pierde**: la lucidez no baja de 1. Pierdes tiempo, no el intento.

Y la decisión importante: **la evidencia con andamio cuenta, pero queda marcada**. El
Atlas guarda cuántos aciertos fueron con apoyo, y el nivel «lo dominas» exige **al menos
uno sin andamio**. El estudiante ve «lo sostienes, pero siempre con ayuda», que es
información honesta y además motivadora.

### El tutorial

Siempre disponible desde el inicio. Un bundle sintético de diez conceptos —abejas,
flores, murciélagos, ecolocalización— construido con **la misma forma que emite el
extractor**, así que pasa por el mismo adaptador y el mismo motor: no hay un camino de
código especial que pueda quedar sin probar. Lo que se aprende es la mecánica, no el
tema.

### El alto en el camino

El refugio dejó de ser un botón de curar. Ahora hace **una pregunta sobre ti**: cuál de
estos conceptos se te está resistiendo más, cuál ya tienes firme, o qué vínculo trazaste
antes entre dos conceptos. El juego compara tu respuesta con lo que el Atlas sabe de
verdad y te lo enseña. Acertar sobre uno mismo paga más lucidez; fallar también informa,
porque te enseña que te estabas leyendo mal.

### El Atlas es la pantalla de inicio

No hay menú ni pantalla de planeación. Se entra al Atlas, que es **el modelo cognitivo
del estudiante hecho visible**: cuánto lleva cubierto, qué conceptos domina, cuáles
sostiene, cuáles se le resisten y cuáles no ha tocado. Una barra de proporciones arriba
y el detalle concepto a concepto debajo, con la evidencia real al pasar el ratón
(aciertos, fallos, herramientas distintas, vecindades distintas).

De ahí sale la propuesta de la siguiente expedición: si hay conceptos que se le
resisten, eso es lo que se le pone delante; si no, terreno nuevo; si ya está todo
tocado, consolidar.

### Lo que se conserva entre expediciones

El progreso vive en el Atlas, no en la partida: **lentes, sellos, herramientas,
vínculos descubiertos y terrenos ganados se quedan**. Cada expedición se empieza más
fuerte — y el carril escala con las que llevas a la espalda, así que la dificultad
sube contigo.

### Los vínculos se descubren derribando enemigos

Se arranca sabiendo trazar solo **apoya** y **contrasta**. Cada enemigo que cae revela
un tipo de vínculo nuevo del texto, empezando por los más escasos, que son los que más
rinden. En la simulación se pasa de 2 a 7 de los 8 disponibles a lo largo de una
expedición.

Las relaciones son de donde sale la información cognitiva, así que conviene que se
ganen jugando en vez de estar todas disponibles desde el minuto uno.

### Cada herramienta dispara distinto

El ataque ya no es un número que baja: es un proyectil con forma propia, y la forma
depende de con qué pensaste.

| Herramienta o vínculo | Arma |
|---|---|
| `apoya` | perdigón limpio |
| `causa` | descarga que atraviesa |
| `requiere` | gancho que salta |
| `contrasta` | tenaza: dos impactos a la vez |
| `generaliza` | onda expansiva |
| `ejemplifica` | lluvia de impactos |
| `extiende` | barrido lateral |
| Identidad | maza pesada de un solo blanco |
| Campo | onda circular |
| Secuencia | gancho encadenado, el más lento |
| Balanza | sello: crítico único y contundente |

**Combinar herramientas transforma el arma**: dos distintas la refuerzan, tres o más
disparan una *Constelación*. Y el número del daño crece con el golpe: por encima de
250 estalla en dorado. Las animaciones van entre 600 y 1200 ms a propósito, para que se
entienda qué pasó.

### Trazar es leer una frase

Al elegir una herramienta se abre un panel: a la izquierda el primer concepto, a la
derecha el segundo, y en medio el conector escrito —*es*, *contiene a*, *vale bajo*,
*no opera en*, *se compone de*, o el tipo de vínculo elegido. Se lee como una frase
antes de trazarla, que era donde estaba la confusión.

### Cuerpo y filo

El marcador nunca anticipa el número, pero sí de dónde sale la fuerza: dos barras,
**cuerpo** (cuánto material verdadero sostienes) y **filo** (cuánto lo amplifican los
vínculos escasos, los conceptos umbral, los combos y las lentes). Al resolver, la cuenta
lleva esas mismas dos etiquetas, así que la relación entre lo que hiciste y lo que salió
se entiende sin ver fórmulas.

### El mapa de cierre
