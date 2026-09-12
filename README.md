# LudusCog · El Archivo Infinito — v5.63

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
| **También es cierto** | el texto lo enuncia de otro modo, pero lo tuyo se sostiene igual | 90% |
| **Derivado** | no lo dice, pero **se sigue** de dos vínculos que sí están | 70% y se marca como inferencia |
| **Aproximado** | el vínculo existe; tu tipo es de la misma familia | 50% |
| **Aproximado lejano** | el vínculo existe, pero tu tipo es de OTRA familia: otra afirmación, no otro matiz | 30% |
| **Insinuado** | el texto no lo enuncia, pero el extractor lo lee entre líneas (confianza < 0.6) — *lo viste tú* | 65%, capa propia, no es evidencia |
| **Convive** | el texto los trata juntos en el mismo caso, escenario, tesis o marco | 55% |
| **Propuesta tuya** | vecino común o misma zona: conexión tuya, se guarda | 35%, capa propia |
| **Plausible** | solo comparten página | 18%, no se guarda |
| **Mudo** | nada | cero, sin castigo |
| **Invertido** | el texto dice lo contrario, con un tipo que sí tiene dirección | castigo |

Solo **sostenido, equivalente, también es cierto y derivado** son evidencia: alimentan
el Atlas, los combos y el alcance. Solo **invertido** y **error** son fallo. Todo lo demás
es otra cosa —matiz, convivencia, creación— y no se anota ni como lo uno ni como lo otro.

**Los vínculos no son alternativas.** Si el texto dice que A *extiende* B, también es
cierto que A *requiere* B: no se amplía lo que no está antes. El extractor emite un tipo
por par, pero un par puede sostener varios a la vez, así que afirmar otro de esos tipos
no es un matiz peor — es otra faceta verdadera. Las implicaciones son direccionales:
extender presupone, pero requerir no amplía.

`contrasta` es simétrica: afirmarla en cualquier dirección vale igual.
`generaliza` y `ejemplifica` son duales: decir *A generaliza B* o *B ejemplifica A* es
la misma afirmación. `apoya`, `extiende` y `matiza` son una familia; confundirlas es
impreciso, no falso. Solo `causa`, `requiere`, `generaliza` y `ejemplifica` castigan al
invertirse, porque ahí la dirección **es** la afirmación.

**Derivado** es lo que convierte el juego en razonamiento y no en recuerdo: si trazas
*A → C* y el texto tiene *A → B → C*, el juego responde «no lo dice directamente, pero
se sigue», te da crédito y lo registra como inferencia. El Atlas, en cambio, solo recoge
lo que el texto afirma literalmente.

### La creatividad se paga siempre; la suerte, solo en el botín

Dos combos nuevos premian jugar con el material en vez de repetirlo, y los dos son
**deterministas**: recompensar la creatividad al azar enseñaría que no es fiable.

- **Veta** — sostener vínculos de los que el autor apenas usa. Lo raro está menos
  trillado y cuesta más verlo.
- **Mestizaje** — cruzar tres o más clases de pieza en la misma afirmación: un caso con
  un concepto, una tesis con un criterio, un terreno con un campo.

Y un caso o una tesis **pertenecen al campo semántico del que hablan**: se representan
por los conceptos que ponen en juego en vez de quedar ignorados, que es lo que pasaba
antes.

**El refuerzo variable vive solo en el botín.** Tras un combate puede aparecer una
cuarta opción rara —la *veta*— con probabilidad que sube con lo bien que resolviste: del
11 % con un diagrama flojo al 49 % con uno excelente, sin llegar nunca a la certeza.

Lo que **jamás** varía al azar es el veredicto de una afirmación. Si acertar dependiera
de la suerte, el Atlas dejaría de distinguir a quien leyó de quien tuvo un buen día, y
ese Atlas es el producto.

### La capa propia del lector

Decir *«razonable, el texto no lo dice»* describe lo que el autor no hizo, no lo que
hiciste tú. Ahora se llama **propuesta tuya**, va en violeta con el glifo `✎`, y el
mensaje está al derecho: *«esto lo pones tú: el autor los deja en la misma zona sin
llegar a enlazarlos»*.

Y lo importante: **se guarda**. El Atlas tiene una capa aparte con las conexiones que el
texto no hace y tú sí. No cuentan como evidencia —subir su multiplicador sería mentir y
corromper el modelo cognitivo— pero se cuentan, se miran y van a la edición crítica en su
propia sección.

**El listón para que no sea un basurero:** solo entran las que están cerca en el grafo —
vecino común o misma zona. Compartir página puntúa en combate pero **no se anota**: en un
texto denso casi todo comparte página. Medido sobre el fixture: de 112 propuestas
posibles se anotan 86, el 28 % de los pares.

**Dos formas de ascender**, ambas por acción tuya:

- **Sostenerla con un caso.** Si en el mismo diagrama anclas los dos conceptos al mismo
  caso, deja de ser corazonada: sube a *convive* y triplica sus fichas.
- **Que el texto te dé la razón después.** Si más adelante aparece esa arista, la
  propuesta se marca como confirmada y el juego lo anuncia: *«lo que propusiste antes
  estaba en el texto»*.

### Convivencia: cuando el texto los junta sin enunciar el vínculo

Un grafo nunca recoge todo lo que un autor pone en la misma escena. Si dos conceptos
aparecen juntos en **el mismo caso, el mismo escenario, la misma tesis o el mismo marco
teórico**, eso es evidencia real de que el texto los relaciona, aunque no enuncie qué
vínculo tienen. Antes eso caía en «plausible» y valía casi nada; ahora es su propio
peldaño y rinde el 55 %.

Compartir página **no** basta: en un texto denso casi todo comparte página. Eso se queda
en plausible, con un mensaje que lo dice: *«el autor los expone en la misma página pero
no llega a enlazarlos; puede ser tuya la conexión»*.

Y las derivaciones llegan ahora hasta **tres pasos**, no dos.

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

## Autorregulación sin pausa (v5.11)

El ciclo de Zimmerman entra como tres decisiones con consecuencia, nunca como
una pantalla de preguntas:

| Fase | Mecánica | Decisión | Consecuencia | Señal |
|---|---|---|---|---|
| Planeación | **Encargo** | al entrar, viendo mano y frente, eliges qué te propones (3 niveles) o nada | cumplirlo cura lucidez y sube la probabilidad de veta en el botín; no cumplirlo no castiga | `srl_planeacion`: nivel elegido, si apuntaba a un concepto débil, latencia de la elección, resultado |
| Acción | **Sello de confianza** | antes de afirmar, declaras que todo el tablero se sostiene | si es así, +1.0 al multiplicador; si un trazo falla, el daño rinde el 60 % | `calibracion`: la apuesta explícita G1, limpia y por turno |
| Autorreflexión | **Marca** | al cerrar la sala señalas qué concepto te costó (o nada) | vuelve en la próxima sala aunque no toque, y sostenerlo paga fichas y cura | `srl_reflexion`: atribución contrastada con los fallos reales de la sala |

Además, al lado de *Afirmar* se muestra la **forma** del diagrama (piezas, alcance
y combos que *podría* encender si todo se sostiene). Anticipación sin trampa: se
enseña la estructura, nunca la verdad.

`npm run smoke` añade un criterio: el sello tiene que premiar al que sabe y
castigar al que adivina (informado 100 % vs azar 8 %).

## Los cinco bucles del enganche (v5.12)

Lo que un roguelike tipo Balatro tiene y ahora esto también, sin tocar las
reglas que no se negocian:

- **La exigencia visible.** Cada nodo del mapa anuncia cuánto aguanta su frente
  («frente ~340») y sobre el carril se ve el aguante restante. La build se mide
  contra un número, no contra una intuición.
- **Portadas.** Antes de la expedición se elige con qué ojos se entra: la
  Clásica, el Disidente, el Cartógrafo o el Escéptico. Cada una modula recursos
  y recompensa — nunca la corrección — y es un plan de lectura distinto del
  mismo texto. La elección queda como señal.
- **Hazañas y Vitrina.** Ocho lentes nacen bloqueadas y cada una se desbloquea
  con una conducta cognitiva concreta (sostener una Analogía, tres quemas
  limpias, tres inferencias, sellar tres veces sin fallar…). El grind de
  colección y la señal de aprendizaje son la misma cosa.
- **El mazo que mejora y se ve.** Las cartas fusionadas quedan doradas, con
  brillo. Y en el refugio se puede **archivar** un concepto dominado: sale de
  la mesa el resto de la run, la mano se adelgaza — solo sale lo consolidado,
  y sale porque lo está.
- **Racha y condiciones de sala.** Turnos seguidos sosteniendo algo suman +0.1
  al multiplicador (solo error o inversión la rompen: el silencio no, regla 3).
  Las salas duras anuncian su regla como un boss blind — Cadena, Monocultivo,
  Marco rival — y todas modulan la recompensa, nunca la verdad (regla 2).
- **Perder promete.** La pantalla de fin dice qué te detuvo, muestra la hazaña
  que quedó más cerca y ofrece «Otra expedición» directo al elegir portada.

## La capa ×mult (v5.13)

La fórmula pasa a tres pisos: `fichas × (1 + filo) × Π(×mult)`. Todo lo que
existía sigue igual; el tercer piso es nuevo y es donde 400 se vuelve 80.000.

- **Seis lentes mayores** cuyas condiciones son las conductas cognitivas más
  caras: El Anclista (×1.5 con caso anclado), Polifonía (×1.5 con tres
  herramientas distintas), Puño del disidente (×1.5 con oposición pura),
  Reliquia del traductor (×2 con Analogía), La Catedral (×3 con Constelación,
  única, exige su hazaña) y El Aleph (×2.5 con Mestizaje de 4 clases, única,
  exige su hazaña). La codicia numérica empuja hacia arriba en Bloom.
- **Dos escaladoras**: Cuaderno del hereje (+0.15 al filo permanente por
  falsificación quemada en la run) y La pluma que aprende (+1 ficha por
  sostenido por inferencia de la run). El motor crece por jugar bien.
- **El sello multiplica**: sellar y sostenerlo todo ya no suma +1: hace ×1.5
  al daño entero. La apuesta vale más cuanto más alto vuelas.
- **La demanda compone**: la vida del frente escala ×1.35 por acto y el jefe
  es un 60 % más gordo, para que el número gigante sea necesario y no adorno.
  El ataque enemigo NO compone: leer lento no se castiga exponencialmente.
- **El sobredaño se convierte**: el exceso al derribar vuelve como lucidez
  (1 por cada 40, tope 8 por turno). El golpe enorme siempre paga algo.
- **La cascada tiene un cuarto acto**: tras trazos y combos, cada mayor se
  revela con su nombre, su ×factor y un acorde propio; el total estampa en
  dorado. El momento del × se oye y se ve.
- **En modo aprendizaje la capa × se acota a ×2**: con el andamio puesto, el
  número no compite con la atención.

Nada de esto toca la corrección: multiplicar el daño jamás cambia qué es
verdad. `npm run smoke` lo vigila con un criterio nuevo: la build mayor debe
multiplicar ≥3× el mejor golpe del lector informado, y regalarle ~nada al azar
(medido: 12.189 → 82.279 · azar 61).

## El carril legible y el desborde (v5.14)

- **La vida en número.** Cada enemigo muestra `hp/hpMax` bajo su barra: el
  frente deja de ser una intuición y pasa a ser aritmética que se puede planear.
- **El golpe desborda.** Lo que sobra al derribar se arrastra al siguiente
  enemigo, blindaje mediante, hasta agotarse: un supergolpe puede limpiar el
  carril entero de una. El Eco lo corta (retrocede y absorbe), y un tanque cuyo
  blindaje tu diagrama no vence frena la cadena — que es su oficio. Lo que
  sobra cuando ya no queda a quién golpear sigue volviendo como lucidez.

## El archivo vestido (v5.15)

Primeras ilustraciones reales en las ranuras de `public/art/`: 12 enemigos y
el jugador, tomadas de **game-icons.net** (Lorc y Delapouite, CC BY 3.0),
limpiadas a la paleta del juego. Cada icono ES la patología de lectura, no un
monstruo: la pluma que copia, la mancha que se cuela, el grito que alcanza,
la máscara doble de la atribución falsa, el templo que solo cede de lado.
Los estados (`herido`, `critico`, `cae`, `retrocede`) tiñen por CSS, y el Eco
va translúcido porque es tu propio calco. Crédito visible en el inicio, mapa
de origen en `public/art/CREDITS.md`. Reemplazables uno a uno cuando llegue
arte propio o Rive: el contrato de ranuras no cambió.

## Sprites de la comunidad y escenarios (v5.16)

Las ranuras de arte ahora aceptan **tiras de frames animadas** declaradas en
`public/art/manifest.json` (packs de itch.io / OpenGameArt caen directo, con
los siete gestos mapeados a idle/attack/hit/death), y cada acto acepta un
**escenario** en `public/art/fondos/actoN.png`, atenuado tras un velo para que
la mesa siga legible. Combo recomendado y verificado en `public/art/LEEME.md`:
LuizMelo (CC0, animado) + ansimuz Gothicvania (libre con crédito). Sin
manifest ni fondos, todo sigue exactamente igual.

## Arreglos de mesa (v5.17)

- **La mano ya no se congela.** Al reciclar el descarte se baraja (con semilla
  propia, sin mover el RNG de la run): en salas chicas volvían las mismas
  cartas en el mismo orden y parecía un bug — lo era.
- **El verbo viaja sobre la flecha.** «extiende», «contrasta»… se dibuja
  centrado sobre la línea entre las dos cartas, con halo de tinta para leerse
  sobre lo que sea; el veredicto (✓, ≈, ↺) baja bajo la línea al resolver.
- **Las doradas se explican al tacto**: el tooltip dice qué son y qué valen.
- **Consejo de forma**: junto a la previsualización, una línea dice qué le
  falta al diagrama para rendir más («teje el campo por dentro: Cierre»,
  «identifica y enlaza la MISMA pieza: Doble registro», «¿seguro de todo? el
  sello multiplica ×1.5»). Estructura, nunca verdad.
- La curva de vida enemiga baja de ×1.35 a ×1.30 por acto, y el bot del smoke
  ahora usa Cambiar al atascarse, como la regla 5 manda.

## La cuenta legible y la isla de certeza (v5.18)

- **Ningún número cambia sin decir por qué.** Todo lo que modifica el daño
  después de la cuenta base (Monocultivo, Cadena, sello fallido, racha, marco
  rival, cuentas saldadas, el tope del andamio) ahora es un **paso propio de
  la cascada**, con nombre, delta y nota al tacto. El «9 × 1.6 = 0» sin
  explicación era la condición Monocultivo restando en silencio: se acabó.
- **Vínculos asentados.** Re-afirmar una arista que tu Atlas ya sostuvo paga
  fichas seguras (+6, una vez por arista y combate) y el trazo lo anuncia
  ANTES de afirmar: «✓ asentado». Lo aprendido es tu mano conocida de póker:
  certeza en medio de la apuesta, sin poder farmearla.
- **Más flexibilidad con evidencia:** si la definición de un concepto NOMBRA
  al otro (o a un sinónimo), el vínculo ya no cae en silencio: es «convive»
  (55 %) — el autor los enlaza al definir aunque no diga el tipo. Es el caso
  «attachment theory extiende X» donde X aparece dentro de la propia
  definición: evidencia textual, no regalo.

## Creatividad con evidencia, clases legibles y golpe puntual (v5.19)

**Flexibilidad y creatividad (con el extractor v3.7):**
- **Gemelos bilingües**: si el texto afirma el vínculo del mismo concepto bajo
  otro nombre (títulos/sinónimos cruzados), es «compatible»: la traducción no
  cuesta puntos.
- **Puentes latentes** (`graph.latent_links` del extractor v3.7): vínculos que
  el texto insinúa sin enunciar, pre-juzgados con justificación anclada → el
  jugador que los propone recibe «convive» y la justificación como feedback.
- **Co-ocurrencias** (`graph.cooccurrences`, v3.5): pares que el autor trata
  juntos una y otra vez → «convive».
- **Secuencia acepta `extiende`** como paso (extender presupone lo anterior).
- **Campo creativo**: una agrupación que cruza zonas pero está conectada por
  dentro ya no cae en silencio: es «plausible» y queda como propuesta tuya.
- Las descripciones sueltas dicen su dueño en el veredicto.

**Cédulas:** color de clase más ancho y separado, el rótulo lo lleva puesto, y
la mano tiene leyenda («colores») con el uso de cada clase al tacto. La banda
de la apócrifa ahora es IDÉNTICA a la del concepto: se cazaban falsificaciones
por color.

**Combate:** el golpe vuelve a ser **puntual** (un objetivo, daño completo) y
lo que sobra al derribar **desborda** al siguiente. El área se compra:
**onda** (Cierre o andanada de 3+ sostenidas) golpea a los primeros `alcance`
con daño completo; **barrido** (Constelación) golpea a TODO el carril. El
patrón del turno se muestra con su chip, y los **bloqueos** (Dogma, Ortodoxia,
fases del Tratado) se listan con su motivo: si el daño aplicado no es el de la
cuenta, la pantalla dice exactamente por qué — no era bug, era blindaje
invisible, y lo invisible era el bug.

## Animación rica desde packs de la comunidad (v5.20)

El manifest acepta frames no cuadrados, listas de clips por gesto (ataques
variados al azar), `golpea_<arma>` para que el protagonista ataque distinto
según el arma del diagrama (espada, arco, hechizo…) y `proyectiles/<arma>`
para sustituir los proyectiles CSS por sprites (flechas, rayos). Selección de
packs con licencias comprobadas y mapa enemigo→pack en `public/art/LEEME.md`.

## Juez mixto, impacto con cadencia y ranuras de arte totales (v5.26)

- **Juez mixto de grafo bipartito**: las flechas hacia/desde casos, tesis y
  marcos se juzgan en cualquier dirección con la membresía (`concept_ids`) que
  el extractor ya declara. «Los Juegos del Hambre ejemplifica el marco X» es
  sostenido si el marco reclama ese concepto; contrastar con el marco RIVAL
  es sostenido con prima; contrastar con el propio marco enseña («al derecho,
  esto es pertenencia»); y el silencio ahora dice quién SÍ lo reclama.
- **El golpe aterriza antes de la muerte**: los impactos se revelan tras el
  viaje del proyectil (o la embestida) y el desborde recorre la cadena con
  cadencia de 150 ms; vida, gesto y número esperan su golpe. La Página en
  Blanco (sin texto: la animación habla sola) espera al último caído y solo se
  gana con el one-shot legendario: 3+ enemigos con la vida LLENA, de un golpe.
- **Ranuras de arte completas**: fondos por TIPO de sala
  (`fondos/jefe_acto2.png` → cae a `acto2.png`), iconos de lente
  (`art/lentes/<id>.png`) en botín y refugio, texturas de carta por clase
  (clave `"cartas"` del manifest; la apócrifa usa SIEMPRE la del concepto), y
  `tiras.py` v2: detecta hojas ya montadas (LuizMelo) y hace el casting
  automático de enemigos por palabras clave.

## El Repartidor (v5.28)

El robo de cartas deja de ser azar puro: cada carta del mazo se clasifica en
tiers respecto de la mano (**ancla** completa una Identidad; **puente** tiene
arista con algo en mesa; **repaso** trae de vuelta un concepto marcado en la
reflexión; **reto** es material sin aristas asentadas; **especial** es
caso/tesis/marco con miembro presente) y el robo elige por ruleta ponderada.
Los pesos se corren con el acto (el andamio se retira: tarde pesan reto y
especial) y con la **piedad**: turnos sin acierto inclinan hacia lo
componible; un acierto la resetea. **Cambiar** veta el concepto un par de
turnos y el reemplazo llega con imán. **Piso duro**: ninguna apertura muda
(se repara) y ningún relleno deja la mano sin jugada componible.

Guardas de integridad de señal: el Repartidor cambia EXPOSICIÓN, jamás
veredictos ni recompensas; es CIEGO a la bandera de apócrifa (la
discriminación sigue siendo del jugador); y es determinista con el RNG de la
run. `npm run smoke` lo vigila: criterio 13, cero aperturas mudas, y el azar
sigue sin ganar nada.

## Integridad de señal y creatividad respaldada (v5.36)

Requiere el bundle **1.1.0** del extractor (cada arista trae `confianza`, `anclaje`,
`veces` y `status`; cada concepto trae `evidencia_textual` y `status`). Los bundles
1.0.0 siguen cargando: sin confianza, toda arista se toma como afirmada.

**Lo que se corrige.** Desde el extractor v3.5 el prompt de capa 2 emite también las
relaciones que el modelo *infiere* del sentido de los conceptos, marcadas con confianza
0.3–0.5 («el texto no la trata»). El compilador tiraba la confianza y el juego decía
*«el texto lo dice»* de vínculos que el propio extractor había declarado inferidos: el
Atlas registraba como evidencia textual algo que nadie leyó. Ahora:

- **Aristas afirmadas** (confianza ≥ 0.6) son la única verdad del juez. Viven en
  `contenido.aristas`; son el denominador de «Vínculos trazados» y del Atlas.
- **Aristas insinuadas** (< 0.6) viven aparte, en `contenido.insinuadas`. Si el lector
  traza exactamente eso, el peldaño es **insinuado**: *«el texto no lo enuncia, pero lo
  insinúa — y lo viste tú»*. Paga el 65 %, sostiene la racha, enciende Hallazgo, y **no
  entra al Atlas como evidencia**: va a la capa propia con `respaldo: texto_insinua`.
  Si hay un vínculo firme entre los dos, la evidencia manda y lo inferido no se mira.
- **Aproximado lejano.** Confundir `apoya` con `extiende` es un matiz (50 %); decir
  `contrasta` donde el texto dice `causa` es otra afirmación (30 %).
- **Verbos bloqueados.** Si el texto dice `causa` y ese verbo aún no se ha descubierto,
  decir `apoya` no es imprecisión del lector: es una restricción del juego. El juez recibe
  los tipos disponibles y lo devuelve como *también es cierto*, con la evidencia intacta.
- **Propuesta ≠ plausible.** Una corazonada entre conceptos cercanos (vecino común,
  misma zona) es una **propuesta**: se guarda, paga el 35 %. Compartir solo página se
  queda en *plausible*: 18 %, no se anota.
- **Hallazgo**, combo nuevo y determinista: proponer lo que el texto no dice **en el
  mismo diagrama** en que sostienes lo que sí dice. Una propuesta suelta es una
  corazonada; junto a evidencia es una lectura.
- **El Atlas anota evidencia y fallo, nada más.** Hasta v5.35 cualquier veredicto que no
  fuera sostenido/equivalente se contaba como fallo del concepto —derivado, compatible,
  convive, una propuesta—, y explorar bajaba un concepto a «se te resiste». Ahora acierto
  = evidencia (`ACIERTA`), fallo = `invertido`/`error` (`FALLA`), y las creaciones no
  entran al cociente de calibración. Misma regla en la Marca de cierre.
- **La cita literal viaja.** `Concepto.evidencia` trae la frase del PDF verificada por el
  extractor carácter por carácter, con página. Es el ancla que devuelve al lector al
  documento; pendiente de mostrarse en carta y veredicto.
- **Lo que el profesor rechaza no entra.** Conceptos, aristas y repertorios con
  `status: rechazado` se descartan al adaptar; los repertorios inferidos sin aprobar
  entran marcados (`revisado: false`) y el diagnóstico lo dice.

**La apertura con plan.** La primera mano de cada sala ya no es el tope de un mazo
barajado: una pareja para emparejar, un puente que valga la pena (**veta**: verbo
disponible, no asentada, rara o entre zonas), una **chispa** para poder proponer (cerca en
el grafo sin vínculo directo), un especial si tiene miembro en mesa, y el resto por
ruleta sin que un concepto monopolice la mano. Cambia exposición, jamás veredictos. Y la
piedad de la regla 5: tras un turno vacío con la mano llena y sin cambios, el Archivo
devuelve un Cambiar. Medido: 100 % de las aperturas permiten una relación, 96 % traen
veta o chispa.

**El lector parcial.** `npm run smoke` simula ahora un cuarto perfil: leyó el texto una
vez, reconoce el 60 % de los conceptos, recuerda el 50 % de los vínculos y no sabe
detectar falsificaciones. Es el estudiante del piloto. Criterios 14–16:

| # | Criterio | Estado |
|---|---|---|
| 14 | quien leyó a medias tiene una expedición justa (≥ 3/6) | **objetivo de balance: PENDIENTE** (2/6, 3.2 turnos/oleada) |
| 15 | las aperturas dan para pensar | pasa |
| 16 | la creatividad se paga siempre y nunca al azar | pasa |

El 14 se mide en cada corrida y **solo bloquea con `EXIGIR_PARCIAL=1`**, para que un
ajuste de balance pendiente no impida desplegar una corrección de integridad. El dato
importa: quitar las apócrifas por completo no cambia el resultado (2/6); con 70 %/60 % de
conocimiento sube a 3/6, con 80 %/70 % a 4/6. Solo quien conoce el grafo entero despeja
en 1.2 turnos por oleada. **El frente está calibrado contra un lector perfecto.**
Palancas: vida del frente en actos 0–1, o falsificaciones señaladas en el acto 0 como en
aprendizaje. Es decisión de diseño, no de parche.

## La flecha crítica (v5.37)

Medido sobre un bundle real («Los Juegos del Hambre», 10 conceptos, 6 tesis, 4 marcos)
con `npm run creativo -- ruta/al/bundle.json`: **144 jugadas de lector crítico valían cero
por construcción** —cualquier flecha que tocara un criterio de refutación o una objeción—
porque esas piezas no llevaban conceptos y el juez mixto no tenía con qué mirar. La nota
decía «el texto no enlaza…», que era falso: el mapa no tenía datos.

- **Los criterios se juzgan por su tesis.** Un criterio o una objeción pertenece a una
  tesis; la tesis pertenece a un marco y reclama conceptos. Con eso basta: contra el marco
  de su tesis → *tensión desde dentro* (sostenido); a favor del marco rival → *la voz del
  rival* (sostenido); contra un concepto que la tesis reclama → *lo pone a prueba*
  (sostenido); con un caso o tesis ajena que comparten conceptos → convive. Para la
  Balanza la objeción sigue siendo señuelo; para la Flecha la pregunta es otra.
  Si el bundle trae `criterios_conceptos` / `contraargumentos_conceptos` (extractor v3.8),
  el juez usa los conceptos que ese criterio invoca; si no, la tesis entera.
- **Silencio honesto.** «Mudo» significa que el mapa no registra el vínculo, no que el
  texto calle. Todas las notas de silencio lo dicen así.
- **El eje no es vecino común.** En un grafo en estrella (el documento estudia una obra y
  todo cuelga de ella) cualquier par tendría vecino común y la capa propia sería un
  basurero. Un concepto con la mitad de las aristas no cuenta como apoyo de una propuesta.
- **Propuesta por distancia.** Misma zona con vecino común 35 %, misma zona 42 %, zonas
  distintas unidas por un vecino común 50 %. Creatividad = distancia × apoyo. Nunca
  alcanza a una flecha firme.

Sobre ese bundle, criterio/objeción ↔ concepto pasa de 0 a **1.7× la identidad**;
objeción ↔ marco de su tesis, de 0 a 32 de daño. El gradiente queda: lectura crítica
(rival↔marco 1.8×, criterio↔concepto 1.7×) > flecha firme (1.5×) > identidad (1.0) >
creación con apoyo (0.4–0.6×) > silencio.

## Modo aprendizaje: herramientas completas y botín por andamiaje (v5.63)

- **Todas las oleadas tienen las herramientas de la expedición.** Antes la oleada 1 solo
  traía Identidad, la 2 Flecha, la 3 el resto; con los conceptos llegando enteros, la
  Identidad no servía de nada en la 2. Las herramientas se ganan en el refugio, no oleada a
  oleada.
- **El botín sigue una escalera de andamiaje** (`ESCALERA` en `route.ts`): cada peldaño es
  una herramienta con dos condiciones: qué tiene que haber en el texto para que sirva (sin
  casos no hay Ancla; sin ejes no hay Eje; sin `matiza` ni tensiones no hay Alcance) y qué
  evidencia previa hace que el estudiante pueda usarla (Jerarquía y Secuencia con 3
  vínculos sostenidos; Ancla con 2 conceptos relacionados; Contraejemplo tras anclar un caso;
  Balanza con 4 vínculos y tesis; Analogía con 6 vínculos en 2 zonas…). Se ofrece **la
  primera que ya puedes usar y aún no tienes**: la zona de desarrollo próximo. La lente
  compensa la dimensión más floja del Atlas (relación floja → Traductor / Causalista /
  Taxónomo / Disidente; transferencia floja → Abogado / Topógrafo; si no, Lexicógrafo /
  Umbral / Arquitecto). El tipo de vínculo ofrecido es el que más queda por sostener en el
  texto. Los sellos solo aparecen cuando la calibración ya dice algo (≥ 6 apuestas). La veta
  rara sigue siendo el único azar. El refugio explica **por qué** ofrece cada cosa.

## Modo aprendizaje: las seis mejoras (v5.62)

1. **La pregunta del Vistazo se cierra.** Al terminar la sala vuelve la pregunta con la que
   se entró y tres respuestas: la que usa un vínculo que el estudiante acaba de sostener,
   la misma al revés y la misma con otro tipo de vínculo. Acertar calibra la Lucidez. Sin
   vínculos nuevos, la pregunta queda abierta para la próxima sala.
2. **Anclaje entre sesiones.** `componerOleadas` recibe los conceptos con evidencia previa
   en el Atlas y los pone primero: la sala engancha con la galaxia que ya existe.
3. **Intuiciones como cambio conceptual.** Si un trazo toca una intuición cotidiana, el
   veredicto muestra el contraste (qué criterio cambia) y **dónde sí funciona** la intuición.
4. **Transferencia.** La última oleada trae un escenario de distancia media sobre sus
   conceptos; la oleada de puerta, uno lejano.
5. **Andamio contingente.** Dos sostenidos sin fallo adelantan la retirada del andamio; dos
   fallos sin acierto la frenan una oleada. Siempre anunciado.
6. **Apuesta de oleada.** Al empezar cada oleada: «¿sostendrás al menos un vínculo?». Se
   resuelve al cerrarla y alimenta la Lucidez (calibración) del Atlas.

## Nueva expedición (v5.61)

El interruptor de modo aprendizaje ya no se bloquea con una expedición guardada: vale para
la próxima. Con una guardada, el pie ofrece «Continuar expedición» (con el modo con el que
empezó) y **«Nueva expedición»**, que pide confirmación («¿Descartar la expedición en curso
(acto 2)?») y empieza otra con el modo del interruptor. Empezar de nuevo no toca el Atlas:
lo aprendido es del perfil.

## El modo aprendizaje vuelve como interruptor (v5.60)

Desde v5.49 «Empezar expedición» lanzaba siempre sin apoyo. Ahora al pie del inicio hay un
interruptor **Modo aprendizaje** (con apoyo: tres oleadas cortas por sala, conceptos
enteros al principio, falsificaciones marcadas, sin caer, andamio que se retira en orden y
avisando; sin apoyo: la expedición normal). Se elige por expedición; una expedición guardada
conserva el suyo (el interruptor se bloquea y el botón dice «Continuar expedición ·
aprendizaje»). El tutorial es aparte y no toca este interruptor.

## La cita en Colección, el encargo del diseño, las cartas del tutorial encendidas (v5.59)

- La cita literal sale del tooltip de la carta (era un bloque enorme) y entra en
  **Colección · Estrellas**: cada concepto se abre y muestra su definición y la cita del
  texto con la página. Tocar una estrella en el inicio lleva a Colección con ese concepto
  abierto, enfocado y centrado.
- El **encargo** («¿Qué te propones en esta sala?») según `Sala v2 · encargo`: velo con
  desenfoque, título grande, opciones como tarjetas, «Cumplirlo cura. No cumplirlo no
  castiga.»
- Las **cartas del paso del tutorial** se encienden con borde y latido naranja por encima de
  la piel de la carta (la regla anterior perdía contra el fondo en línea) y el resto se atenúa.

## El tema elegido manda (v5.58)

Dos fallos de v5.57. (1) Los callbacks que lanzan y retoman la expedición leían el tema
desde una clausura vieja: eligieras lo que eligieras, jugabas el primer tema. Ahora el tema
vive en un ref que esos callbacks leen al momento. (2) Una expedición guardada de un tema
seguía ofreciéndose como «Continuar» tras cambiar de tema, y al retomarla traía la sala con
las cartas del otro. La expedición guardada recuerda su tema; si eliges otro, el inicio
ofrece «Empezar» y no la retoma (la guardada del tema original sigue ahí si vuelves a él).

## Las expediciones no mezclan temas (v5.57)

El plan de un perfil junta todas sus lecturas, y la expedición repartía cartas sobre todo el
plan: una sala podía mezclar *Los Juegos del Hambre* con psicología. `src/engine/temas.ts`
resuelve qué **temas** hay en el plan —dos documentos son el mismo tema si comparten al
menos un concepto fusionado (`fuentes`); sin fuentes, la componente conexa del grafo; los
temas de menos de 4 conceptos se pegan al tema con el que más vínculos tienen— y `recortar`
deja el contenido en un solo tema (conceptos, vínculos, casos, tesis, marcos, repertorios,
unidades, zonas y ejes). La expedición se lanza sobre el recorte; el inicio, la galaxia y la
Colección siguen viendo el plan entero, y el Atlas es del perfil. Si hay más de un tema, el
pie del inicio muestra el selector **Explorar** (nombre del tema = su concepto eje, y
cuántas estrellas lleva encendidas); con uno solo no aparece nada.

## Cita literal en la carta, barra sin callejones (v5.56)

- **La carta enseña el texto**: al pasar el cursor por una carta de la Mano aparece la cita
  literal de donde sale el concepto («EN EL TEXTO (p. 6) …»), la `evidencia_textual` del
  extractor. Es el pendiente #4 de v5.36: el juego como compañero de lectura, que devuelve
  al PDF.
- Fuera «1 casilla/turno» de las entidades (el carril ya muestra cómo avanzan) y fuera las
  pestañas Misión y Taller de la barra, que estaban marcadas «pronto» y eran callejones.

## Sala v2, cuarta pasada (v5.55)

- **El jugador dejaba de verse bien por mi culpa**: un tope de alto sobre el marco del
  sprite descuadró la ventana que recorta la tira de animación (salían dos cuadros seguidos)
  y los pies quedaban bajo el borde. Fuera ese tope; la pista usa todo el alto del carril
  (128 px) y el jugador se alinea al pie con margen.
- **Objetivo sin caja**: la entidad en la mira lleva un halo rojo bajo los pies y el nombre
  en claro, en vez del recuadro.
- **Encargo como tarjetas** del sistema (oscuras, borde naranja al pasar), y **Quemar como
  brasero** (botón rojo oscuro con llama).

## Sala v2, tercera pasada (v5.54)

- **Cartas con carácter**: oscuras, pero con el color de su clase como degradado en la
  esquina, en la pastilla de clase y en el brillo al pasar; el glifo de clase queda como
  marca de agua. Se distinguen concepto, caso, tesis, criterio, marco e intuición de un
  vistazo sin volver al papel claro. (`--banda` viaja como variable CSS desde la carta.)
- **Carril más alto (136 px) y sin la fila de arriba**: «El frente aguanta N · condición»
  pasa a rótulo flotante en la esquina; la pista usa todo el alto (118 px), sin barra
  vertical, y el jugador ya no queda cortado.
- **La cuenta del daño en la barra inferior** tras afirmar (`puntos 19 × multiplicador 2.4 =
  46`, con el total en naranja y en oro si hubo multiplicador extra), como en el diseño; la
  cuenta de la mesa se oculta.

## Sala v2, segunda pasada (v5.53)

- **Cartas oscuras de verdad**: el fondo claro llegaba en línea por clase de carta
  (`cd.tono` + textura) y ganaba a la hoja de estilos; ahora se pisa y la carta es
  `#1A2A58` con texto claro, conservando la banda de color por clase en el borde izquierdo.
- **El carril es un escenario**: fuera las cajas por casilla (solo una línea punteada
  tenue); las entidades caminan sobre el fondo. El jugador baja al mismo suelo que las
  entidades (alineación al pie, no al centro).

## La Sala v2 (v5.52)

Primera pasada de `docs/diseno/Sala v2.dc.html` sobre el tablero real: rejilla 280 · 1fr ·
320 con el carril arriba (104 px) y la barra de acciones abajo (64 px), todo en una
pantalla sin desplazamiento de página (solo herramientas y Mano se desplazan por dentro);
las cartas de la Mano según `Carta.dc.html` (título, descripción de dos líneas, clase como
pastilla; la seleccionada en naranja); herramientas como fichas de 40 px con glifo grande;
móvil con el carril compacto, la mesa al centro, las herramientas en fila y la Mano como
bandeja horizontal. **Anclas fijas del tutorial** (`data-tutorial`: carril, herramientas,
mesa, mano, pozo, afirmar; `data-uid` en cada carta; `data-herramienta` en cada ficha): el
velo mide esas anclas y ya no depende de clases ni de la disposición. Queda para la
siguiente pasada: el veredicto dibujado sobre los trazos de la mesa y la cuenta dentro de
la barra inferior, el brasero del pozo y la pantalla del encargo como tarjetas.

## Tutorial que recorta de verdad, y palabras del jugador (v5.51)

- **Recorte medido, no por z-index.** El velo es ahora un SVG fijo que mide cada cuadro los
  rectángulos de las zonas destacadas y los recorta con una máscara (`TutorialVelo.tsx`).
  El paso 1 iluminaba la burbuja pero no las cartas porque la Mano no podía subir por
  encima del velo desde su contexto de apilamiento; con la máscara ya no hace falta que
  suba. Borde naranja pulsante, y un **conector** curvo punteado con una chispa que corre
  desde la burbuja de Andy hasta el recorte más cercano.
- **Tarjeta de cierre** «Ya sabes jugar»: las tres cosas que acabas de hacer y la regla del
  daño en una frase.
- **Cuenta del daño en palabras del jugador**: «puntos × multiplicador» en vez de «cuerpo ×
  filo», con explicación al pasar el cursor. Puntos = cuánto de lo que dijiste lo sostiene
  el texto; multiplicador = cuánto se articula el diagrama.
- **Veredictos y motivos en claro**: «el texto lo dice», «casi: el vínculo es otro», «el
  texto los junta, no los enlaza», «el mapa no lo registra», «falso». Las entidades ya no
  hablan en clave («solo cede ante puentes y contrastes» → «solo le hacen daño los vínculos
  que unen zonas distintas del texto o que contrastan»). Patrones de golpe: «a uno», «en
  cadena», «a todos».

## El tutorial con el diseño (v5.50)

El mecanismo del tutorial ya existía (foco por zona, piezas y herramientas permitidas,
pasos que avanzan con la acción real y no vuelven atrás). v5.50 le pone la piel de
`docs/diseno/Tutorial.dc.html`: un **velo** `rgba(10,18,48,0.78)` sobre toda la batalla, la
zona que toca sube por encima con un **recorte** de borde naranja pulsante, y la **burbuja
de Andy** (avatar, «Paso 2 de 4», título, texto, puntos hecho/activo/pendiente y «Esperando
tu acción» con pulso). En móvil la burbuja ocupa el ancho abajo. `prefers-reduced-motion`
apaga los pulsos.

## Inicio sin «Más opciones» (v5.49)

Del viejo HomeView solo queda el botón **Tutorial** al pie del inicio. «Cambiar texto» ya es
Biblioteca; «con apoyo» lo decide la portada de la expedición; «retomar» es el propio
«Continuar expedición». `HomeView.tsx` sigue en el repo por si hace falta, pero nada lo usa.

## Subidas que sobreviven a cualquier pantalla (v5.48)

El seguimiento de una subida vivía dentro de Biblioteca y se perdía al cambiar de menú
(el extractor seguía trabajando en el servidor, pero el juego perdía el hilo). Ahora
`src/net/subidas.ts` es un pequeño almacén fuera de React —lista de jobs por perfil en
`localStorage`, un sondeo cada 3 s mientras haya alguno en marcha— al que se suscriben la
barra y Biblioteca. Puedes cambiar de pantalla, empezar una expedición o cerrar y volver a
abrir: la subida sigue y se retoma. **Progreso por capas**: el backend (v3.11) informa cada
capa terminada mientras corre (`progreso.fraccion`, `progreso.ultima.layer`), y el juego lo
pinta como anillo en la barra («Relaciones · 44 %») y como barra en Biblioteca. Cuando la
lectura queda lista, el chip pasa a «Lectura lista ✓» y el plan del perfil se recarga solo
en cuanto no hay batalla en curso (nunca en mitad de una sala); la primera lectura de un
perfil vacío entra sola al terminar.

## Colección, zonas y una galaxia que aguanta 30 documentos (v5.47)

- **Colección** (`src/ui/ColeccionView.tsx`, según `Coleccion.dc.html`): Estrellas (por zona,
  con su estado y nivel; «Se te resiste» primero), Propuestas (confirmar / descartar; las
  confirmadas quedan punteadas en violeta en la galaxia), Logros (las hazañas con su progreso
  y la lente que desbloquean) y Atlas completo (la vista de siempre). **Logros** tiene fase
  propia y se abre desde cualquier pantalla; antes compartía fase con Colección y desde
  Colección no respondía.
- **Barra**: las pestañas ya no se parten a dos líneas en Expedición; ceden los chips.
- **Zonas de tu cielo** sustituye a la constelación redundante de la derecha: cada zona con
  cuántas estrellas tiene encendidas y un toque para acercar la cámara a esa zona (el resto se
  atenúa). Es la navegación pensada para cuando el cielo sea grande.
- **La galaxia escala**: las zonas van sobre un anillo con el ángulo áureo (nunca se encima
  una con otra), el radio de cada zona crece con la raíz de su tamaño, y todo se normaliza
  para que la estrella más lejana quede en el borde: con 18 o con 400 conceptos ocupa el
  mismo lienzo. Con más de 60 estrellas, las no tocadas se hacen más pequeñas y tenues y solo
  se nombran las 22 que más brillan (por estado e importancia); el resto muestra su nombre al
  pasar el cursor. Nunca hay que desplazarse ni el lienzo crece.

## El cierre, solo la galaxia (v5.46)

`src/ui/CierreView.tsx` sustituye al mapa conceptual del resumen: la galaxia en modo
`cierre` arriba (lo ganado se dibuja delante del estudiante) y debajo cuatro tarjetas en
fila con lo que el mapa contaba: **tu golpe más fuerte** (daño, fichas × multiplicador,
trazos, entidades derribadas), **lo que se desbloqueó** (estrellas que suben de nivel,
vínculos aprendidos, hazañas y sus lentes), **tu encargo** (cumplido / pendiente y los
sellos) y **¿qué te costó más?**, que sigue siendo obligatoria porque es la autorreflexión
con consecuencia (lo marcado vuelve con prima). `BattleMap` deja de usarse en el cierre;
queda en el repo para la vista de mapa del combate.

## El cierre en la galaxia y el Atlas desde cualquier sitio (v5.45)

- **Bug**: tocar una estrella o abrir Colección/Logros sin expedición empezada caía al
  cargador de bundles, porque la vista del Atlas vivía dentro del render de expedición (que
  exige ruta). Ahora el Atlas se renderiza con la barra antes de ese guard, y sin ruta
  cualquier fase suelta vuelve a Entrar, nunca al cargador.
- **Cierre de batalla**: sobre el resumen aparece la galaxia en modo `cierre` con lo ganado
  en esa batalla: los vínculos nuevos se dibujan uno a uno en oro (700 ms cada uno, con una
  chispa recorriendo el hilo) y las estrellas que subieron de estado destellan. Lo «nuevo» es
  la diferencia entre la foto del Atlas al empezar la batalla y el Atlas al terminar.

## El Inicio del diseño, con la galaxia al centro (v5.44)

`src/ui/InicioView.tsx` reproduce `docs/diseno/Inicio.dc.html`: tres columnas (280 · 1fr ·
320) que se apilan en móvil. Izquierda: Andy con una frase que cambia con el Atlas, Misión
actual (la unidad en curso y la cobertura), Próximo desafío, Concepto recomendado (el que se
te resiste o el más importante con menor nivel). Centro: **la galaxia** (`src/ui/Galaxia.tsx`,
canvas con profundidad, portada de `galaxia.js`: estrellas por concepto con los seis estados
sacados de `nivelDe` y los fallos, hilos firmes = vínculos sostenidos del Atlas, propuestas
punteadas en violeta, nebulosas con nombre por zona, órbita lenta, arrastrar gira, tocar una
estrella abre el Atlas), leyenda y los cinco escalones con porcentaje. Derecha: la
constelación de la unidad actual (la misma galaxia en modo quieto), Tu progreso (cinco
barras) y Lucidez. Abajo: «Continuar / Empezar expedición» y, en «Más opciones», la HomeView
de siempre (con apoyo, tutorial, cambiar texto). La disposición de las estrellas es estable:
sale del id del concepto y de su zona, así la galaxia no se reordena entre sesiones ni al
entrar lecturas nuevas.

## El avance es del perfil (v5.43)

Bug de v5.39–v5.42: el Atlas y la expedición guardada se guardaban en `localStorage` por
**texto** (`atlas:<fuente>`) y se leía además la clave vieja como respaldo. Un perfil nuevo
con el mismo PDF en el mismo navegador heredaba el Atlas del perfil anterior («71 % de
cobertura al entrar»). Ahora, con perfil, la clave es `:perfil:<id>` para el Atlas y para
la expedición; sobreviven a que entren lecturas nuevas al plan (el texto cambia, el perfil
no). Sin perfil (demo, bundle a mano), por texto como antes. `fijarAmbito` en
`engine/atlas.ts` es el único interruptor; `App` lo fija al entrar y lo suelta al salir.

## Un perfil, una galaxia, muchas lecturas (v5.42)

El modelo es el del extractor v2.5 (`engine/merge.py`), ahora visible en el juego: **el
conocimiento pertenece al perfil, no al documento**. Entrar es solo elegir o crear un
perfil. Dentro, **Biblioteca** deja subir un PDF: el extractor lo procesa con
`student_id`, lo suma al plan del perfil, unifica los conceptos que se repiten entre
lecturas (canonicalización conservadora entre documentos) y recalcula las zonas. El juego
carga `GET /students/{id}/bundle`, que es el plan fusionado; un perfil sin material cae
directo en Biblioteca. Las zonas ya se llaman por su concepto eje («Zona de Crítica
social») y son las nebulosas de la galaxia. El Atlas se sincroniza por perfil
(`campo = "plan"`) y se conserva cuando entra una lectura nueva.

## Entrar como en el extractor (v5.41)

Entrar tiene ahora dos listas y un botón: **¿Quién juega?** (los perfiles existentes con su
código de jugador, `GET /students`, o «Crear perfil nuevo» con solo un nombre) y **¿En qué
campo?** (los campos publicados con nombre y tamaño, `GET /campos`, o un código escrito a
mano para campos privados). Se preselecciona lo de la última vez. Sin servidor, las listas
avisan y el cargador manual sigue en Opciones.

## El sistema visual LudusCog (v5.40)

El sistema salido de Claude Design (`docs/diseno/Sistema.dc.html`) entra por las variables
CSS que toda la aplicación ya usaba: `--tinta`, `--papel`, `--laton`… quedan remapeadas al
sistema (`--fondo` #0A1230, `--panel` #15224A, `--borde` #24335E, `--texto` #F3F6FF,
`--acento` #FF6A1A, `--descubierto` #38B6FF, `--sostenido` #5BD36F, `--transferir` #9B6CFF,
`--dominar` #FFC23D), con Manrope y JetBrains Mono. Así todas las pantallas cambian de piel
sin tocar su marcado. Entrar y la barra ya siguen el diseño al detalle (marca con órbita,
chip de perfil, foco naranja). Los ocho `.dc.html` del diseño y `galaxia.js` (el spec del
componente de galaxia: modos vivo / cierre / quieto, seis estados de estrella) están en
`docs/diseno/` como referencia para las pantallas que siguen: Inicio con la galaxia al
centro, Sala, Síntesis, Cierre, Colección, Profesor.

## Entrar, la barra y el Atlas que viaja (v5.39)

- **Entrar sin contraseña.** Nombre + código del campo (6 caracteres, el del curso del
  extractor). El backend crea el perfil y devuelve un **código de jugador** que aparece en
  la barra y recupera el perfil en otro dispositivo. Sin código de campo, el cargador manual
  de siempre (demo o bundle propio). Sesión en `localStorage` (`ludus:sesion`).
- **La barra LudusCog** (`src/ui/Shell.tsx`): marca, pestañas (Expedición · Colección ·
  Logros activas; Misión y Taller «pronto»), quién juega con nivel y XP, **Lucidez**
  (= calibración del Atlas: apuestas acertadas / apuestas) y **Hallazgos** (= vínculos
  ganados + propuestas propias). Todo sale del Atlas; no hay estado nuevo.
- **El Atlas ya no se pisa.** Una clave por texto en `localStorage` (antes jugar el texto
  B borraba el Atlas del texto A) y sincronización con el backend: cada guardado sube
  agrupado a `POST /students/{id}/atlas` (backend v3.9); al entrar se baja el remoto y se
  queda el más avanzado. El profesor puede leerlo por estudiante y campo.

## Auditoría de herramientas (v5.38)

`npm run herramientas -- ruta/al/bundle.json` construye, para cada una de las 12
herramientas, la mejor jugada posible con lo que trae el bundle y la pasa por el motor.
Distingue «sin material en este bundle» (hueco del extractor para ese documento) de
«muda con material» (bug del motor). La auditoría encontró y corrigió uno: **Jerarquía**
solo aceptaba `generaliza` de arriba abajo e ignoraba su dual `ejemplifica`, que es lo que
el extractor emite casi siempre; devolvía «el texto no establece esa contención» sobre
jerarquías reales. Sobre el bundle de muestra las 10 herramientas con material se
sostienen; **Eje** y **Descomposición** dependen de que el bundle traiga ejes reales y
subdimensiones, y **Alcance** de aristas `matiza` o tensiones que nombren a otro
concepto, que el extractor rara vez emite: ese es el siguiente hueco del lado del texto.

## Pendientes

- **Balance del lector parcial** (criterio 14): decidir la palanca y subir el listón.
- **La galaxia**: el Atlas persistente como cielo del texto entero —disposición fija,
  estrellas por `nivelDe`, constelaciones por unidad, propuestas en violeta— con las
  aristas ganadas viajando desde el mapa de la sala al cerrar. Hoy el Atlas es rejilla y
  tabla; el único grafo dibujado es el de una sala.
- `BattleMap` no dibuja todavía `hallazgos.propuestas` (ya se recogen).
- Puentes latentes entre capas en el extractor (caso↔tesis, tesis↔marco sin conceptos
  compartidos): hoy quedan en convive/silencio.
- Mostrar `Concepto.evidencia` (cita literal y página) en carta y veredicto.
- `POST /students/{id}/atlas`: el Atlas vive en `localStorage`, con una sola clave — jugar
  un segundo texto pisa el Atlas del primero, y el profesor no recibe nada del juego.
- Reserva de una pieza entre turnos (segunda señal de planeación).
- Familia H (colaborar) requiere un segundo estudiante.
- `docs/PEGLIN.md` describe la Mesa de Tiradas, que sigue sin implementar y que ahora
  encaja mejor: las clavijas serían las piezas del tablero.

### El modo Aprendizaje

No es un modo fácil: es **otra vía al mismo sitio**, con el andamio puesto y anunciado.

**El Vistazo.** Antes de cada sala, el concepto que engloba a los demás —material *más
general* que lo que viene, no un adelanto de lo mismo— y **una pregunta abierta** que la
sala va a responder, sacada de las `tensiones` del concepto o de un caso sin resolver.

Y se puede saltar, porque saltarlo es **una apuesta**: quien lo lee entra con una
falsificación ya señalada; quien lo salta, con una herramienta extra. No hay opción
correcta, y elegir queda registrado como señal de regulación.

**El Fragmento.** Una sala no es un combate largo con todo encima: son **tres oleadas
cortas**, y cada una añade conceptos y una herramienta.

| Oleada | Herramienta | Qué se pide |
|---|---|---|
| Reconocer | Identidad | emparejar nombre y descripción |
| Relacionar | Flecha | enlazar lo nuevo con lo de la oleada 1 |
| Sostener | Campo y las tuyas | estructurar usando las dos anteriores |

Lo que ya identificaste **vuelve entero** en la oleada siguiente: te lo ganaste. Lo nuevo
llega partido cuando el andamio ya se retiró.

**No se avanza acumulando, se avanza reusando.** Si el diagrama no toca ningún concepto
de las oleadas anteriores, rinde la mitad, y el juego lo dice.

**El desvanecimiento.** El andamio se retira en orden y anunciándolo, que es lo que lo
separa de una muleta:

| Oleada | Conceptos | Falsificaciones | Lucidez |
|---|---|---|---|
| 1 · total | partidos, para poder emparejar | señaladas | no baja |
| 2 · parcial | los ya vistos, enteros | señaladas | no baja |
| 3 · ninguno | partidos | sin señalar | baja normal |

**El error vuelve, no castiga.** Los pares que fallaste reaparecen en la oleada
siguiente: práctica espaciada dentro de la propia sala.

**El nudo.** Si el concepto puerta de la unidad sigue sin evidencia en el Atlas, la sala
**no se cierra** aunque el carril esté vacío: entra una oleada más centrada en él. El
progreso se mide por lo aprendido, no por lo derrotado.

**Rutas más cortas.** Tres oleadas por sala alargan mucho, así que en aprendizaje el acto
se acorta: de 16 salas a 10.

Y la decisión de fondo: **la evidencia con andamio cuenta, pero queda marcada**. El nivel
«lo dominas» exige al menos un acierto sin apoyo, y el Atlas muestra «lo sostienes, pero
siempre con ayuda».

### El tutorial

Se **activa y se desactiva** con el botón *Tutorial* al pie del menú, sin perder el
texto que estuvieras usando: al salir se recupera tal cual, con su Atlas y su expedición
a medias si la había. Mientras está activo no se pueden lanzar expediciones generadas
sobre el contenido del tutorial: hay un solo camino, que son las dos salas guionizadas.

Son **tres combates prefabricados** con mano fija, frente fijo y una guía que avanza
sola cuando haces lo que toca:

| Sala | Enseña | Frente |
|---|---|---|
| **Poner y emparejar** | arrastrar piezas, usar la Identidad, afirmar | dos Copistas |
| **Relacionar y desconfiar** | encadenar dos flechas y detectar una falsificación | Copista, Errata y Apócrifo |
| **El golpe grande** | qué hace una pasiva y cómo se encienden los combos | un Dogma, que no cede ante una sola frase |

La tercera regala la **Lente del arquitecto** y reparte justo las fichas que permiten
encadenar, emparejar y encerrar en el mismo diagrama: la idea es que el jugador vea el
número dispararse una vez, para que entienda qué persigue el juego. Al terminar hay un
cierre que le invita a hacerlo con su propio texto.

### Pistas visuales

Cada paso declara **qué se ilumina y qué se bloquea**. El resto de la pantalla se
oscurece al 34 %, la zona que toca queda a plena luz, y lo que hay que tocar late con un
contorno de latón y una flecha que apunta. Las fichas que no corresponden al paso no se
pueden arrastrar ni seleccionar, y las herramientas que no tocan quedan deshabilitadas.

La guía vive en un panel fijo abajo a la izquierda, con los pasos marcados. Cada paso
tiene una condición real sobre el estado de la partida —«hay dos piezas en el tablero»,
«has trazado una identidad», «quemaste la apócrifa»— así que avanza cuando de verdad lo
hiciste, no por tiempo. Y **es monótona**: una vez cumplido, un paso no vuelve atrás
aunque afirmar limpie el tablero y su condición deje de cumplirse.

Todo es determinista: la mano, el frente y la falsificación son siempre los mismos. La
apócrifa de la segunda sala es la confusión clásica —un murciélago con la descripción de
un ave— y no una cualquiera del pool.

El contenido son diez conceptos de abejas, flores y murciélagos, construidos con **la
misma forma que emite el extractor**: pasan por el mismo adaptador y el mismo motor, así
que no hay un camino de código especial que pueda quedar sin probar.

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

### Lo que se conserva y lo que no

La línea es clara: **lo que se aprende se queda, lo que se equipa no**.

| Persiste siempre | Se arma de nuevo cada expedición |
|---|---|
| evidencia del Atlas, vínculos trazados | lentes |
| tipos de vínculo descubiertos | sellos |
| intuiciones reubicadas (Terrenos) | herramientas extra, tamaño de mano |

Así cada expedición vuelve a ser una partida de verdad, y el conocimiento sigue siendo
acumulativo. El carril escala con las expediciones que llevas.

### Retomar a medias

El tiempo es la razón de abandono más citada en cursos en línea, así que **se puede
salir y volver**. Al abandonar una expedición se guarda el estado del mapa y el equipo;
al volver al Atlas aparece un aviso de *expedición a medias* con el acto, la lucidez y
cuándo la dejaste. Se guarda el mapa, no el tablero a medio trazar: si te vas en mitad
de una sala, vuelves al inicio de esa sala.

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

Al elegir una herramienta aparece un **rastro que sigue al cursor**: pequeño,
translúcido y sin capturar clics, porque el tablero es justo donde hay que tocar.

Mientras está abierto **sustituye a la ayuda flotante**, en vez de competir con ella.
Al pasar por encima de una pieza del tablero, su descripción completa entra tenue en la
ranura siguiente —A, B, C…— con un «clic para fijar»; al pulsar, se queda. Así se ve la
frase montándose antes de comprometerse, y nunca hay dos cuadros de texto a la vez.

El conector va escrito —*es*, *contiene a*, *vale bajo*, *no opera en*, *se compone de*,
*es a lo que*, o el tipo de vínculo elegido— y la cadena crece con la aridad de la
herramienta, así que una agrupación de cuatro conceptos se lee entera.

Lo único que necesita clics —los tipos de vínculo, *Trazar* y cerrar— vive en una barra
compacta al pie del lienzo.

### Cuerpo y filo

El marcador nunca anticipa el número, pero sí de dónde sale la fuerza: dos barras,
**cuerpo** (cuánto material verdadero sostienes) y **filo** (cuánto lo amplifican los
vínculos escasos, los conceptos umbral, los combos y las lentes). Al resolver, la cuenta
lleva esas mismas dos etiquetas, así que la relación entre lo que hiciste y lo que salió
se entiende sin ver fórmulas.

### El mapa de cierre
