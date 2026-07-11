'use client';

import { useState } from 'react';

// G1 APOSTAR v1.0.0 — ficha técnica doc 08, familia Calibración.
// Wrapper: antes de ver el ítem completo, el estudiante declara su confianza
// apostando monedas. La apuesta alimenta srl_calibracion (el "devil deal").
// La resolución económica (pago 2× / pérdida) la hace la capa 2 (engine).

export type NivelConfianza = 'baja' | 'media' | 'alta';

interface Props {
  conceptLabel: string;
  coins: number;
  onBet: (nivel: NivelConfianza, monedas: number) => void;
}

const NIVELES: { nivel: NivelConfianza; texto: string; frac: number }[] = [
  { nivel: 'baja', texto: 'Voy con cautela', frac: 0 },
  { nivel: 'media', texto: 'Creo que lo sé', frac: 0.25 },
  { nivel: 'alta', texto: 'Lo domino', frac: 0.5 },
];

export function G1Apostar({ conceptLabel, coins, onBet }: Props) {
  const [hover, setHover] = useState<NivelConfianza | null>(null);

  return (
    <div className="mech devil">
      <p className="mech-prompt">
        😈 El tratante te observa. La siguiente prueba es sobre{' '}
        <strong>{conceptLabel}</strong>.
      </p>
      <p className="mech-def">
        Declara tu confianza. Si apuestas y aciertas, duplicas. Si fallas,
        pierdes lo apostado.
      </p>
      <div className="mech-options">
        {NIVELES.map(({ nivel, texto, frac }) => {
          const monedas = Math.floor(coins * frac);
          return (
            <button
              key={nivel}
              className={`opt bet ${hover === nivel ? 'hovered' : ''}`}
              onMouseEnter={() => setHover(nivel)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onBet(nivel, monedas)}
            >
              {texto}
              <span className="opt-note">
                {monedas > 0 ? `apuesta 🪙${monedas}` : 'sin apuesta'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
