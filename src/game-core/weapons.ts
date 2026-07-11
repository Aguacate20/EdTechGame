// Armas = capa de HABILIDAD pura. Modifican daño/cadencia/velocidad del
// proyectil contra enemigos básicos y ventanas de vulnerabilidad.
// NUNCA tocan la señal cognitiva: los objetivos etiquetados mueren por
// conocimiento (un impacto correcto), no por estadísticas.

export type WeaponId = 'piedra' | 'honda' | 'arco' | 'varita';

export interface WeaponDef {
  weapon_id: WeaponId;
  nombre: string;
  icono: string;
  dmg: number;
  cadencia_ms: number;
  vel: number; // unidades/s del proyectil
  pierce: boolean;
  tier: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  piedra: { weapon_id: 'piedra', nombre: 'Piedras del camino', icono: '🪨', dmg: 1, cadencia_ms: 480, vel: 100, pierce: false, tier: 0 },
  honda: { weapon_id: 'honda', nombre: 'Honda del pastor', icono: '🪃', dmg: 1, cadencia_ms: 300, vel: 125, pierce: false, tier: 1 },
  arco: { weapon_id: 'arco', nombre: 'Arco del cazador', icono: '🏹', dmg: 2, cadencia_ms: 340, vel: 155, pierce: false, tier: 2 },
  varita: { weapon_id: 'varita', nombre: 'Varita runada', icono: '🪄', dmg: 2, cadencia_ms: 300, vel: 155, pierce: true, tier: 3 },
};

export const weaponForFloor = (f: number): WeaponId =>
  f <= 1 ? 'honda' : f <= 3 ? 'arco' : 'varita';
