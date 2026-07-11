'use client';

import { useMemo, useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { shuffle } from '@/game-core/rng';
import { Timer } from '@/theme/Timer';

// B1 DISTINGUIR v1.0.0 — ficha técnica doc 08.
// Dos enunciados sobre el concepto, uno correcto y uno incorrecto-pero-plausible.

export function B1Distinguir({
  config,
  concepts,
  rng,
  onComplete,
}: MechanicProps) {
  const objetivo = concepts[0];
  const startRef = useRef(Date.now());
  const [elegida, setElegida] = useState<number | null>(null);

  const enunciados = useMemo(
    () =>
      shuffle(rng, [
        { texto: objetivo.enunciado_correcto, correcta: true },
        { texto: objetivo.enunciado_incorrecto, correcta: false },
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const finalizar = (idx: number | null, timeout = false) => {
    const correcta = idx !== null && enunciados[idx].correcta;
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: correcta,
      partial_score: correcta ? 1 : 0,
      concepts_involved: [objetivo.concept_id],
      repertoires_activated: [],
      cognitive_signals: [
        {
          dimension: 'recuperacion',
          target: objetivo.concept_id,
          delta: correcta ? 0.04 : -0.04,
          confidence: 0.7,
        },
      ],
      mechanic_specific: {
        eleccion_index: idx,
        tiempo_ms: Date.now() - startRef.current,
        timeout,
      },
    });
  };

  const elegir = (idx: number) => {
    if (elegida !== null) return;
    setElegida(idx);
    setTimeout(() => finalizar(idx), 900);
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer
          ms={config.tiempo_limite_ms as number}
          paused={elegida !== null}
          onTimeout={() => elegida === null && finalizar(null, true)}
        />
      ) : null}
      <p className="mech-prompt">
        Sobre <strong>{objetivo.label}</strong>, ¿cuál enunciado es correcto?
      </p>
      <div className="mech-options stacked">
        {enunciados.map((e, i) => {
          const revelada = elegida !== null;
          const estado = revelada
            ? e.correcta
              ? 'correcta'
              : i === elegida
                ? 'incorrecta'
                : ''
            : '';
          return (
            <button
              key={i}
              className={`opt ${estado}`}
              disabled={revelada}
              onClick={() => elegir(i)}
            >
              {e.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}
