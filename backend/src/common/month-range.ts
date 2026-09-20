import { localToUtc, utcToLocalParts } from './time/algiers-time';

/**
 * Bornes UTC du mois calendaire local en cours, et date de remise à zéro.
 *
 * Le quota se compte en mois **local** : un salon algérien raisonne en mois
 * civils, pas en fenêtres glissantes UTC. Un rendez-vous pris le 1er du mois
 * à 00h30 locale appartient bien au nouveau mois, alors qu'il est encore
 * 23h30 la veille en UTC.
 */
export function currentLocalMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const { year, month } = utcToLocalParts(now);

  const start = localToUtc(
    `${year}-${String(month).padStart(2, '0')}-01`,
    '00:00',
  );

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = localToUtc(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    '00:00',
  );

  return { start, end };
}
