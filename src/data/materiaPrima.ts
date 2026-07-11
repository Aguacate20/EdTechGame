import type { MateriaPrima } from '@/game-core/types';

// Materia prima de ejemplo — misma forma que emite el pipeline de extracción
// (capas 1 y 3 del doc 06). Dominio: confianza en IA y toma de decisiones,
// el paper con el que se validó el pipeline. En la siguiente iteración esto
// se reemplaza por un fetch al backend de extracción (HF Space).

export const CURSO_DEMO: MateriaPrima = {
  course_id: 'confianza-ia-demo',
  course_nombre: 'Confianza en IA y toma de decisiones',
  repertoires: [
    {
      repertoire_id: 'R_maquina_objetiva',
      nombre: 'La máquina es objetiva',
      enunciado:
        'Como el algoritmo no tiene emociones, sus resultados son neutrales y libres de sesgo.',
    },
    {
      repertoire_id: 'R_humano_siempre_mejor',
      nombre: 'El humano siempre sabe más',
      enunciado:
        'Ante la duda, el juicio de una persona experta siempre es más confiable que el de un algoritmo.',
    },
    {
      repertoire_id: 'R_caja_negra_inutil',
      nombre: 'Si no lo entiendo, no sirve',
      enunciado:
        'Un sistema que no puedo explicar por dentro no puede ser confiable en absoluto.',
    },
  ],
  concepts: [
    {
      concept_id: 'confianza_calibrada',
      fragmento:
        'Ajustar el nivel de confianza a la fiabilidad demostrada del sistema —ni más, ni menos— se conoce como ____.',
      label: 'Confianza calibrada',
      definicion_formal:
        'Ajuste del nivel de confianza del usuario a la fiabilidad real y demostrada del sistema, evitando tanto la sobreconfianza como la desconfianza injustificada.',
      definicion_intuitiva:
        'Confiar en la IA exactamente tanto como merece: ni más, ni menos.',
      sinonimos: ['calibración de confianza', 'confianza apropiada'],
      enunciado_correcto:
        'La confianza calibrada requiere evidencia sobre el desempeño real del sistema en el contexto de uso.',
      enunciado_incorrecto:
        'La confianza calibrada consiste en mantener siempre un nivel medio de confianza para no equivocarse.',
      distractor_caracterizado: {
        label: 'Confiar siempre al 50%',
        repertoire_id: 'R_humano_siempre_mejor',
      },
    },
    {
      concept_id: 'aversion_algoritmica',
      fragmento:
        'Descartar al algoritmo tras verlo fallar una vez, aunque acierte más que el humano, es la ____.',
      label: 'Aversión algorítmica',
      definicion_formal:
        'Tendencia a descartar las recomendaciones de un algoritmo tras observar que comete errores, incluso cuando su desempeño promedio supera al humano.',
      definicion_intuitiva:
        'Perderle la fe al algoritmo al primer error, aunque en promedio acierte más que una persona.',
      sinonimos: ['algorithm aversion', 'rechazo algorítmico'],
      enunciado_correcto:
        'La aversión algorítmica se intensifica después de ver fallar al algoritmo, más que ante errores humanos equivalentes.',
      enunciado_incorrecto:
        'La aversión algorítmica aparece solo en personas sin formación técnica.',
      distractor_caracterizado: {
        label: 'Desconfianza racional',
        repertoire_id: 'R_humano_siempre_mejor',
      },
    },
    {
      concept_id: 'apreciacion_algoritmica',
      fragmento:
        'Preferir el consejo por el solo hecho de venir de un algoritmo se denomina ____.',
      label: 'Apreciación algorítmica',
      definicion_formal:
        'Tendencia a preferir el consejo de un algoritmo sobre el de un humano, observada especialmente en tareas percibidas como objetivas o cuantitativas.',
      definicion_intuitiva:
        'Preferir lo que dice el algoritmo por el solo hecho de venir de un algoritmo.',
      sinonimos: ['algorithm appreciation'],
      enunciado_correcto:
        'La apreciación algorítmica es más frecuente cuando la tarea se percibe como objetiva o de cálculo.',
      enunciado_incorrecto:
        'La apreciación algorítmica demuestra que los algoritmos son de hecho más precisos en toda tarea.',
      distractor_caracterizado: {
        label: 'Precisión garantizada',
        repertoire_id: 'R_maquina_objetiva',
      },
    },
    {
      concept_id: 'sesgo_automatizacion',
      fragmento:
        'Aceptar la salida del sistema sin verificarla, omitiendo señales contradictorias, es el ____.',
      label: 'Sesgo de automatización',
      definicion_formal:
        'Tendencia a aceptar las salidas de un sistema automatizado sin verificarlas, omitiendo información contradictoria disponible.',
      definicion_intuitiva:
        'Piloto automático mental: si lo dijo el sistema, no lo reviso.',
      sinonimos: ['automation bias', 'complacencia automatizada'],
      enunciado_correcto:
        'El sesgo de automatización puede llevar a errores por omisión: no actuar porque el sistema no alertó.',
      enunciado_incorrecto:
        'El sesgo de automatización desaparece por completo cuando el usuario es experto en el dominio.',
      distractor_caracterizado: {
        label: 'Delegación segura',
        repertoire_id: 'R_maquina_objetiva',
      },
    },
    {
      concept_id: 'explicabilidad',
      fragmento:
        'Que el sistema ofrezca razones comprensibles y cuestionables de sus salidas es la ____.',
      label: 'Explicabilidad',
      definicion_formal:
        'Capacidad de un sistema de IA de ofrecer razones comprensibles para sus salidas, de modo que un humano pueda evaluarlas y cuestionarlas.',
      definicion_intuitiva:
        'Que la IA pueda mostrar el porqué de su respuesta en términos que una persona entienda.',
      sinonimos: ['XAI', 'interpretabilidad orientada al usuario'],
      enunciado_correcto:
        'La explicabilidad busca que el usuario pueda evaluar y cuestionar las salidas del sistema.',
      enunciado_incorrecto:
        'Un sistema sin explicabilidad total es necesariamente inservible para cualquier decisión.',
      distractor_caracterizado: {
        label: 'Transparencia total o nada',
        repertoire_id: 'R_caja_negra_inutil',
      },
    },
    {
      concept_id: 'transparencia',
      fragmento:
        'Divulgar cómo funciona el sistema, con qué datos y dónde falla, constituye la ____.',
      label: 'Transparencia',
      definicion_formal:
        'Grado en que se divulga información sobre el funcionamiento, los datos y las limitaciones de un sistema de IA a sus usuarios y evaluadores.',
      definicion_intuitiva:
        'Cuánto deja ver el sistema sobre cómo está hecho, con qué datos y dónde falla.',
      sinonimos: ['apertura del sistema'],
      enunciado_correcto:
        'La transparencia incluye comunicar las limitaciones y los casos donde el sistema falla.',
      enunciado_incorrecto:
        'La transparencia consiste únicamente en publicar el código fuente del modelo.',
    },
    {
      concept_id: 'delegacion_decisiones',
      fragmento:
        'Transferir autoridad decisoria a un sistema, con distintos niveles de supervisión, es la ____.',
      label: 'Delegación de decisiones',
      definicion_formal:
        'Transferencia parcial o total de la autoridad decisoria de un humano hacia un sistema automatizado, con distintos niveles de supervisión.',
      definicion_intuitiva:
        'Dejar que el sistema decida por ti, con más o menos vigilancia de tu parte.',
      sinonimos: ['decision delegation', 'autonomía delegada'],
      enunciado_correcto:
        'La delegación de decisiones admite grados: desde sugerencia supervisada hasta autonomía plena.',
      enunciado_incorrecto:
        'Delegar una decisión a un sistema elimina la responsabilidad humana sobre el resultado.',
      distractor_caracterizado: {
        label: 'Responsabilidad transferida',
        repertoire_id: 'R_maquina_objetiva',
      },
    },
    {
      concept_id: 'confianza_inicial',
      fragmento:
        'La disposición a confiar antes de la primera experiencia directa se llama ____.',
      label: 'Confianza inicial',
      definicion_formal:
        'Disposición a confiar en un sistema antes de tener experiencia directa con él, influida por reputación, diseño y expectativas previas.',
      definicion_intuitiva:
        'La confianza que le das a un sistema antes de haberlo probado.',
      sinonimos: ['initial trust', 'confianza a priori'],
      enunciado_correcto:
        'La confianza inicial se forma con señales indirectas: reputación, apariencia y expectativas.',
      enunciado_incorrecto:
        'La confianza inicial es irrelevante porque se corrige de inmediato con el primer uso.',
    },
  ],
  // Capa 5 — casos: cada caso es un "enemigo" potencial; su debilidad
  // es el concepto que lo explica (E3 APLICAR, B2 CLASIFICAR).
  casos: [
    {
      case_id: 'caso_dosis',
      texto:
        'Un médico acepta la dosis que sugiere el sistema sin revisar la historia clínica, y pasa por alto una alergia registrada.',
      concepto_correcto: 'sesgo_automatizacion',
    },
    {
      case_id: 'caso_pronostico',
      texto:
        'Tras ver al modelo equivocarse una sola vez, la analista vuelve a hacer todos los cálculos a mano, aunque el modelo acierta más que ella.',
      concepto_correcto: 'aversion_algoritmica',
    },
    {
      case_id: 'caso_estimacion',
      texto:
        'En una tarea de cálculo, los participantes prefieren la estimación del algoritmo sobre la de un experto humano, solo por venir de una máquina.',
      concepto_correcto: 'apreciacion_algoritmica',
    },
    {
      case_id: 'caso_universidad',
      texto:
        'Antes de usar la nueva app de diagnóstico, la doctora ya confía en ella porque la desarrolló una universidad prestigiosa.',
      concepto_correcto: 'confianza_inicial',
    },
    {
      case_id: 'caso_banco',
      texto:
        'El banco publica qué datos usa su modelo de crédito, cómo fue entrenado y en qué poblaciones falla más.',
      concepto_correcto: 'transparencia',
    },
    {
      case_id: 'caso_razones',
      texto:
        'El sistema muestra las tres razones principales de cada recomendación para que el usuario pueda cuestionarlas.',
      concepto_correcto: 'explicabilidad',
    },
    {
      case_id: 'caso_piloto',
      texto:
        'La aerolínea permite que el piloto automático aterrice, pero exige que el piloto humano supervise y pueda intervenir.',
      concepto_correcto: 'delegacion_decisiones',
    },
    {
      case_id: 'caso_alarma',
      texto:
        'Después de cincuenta usos, la enfermera confía en la alarma exactamente en la medida en que ha demostrado acertar.',
      concepto_correcto: 'confianza_calibrada',
    },
    {
      case_id: 'caso_gps',
      texto:
        'El conductor sigue la ruta del navegador hacia un puente cerrado, ignorando la señal de desvío que tiene enfrente.',
      concepto_correcto: 'sesgo_automatizacion',
    },
    {
      case_id: 'caso_recontratar',
      texto:
        'El comité descarta la herramienta de selección tras un falso positivo, pero mantiene al reclutador que se equivoca el doble.',
      concepto_correcto: 'aversion_algoritmica',
    },
  ],
  // Capa 2 — relaciones entre conceptos (C1 CONECTAR; combos futuros)
  relaciones: [
    {
      relation_id: 'rel_aversion_apreciacion',
      origen: 'aversion_algoritmica',
      destino: 'apreciacion_algoritmica',
      tipo: 'contraste',
      enunciado:
        'Son tendencias opuestas ante el mismo consejo algorítmico: rechazarlo tras un error vs preferirlo por su origen.',
    },
    {
      relation_id: 'rel_delegacion_sesgo',
      origen: 'delegacion_decisiones',
      destino: 'sesgo_automatizacion',
      tipo: 'condiciona',
      enunciado:
        'Delegar sin supervisión aumenta el riesgo de aceptar salidas sin verificarlas.',
    },
    {
      relation_id: 'rel_explicabilidad_calibrada',
      origen: 'explicabilidad',
      destino: 'confianza_calibrada',
      tipo: 'habilita',
      enunciado:
        'Las razones comprensibles del sistema aportan la evidencia que permite calibrar la confianza.',
    },
    {
      relation_id: 'rel_transparencia_inicial',
      origen: 'transparencia',
      destino: 'confianza_inicial',
      tipo: 'influye',
      enunciado:
        'Lo que el sistema divulga de sí mismo moldea las expectativas antes del primer uso.',
    },
  ],
};
