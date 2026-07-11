'use client';

import { useMemo, useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { shuffle } from '@/game-core/rng';
import { Timer } from '@/theme/Timer';

// C1 CONECTAR v1.0.0 — familia Relación (consume capa 2).
// Dados dos conceptos, elegir el enunciado que expresa su relación verdadera
// entre distractores (enunciados de otras relaciones del curso).

export function C1Conectar({ config, concepts, relaciones, rng, onComplete }: MechanicProps) {
  const [a, b] = concepts;
  const startRef = useRef(Date.now());
  const [elegida, setElegida] = useState<number | null>(null);

  const { correcta, opciones } = useMemo(() => {
    const rel =
      relaciones.find(
        (r) =>
          (r.origen === a?.concept_id && r.destino === b?.concept_id) ||
          (r.origen === b?.concept_id && r.destino === a?.concept_id)
      ) ?? relaciones[0];
    const distractores = shuffle(
      rng,
      relaciones.filter((r) => r.relation_id !== rel.relation_id)
    )
      .slice(0, 2)
      .map((r) => ({ texto: r.enunciado, correcta: false }));
    if (distractores.length < 2) {
      distractores.push({ texto: 'No existe relación directa entre estos conceptos.', correcta: false });
    }
    return {
      correcta: rel,
      opciones: shuffle(rng, [{ texto: rel.enunciado, correcta: true }, ...distractores]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizar = (idx: number | null, timeout = false) => {
    const ok = idx !== null && opciones[idx].correcta;
    const targets = [a?.concept_id, b?.concept_id].filter(Boolean) as string[];
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: ok,
      partial_score: ok ? 1 : 0,
      concepts_involved: targets,
      repertoires_activated: [],
      cognitive_signals: targets.map((t) => ({
        dimension: 'relacion' as const,
        target: t,
        delta: ok ? 0.06 : -0.05,
        confidence: 0.75,
      })),
      mechanic_specific: {
        relation_id: correcta.relation_id,
        tipo: correcta.tipo,
        eleccion_index: idx,
        tiempo_ms: Date.now() - startRef.current,
        timeout,
      },
    });
  };

  const elegir = (idx: number) => {
    if (elegida !== null) return;
    setElegida(idx);
    setTimeout(() => finalizar(idx), 950);
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer ms={config.tiempo_limite_ms as number} paused={elegida !== null}
          onTimeout={() => elegida === null && finalizar(null, true)} />
      ) : null}
      <p className="mech-prompt">🔗 Dos runas brillan juntas. ¿Qué hilo las une de verdad?</p>
      <div className="connect-pair">
        <span className="rune">{a?.label}</span>
        <span className="connect-thread">⟡</span>
        <span className="rune">{b?.label}</span>
      </div>
      <div className="mech-options stacked">
        {opciones.map((op, i) => {
          const revelada = elegida !== null;
          const estado = revelada ? (op.correcta ? 'correcta' : i === elegida ? 'incorrecta' : '') : '';
          return (
            <button key={i} className={`opt ${estado}`} disabled={revelada} onClick={() => elegir(i)}>
              {op.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}
