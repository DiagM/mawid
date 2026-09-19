-- ============================================
-- Anti-double-réservation : passage à la ressource
-- ============================================
-- Jusqu'ici la contrainte portait sur "salonId" : un salon ne pouvait avoir
-- qu'un seul rendez-vous à un instant donné. C'était juste tant qu'un salon
-- n'avait qu'une ressource (le gérant), mais cela interdit le multi-employés.
--
-- On bascule la clé sur COALESCE("employeeId", "salonId") :
--   - employeeId NULL  → la clé est le salon, comportement V1 inchangé ;
--   - deux employés distincts → deux clés distinctes, pas de conflit ;
--   - le même employé → même clé, chevauchement toujours refusé.
--
-- ⚠️ État mixte à éviter : un salon qui aurait à la fois des réservations
-- sans employé et des réservations assignées pourrait se retrouver avec deux
-- rendez-vous simultanés. C'est pourquoi la création du PREMIER employé
-- réassigne les rendez-vous à venir (voir EmployeesService#create).
--
-- Migration écrite à la main : Prisma ne sait pas exprimer une contrainte
-- d'exclusion. Voir docs/DATABASE.md §6.3.

ALTER TABLE "reservations" DROP CONSTRAINT "reservations_no_overlap";

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    (COALESCE("employeeId", "salonId")) WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');
