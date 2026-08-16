# La Mesa de Tiradas — integración de la dinámica tipo Peglin

> Propuesta de diseño para v3.4. No está implementada en v3.3.
> Escrita después de auditar qué sostiene el bundle real.

---

## 1. Qué hace bien Peglin y qué de eso nos sirve

Peglin gusta por tres cosas, y conviene separarlas porque solo dos se pueden copiar:

1. **Apuntar es declarar una intención.** Antes de soltar la bola ya decidiste algo.
2. **La cascada es parcialmente tuya.** Causaste el inicio, no el detalle. Esa mezcla de
   control y sorpresa es el motor del placer.
3. **El descubrimiento de combos.** Cierta bola sobre cierta configuración de clavijas
   hace algo que no estaba escrito en ninguna parte.

La primera y la tercera se trasladan enteras. La segunda tiene un problema serio:
**la puntería es destreza motora**, y la regla de integridad de señal del proyecto dice
que la destreza modula recompensas pero no produce señal cognitiva. Si un rebote
afortunado te da la razón, el dato queda contaminado y el panel docente miente.

Toda la propuesta se apoya en resolver eso.

---

## 2. La decisión estructural: declarar y luego lanzar

Un turno se parte en dos actos con dueños distintos.

**Acto 1 — Declarar (conocimiento).** El tablero son clavijas etiquetadas con los
conceptos del vecindario. Eliges un **verbo** de tu mano y una **relación** de la
bandeja, y marcas las clavijas sobre las que afirmas esa relación:

> Con **Conectar** afirmo que *IA relacional* —**causa**→ *apego*, *internalización*.

Eso es una declaración completa, comprobable contra `graph.adyacencia`, y produce señal
por sí sola. Es la mecánica C1 llevada a D1 CONSTRUIR: no eliges entre cuatro etiquetas,
armas un subgrafo.

**Acto 2 — Lanzar (destreza).** Apuntas y sueltas. Solo cobra daño la clavija que está
**marcada, golpeada y sostenida por el texto**.

| Marcada | Golpeada | ¿Lo dice el texto? | Resultado |
|---|---|---|---|
| sí | sí | sostenida | daño completo · arista al Atlas |
| sí | **no** | sostenida | **0 daño · arista al Atlas igual** |
| sí | sí | no sostenida | la clavija resiste · sin daño y **sin castigo**: el texto no lo dice, no es un error |
| sí | sí | invertida | rebote adverso · castigo · se revela la dirección real |
| no | sí | — | rebote mudo |

La fila en negrita es el corazón del diseño. **El daño registra tu puntería; el Atlas
registra tu conocimiento.** Un tiro malo te cuesta la partida, nunca la evidencia. Y al
revés: acertar de rebote sobre una clavija que no marcaste no suma nada, así que la
suerte no puede fabricar señal.

Añadido para que no se sienta injusto: si **todas** las clavijas marcadas eran
sostenidas, se garantiza un impacto mínimo aunque el tiro haya sido pésimo. La
afirmación se sostiene sola; el tiro solo decide cuánto rinde.

---

## 3. Dos fuentes de munición, que es la vieja distinción del prototipo en papel

El kit de papel separaba *las reparte el enemigo* de *las reparte tu mano*. En la Mesa
esa distinción se vuelve física y visible:

- **Los verbos son tu mazo.** Deciden cómo vuela la bola. Los eliges, los mejoras, los
  depuras. Ahí está el deckbuilding.
- **Las relaciones son la bandeja del encuentro.** El enemigo pone sobre la mesa los
  tipos de vínculo que el subgrafo local admite. No te puedes quedar sin munición, y
  la escasez del bundle se vuelve textura: si `ejemplifica` solo tiene dos aristas en
  todo el texto, esa bola aparece poquísimo y vale muchísimo.

El disparo es la combinación de ambas. Verbo = *cómo lo pienso*. Relación = *qué afirmo*.
Clavijas marcadas = *sobre quién*.

---

## 4. Los verbos como física

Aquí está el equivalente honesto a «bolas que rebotan más, que curan, que dan críticos»:
cada verbo vuela distinto, y la diferencia dice algo verdadero sobre la operación mental.

| Verbo | Física | Por qué esa física |
|---|---|---|
| **Definir** | pesada, apenas rebota, impacto único y fuerte | fijar un concepto es un acto puntual y preciso |
| **Conectar** | rebote elástico; solo cobra si toca **dos** clavijas marcadas | una relación necesita dos extremos |
| **Contrastar** | se desvía hacia clavijas de definición parecida | discriminar es ir a buscar al que se te parece |
| **Ejemplificar** | cae rápido hacia las ranuras del fondo | bajar de la abstracción al caso |
| **Generalizar** | al primer impacto se divide en tres bolas menores | un patrón que se aplica a varios casos a la vez |
| **Externalizar** | pegajosa: las clavijas que toca **siguen marcadas el turno siguiente** | sacar el problema de la cabeza al tablero |
| **Transferir** | atraviesa sin rebotar hasta el Portal del fondo | llevar el mecanismo a otro dominio |
| **Anclar** | se clava y cuenta como marcada de forma permanente | el concepto ancla sostiene el resto del mapa |
| **Refutar** | solo contra el jefe; ignora el escudo del marco | la rúbrica atraviesa el argumento |

Ninguna toca la corrección. Todas tocan el rendimiento. La regla se mantiene.

---

## 5. Clavijas especiales, sacadas de campos que ya existen

| Clavija | Campo del bundle | Comportamiento |
|---|---|---|
| Concepto | `concepts` | clavija normal; su `importancia` da el peso del impacto |
| Umbral | `es_umbral` | al sostenerla, **reorganiza el tablero**: aparecen conexiones antes ocultas |
| Puerta | `es_puerta` + aristas `requiere` | bloquea una zona hasta que sostengas su prerrequisito |
| Eco | `content.repertoires` | parece una clavija de concepto; golpearla no hace nada. Se estabiliza marcándola **como Eco** y nombrando dónde sí funcionaba |
| Espejo | pares con `n_efectivo` alto | dos clavijas casi idénticas: la de al lado es el distractor caracterizado |

El Eco es el hallazgo: en un tablero de clavijas, una intuición razonable *parece* un
concepto más. Esa es exactamente la experiencia que queremos producir.

---

## 6. Las ranuras del fondo son las otras mecánicas

Donde termina la bola dispara un encuentro corto, igual que los cubos de Peglin:

- **Ranura Caso** → un `B2`: ¿bajo qué concepto cae esta situación?
- **Ranura Portal** → un `E3` por distancia; la ranura lejana es la que más rinde
- **Ranura Fuente** → consulta gratis de la definición y la página (queda registrada como ayuda)
- **Ranura Atlas** → un vínculo del subgrafo se traza sin combate
- **Ranura Muda** → nada. También tiene que haber tiros que no dan nada.

Así el fondo del tablero deja de ser decoración y se convierte en la vía por la que
entran las mecánicas que no son de relación.

---

## 7. El mapa: rutas fáciles, rutas difíciles, jefes

Esto ya está en v3.3 y solo necesita hacerse legible en los términos que pediste. La
dificultad de una ruta no debe ser un número: debe ser una promesa de qué te va a pedir.

| Etiqueta de ruta | Qué la genera | Qué se siente |
|---|---|---|
| Consolidar | conceptos con `carga_cognitiva: memorizar`, alta `n_efectivo` | seguro, poco Atlas |
| Elaborar | conceptos con `integrar`, muchas aristas | tableros densos, mucho Atlas |
| Umbral | la ruta pasa por `es_umbral` | reorganiza el tablero; caro y transformador |
| Portal | escenarios de distancia lejana | riesgo alto, recompensa alta |

Y el jefe final es EL MARCO: una tesis defendida desde un marco rival, con escudo que
solo atraviesa **Refutar**, y los señuelos salidos de `counterarguments`. Ya está
implementado en v3.3 como encuentro de cartas; en la Mesa se convierte en un tablero
con escudos por fase, una por cada arista `requiere` que sale del concepto umbral.

---

## 8. Lo que hay que vigilar

- **Aritmética.** Peglin muestra números por todas partes. Nuestra regla 1 lo prohíbe
  antes de resolver. La clavija no muestra nada hasta que el tiro termina; entonces
  cae el sello. Si el tablero se llena de cifras, el juego se optimiza sin leer.
- **Duración del turno.** Física más lectura puede irse a dos minutos. La lectura tiene
  que ocurrir **antes** de apuntar: primero se leen las clavijas y se marca, después se
  apunta. Nunca leer con la bola en el aire.
- **Accesibilidad.** La puntería excluye a quien tenga dificultad motora, y el proyecto
  se comprometió a que el modo foco no reduzca oportunidades. Hace falta un **modo
  trayectoria** que muestre la línea prevista completa, y por debajo un modo donde
  marcar equivalga a disparar con impacto garantizado. Quien juegue así debe poder
  llegar al mismo Atlas.
- **Física determinista.** El rebote se calcula con la semilla de la run y el ángulo,
  con paso fijo. Dos runs con la misma semilla dan el mismo tablero y el mismo rebote.
  Eso no es un capricho técnico: hace la tirada reproducible y por tanto auditable por
  el docente, que es lo que exige el contrato de contenido.
- **Tableros que el bundle no sostiene.** Un subgrafo de menos de seis clavijas con
  aristas es un tablero pobre. Con el bundle actual, catorce conceptos califican como
  ancla; los que tienen cero aristas nunca pueden ser el centro de un tablero.

---

## 9. Cómo se construye sin romper v3.3

La abstracción `Embate` de `src/engine/encounters.ts` ya separa *qué se pregunta* de
*cómo se presenta*. La Mesa es una presentación nueva sobre el mismo contrato, no un
motor paralelo.

1. **Semana 1** — motor de física determinista: círculos, gravedad, rebote elástico,
   paso fijo, canvas. Sin contenido, con clavijas de prueba.
2. **Semana 2** — generador de tablero desde un subgrafo: clavijas = conceptos,
   posiciones estables por semilla, ranuras del fondo.
3. **Semana 3** — capa de declaración (marcar clavijas + elegir verbo y relación) y
   resolución con la tabla de la sección 2. Solo para EL ESPEJO.
4. **Semana 4** — modo trayectoria, sello de resolución, integración con el Atlas y
   medición: ¿el jugador marca antes de apuntar, o apunta y luego justifica?

La pregunta que decide si la Mesa entra o se descarta es una sola, y se responde
mirando a alguien jugar: **¿marca las clavijas leyendo, o dispara al montón más denso
y ve qué pasa?** Si es lo segundo, la Mesa es bonita y está midiendo puntería.
