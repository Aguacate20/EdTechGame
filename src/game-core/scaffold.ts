// ============================================================
// Política de fading del modo APRENDIZAJE (doc 01 §6, doc 00 §2).
// La bajada de pisos ES el retiro del andamio: tabla declarativa,
// monotónicamente decreciente en soporte. El modo evaluación usa
// siempre la fila "retirado" (la fricción es la mecánica, doc 05).
// ============================================================

export type Modo = 'aprendizaje' | 'evaluacion';

export interface Scaffold {
  nivel: 'alto' | 'medio' | 'retirado';
  archivo: boolean; // sala-biblioteca al inicio del piso (exposición previa)
  n_slimes: number; // distractores en cacería
  senuelos: boolean; // el repertorio (capa 3) entra como señuelo
  orb_speed_mul: number; // velocidad de orbes del espectro
  basics_mul: number; // densidad del piso de habilidad
  hint_tras_errores: number | null; // el objetivo brilla tras N errores (null = nunca)
  errores_gratis: boolean; // orbes falsos no quitan corazón
  lupa_gratis: boolean; // I3 sin consumir el ítem
}

const RETIRADO: Scaffold = {
  nivel: 'retirado', archivo: false, n_slimes: 4, senuelos: true,
  orb_speed_mul: 1, basics_mul: 1, hint_tras_errores: null,
  errores_gratis: false, lupa_gratis: false,
};

export function scaffoldFor(modo: Modo, floor: number): Scaffold {
  if (modo === 'evaluacion') return RETIRADO;
  if (floor <= 1)
    return {
      nivel: 'alto', archivo: true, n_slimes: 3, senuelos: false,
      orb_speed_mul: 0.65, basics_mul: 0.5, hint_tras_errores: 2,
      errores_gratis: true, lupa_gratis: true,
    };
  if (floor === 2)
    return {
      nivel: 'medio', archivo: true, n_slimes: 4, senuelos: true,
      orb_speed_mul: 0.85, basics_mul: 0.75, hint_tras_errores: 2,
      errores_gratis: false, lupa_gratis: true,
    };
  return RETIRADO; // pisos 4-5: llegas al jefe sin andamio
}

/** Modulación de señal por andamio: éxito asistido ≠ dominio (doc 00 §5). */
export const scaffoldSignal = (sc: Scaffold, hintActivo: boolean) => ({
  deltaMul: hintActivo ? 0.4 : sc.nivel === 'alto' ? 0.7 : sc.nivel === 'medio' ? 0.85 : 1,
  confMul: hintActivo ? 0.6 : sc.nivel === 'alto' ? 0.75 : sc.nivel === 'medio' ? 0.9 : 1,
});
