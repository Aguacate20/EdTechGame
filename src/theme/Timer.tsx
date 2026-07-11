'use client';

import { useEffect, useRef, useState } from 'react';

// Modificador J1 CRONÓMETRO como componente visual reutilizable.
export function Timer({
  ms,
  paused,
  onTimeout,
}: {
  ms: number;
  paused: boolean;
  onTimeout: () => void;
}) {
  const [restante, setRestante] = useState(ms);
  const fired = useRef(false);

  useEffect(() => {
    if (paused) return;
    const t0 = Date.now();
    const base = restante;
    const id = setInterval(() => {
      const r = base - (Date.now() - t0);
      setRestante(Math.max(0, r));
      if (r <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onTimeout();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const frac = restante / ms;
  return (
    <div className="timer" role="timer" aria-label="tiempo restante">
      <div
        className={`timer-fill ${frac < 0.3 ? 'urgent' : ''}`}
        style={{ width: `${frac * 100}%` }}
      />
      <span className="timer-label">{Math.ceil(restante / 1000)}s</span>
    </div>
  );
}
