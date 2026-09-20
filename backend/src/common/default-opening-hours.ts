/**
 * Horaires d'un salon qui vient d'être créé : ouvert tous les jours sauf
 * vendredi, de 9 h à 19 h.
 *
 * Un salon sans horaires ne proposerait aucun créneau et paraîtrait cassé dès
 * la première visite. Le gérant les ajuste ensuite depuis son back-office —
 * ces valeurs ne sont qu'un point de départ crédible, pas une règle.
 */
export const DEFAULT_OPENING_HOURS = {
  monday: { open: '09:00', close: '19:00' },
  tuesday: { open: '09:00', close: '19:00' },
  wednesday: { open: '09:00', close: '19:00' },
  thursday: { open: '09:00', close: '19:00' },
  friday: null,
  saturday: { open: '09:00', close: '19:00' },
  sunday: { open: '09:00', close: '19:00' },
} as const;
