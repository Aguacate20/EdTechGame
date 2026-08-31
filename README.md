# El Archivo Infinito — v5.20

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
| **Convive** | el texto los trata juntos en el mismo caso, escenario, tesis o marco | 55% |
| **Propuesta tuya** | vecino común, misma zona o misma página | 18%, y se guarda aparte |
| **Mudo** | nada | cero, sin castigo |
| **Invertido** | el texto dice lo contrario, con un tipo que sí tiene dirección | castigo |

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

## Pendientes

- Reserva de una pieza entre turnos (segunda señal de planeación).
- Familia H (colaborar) requiere un segundo estudiante.
- `docs/PEGLIN.md` describe la Mesa de Tiradas, que sigue sin implementar y que ahora
  encaja mejor: las clavijas serían las piezas del tablero.### El modo Aprendizaje

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
