'use client';

import { useEffect, useRef } from 'react';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// Teclado (WASD + flechas) y D-pad táctil escriben en el mismo estado.
export function useInput() {
  const input = useRef<InputState>({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const map: Record<string, keyof InputState> = {
      w: 'up', arrowup: 'up',
      s: 'down', arrowdown: 'down',
      a: 'left', arrowleft: 'left',
      d: 'right', arrowright: 'right',
    };
    // Si el foco está en un campo de texto (pergaminos A2/A3, semilla),
    // WASD y flechas son ESCRITURA, no movimiento.
    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return Boolean(
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const k = map[e.key.toLowerCase()];
      if (k) { input.current[k] = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      // Soltar SIEMPRE limpia la bandera (aunque estés escribiendo):
      // evita que el héroe quede caminando solo si el foco cambió a mitad de tecla.
      const k = map[e.key.toLowerCase()];
      if (k) input.current[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return input;
}
