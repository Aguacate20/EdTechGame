'use client';

// G4 EXPLICAR ERROR PROPIO v1.0.0 — variante de categorías cerradas.
// Tras un error cognitivo, el estudiante nombra por qué falló.
// Señal: srl_autorreflexion. No hay respuesta "correcta": la honestidad
// del marcaje ES la señal.

export type CategoriaError =
  | 'confusion_con_otro'
  | 'no_lo_recordaba'
  | 'fui_muy_rapido'
  | 'no_entendi_la_tarea';

const CATEGORIAS: { id: CategoriaError; texto: string; icono: string }[] = [
  { id: 'confusion_con_otro', texto: 'Lo confundí con otro concepto', icono: '🔀' },
  { id: 'no_lo_recordaba', texto: 'No lo recordaba', icono: '🌫' },
  { id: 'fui_muy_rapido', texto: 'Fui demasiado rápido', icono: '💨' },
  { id: 'no_entendi_la_tarea', texto: 'No entendí qué me pedían', icono: '❓' },
];

export function G4Autopsia({
  conceptLabel,
  onDone,
}: {
  conceptLabel: string;
  onDone: (categoria: CategoriaError) => void;
}) {
  return (
    <div className="mech">
      <p className="mech-prompt">🪦 Autopsia del golpe</p>
      <p className="mech-def">
        Fallaste con <strong>{conceptLabel}</strong>. Conocer tu herida vale más
        que negarla — ¿qué pasó?
      </p>
      <div className="mech-options">
        {CATEGORIAS.map((c) => (
          <button key={c.id} className="opt" onClick={() => onDone(c.id)}>
            {c.icono} {c.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
