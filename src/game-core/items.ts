import type { ItemDef, ItemId } from './types';

// Ítems = mutadores de parámetros del juego, nunca de la señal cognitiva.
// Regla: ningún ítem responde por el estudiante ni elimina el señuelo
// caracterizado (esa intuición es señal valiosa).
export const ITEM_CATALOG: Record<ItemId, ItemDef> = {
  botas: {
    item_id: 'botas',
    nombre: 'Botas del Explorador',
    descripcion: '+30% velocidad de movimiento',
    tipo: 'pasivo',
    icono: '👢',
  },
  amuleto: {
    item_id: 'amuleto',
    nombre: 'Amuleto Guardián',
    descripcion: 'Absorbe un golpe (un uso)',
    tipo: 'consumible',
    icono: '🧿',
  },
  lupa: {
    item_id: 'lupa',
    nombre: 'Lupa Reveladora',
    descripcion: 'Ahuyenta un slime falso en salas de caza (un uso)',
    tipo: 'consumible',
    icono: '🔍',
  },
};
