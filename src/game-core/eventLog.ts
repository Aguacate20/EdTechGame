import type { EventSink, MechanicOutput } from './types';

// MVP: persiste en localStorage + consola.
// Siguiente iteración: SupabaseEventSink hacia la tabla event_log.
export class LocalEventSink implements EventSink {
  private key: string;
  constructor(runId: string) {
    this.key = `event_log_${runId}`;
  }
  async emit(output: MechanicOutput): Promise<void> {
    try {
      const prev: MechanicOutput[] = JSON.parse(
        localStorage.getItem(this.key) ?? '[]'
      );
      prev.push(output);
      localStorage.setItem(this.key, JSON.stringify(prev));
    } catch {
      /* almacenamiento no disponible: seguimos con consola */
    }
    console.log('[event_log]', output.mechanic_id, {
      correct: output.is_correct,
      score: output.partial_score,
      concepts: output.concepts_involved,
      repertoires: output.repertoires_activated,
      signals: output.cognitive_signals,
    });
  }
}
