/**
 * ============================================
 * Libellés — français
 * ============================================
 * Tous les textes affichés passent par ce fichier, jamais en dur dans un
 * composant. L'arabe (et son RTL) est prévu après la V1 : ce jour-là, ce sera
 * un fichier à traduire, pas une chasse aux chaînes dans tout le code.
 *
 * Décision produit : français seul en V1, sans librairie i18n — elle
 * n'apporterait rien tant qu'il n'y a qu'une langue (docs/MVP_SCOPE.md §3.7).
 */

export const fr = {
  app: {
    name: 'Mawid',
    tagline: 'Ton rendez-vous beauté, en 60 secondes.',
  },

  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    back: 'Retour',
    cancel: 'Annuler',
    close: 'Fermer',
    error: 'Une erreur est survenue',
    networkError: 'Connexion impossible. Vérifiez votre réseau.',
  },

  salon: {
    closed: 'Fermé',
    openingHours: "Horaires d'ouverture",
    services: 'Prestations',
    book: 'Réserver',
    bookThis: 'Réserver cette prestation',
    noServices: 'Ce salon n’a pas encore publié ses prestations.',
    notFound: 'Salon introuvable',
    notFoundHelp:
      'Ce salon n’existe pas ou n’est plus disponible sur Mawid.',
    womenOnly: '100 % féminin',
    minutes: 'min',
  },

  weekdays: {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche',
  } as const,

  booking: {
    title: 'Réserver',
    stepServices: 'Vos prestations',
    stepSlot: 'Date et heure',
    stepDetails: 'Vos coordonnées',
    selectServices: 'Choisissez une à trois prestations',
    maxServices: 'Trois prestations maximum par réservation.',
    total: 'Total',
    duration: 'Durée',
    continue: 'Continuer',
    chooseDay: 'Choisissez un jour',
    noSlots: 'Aucun créneau disponible ce jour-là.',
    tryAnotherDay: 'Essayez une autre date.',
    loadingSlots: 'Recherche des créneaux…',
    firstName: 'Prénom',
    firstNamePlaceholder: 'Amine',
    phone: 'Téléphone',
    phonePlaceholder: '0555 12 34 56',
    phoneHelp: 'Le salon vous contactera sur ce numéro si besoin.',
    phoneInvalid: 'Numéro de mobile algérien attendu (05, 06 ou 07).',
    firstNameInvalid: 'Indiquez votre prénom.',
    submit: 'Confirmer la réservation',
    submitting: 'Confirmation…',
    noAccountNeeded: 'Aucun compte à créer.',
    slotTaken:
      'Ce créneau vient d’être réservé par quelqu’un d’autre. Choisissez-en un autre.',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
  },

  confirmation: {
    title: 'C’est réservé !',
    subtitle: 'Votre rendez-vous est confirmé.',
    at: 'chez',
    sendToSalon: 'Prévenir le salon sur WhatsApp',
    sendToSalonHelp:
      'Recommandé : le salon reçoit votre rendez-vous directement sur son téléphone.',
    addToCalendar: 'Ajouter à mon agenda',
    addToCalendarHelp:
      'Le rendez-vous et son lien de gestion arrivent dans votre agenda.',
    manageLink: 'Lien pour modifier ou annuler',
    copyLink: 'Copier le lien',
    copied: 'Lien copié',
    keepLink:
      'Gardez ce lien : c’est le seul moyen d’annuler sans appeler le salon.',
  },

  manage: {
    title: 'Votre rendez-vous',
    status: {
      CONFIRMED: 'Confirmé',
      HONORED: 'Honoré',
      NO_SHOW: 'Non honoré',
      CANCELED: 'Annulé',
    } as const,
    cancelTitle: 'Annuler ce rendez-vous ?',
    cancelConfirm: 'Oui, annuler',
    cancelKeep: 'Non, le garder',
    cancelAction: 'Annuler mon rendez-vous',
    canceled: 'Rendez-vous annulé',
    canceledHelp: 'Le créneau est de nouveau disponible pour d’autres clients.',
    callSalon: 'Appeler le salon',
    notFound: 'Rendez-vous introuvable',
    notFoundHelp:
      'Ce lien n’est plus valide. Contactez directement le salon.',
  },
} as const;

export type WeekdayKey = keyof typeof fr.weekdays;
