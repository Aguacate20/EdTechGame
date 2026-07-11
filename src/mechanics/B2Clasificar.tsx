'use client';

import { useMemo, useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { sample, shuffle } from '@/game-core/rng';
import { Timer } from '@/theme/Timer';

// B2 CLASIFICAR v1.0.0 — ficha técnica doc 08.
// Etiquetar casos (capa 5) con conceptos de un menú. Cada acierto suma
// al partial_score (0-1). Señal por concepto individual.

export function B2Clasificar({ config, concepts, allConcepts, casos, rng, onComplete }: MechanicProps) {
  const startRef = useRef(Date.now());

  // 3 casos de conceptos distintos + esos conceptos como buckets (+1 distractor)
  const { items, buckets } = useMemo(() => {
    const base = concepts[0];
    const conCaso = allConcepts.filter((c) =>
      casos.some((k) => k.concepto_correcto === c.concept_id)
    );
    const elegidos = [
      base,
      ...sample(rng, conCaso.filter((c) => c.concept_id !== base.concept_id), 2),
    ];
    const items = shuffle(
      rng,
      elegidos.map((c) => {
        const propios = casos.filter((k) => k.concepto_correcto === c.concept_id);
        return propios[Math.floor(rng() * propios.length)];
      })
    );
    const distractor = sample(rng, allConcepts.filter((c) => !elegidos.includes(c)), 1);
    const buckets = shuffle(rng, [...elegidos, ...distractor]);
    return { items, buckets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [resuelto, setResuelto] = useState(false);
  const completas = items.every((it) => asignaciones[it.case_id]);

  const confirmar = (timeout = false) => {
    if (resuelto) return;
    setResuelto(true);
    const aciertos = items.filter((it) => asignaciones[it.case_id] === it.concepto_correcto);
    const score = aciertos.length / items.length;
    setTimeout(() => {
      onComplete({
        status: timeout ? 'timeout' : 'completed',
        is_correct: null, // score parcial: la corrección es gradual
        partial_score: score,
        concepts_involved: items.map((it) => it.concepto_correcto),
        repertoires_activated: [],
        cognitive_signals: items.map((it) => ({
          dimension: 'recuperacion' as const,
          target: it.concepto_correcto,
          delta: asignaciones[it.case_id] === it.concepto_correcto ? 0.04 : -0.04,
          confidence: 0.7,
        })),
        mechanic_specific: {
          matriz: items.map((it) => ({
            case_id: it.case_id,
            asignado: asignaciones[it.case_id] ?? null,
            correcto: it.concepto_correcto,
            ok: asignaciones[it.case_id] === it.concepto_correcto,
          })),
          tiempo_ms: Date.now() - startRef.current,
          timeout,
        },
      });
    }, 1300);
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer ms={config.tiempo_limite_ms as number} paused={resuelto}
          onTimeout={() => !resuelto && confirmar(true)} />
      ) : null}
      <p className="mech-prompt">🗂 Tres escenas del mundo real. Sella cada una con su concepto:</p>
      <div className="classify">
        {items.map((it) => (
          <div key={it.case_id} className={`classify-item ${resuelto ? (asignaciones[it.case_id] === it.concepto_correcto ? 'ok' : 'ko') : ''}`}>
            <p className="classify-caso">{it.texto}</p>
            <div className="classify-chips">
              {buckets.map((b) => (
                <button
                  key={b.concept_id}
                  className={`chip ${asignaciones[it.case_id] === b.concept_id ? 'chosen' : ''}`}
                  disabled={resuelto}
                  onClick={() => setAsignaciones((a) => ({ ...a, [it.case_id]: b.concept_id }))}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {resuelto && asignaciones[it.case_id] !== it.concepto_correcto && (
              <p className="mech-hint">
                → era {buckets.find((b) => b.concept_id === it.concepto_correcto)?.label ?? it.concepto_correcto}
              </p>
            )}
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={() => confirmar()} disabled={!completas || resuelto}>
        Sellar clasificación
      </button>
    </div>
  );
}
