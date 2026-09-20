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

  search: {
    title: 'Trouver un salon',
    placeholder: 'Coupe, barbe, quartier…',
    submit: 'Rechercher',
    womenOnly: 'Salons 100 % féminin',
    results: 'salon',
    resultsPlural: 'salons',
    empty: 'Aucun salon ne correspond à votre recherche.',
    emptyHelp: 'Essayez un autre mot, ou retirez le filtre.',
    from: 'à partir de',
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
    stepEmployee: 'Avec qui ?',
    anyEmployee: 'Peu importe',
    anyEmployeeHelp: 'Le premier membre disponible vous recevra.',
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

  review: {
    title: 'Votre avis',
    prompt: 'Comment s’est passé votre rendez-vous ?',
    ratingLabel: 'Votre note',
    commentLabel: 'Votre commentaire (optionnel)',
    commentPlaceholder: 'Accueil, résultat, ambiance…',
    submit: 'Publier mon avis',
    submitting: 'Publication…',
    thanks: 'Merci pour votre avis !',
    thanksHelp: 'Il aide les autres clients à choisir.',
    already: 'Vous avez déjà laissé un avis pour ce rendez-vous.',
    notYet:
      'Vous pourrez laisser un avis une fois votre rendez-vous passé et confirmé par le salon.',
    stars: 'étoiles',
    star: 'étoile',
    noReviews: 'Aucun avis pour le moment.',
    noReviewsHelp: 'Soyez le premier à donner votre avis après votre passage.',
    reviewsTitle: 'Avis clients',
    with: 'avec',
    basedOn: 'avis',
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

  pro: {
    title: 'Espace gérant',
    login: 'Connexion',
    loginSubtitle: 'Accédez à l’agenda de votre salon.',
    phone: 'Téléphone',
    password: 'Mot de passe',
    signIn: 'Se connecter',
    signingIn: 'Connexion…',
    signOut: 'Déconnexion',
    invalidCredentials: 'Identifiants invalides',
    noAccount: 'Pas encore de compte ?',
    createAccount: 'Inscrire mon salon',
    haveAccount: 'Déjà inscrit ?',
    backToLogin: 'Se connecter',

    register: {
      title: 'Inscrire mon salon',
      subtitle: 'Gratuit, sans engagement. Quelques informations suffisent.',
      yourAccount: 'Votre compte',
      yourSalon: 'Votre salon',
      fullName: 'Votre nom',
      loginPhone: 'Téléphone de connexion',
      loginPhoneHelp: 'Sert uniquement à vous connecter. Jamais affiché aux clients.',
      password: 'Mot de passe',
      salonName: 'Nom du salon',
      addressLine: 'Adresse',
      district: 'Quartier',
      contactPhone: 'Numéro WhatsApp public',
      contactPhoneHelp:
        'Celui que vos clients verront et sur lequel ils vous préviendront.',
      womenOnly: 'Salon 100 % féminin',
      submit: 'Créer mon salon',
      submitting: 'Création…',
      pendingTitle: 'Salon en attente de validation',
      pendingHelp:
        'Votre salon n’est pas encore visible publiquement. Préparez vos prestations et vos horaires : nous le validons sous 48 h.',
    },
    tooManyAttempts:
      'Trop de tentatives. Patientez quelques minutes avant de réessayer.',

    changePassword: 'Changer mon mot de passe',
    changePasswordForced: 'Choisissez votre mot de passe',
    changePasswordForcedHelp:
      'Votre mot de passe actuel a été généré pour vous. Remplacez-le avant de continuer.',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    newPasswordHelp: '10 caractères minimum, avec au moins une lettre et un chiffre.',
    passwordChanged: 'Mot de passe mis à jour',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré',

    nav: {
      agenda: 'Agenda',
      salon: 'Mon salon',
      prestations: 'Prestations',
      team: 'Équipe',
      reviews: 'Avis',
      blocked: 'Indisponibilités',
    },

    team: {
      title: 'Équipe',
      add: 'Ajouter un membre',
      fullName: 'Nom du membre',
      archived: 'Archivé',
      archive: 'Archiver',
      restore: 'Réactiver',
      empty:
        'Aucun membre. Sans équipe, votre salon accepte un rendez-vous à la fois.',
      help:
        'Chaque membre peut recevoir un client en parallèle des autres. Le premier membre ajouté reprend vos rendez-vous à venir.',
      archiveHelp:
        'Un membre ne peut être archivé que lorsqu’il n’a plus de rendez-vous à venir.',
    },

    reviews: {
      title: 'Avis reçus',
      empty: 'Aucun avis pour le moment.',
      emptyHelp:
        'Vos clients pourront en laisser un après un rendez-vous que vous aurez marqué comme honoré.',
      help:
        'Seuls vos clients réellement venus peuvent noter. Les avis ne sont ni modifiables ni supprimables : c’est ce qui leur donne de la valeur.',
      hidden: 'Retiré par Mawid',
      visitedOn: 'Venu le',
    },

    agenda: {
      title: 'Agenda',
      today: "Aujourd'hui",
      previousDay: 'Jour précédent',
      nextDay: 'Jour suivant',
      empty: 'Aucun rendez-vous ce jour-là.',
      markHonored: 'Honoré',
      markNoShow: 'Non présenté',
      markCanceled: 'Annuler',
      callClient: 'Appeler',
      revenue: 'Total du jour',
      revenueHelp: 'Rendez-vous honorés uniquement.',
    },

    salon: {
      title: 'Mon salon',
      publicLink: 'Lien public',
      name: 'Nom du salon',
      description: 'Description',
      addressLine: 'Adresse',
      district: 'Quartier',
      hours: 'Horaires',
      openLabel: 'Ouvert',
      closedLabel: 'Fermé',
      from: 'de',
      to: 'à',
      invalidHours: 'L’heure de fermeture doit suivre l’heure d’ouverture.',
    },

    prestations: {
      title: 'Prestations',
      add: 'Ajouter une prestation',
      name: 'Nom',
      description: 'Description',
      duration: 'Durée (minutes)',
      price: 'Prix (DA)',
      archived: 'Archivée',
      archive: 'Archiver',
      restore: 'Réactiver',
      empty: 'Aucune prestation. Ajoutez-en une pour ouvrir les réservations.',
      archiveHelp:
        'Archiver retire la prestation du public sans toucher à l’historique des rendez-vous.',
    },

    blocked: {
      title: 'Indisponibilités',
      add: 'Bloquer un créneau',
      date: 'Date',
      start: 'Début',
      end: 'Fin',
      reason: 'Motif (optionnel)',
      reasonPlaceholder: 'Pause déjeuner',
      remove: 'Supprimer',
      empty: 'Aucune indisponibilité à venir.',
      help:
        'Un créneau bloqué disparaît immédiatement des disponibilités proposées aux clients.',
    },
  },
} as const;

export type WeekdayKey = keyof typeof fr.weekdays;
