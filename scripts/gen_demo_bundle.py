"""Genera public/bundles/demo.json: un bundle de muestra con la forma real del
extractor, para que el juego sea jugable sin backend. Contenido abreviado."""
import json, hashlib, itertools, random, pathlib

random.seed(7)

C = [
  ("attachment_theory","Teoría del apego","Marco que explica cómo las figuras de apego funcionan como refugio seguro y base segura, moldeando la regulación emocional y la confianza.","teorico","unidad_1","cluster_1",0.9,0.55,True,True,["integrar"],["A","C","D"],["Teoría del apego","attachment theory"],[2,3]),
  ("relational_ai","IA relacional","Inteligencia artificial que sostiene diálogos persistentes y co-creativos, actuando como un agente personificado que puede generar apego y desplazar la autoridad epistémica.","teorico","unidad_1","cluster_1",0.8,0.55,True,False,["integrar"],["A","C","D"],["IA relacional","relational AI"],[1,2]),
  ("apego","Apego","Vínculo emocional que el usuario establece con un agente, con sensación de seguridad, dependencia y búsqueda de consuelo.","teorico","unidad_1","cluster_1",0.6,0.38,False,True,["memorizar"],["A","B","C"],["apego","attachment"],[2,8]),
  ("vigilancia_epistemica","Vigilancia epistémica","Disposición a cuestionar y verificar la información que entrega un agente, medida como índice auditable a lo largo de la interacción.","empirico","unidad_1","cluster_1",0.8,0.75,True,False,["discriminar"],["A","B","C"],["EVI","vigilancia epistémica"],[2,4]),
  ("co_creacion","Co-creación parasocial","Fase en la que usuario y agente construyen juntos el significado, con señales lingüísticas que generan sensación de propiedad compartida.","teorico","unidad_2","cluster_2",0.75,0.35,False,False,["inferir"],["B","C","D"],["co-creación","PCCI"],[3,4]),
  ("refuerzo_linguistico","Refuerzo lingüístico","Conjunto de estrategias —espejado, pronombres inclusivos, reformulación elaborada— que trasladan la autoridad epistémica a la pareja dialógica.","teorico","unidad_2","cluster_2",0.8,0.47,False,True,["discriminar"],["B","C","D"],["refuerzo lingüístico"],[1,4]),
  ("internalizacion","Internalización","Proceso por el que el agente pasa a ser un objeto interno del usuario, de modo que corregirlo se siente como una amenaza al yo.","teorico","unidad_2","cluster_2",0.7,0.48,False,True,["integrar"],["C","D"],["internalización"],[6,7]),
  ("camaras_eco","Cámaras de eco","Entornos donde la exposición repetida a información afín refuerza creencias y reduce la diversidad de perspectivas.","empirico","unidad_2","cluster_2",0.4,0.28,False,False,["memorizar"],["A"],["cámaras de eco","echo chambers"],[2]),
  ("bucles_resonantes","Bucles de amplificación resonante","Retroalimentación en la que sesgos ordinarios se intensifican y recombinan en la interacción uno a uno, produciendo convicciones resistentes a la corrección.","teorico","unidad_3","cluster_3",0.7,0.87,False,False,["integrar"],["C","D","E","F"],["bucles resonantes"],[9]),
  ("interruptores","Interruptores cognitivos","Intervenciones de diseño alineadas a fases que cortan la amplificación y preservan la autonomía del usuario.","aplicado","unidad_3","cluster_3",0.6,0.87,False,False,["inferir"],["C","D","E","F"],["circuit breakers"],[5,6]),
  ("seguridad_epistemica","Seguridad epistémica","Protección de la integridad del conocimiento del usuario frente a la sobre-confianza y la manipulación en la interacción con IA.","teorico","unidad_3","cluster_3",0.6,0.55,False,False,["integrar"],["C","D","E","F"],["seguridad epistémica"],[7,8]),
  ("presencia_social","Presencia social","Sensación de estar con otro en una interacción mediada, producida por señales de la interfaz como el ritmo, la voz o la respuesta adaptativa.","teorico","unidad_1","cluster_1",0.5,0.28,False,False,["memorizar"],["A","B","C"],["presencia social"],[2]),
  ("confianza_calibrada","Confianza calibrada","Ajuste progresivo de la confianza del usuario a la fiabilidad real del sistema, que con el tiempo reduce la monitorización.","empirico","unidad_1","cluster_1",0.55,0.58,False,False,["discriminar"],["A","B","C"],["calibración de confianza"],[3]),
  ("espejado","Espejado","Repetición del contenido y del tono del usuario por parte del agente, que produce sintonía y sensación de ser comprendido.","teorico","unidad_2","cluster_2",0.6,0.4,False,False,["discriminar"],["B","C","D"],["espejado","mirroring"],[4]),
  ("sesgo_confirmacion","Sesgo de confirmación","Tendencia a buscar y valorar la información que confirma lo que ya se creía, ignorando la que lo contradice.","empirico","unidad_2","cluster_2",0.5,0.35,False,False,["memorizar"],["A","B"],["sesgo de confirmación"],[2]),
  ("objeto_interno","Objeto interno","Representación mental de otro significativo que queda incorporada al mundo psíquico y ancla la regulación emocional.","teorico","unidad_3","cluster_3",0.65,0.75,False,True,["integrar"],["C","D","E","F"],["objeto interno"],[4,7]),
  ("autonomia","Autonomía epistémica","Capacidad del usuario de decidir por sí mismo qué creer, sin delegar el juicio en el agente.","teorico","unidad_3","cluster_3",0.6,0.6,False,False,["inferir"],["C","D","E"],["autonomía"],[7,8]),
  ("resistencia_correccion","Resistencia a la corrección","Proporción de la creencia que el usuario mantiene después de recibir evidencia contraria.","empirico","unidad_3","cluster_3",0.5,0.67,False,False,["discriminar"],["A","B","C"],["IRM"],[6,7]),
]

E = [
  ("relational_ai","apego","causa","La IA relacional reconfigura la interacción cubriendo necesidades de apego."),
  ("apego","vigilancia_epistemica","causa","El apego reduce la vigilancia epistémica del usuario."),
  ("attachment_theory","apego","generaliza","La teoría del apego abstrae el fenómeno del apego."),
  ("attachment_theory","relational_ai","apoya","La teoría del apego explica por qué la IA relacional resulta convincente."),
  ("refuerzo_linguistico","co_creacion","apoya","El refuerzo lingüístico sostiene la fase de co-creación."),
  ("co_creacion","internalizacion","causa","La co-creación conduce a la internalización del agente."),
  ("relational_ai","internalizacion","causa","La IA relacional termina internalizándose como objeto psicológico."),
  ("camaras_eco","relational_ai","contrasta","Las cámaras de eco operan en red; la IA relacional, uno a uno."),
  ("bucles_resonantes","internalizacion","requiere","El bucle resonante necesita que la interpretación se haya internalizado."),
  ("interruptores","bucles_resonantes","contrasta","Los interruptores cognitivos cortan los bucles de amplificación."),
  ("interruptores","seguridad_epistemica","apoya","Los interruptores preservan la autonomía y la seguridad epistémica."),
  ("internalizacion","resistencia_correccion","causa","La internalización produce resistencia a la corrección."),
  ("apego","co_creacion","apoya","El apego facilita que aparezca la co-creación parasocial."),
  ("vigilancia_epistemica","seguridad_epistemica","apoya","La vigilancia individual sostiene la seguridad epistémica."),
  ("presencia_social","apego","apoya","La sensación de presencia social prepara el terreno para el apego."),
  ("relational_ai","presencia_social","causa","La IA relacional produce una fuerte sensación de presencia social."),
  ("confianza_calibrada","vigilancia_epistemica","apoya","Calibrar la confianza sostiene la vigilancia epistémica."),
  ("apego","confianza_calibrada","contrasta","El apego descalibra la confianza en vez de ajustarla."),
  ("espejado","refuerzo_linguistico","ejemplifica","El espejado es un caso concreto de refuerzo lingüístico."),
  ("espejado","co_creacion","causa","El espejado produce la sensación de estar co-creando."),
  ("sesgo_confirmacion","camaras_eco","causa","El sesgo de confirmación alimenta las cámaras de eco."),
  ("bucles_resonantes","sesgo_confirmacion","generaliza","El bucle resonante abstrae y recombina el sesgo de confirmación."),
  ("objeto_interno","internalizacion","generaliza","El objeto interno es la forma general de lo que la internalización produce."),
  ("internalizacion","objeto_interno","requiere","Internalizar exige que se forme un objeto interno."),
  ("interruptores","autonomia","apoya","Los interruptores cognitivos protegen la autonomía."),
  ("autonomia","seguridad_epistemica","apoya","La autonomía individual sostiene la seguridad epistémica."),
  ("objeto_interno","resistencia_correccion","causa","Un objeto interno consolidado produce resistencia a la corrección."),
  ("bucles_resonantes","camaras_eco","matiza","El bucle resonante precisa lo que las cámaras de eco dejan sin explicar."),
  ("relational_ai","bucles_resonantes","ejemplifica","La IA relacional es el caso concreto donde el bucle se observa."),
]

REPS = [
  ("rep_apego","apego","El apego como simple afinidad",
   "Un cliente habitual confía a ciegas en la recomendación del barista porque le cae bien.",
   "La intuición trata el apego como un vínculo que siempre aumenta la fiabilidad; aquí es una fase que REDUCE la vigilancia epistémica.",
   "En trato cara a cara, la afinidad suele correlacionar con consejos acertados porque la persona conocida habla desde experiencia real.","confianza"),
  ("rep_cocreacion","co_creacion","Co-crear es repartir la autoridad por igual",
   "Quien escribe un relato junto a un chatbot asume que el resultado vale tanto como una obra a cuatro manos humanas.",
   "La co-creación no reparte autoridad: el refuerzo lingüístico traslada la autoridad al «nosotros», que se percibe más verdadero que cualquiera de las partes.",
   "En proyectos creativos grupales la co-creación sí eleva la calidad, porque los aportes son complementarios y verificables.","co_creacion"),
  ("rep_internalizacion","internalizacion","Internalizar es haber aprendido bien",
   "Quien memoriza la explicación de un asistente la da por válida incluso cuando la evidencia posterior la contradice.",
   "La intuición equipara internalizar con acertar; aquí internalizar es incorporar al agente como parte del yo, lo que genera rigidez ante la corrección.",
   "En el estudio con material correcto, la repetición sí produce retención útil.","bucles_resonantes"),
]

CASOS = [
  ("case_companion_vs_tool","Diseño factorial que compara una condición de «acompañante» contra una de «herramienta» para medir la caída de la vigilancia epistémica.",
   ["apego","vigilancia_epistemica","relational_ai"],"apego","interacción humano-computadora",
   "Se espera menos clics de verificación y peor atribución de fuente en la condición acompañante, mediado por la seguridad percibida.",
   ["manipulación de apego","clics de verificación","tiempo con evidencia contraria","seguridad percibida"],True),
  ("case_debias_longitudinal","Diseño longitudinal que mide cuánta creencia se conserva tras un procedimiento de des-sesgo, comparando agente compañero y agente herramienta.",
   ["internalizacion","resistencia_correccion","relational_ai"],"internalizacion","interacción humano-computadora",
   "El grupo compañero conserva más creencia tras el des-sesgo, señal de resistencia derivada de la internalización.",
   ["condición del agente","medición previa y posterior","señales de internalización en el diálogo"],True),
  ("case_dark_patterns","Una aplicación de bienestar usa lenguaje emocional y notificaciones persistentes para empujar una compra, saltándose los avisos de gasto.",
   ["interruptores","seguridad_epistemica","relational_ai"],"interruptores","interacción humano-computadora",
   "Es un patrón oscuro que compromete la seguridad epistémica: hacen falta interruptores auditables que detecten vulnerabilidad y detengan la transacción.",
   ["tipo de patrón","presencia de interruptor","autonomía percibida"],False),
]

ESCEN = [
  ("sc_mentoria","En un programa de mentoría juvenil, quienes vienen de entornos sobreprotectores se vinculan rápido con su mentor y aceptan sus opiniones como verdades absolutas.",
   ["apego","vigilancia_epistemica","interruptores"],"lejana","educación",
   "Hay que aplicar apego y vigilancia al vínculo mentor-estudiante y proponer interrupciones externas —debate con otros mentores— que reactiven el escrutinio.",
   "Confundir el apego sano con la caída de la vigilancia epistémica."),
  ("sc_secta","Un grupo de influencia usa jerga propia y espejado de gestos del líder; los nuevos miembros dejan de cuestionar las premisas.",
   ["refuerzo_linguistico","co_creacion","vigilancia_epistemica"],"lejana","psicología social",
   "El refuerzo lingüístico y la co-creación de identidad desactivan la vigilancia epistémica y permiten aceptar dogmas sin análisis.",
   None),
  ("sc_soporte","En un foro de soporte, los moderadores muy empáticos («entiendo tu frustración, yo pasé por eso») logran que se acepten soluciones técnicamente incorrectas.",
   ["refuerzo_linguistico","vigilancia_epistemica"],"media","interacción humano-computadora",
   "La alta co-creación baja la vigilancia: se acepta por conexión social y no por verificación técnica.",
   None),
  ("sc_idiomas","Una app de idiomas ofrece corrección gramatical fría frente a un avatar que simula ser un amigo nativo; se mide si el usuario ignora las correcciones que contradicen su intuición.",
   ["internalizacion","resistencia_correccion","interruptores"],"cercana","interacción humano-computadora",
   "El avatar produce más resistencia a la corrección porque el aprendizaje fue relacional y no solo técnico.",
   "Atribuir la resistencia a que el avatar enseña mejor, confundiendo eficacia con internalización."),
  ("sc_telemedicina","Un agente de telemedicina crea dependencia afectiva para asegurar la adherencia al tratamiento, e invisibiliza los efectos secundarios.",
   ["interruptores","seguridad_epistemica","relational_ai"],"media","salud",
   "Crear vínculo para manipular la adherencia erosiona la seguridad epistémica: hacen falta interruptores que presenten el riesgo desligado del vínculo.",
   None),
  ("sc_corporativo","Empleados formados por un mentor carismático resisten cambiar métodos ineficientes mucho más que quienes aprendieron del manual.",
   ["internalizacion","resistencia_correccion"],"lejana","psicología organizacional",
   "El método se internalizó como parte de un vínculo de lealtad, no como instrucción técnica: por eso resiste la corrección.",
   None),
]

TESIS = [
  ("tesis_interruptores","Los interruptores cognitivos alineados a fases preservan la autonomía incluso bajo incentivos que maximizan el enganche.",
   ["interruptores","seguridad_epistemica","apego"],"framework_raf",
   ["Son controles concretos atados a cada fase del proceso.","Reducen la sobre-dependencia sin bajar el nivel del contenido."],
   ["Un aviso demasiado directivo puede provocar reactancia y reducir la autonomía.","La variación cultural limita que un mismo umbral sirva en todas partes."],
   ["Estudios que muestren menos sobre-dependencia frente a un grupo control.","Mejora medible de vigilancia y resistencia tras desplegar el interruptor."],
   ["Un experimento donde el interruptor aumente la reactancia frente a la línea base.","Ausencia de mejora medible en los índices tras la intervención.","Ensayos interculturales sin beneficio o con efecto adverso."]),
  ("tesis_secuencia","La secuencia apego → co-creación → internalización explica el refuerzo de creencias mejor que los modelos de cámara de eco.",
   ["bucles_resonantes","camaras_eco","co_creacion"],None,
   ["Incorpora apego y señales de propiedad lingüística que la cámara de eco no considera.","El contexto uno a uno es adaptativo, no una difusión de red."],
   ["La exposición repetida y la selección algorítmica ya explican el reforzamiento.","La polarización en redes muestra patrones muy parecidos."],
   ["Mostrar que los índices de fase predicen el cambio de creencia por encima de la exposición.","Formular predicciones que distingan una trayectoria de la otra."],
   ["Datos donde la variación de creencia se explique por completo con métricas de exposición.","Evidencia de que los índices de fase no añaden poder predictivo."]),
  ("tesis_auditable","Las señales de propiedad lingüística se pueden observar en transcripciones y sirven para auditar la internalización.",
   ["refuerzo_linguistico","internalizacion"],None,
   ["La propiedad lingüística es observable en el diálogo y accionable en diseño."],
   ["La detección automática es ruidosa y puede no corresponder a procesos internos.","Auditar por uso y satisfacción podría bastar."],
   ["Fiabilidad entre anotadores al codificar el refuerzo en un corpus.","Manipular la señal y observar cambios en la resistencia a la corrección."],
   ["Mostrar que la resistencia no se asocia a la presencia de refuerzo lingüístico.","Demostrar que otras métricas capturan mejor el riesgo."]),
]

MARCOS = [
  ("framework_raf","Marco de amplificación resonante",["apego","co_creacion","internalizacion","refuerzo_linguistico"],
   ["El apego baja la vigilancia epistémica.","La co-creación reubica la autoridad en el «nosotros».","La internalización estabiliza la resistencia."],
   ["framework_casa","framework_eco"]),
  ("framework_casa","Ordenadores como actores sociales",["relational_ai"],
   ["Las personas aplican reglas sociales a las máquinas.","Señales simples de interfaz bastan para producir respuesta social."],["framework_raf"]),
  ("framework_eco","Modelo de cámaras de eco",["camaras_eco"],
   ["La exposición repetida a información afín refuerza la creencia.","El filtrado algorítmico reduce la diversidad de fuentes."],["framework_raf"]),
]

def h(*p):
    return hashlib.sha1("|".join(map(str, p)).encode()).hexdigest()[:10]

conceptos = {}
for (cid, tit, defi, tipo, uni, clu, imp, dif, puerta, umbral, carga, fams, sin, pags) in C:
    conceptos[cid] = dict(
        id=cid, titulo=tit, definicion=defi, definicion_corta=defi, tipo=tipo,
        unidad_id=uni, importancia=imp, dificultad_objetivo=dif, es_puerta=puerta,
        es_umbral=umbral, carga_cognitiva=carga, familias_recomendadas=fams,
        sinonimos=sin, paginas=pags, subdimensiones=[], tensiones=[],
        n_fuentes=1, posicion=list(conceptos).__len__() + 1, andamiaje="medio",
        dificultad_declarada="intermedio", n_efectivo=0, n_opciones=0, n_distractores=0,
        _cluster=clu,
    )

vecinos = {cid: set() for cid in conceptos}
for a, b, *_ in E:
    vecinos[a].add(b); vecinos[b].add(a)

# pools de distractores: distinción (con explicación) + vecindad
pools = {}
for cid, c in conceptos.items():
    otros = [o for o in conceptos if o != cid]
    vs = sorted(vecinos[cid])
    resto = [o for o in otros if o not in vs]
    elegidos = (vs + resto)[:5]
    pool = []
    # los distractores de repertorio van PRIMERO: son los más valiosos y deben
    # entrar en los items, no quedarse al final del pool sin usarse nunca
    for r in REPS:
        if r[1] == cid:
            pool.append(dict(id=f"rep_{h(r[0])}", texto=r[3], fuente="repertorio",
                             etiqueta=r[2], explicacion=f"{r[4]} Donde sí funciona: {r[5]}",
                             plausibilidad=0.95, repertoire_id=r[0], concepto_confundido=r[6]))
    for i, o in enumerate(elegidos):
        caracterizado = i < 2
        pool.append(dict(
            id=f"dist_{h(cid,o)}", texto=conceptos[o]["definicion_corta"],
            fuente="distincion" if caracterizado else "vecino_grafo",
            etiqueta=conceptos[o]["titulo"],
            explicacion=(f"«{conceptos[o]['titulo']}» nombra otra cosa: {conceptos[o]['definicion_corta']} "
                         f"Lo que separa a «{c['titulo']}» es su papel dentro del proceso.")
                        if caracterizado else "",
            plausibilidad=0.9 if caracterizado else 0.6,
            repertoire_id=None, concepto_confundido=o))
    pools[cid] = pool
    c["n_distractores"] = len(pool)
    c["n_efectivo"] = round(1 + 0.75 * len(pool), 2)
    c["n_opciones"] = min(5, len(pool) + 1)

items = {"A1": [], "A3": [], "B1": [], "B2": [], "C1": [], "E1": [], "E2": [], "E3": []}

for cid, c in conceptos.items():
    pool = pools[cid]
    k = min(c["n_opciones"] - 1, len(pool))
    sel = pool[:k]
    items["A1"].append(dict(
        id=f"A1_{h(cid)}", mechanic_id="A1", concept_id=cid,
        enunciado=f"¿Cuál corresponde a «{c['titulo']}»?",
        dificultad=c["dificultad_objetivo"], n_efectivo=c["n_efectivo"],
        opciones=[dict(id="correcta", texto=c["definicion_corta"], es_correcta=True,
                       feedback="", repertoire_id=None, concepto_confundido=None,
                       contexto_donde_funciona="")] +
                 [dict(id=d["id"], texto=d["texto"], es_correcta=False,
                       feedback=d["explicacion"], repertoire_id=d["repertoire_id"],
                       concepto_confundido=d["concepto_confundido"],
                       contexto_donde_funciona="") for d in sel]))
    items["A3"].append(dict(
        id=f"A3_{h(cid)}", mechanic_id="A3", concept_id=cid,
        enunciado=f"¿Qué concepto se define así? «{c['definicion_corta']}»",
        dificultad=c["dificultad_objetivo"], respuestas_aceptadas=c["sinonimos"] or [c["titulo"]]))

    # B1 con polaridad mixta: la mitad verdaderas
    for i, d in enumerate(sel[:2]):
        verdadera = (i % 2 == 0)
        items["B1"].append(dict(
            id=f"B1_{h(cid,d['id'],i)}", mechanic_id="B1", concept_id=cid,
            enunciado=f"¿Esta afirmación describe «{c['titulo']}»?",
            afirmacion=c["definicion_corta"] if verdadera else d["texto"],
            dificultad=c["dificultad_objetivo"], n_efectivo=2.0,
            respuesta_correcta=verdadera,
            concepto_confundido=None if verdadera else d["concepto_confundido"],
            feedback=("El texto atribuye exactamente esto a ese concepto."
                      if verdadera else d["explicacion"] or
                      f"Eso describe a «{conceptos[d['concepto_confundido']]['titulo']}»."
                      if d["concepto_confundido"] in conceptos else "Eso describe a otro concepto."),
            repertoire_id=d["repertoire_id"]))

for (a, b, tipo, desc) in E:
    opciones = sorted({t for _, _, t, _ in E} | {"apoya", "causa", "contrasta", "requiere"})
    items["C1"].append(dict(
        id=f"C1_{h(a,b)}", mechanic_id="C1", par=[a, b],
        enunciado=f"¿Qué relación va de «{conceptos[a]['titulo']}» a «{conceptos[b]['titulo']}»?",
        dificultad=round((conceptos[a]["dificultad_objetivo"] + conceptos[b]["dificultad_objetivo"]) / 2, 2),
        n_efectivo=len(opciones), opciones=opciones, respuesta_correcta=tipo, explicacion=desc))

for (cid_, desc, cids, princ, dom, res, vars_, pred) in CASOS:
    otros = [x for x in conceptos if x not in cids][:3]
    items["B2"].append(dict(
        id=f"B2_{h(cid_)}", mechanic_id="B2", case_id=cid_, enunciado=desc,
        dificultad=conceptos[princ]["dificultad_objetivo"], n_efectivo=4,
        opciones=[princ] + otros, respuesta_correcta=princ))
    if pred:
        items["E1"].append(dict(
            id=f"E1_{h(cid_)}", mechanic_id="E1", origen="caso", origen_id=cid_,
            enunciado=desc, dificultad=conceptos[princ]["dificultad_objetivo"],
            concept_ids=cids, variables_clave=vars_, resolucion_esperada=res,
            dominio=dom, distancia="cercana", requiere_juez=True))

for (sid, desc, cids, dist, dom, res, err) in ESCEN:
    items["E3"].append(dict(
        id=f"E3_{h(sid)}", mechanic_id="E3", origen="escenario", origen_id=sid,
        enunciado=desc, dificultad=0.6, concept_ids=cids, distancia=dist,
        dominio=dom, resolucion_esperada=res, requiere_juez=True, variables_clave=[]))

por_tipo, ady = {}, {cid: [] for cid in conceptos}
for (a, b, tipo, desc) in E:
    e = dict(**{"from": a}, to=b, tipo=tipo, descripcion=desc)
    por_tipo.setdefault(tipo, []).append(e)
    ady[a].append(e)
    ady[b].append(dict(**{"from": a}, to=b, tipo=tipo, descripcion=desc, invertida=True))

clusters = {}
for (cid, *_rest) in C:
    clusters.setdefault(conceptos[cid].pop("_cluster"), []).append(cid)

unidades = {}
for cid, c in conceptos.items():
    unidades.setdefault(c["unidad_id"], []).append(cid)

MODALIDAD = {"attachment_theory":"disposicional","relational_ai":"situacional","apego":"disposicional",
 "vigilancia_epistemica":"disposicional","co_creacion":"situacional","refuerzo_linguistico":"situacional",
 "internalizacion":"disposicional","camaras_eco":"situacional","bucles_resonantes":"situacional",
 "interruptores":"situacional","seguridad_epistemica":"disposicional","resistencia_correccion":"disposicional"}
PROFUNDIDAD = {k: ("superficial" if v < 0.5 else "profundo")
               for k, v in ((cid, c["dificultad_objetivo"]) for cid, c in conceptos.items())}

bundle = dict(
    bundle_version="1.0.0-demo", compiled_from_schema="2.1.0",
    source_filename="Bundle de muestra — amplificación resonante (contenido abreviado)",
    course_id="demo", fuentes=[dict(id="demo", title="Bundle de muestra")],
    concepts=conceptos,
    graph=dict(
        por_tipo=por_tipo, adyacencia=ady,
        clusters=[dict(id=k, label=f"Grupo {i+1}", concept_ids=v) for i, (k, v) in enumerate(sorted(clusters.items()))],
        ejes=[dict(id="eje_modalidad", nombre="Modalidad relacional", provisional=False, valores=MODALIDAD),
              dict(id="eje_profundidad", nombre="Profundidad del proceso", provisional=False, valores=PROFUNDIDAD)]),
    items=items,
    distractor_pools=pools,
    content=dict(
        repertoires=[dict(id=r[0], concept_id=r[1], label=r[2], example=r[3],
                          contraste_cientifico=r[4], contexto_donde_funciona=r[5],
                          concepto_confundido=r[6], description=r[2], status="borrador",
                          origin="inferido_por_llm", confidence_extraction=0.9) for r in REPS],
        cases=[dict(id=c[0], description=c[1], concept_ids=c[2], primary_concept_id=c[3],
                    dominio=c[4], resolucion_esperada=c[5], variables_clave=c[6],
                    prediction_enabled=c[7], status="borrador", kind="experimento",
                    confidence_extraction=0.8) for c in CASOS],
        scenarios=[dict(id=s[0], description=s[1], concept_ids=s[2], distancia=s[3],
                        dominio=s[4], resolucion_esperada=s[5], error_embebido=s[6],
                        status="borrador", habilidad_objetivo="transferencia",
                        confidence_extraction=0.85) for s in ESCEN],
        theses=[dict(id=t[0], statement=t[1], concept_ids=t[2], framework_id=t[3],
                     supporting_arguments=t[4], counterarguments=t[5],
                     criterios_defensa_valida=t[6], criterios_refutacion_valida=t[7],
                     status="borrador", confidence_extraction=0.8) for t in TESIS],
        frameworks=[dict(id=m[0], label=m[1], concept_ids=m[2], principios_centrales=m[3],
                         rivales=m[4], status="borrador", confidence_extraction=0.9) for m in MARCOS]),
    study_plan=dict(
        orden=list(conceptos),
        unidades=[dict(id=u, numero=i+1,
                       titulo=conceptos[cs[0]]["titulo"] + (f" y {len(cs)-1} más" if len(cs) > 1 else ""),
                       concept_ids=cs,
                       tiene_puerta=any(conceptos[c]["es_puerta"] for c in cs),
                       tiene_umbral=any(conceptos[c]["es_umbral"] for c in cs),
                       dificultad_media=round(sum(conceptos[c]["dificultad_objetivo"] for c in cs)/len(cs), 2))
                  for i, (u, cs) in enumerate(sorted(unidades.items()))],
        curva_dificultad=[dict(unidad_id=u, dificultad_objetivo=round(0.45 + 0.18*i, 2),
                               n_opciones_sugerido=3 + i, andamiaje_sugerido=["medio","medio","bajo"][min(i,2)])
                          for i, u in enumerate(sorted(unidades))],
        calidad=dict(nivel="buena", senales_usadas=5, aristas_orientativas=len(E), aristas_prerequisito=1)),
    capabilities=dict(condiciones=dict(
        cadena=dict(instanciable=True), umbral=dict(instanciable=True),
        enjambre=dict(instanciable=True), monocultivo=dict(instanciable=True),
        eco_de_intuicion=dict(instanciable=True), marco_rival=dict(instanciable=True),
        portal_por_distancia=dict(instanciable=True))),
    conceptos_con_problemas=[],
    readiness=[], mechanics={}, items_descartados=[],
    stats=dict(conceptos=len(conceptos), aristas=len(E),
               items_precompilados=sum(len(v) for v in items.values())))

out = pathlib.Path("public/bundles/demo.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(bundle, ensure_ascii=False, indent=1), encoding="utf-8")
print("conceptos", len(conceptos), "aristas", len(E),
      "items", {k: len(v) for k, v in items.items() if v},
      "bytes", out.stat().st_size)
