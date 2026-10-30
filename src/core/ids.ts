let counter = 0;

/**
 * Suffixe unique pour les identifiants (séquences d'historique, sondes, traces, missions…).
 *
 * `Date.now()` seul ne suffit pas : deux opérations dans la même milliseconde (fréquent pendant
 * les simulations des robots) recevaient le même identifiant, et l'annulation regroupait alors
 * des séquences distinctes. Le compteur garantit l'unicité dans la session, l'horodatage entre sessions.
 */
export function uniqueId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
}
