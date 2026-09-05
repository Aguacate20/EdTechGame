/** Glosa en lenguaje llano de cada tipo de vínculo. Se usa en la ayuda flotante
 *  del tablero y del Atlas: el estudiante nunca ve el nombre técnico de la señal
 *  cognitiva que produce, solo qué significa el vínculo. */
export const GLOSA_RELACION: Record<string, string> = {
  apoya: 'A respalda o da evidencia a B.',
  causa: 'A produce B.',
  requiere: 'B es condición previa de A.',
  contrasta: 'A se opone o se distingue de B.',
  generaliza: 'A abstrae a B.',
  ejemplifica: 'A es un caso concreto de B.',
  extiende: 'A amplía el alcance de B.',
  matiza: 'A precisa o limita a B.'
}
