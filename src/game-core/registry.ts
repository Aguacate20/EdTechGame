// ============================================================
// Registro del catálogo (todas las piezas no-multijugador, docs 07/08).
// Cada pieza declara su ROL EN EL JUEGO — el verbo que añade al crawler.
// Principio: agregar una pieza cambia CÓMO se juega, no cuántas
// preguntas hay. estado:
//   'jugable'       → implementada en el crawler v0.3
//   'taller'        → mapeada, pendiente de implementación
//   'requiere_juez' → necesita el rol Juez del LLM en runtime (backend)
// ============================================================

export type Estado = 'jugable' | 'taller' | 'requiere_juez';

export interface MechanicMeta {
  id: string;
  familia: string;
  rank: number; // escalado cognitivo A=1 B=2 C=3 D=3 E=4 F=4 G/I=0 (meta)
  nombre: string;
  icono: string;
  rol: string; // qué añade al JUEGO
  estado: Estado;
  meta?: boolean; // pieza metacognitiva (ritual), no genera salas
}

export const REGISTRY: MechanicMeta[] = [
  // ---- A · Recuperación → verbo APUNTAR (la memoria es tu arma) ----
  { id: 'A1', familia: 'Recuperación', rank: 1, nombre: 'Reconocer', icono: '🏹',
    rol: 'Salas de caza: dispara al slime que porta el concepto de la definición. Los señuelos encarnan tus intuiciones.', estado: 'jugable' },
  { id: 'A2', familia: 'Recuperación', rank: 1, nombre: 'Completar', icono: '🚪',
    rol: 'Puertas rúnicas: restaura la palabra perdida del pergamino para abrir la bóveda de botín.', estado: 'jugable' },
  { id: 'A3', familia: 'Recuperación', rank: 1, nombre: 'Evocar', icono: '🗿',
    rol: 'Santuarios: invoca el término exacto ante la estatua y recibe su bendición.', estado: 'jugable' },
  { id: 'A4', familia: 'Recuperación', rank: 1, nombre: 'Definir', icono: '📜',
    rol: 'Forja de pergaminos: define con tus palabras y el Juez tasa tu pergamino.', estado: 'requiere_juez' },

  // ---- B · Discriminación → verbo ESQUIVAR/ATRAPAR (leer el peligro) ----
  { id: 'B1', familia: 'Discriminación', rank: 2, nombre: 'Distinguir', icono: '👻',
    rol: 'Espectros: lanzan pares de orbes-enunciado. Toca el verdadero, esquiva el falso — discriminar ES moverse.', estado: 'jugable' },
  { id: 'B2', familia: 'Discriminación', rank: 2, nombre: 'Clasificar', icono: '⚗',
    rol: 'Altares: sella cada escena del mundo real con su concepto para consagrar la sala.', estado: 'jugable' },
  { id: 'B3', familia: 'Discriminación', rank: 2, nombre: 'Taggear', icono: '🔦',
    rol: 'Visión del cazador: ilumina las instancias del concepto ocultas en un pergamino-pared.', estado: 'taller' },

  // ---- C · Relación → verbo TEJER (combos y puentes) ----
  { id: 'C1', familia: 'Relación', rank: 3, nombre: 'Conectar', icono: '🌉',
    rol: 'Puentes de runas: encuentra el hilo verdadero entre dos runas y el puente se extiende hacia el cofre.', estado: 'jugable' },
  { id: 'C2', familia: 'Relación', rank: 3, nombre: 'Ordenar', icono: '⚙',
    rol: 'Salas de engranajes: ordena la secuencia causal para que el mecanismo abra el paso.', estado: 'taller' },
  { id: 'C3', familia: 'Relación', rank: 3, nombre: 'Agrupar', icono: '✨',
    rol: 'Constelaciones: agrupa las estrellas-concepto en sus familias para iluminar la bóveda.', estado: 'taller' },
  { id: 'C4', familia: 'Relación', rank: 3, nombre: 'Mapear', icono: '🗺',
    rol: 'Cartografía: ubica conceptos en el mapa 2D del salón de los ejes.', estado: 'taller' },
  { id: 'C5', familia: 'Relación', rank: 3, nombre: 'Contrastar', icono: '⚖',
    rol: 'Duelo de gemelos: enuncia semejanzas y diferencias de dos conceptos casi idénticos.', estado: 'requiere_juez' },

  // ---- D · Estructura → verbo CONSTRUIR (tu santuario) ----
  { id: 'D1', familia: 'Estructura', rank: 3, nombre: 'Construir', icono: '🏗',
    rol: 'Tu santuario entre pisos: el mapa conceptual como árbol de habilidades físico que edificas run a run.', estado: 'taller' },
  { id: 'D2', familia: 'Estructura', rank: 3, nombre: 'Extender', icono: '🧱',
    rol: 'Ampliar el santuario con los nodos conquistados en la última mazmorra.', estado: 'taller' },
  { id: 'D3', familia: 'Estructura', rank: 3, nombre: 'Criticar', icono: '🔨',
    rol: 'Muros corruptos: detecta las conexiones falsas del grafo para derrumbarlos.', estado: 'taller' },

  // ---- E · Transferencia → verbo CAZAR JEFES (los casos SON enemigos) ----
  { id: 'E1', familia: 'Transferencia', rank: 4, nombre: 'Predecir', icono: '🔮',
    rol: 'Enemigos que telegrafían: anticipa su próximo movimiento leyendo el escenario.', estado: 'taller' },
  { id: 'E2', familia: 'Transferencia', rank: 4, nombre: 'Diagnosticar', icono: '🩺',
    rol: 'Enemigos corruptos: encuentra el error embebido en su caso para exponer su núcleo.', estado: 'taller' },
  { id: 'E3', familia: 'Transferencia', rank: 4, nombre: 'Aplicar', icono: '💀',
    rol: 'Élites y jefe final: el enemigo ES un caso real. Solo el concepto-hechizo que lo explica lo daña.', estado: 'jugable' },
  { id: 'E4', familia: 'Transferencia', rank: 4, nombre: 'Generar ejemplo', icono: '🌱',
    rol: 'Invocar aliados: crea tu propio caso válido y lucha a tu lado si el Juez lo aprueba.', estado: 'requiere_juez' },
  { id: 'E5', familia: 'Transferencia', rank: 4, nombre: 'Resolver', icono: '🧩',
    rol: 'Cámaras selladas: problemas que exigen combinar varios conceptos para abrirse.', estado: 'requiere_juez' },

  // ---- F · Producción → verbo FORJAR (requiere Juez) ----
  { id: 'F1', familia: 'Producción', rank: 4, nombre: 'Explicar', icono: '🔥',
    rol: 'Forja: explica el concepto a la audiencia elegida y el Juez templa tu arma.', estado: 'requiere_juez' },
  { id: 'F2', familia: 'Producción', rank: 4, nombre: 'Argumentar', icono: '🛡',
    rol: 'Defensa de la tesis: sostén una posición de la capa 4 contra el asedio.', estado: 'requiere_juez' },
  { id: 'F3', familia: 'Producción', rank: 4, nombre: 'Refutar', icono: '⚔',
    rol: 'Contraataque: derriba la tesis enemiga punto por punto.', estado: 'requiere_juez' },
  { id: 'F4', familia: 'Producción', rank: 4, nombre: 'Reformular', icono: '🪞',
    rol: 'Espejo: di lo mismo con otras palabras para cruzar el salón de reflejos.', estado: 'requiere_juez' },
  { id: 'F5', familia: 'Producción', rank: 4, nombre: 'Traducir', icono: '🗣',
    rol: 'Intérprete: traduce del registro técnico al cotidiano para el NPC aldeano.', estado: 'requiere_juez' },

  // ---- G · Calibración → verbo APOSTARTE A TI MISMO ----
  { id: 'G1', familia: 'Calibración', rank: 0, nombre: 'Apostar', icono: '😈', meta: true,
    rol: 'Mesa del trato ante el élite: apuesta monedas a tu confianza. Recibir un golpe rompe el trato.', estado: 'jugable' },
  { id: 'G2', familia: 'Calibración', rank: 0, nombre: 'Estimar', icono: '📜', meta: true,
    rol: 'Contrato de piso: al entrar declaras tu % de aciertos; el cierre lo revela y paga si cumpliste. Cinco calibraciones por run.', estado: 'jugable' },
  { id: 'G3', familia: 'Calibración', rank: 0, nombre: 'Anticipar dificultad', icono: '🌡', meta: true,
    rol: 'Mirilla del explorador: tasa al guardián ANTES de pelear; tasarlo difícil y vencerlo paga más — pero el sistema coteja con tu historial real.', estado: 'jugable' },
  { id: 'G4', familia: 'Calibración', rank: 0, nombre: 'Explicar error', icono: '🪦', meta: true,
    rol: 'Autopsia en vida + campamento post-muerte: al morir eliges qué te mató, el sistema coteja con la evidencia y te da una bendición contra esa causa para la próxima run.', estado: 'jugable' },
  { id: 'G5', familia: 'Calibración', rank: 0, nombre: 'Marcar dificultad', icono: '🗺', meta: true,
    rol: 'Mapa del cartógrafo: marca tus presas difíciles al cierre y el cartógrafo revela las suyas — la comparación es tu calibración retrospectiva.', estado: 'jugable' },

  // ---- I · Regulación → verbo DESCANSAR/PLANEAR ----
  { id: 'I1', familia: 'Regulación', rank: 0, nombre: 'Planear', icono: '🧭', meta: true,
    rol: 'Ruta del explorador: en cada portal eliges cómo será el siguiente piso (acero feroz vs peregrino). Elegir la ruta ES el plan.', estado: 'jugable' },
  { id: 'I2', familia: 'Regulación', rank: 0, nombre: 'Monitorear', icono: '🔭', meta: true,
    rol: 'El catalejo: consultar tu progreso del piso en plena expedición es señal de monitoreo, jamás penalizada.', estado: 'jugable' },
  { id: 'I3', familia: 'Regulación', rank: 0, nombre: 'Pedir ayuda', icono: '🕯', meta: true,
    rol: 'Velas de auxilio: hints con costo estratégico (la Lupa es su primera encarnación).', estado: 'taller' },
  { id: 'I4', familia: 'Regulación', rank: 0, nombre: 'Reflexionar', icono: '🔥', meta: true,
    rol: 'Fogatas entre mazmorras: reflexionar cura un corazón y enfoca el siguiente piso en tu punto débil.', estado: 'jugable' },
  { id: 'I5', familia: 'Regulación', rank: 0, nombre: 'Consolidar', icono: '🎒', meta: true,
    rol: 'Curaduría del mazo: en cada portal eliges qué 3 conceptos LLEVAS (buff de botín) y cuáles sueltas. El descarte es la señal honesta.', estado: 'jugable' },
];

export const byId = (id: string) => REGISTRY.find((m) => m.id === id);
export const JUGABLES = REGISTRY.filter((m) => m.estado === 'jugable');
export const PRIMARIAS_JUGABLES = JUGABLES.filter((m) => !m.meta);
