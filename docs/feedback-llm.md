# Feedback en dos capas: grafo + LLM

## Capa 1 (hecha, v5.65): orientación derivada del grafo
`engine/feedback.ts` cubre todo lo que se puede afirmar con certeza desde el bundle: dirección,
tipo, existencia del vínculo, procedencia de una descripción, zona, casos, criterios. Es
determinista, instantánea, sin costo, y usa las palabras del autor (descripción de la arista,
evidencia textual). Es la base; la capa 2 no la sustituye.

## Capa 2 (por hacer): explicación con LLM, solo donde el grafo calla
Cuándo se llama (nunca en cada trazo): (a) tercer fallo seguido sobre el mismo par o concepto;
(b) el estudiante pide «¿por qué?» en el veredicto; (c) modo aprendizaje, al cerrar la sala,
sobre el trazo que más costó. Máximo una llamada por sala; en móvil, solo a petición.

Endpoint: `POST /tutor/orientar` con `{ concepto_a, concepto_b, tipo_trazado, veredicto,
arista_real | null, evidencia_a, evidencia_b, intuiciones_cercanas, historial_del_par }`.
Prompt del sistema: «Eres el tutor de LudusCog. No des la respuesta. En tres frases: (1) por
qué la relación que trazó el estudiante es razonable (qué la hace tentadora), (2) qué criterio
distingue lo que dijo de lo que dice el texto, (3) una pregunta que le permita encontrarlo por
sí mismo. Usa solo la evidencia que te doy; si no alcanza, di que el texto no lo resuelve.»
Salida JSON `{ razonable, criterio, pregunta }`, ≤ 60 palabras por campo, en el idioma del
texto. Modelo: el pool del extractor (capa 4 primero, que es la de argumentación). Caché por
`(par, tipo_trazado, veredicto)`: el mismo error de dos estudiantes recibe la misma
explicación, y el profesor puede revisarla en Biblioteca.

Reglas pedagógicas (aplican a las dos capas): informativo, no evaluativo («la dirección va al
revés», no «mal»); apunta a la evidencia; propone una acción; retiene la respuesta cuando el
estudiante puede encontrarla (andamiaje contingente: más ayuda tras más fallos, no antes); se
registra como señal `ayuda` en el Atlas para que la Lucidez no la cuente como acierto propio.
