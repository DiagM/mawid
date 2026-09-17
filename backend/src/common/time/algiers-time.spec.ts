import {
  addMinutes,
  localDayRangeUtc,
  localToUtc,
  utcToLocalDate,
  utcToLocalParts,
  utcToLocalTime,
  weekdayOfLocalDate,
} from './algiers-time';

/**
 * Le décalage Alger/UTC est la source de bug la plus probable du projet :
 * une erreur d'une heure ici décale toutes les réservations sans rien casser
 * visiblement. D'où des assertions sur des valeurs écrites en dur.
 */
describe('algiers-time', () => {
  describe('localToUtc', () => {
    it('retire une heure : Alger est à UTC+1', () => {
      expect(localToUtc('2026-10-05', '09:00').toISOString()).toBe(
        '2026-10-05T08:00:00.000Z',
      );
    });

    it("applique le même offset en été (pas d'heure d'été en Algérie)", () => {
      expect(localToUtc('2026-07-15', '14:30').toISOString()).toBe(
        '2026-07-15T13:30:00.000Z',
      );
      expect(localToUtc('2026-01-15', '14:30').toISOString()).toBe(
        '2026-01-15T13:30:00.000Z',
      );
    });

    it('bascule au jour précédent avant 01:00 locale', () => {
      expect(localToUtc('2026-10-05', '00:30').toISOString()).toBe(
        '2026-10-04T23:30:00.000Z',
      );
    });
  });

  describe('utcToLocalParts', () => {
    it("reconstruit l'heure murale locale", () => {
      const parts = utcToLocalParts(new Date('2026-10-05T08:00:00.000Z'));
      expect(parts.date).toBe('2026-10-05');
      expect(parts.time).toBe('09:00');
      expect(parts.weekday).toBe('monday');
    });

    it('rattache un instant UTC tardif au bon jour local', () => {
      // 23:30 UTC = 00:30 locale le lendemain : un RDV de fin de soirée ne
      // doit pas être compté sur la mauvaise journée dans l'agenda.
      const parts = utcToLocalParts(new Date('2026-10-04T23:30:00.000Z'));
      expect(parts.date).toBe('2026-10-05');
      expect(parts.time).toBe('00:30');
    });
  });

  it('fait un aller-retour sans perte', () => {
    const utc = localToUtc('2026-12-31', '23:45');
    expect(utcToLocalDate(utc)).toBe('2026-12-31');
    expect(utcToLocalTime(utc)).toBe('23:45');
  });

  describe('weekdayOfLocalDate', () => {
    it('donne le bon jour de la semaine', () => {
      expect(weekdayOfLocalDate('2026-10-05')).toBe('monday');
      expect(weekdayOfLocalDate('2026-10-09')).toBe('friday');
      expect(weekdayOfLocalDate('2026-10-11')).toBe('sunday');
    });
  });

  describe('localDayRangeUtc', () => {
    it('couvre exactement 24 h à partir de minuit local', () => {
      const { start, end } = localDayRangeUtc('2026-10-05');
      expect(start.toISOString()).toBe('2026-10-04T23:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-05T23:00:00.000Z');
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('addMinutes', () => {
    it('ne mute pas la date source', () => {
      const origin = new Date('2026-10-05T08:00:00.000Z');
      const later = addMinutes(origin, 50);
      expect(later.toISOString()).toBe('2026-10-05T08:50:00.000Z');
      expect(origin.toISOString()).toBe('2026-10-05T08:00:00.000Z');
    });
  });
});
