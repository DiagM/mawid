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
    featured: 'Mis en avant',
    forSalons: 'Vous êtes un salon ? Inscrivez-vous sur Mawid',
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
    reschedule: 'Déplacer mon rendez-vous',
    rescheduleTitle: 'Choisir un autre créneau',
    rescheduleDay: 'Jour',
    rescheduleNoSlot: 'Aucun créneau libre ce jour-là.',
    rescheduleKeep: 'Garder mon créneau',
    rescheduleDone: 'Votre rendez-vous a été déplacé.',
    rescheduleTaken: 'Ce créneau vient d’être pris. Choisissez-en un autre.',
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
    noSalon: 'Aucun salon n’est associé à ce compte.',
    noSalonHelp:
      'Ce compte administre la plateforme sans tenir d’agenda. Contactez Mawid si vous pensez qu’il s’agit d’une erreur.',
    title: 'Espace gérant',
    login: 'Connexion',
    loginSubtitle: 'Accédez à l’agenda de votre salon.',
    phone: 'Téléphone',
    password: 'Mot de passe',
    signIn: 'Se connecter',
    signingIn: 'Connexion…',
    signOut: 'Déconnexion',

    locked: {
      badge: 'Inclus dans l’offre {plan}',
      contact:
        'Contactez Mawid pour passer à l’offre {plan}. Vos données actuelles sont conservées, rien n’est perdu.',
      navHint: 'Offre {plan}',
      modules: {
        clients: {
          title: 'Votre clientèle',
          body:
            'La fiche de chaque cliente se construit toute seule au fil des rendez-vous. Vous voyez qui revient, qui ne revient plus, et vous les relancez sur WhatsApp en quelques minutes.',
          bullets: [
            'Historique complet de chaque cliente',
            'Segment « pas revenues depuis 2 mois »',
            'Relances WhatsApp, liste de diffusion ou une par une',
            'Blocage des numéros abusifs',
          ],
        },
        cash: {
          title: 'La caisse',
          body:
            'Vos ventes et vos dépenses du jour, encaissées en un clic depuis l’agenda. De quoi ranger définitivement le cahier tenu à côté.',
          bullets: [
            'Ventes et dépenses, espèces, carte ou virement',
            'Encaissement d’un rendez-vous sans ressaisie',
            'Solde du jour, y compris les journées négatives',
          ],
        },
        stock: {
          title: 'Les stocks',
          body:
            'Vos produits, leurs quantités et leurs alertes de stock bas. La quantité ne bouge que par un mouvement, donc l’historique reste toujours juste.',
          bullets: [
            'Entrées et sorties tracées',
            'Alerte quand un produit passe sous son seuil',
            'Prix d’achat et valeur du stock',
          ],
        },
      },
    },
    discoverMawid: 'Découvrir Mawid pour les salons',
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
      stats: 'Statistiques',
      clients: 'Clients',
      campaigns: 'Campagnes',
      cash: 'Caisse',
      stock: 'Stock',
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
      hours: 'Horaires',
      followsSalon: 'Suit les horaires du salon',
      customHours: 'Horaires personnalisés',
      hoursHelp:
        'Décocher « suit les horaires du salon » permet de définir des heures propres à ce membre. Attention : décocher aussi tous les jours le rendrait indisponible en permanence.',
      moveUp: 'Remonter dans la liste',
      archiveHelp:
        'Un membre ne peut être archivé que lorsqu’il n’a plus de rendez-vous à venir.',
    },

    quota: {
      nearLimitTitle: 'Bientôt à court de réservations',
      nearLimit:
        'Il vous reste {remaining} réservation(s) en ligne ce mois-ci sur votre offre gratuite.',
      exceededTitle: 'Limite mensuelle atteinte',
      exceeded:
        'Vos clients ne peuvent plus réserver en ligne ce mois-ci. Ils peuvent toujours vous appeler.',
      resets: 'Remise à zéro le {date}.',
      upgrade: 'Contactez Mawid pour passer à l’offre Pro.',
      used: '{used} / {limit} réservations ce mois-ci',
      unlimited: 'Réservations illimitées',
    },

    cash: {
      title: 'Caisse',
      help:
        'Enregistrez aussi vos clients de passage : votre caisse ne serait pas juste si elle ne comptait que les réservations en ligne.',
      today: "Aujourd'hui",
      previousDay: 'Jour précédent',
      nextDay: 'Jour suivant',
      sales: 'Recettes',
      expenses: 'Dépenses',
      balance: 'Solde',
      pending: 'Rendez-vous à encaisser',
      pendingHelp: 'Un clic suffit, inutile de ressaisir le montant.',
      cash: 'Encaisser',
      empty: 'Aucun mouvement ce jour-là.',
      addSale: 'Ajouter une recette',
      addExpense: 'Ajouter une dépense',
      label: 'Libellé',
      labelSalePlaceholder: 'Client de passage',
      labelExpensePlaceholder: 'Achat de produits',
      amount: 'Montant (DA)',
      method: 'Paiement',
      methodCASH: 'Espèces',
      methodCARD: 'Carte',
      methodTRANSFER: 'Virement',
      remove: 'Supprimer',
      removeHelp:
        'Une erreur de saisie se corrige : la ligne est réellement supprimée.',
    },

    stock: {
      title: 'Stock',
      help:
        'La quantité ne change que par une entrée ou une sortie, pour que l’historique reste juste.',
      empty: 'Aucun produit. Ajoutez-en un pour suivre vos consommables.',
      add: 'Ajouter un produit',
      name: 'Nom',
      unit: 'Unité',
      unitPlaceholder: 'flacon',
      cost: 'Prix d’achat (DA)',
      quantity: 'Quantité',
      threshold: 'Seuil d’alerte',
      lowStock: 'À réapprovisionner',
      archived: 'Archivé',
      archive: 'Archiver',
      movementIn: 'Entrée',
      movementOut: 'Sortie',
      movementAmount: 'Combien',
      reason: 'Motif',
      reasonPlaceholder: 'Livraison, consommation…',
      apply: 'Enregistrer',
      negative: 'Le stock ne peut pas devenir négatif.',
    },

    campaigns: {
      title: 'Campagnes WhatsApp',
      help:
        'Mawid n’envoie rien à votre place. Vous écrivez votre message une fois, et vous l’envoyez ensuite client par client, depuis votre WhatsApp.',
      segment: 'À qui écrire',
      segmentAll: 'Tous mes clients',
      segmentLapsed: 'Pas revenus depuis 2 mois',
      segmentLapsedHelp:
        'Ceux qui n’ont aucun rendez-vous à venir. C’est la relance qui rapporte le plus.',
      segmentRegulars: 'Mes fidèles (3 visites et plus)',
      segmentRegularsHelp: 'À qui annoncer une nouveauté ou une promotion.',
      message: 'Votre message',
      messagePlaceholder:
        'Bonjour {prenom}, cela fait un moment ! On vous réserve une place cette semaine ?',
      messageHelp:
        'Écrivez {prenom} là où le prénom du client doit apparaître.',
      recipients: 'destinataire',
      recipientsPlural: 'destinataires',
      send: 'Ouvrir WhatsApp',
      sent: 'Envoyé',
      markSent: 'Marquer envoyé',
      progress: '{done} sur {total} envoyés',
      empty: 'Aucun client dans ce segment.',
      emptyHelp: 'Essayez un autre segment.',
      noMessage: 'Écrivez votre message pour faire apparaître les liens.',
      notPersisted:
        'Le suivi des envois n’est pas conservé si vous rechargez la page.',
      preview: 'Aperçu pour {name}',

      mode: 'Comment envoyer',
      modeBroadcast: 'Liste de diffusion',
      modeBroadcastHelp:
        'Un seul envoi pour tout le monde, gratuit. Le message est identique pour tous.',
      modeQueue: 'Un par un',
      modeQueueHelp:
        'Un clic par cliente, mais le message porte son prénom et atteint tout le monde.',

      broadcastSteps: [
        'Copiez les numéros ci-dessous.',
        'Dans WhatsApp, ouvrez « Nouvelle diffusion » et collez-y les numéros.',
        'Copiez le message, collez-le dans la conversation de diffusion, envoyez.',
      ],
      broadcastCaveat:
        'Une diffusion WhatsApp n’arrive qu’aux personnes qui ont enregistré votre numéro dans leurs contacts. C’est une règle de WhatsApp : vous ne saurez pas qui ne l’a pas reçue. Pour être sûr d’atteindre quelqu’un, utilisez « Un par un ».',
      broadcastMessage: 'Message à diffuser',
      broadcastPlaceholderText:
        'Bonjour ! Nous avons de la place cette semaine, au plaisir de vous revoir.',
      broadcastNoPlaceholder:
        'Une diffusion ne peut pas être personnalisée : le même texte part à tout le monde.',
      broadcastPlaceholder:
        'Votre message contient {prenom}, qui ne sera pas remplacé en diffusion. Retirez-le, ou passez en « Un par un ».',
      numbers: 'Numéros',
      batchTitle: 'Lot {index} sur {total}',
      copyMessage: 'Copier le message',
      copyNumbers: 'Copier les numéros',
      copied: 'Copié',
      copyFailed:
        'La copie automatique a échoué. Sélectionnez le texte ci-dessous et copiez-le à la main.',

      sendAndNext: 'Ouvrir WhatsApp, puis suivante',
      skip: 'Passer',
      queueDone: 'Vous avez fait le tour de la liste.',
      queueRestart: 'Recommencer',
    },

    clients: {
      blockTitle: 'Bloquer cette cliente',
      blockHelp:
        'Elle ne pourra plus réserver en ligne dans VOTRE salon. Les autres salons ne sont pas concernés, et elle n’en est pas informée.',
      block: 'Bloquer',
      unblock: 'Débloquer',
      blockedHere: 'Bloquée dans votre salon',
      blockReason: 'Motif (privé)',
      blockReasonPlaceholder: 'Trois rendez-vous manqués',
      blockDone: 'Cliente bloquée dans votre salon.',
      unblockDone: 'Cliente débloquée.',
      title: 'Clients',
      search: 'Rechercher un client',
      searchPlaceholder: 'Prénom ou numéro…',
      empty: 'Aucun client pour le moment.',
      emptyHelp: 'Vos clients apparaîtront ici après leur premier rendez-vous.',
      noResult: 'Aucun client ne correspond à cette recherche.',
      visits: 'visite',
      visitsPlural: 'visites',
      noShows: 'absence',
      noShowsPlural: 'absences',
      spent: 'dépensé',
      lastVisit: 'Dernière visite',
      nextVisit: 'Prochain RDV',
      never: 'Jamais venu',
      blocked: 'Bloqué',
      history: 'Historique',
      call: 'Appeler',
      whatsapp: 'WhatsApp',
      back: 'Tous les clients',
      notFound: 'Client introuvable',
    },

    stats: {
      title: 'Statistiques',
      period: 'Période',
      last30: '30 derniers jours',
      last7: '7 derniers jours',
      last90: '90 derniers jours',
      revenue: 'Chiffre d’affaires',
      revenueHelp: 'Rendez-vous honorés uniquement.',
      honored: 'Rendez-vous honorés',
      averageBasket: 'Panier moyen',
      noShowRate: 'Clients absents',
      noShowHelp:
        'Part des clients attendus qui ne sont pas venus. Les annulations à l’avance ne comptent pas.',
      vsPrevious: 'vs période précédente',
      topPrestations: 'Prestations les plus rentables',
      byEmployee: 'Par membre de l’équipe',
      clients: 'Clients',
      newClients: 'nouveaux',
      returningClients: 'déjà venus',
      empty: 'Aucune donnée sur cette période.',
      emptyHelp: 'Les statistiques apparaîtront après vos premiers rendez-vous honorés.',
      noData: '—',
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
      who: 'Qui est indisponible ?',
      wholeSalon: 'Tout le salon',
      forEmployee: 'Absence : {name}',
      whoHelp:
        'Viser une personne laisse le reste de l’équipe disponible. « Tout le salon » ferme pour tout le monde.',
      remove: 'Supprimer',
      empty: 'Aucune indisponibilité à venir.',
      help:
        'Un créneau bloqué disparaît immédiatement des disponibilités proposées aux clients.',
    },
  },
  admin: {
    title: 'Administration',
    nav: {
      overview: 'Plateforme',
      salons: 'Salons',
      managers: 'Nouveau salon',
      reviews: 'Modération',
      publicSite: 'Site public',
    },
    saved: 'Enregistré.',
    forbidden: 'Cette action demande un compte administrateur.',
    featuredInvalid: 'Nombre de semaines attendu, entre 0 et 52.',

    overview: {
      title: 'Vue d’ensemble',
      salonsTotal: 'Salons',
      salonsActive: 'Actifs',
      salonsPending: 'En attente',
      pendingHelp:
        'Ces salons se sont inscrits et attendent votre validation. Tant qu’ils ne sont pas activés, ils n’apparaissent nulle part et n’ont aucun client.',
      managers: 'Gérants',
      reservations: 'Réservations ce mois-ci',
      clients: 'Clientes',
      reviewsPublished: 'Avis publiés',
      reviewsHidden: 'Avis masqués',
    },

    salons: {
      title: 'Salons',
      empty: 'Aucun salon ne correspond.',
      search: 'Nom, slug ou numéro du gérant',
      filterAll: 'Tous',
      filterPending: 'En attente',
      filterActive: 'Actifs',
      activate: 'Activer',
      deactivate: 'Désactiver',
      pending: 'En attente',
      featured: 'Mis en avant',
      featuredUntil: 'jusqu’au {date}',
      plan: 'Offre',
      apply: 'Appliquer',
      featureWeeks: 'Semaines en avant',
      quotaUsed: '{used} / {limit} ce mois-ci',
      quotaUnlimited: 'Illimité',
      owner: 'Gérant',
      neverConnected: 'Jamais connecté',
      lastLogin: 'Dernière connexion {date}',
      mustChangePassword: 'Mot de passe initial non changé',
      counts: '{prestations} prestation(s) · {employees} membre(s)',
      resetPassword: 'Réinitialiser le mot de passe',
      view: 'Voir la fiche',
    },

    managers: {
      title: 'Créer un salon',
      help:
        'Crée le compte du gérant et son salon, actif immédiatement. Le mot de passe est généré ici et ne sera plus jamais affiché.',
      phone: 'Téléphone du gérant (connexion)',
      fullName: 'Nom du gérant',
      salonName: 'Nom du salon',
      addressLine: 'Adresse',
      district: 'Quartier',
      city: 'Ville',
      contactPhone: 'WhatsApp public du salon',
      isWomenOnly: 'Salon 100 % féminin',
      submit: 'Créer le salon',
      invalidPhone: 'Numéro de mobile algérien attendu (ex. 0555 12 34 56).',
      created: 'Salon créé : mawid.dz/{slug}',
      passwordReset: 'Nouveau mot de passe généré.',
      passwordTitle: 'Mot de passe initial',
      passwordWarning:
        'Notez-le maintenant et transmettez-le au gérant : il ne sera plus affiché. Le gérant devra le remplacer à sa première connexion.',
    },

    reviews: {
      title: 'Modération des avis',
      empty: 'Aucun avis à afficher.',
      filterAll: 'Tous',
      filterPublished: 'Publiés',
      filterHidden: 'Masqués',
      lowRatings: 'Notes basses',
      hide: 'Masquer',
      publish: 'Republier',
      hidden: 'Masqué',
      help:
        'Masquer retire l’avis des fiches publiques sans l’effacer : la cliente ne peut pas en redéposer un autre sur le même rendez-vous. Le gérant, lui, n’a aucun moyen de masquer ses mauvaises notes.',
      visitedOn: 'Venue le {date}',
    },
  },
  landing: {
    metaTitle: 'Mawid pour les salons — Remplissez votre agenda',
    metaDescription:
      'Mawid est la plateforme de réservation en ligne des salons de beauté et barbershops en Algérie. Vos clientes réservent 24h/24, sans créer de compte. Gratuit jusqu’à 30 rendez-vous par mois.',

    heroTitle: 'Vos clientes réservent pendant que vous coiffez.',
    heroSubtitle:
      'Mawid met votre salon en ligne : vos clientes choisissent leur créneau depuis leur téléphone, à toute heure, sans vous appeler et sans créer de compte.',
    heroCta: 'Inscrire mon salon',
    heroSecondary: 'J’ai déjà un compte',
    heroNote: 'Gratuit jusqu’à 30 rendez-vous par mois. Sans engagement.',

    problemTitle: 'Ce que ça change pour vous',
    problems: [
      {
        title: 'Plus d’appels pendant une coupe',
        body:
          'Un appel manqué est un rendez-vous perdu. Vos clientes réservent seules, y compris le soir et le dimanche, quand votre téléphone ne sonne pas.',
      },
      {
        title: 'Jamais deux clientes à la même heure',
        body:
          'Le créneau disparaît dès qu’il est pris. Même si deux personnes valident à la seconde près, une seule passe — c’est garanti par la base de données, pas par un calcul approximatif.',
      },
      {
        title: 'Une page que Google trouve',
        body:
          'Votre salon a sa page, avec vos prestations, vos prix et vos horaires. Elle se partage en un lien sur WhatsApp et sur Instagram.',
      },
      {
        title: 'Vous gardez la main',
        body:
          'Vous bloquez un créneau, vous notez une absence, vous fermez une journée. Ce que vous bloquez disparaît immédiatement des créneaux proposés.',
      },
    ],

    featuresTitle: 'Tout ce que vous pouvez piloter',
    features: [
      {
        title: 'Agenda et prestations',
        body:
          'Vos prestations avec durée et prix, vos horaires jour par jour, votre agenda du jour. Vous qualifiez chaque rendez-vous : honoré, non présenté, annulé.',
      },
      {
        title: 'Votre équipe',
        body:
          'Plusieurs personnes travaillent en parallèle, chacune avec ses propres horaires et ses jours d’absence. La cliente peut choisir avec qui.',
      },
      {
        title: 'Votre clientèle',
        body:
          'La fiche de chaque cliente se construit toute seule au fil des rendez-vous. Vous voyez qui revient et qui n’est pas revenue depuis deux mois.',
      },
      {
        title: 'Relances WhatsApp',
        body:
          'Vous écrivez votre message une fois, Mawid prépare la liste et les liens. L’envoi part de votre WhatsApp, depuis votre numéro — donc il est lu.',
      },
      {
        title: 'Caisse et stocks',
        body:
          'Ventes et dépenses du jour, encaissement d’un rendez-vous en un clic, produits et alertes de stock bas.',
      },
      {
        title: 'Avis vérifiés',
        body:
          'Seule une cliente réellement venue peut noter, une seule fois. Ni vous ni un concurrent ne pouvez peser sur vos notes.',
      },
    ],

    pricingTitle: 'Tarifs',
    pricingNote:
      'Toutes les fonctionnalités sont incluses dans les deux offres. La seule différence est le nombre de rendez-vous en ligne par mois.',
    planFreeName: 'Gratuit',
    planFreePrice: '0 DZD',
    planFreePeriod: 'pour toujours',
    planFreeLimit: '30 rendez-vous en ligne par mois',
    planProName: 'Pro',
    planProPrice: '3 000 DZD',
    planProPeriod: 'par mois, sans engagement',
    planProLimit: 'Rendez-vous illimités',
    planIncluded: 'Inclus dans les deux offres',
    planFeatures: [
      'Page salon publique et référencée',
      'Réservation sans compte pour vos clientes',
      'Agenda, prestations, horaires, absences',
      'Équipe, clientèle, avis vérifiés',
      'Caisse, stocks, statistiques',
      'Relances WhatsApp',
    ],
    quotaWarning:
      'Au-delà de 30 rendez-vous dans le mois, l’offre gratuite bloque la réservation en ligne. Vos clientes peuvent toujours vous appeler, et vous êtes prévenu bien avant d’y arriver.',

    stepsTitle: 'Comment démarrer',
    steps: [
      {
        title: 'Vous créez votre compte',
        body:
          'Votre nom, votre numéro, l’adresse du salon. Trois minutes, aucune carte bancaire.',
      },
      {
        title: 'Vous ajoutez vos prestations',
        body:
          'Nom, durée, prix. C’est ce qui construit la grille de créneaux proposée à vos clientes.',
      },
      {
        title: 'Nous validons votre salon',
        body:
          'Un salon n’apparaît en ligne qu’après vérification de notre côté. C’est ce qui protège la plateforme des faux salons — et donc votre réputation.',
      },
    ],

    faqTitle: 'Questions fréquentes',
    faq: [
      {
        question: 'Mes clientes doivent-elles créer un compte ?',
        answer:
          'Non. Un prénom et un numéro de téléphone suffisent. C’est ce qui fait la différence entre une réservation terminée et une réservation abandonnée.',
      },
      {
        question: 'Est-ce que Mawid envoie des rappels automatiques ?',
        answer:
          'Pas de SMS ni de WhatsApp automatiques aujourd’hui. Votre cliente reçoit un lien pour ajouter le rendez-vous à son agenda, et vous disposez d’un outil de relance que vous envoyez vous-même. C’est volontaire : un envoi automatique se facture au message, et nous préférons ne pas vous le répercuter.',
      },
      {
        question: 'Puis-je annuler ou changer d’offre ?',
        answer:
          'Oui, à tout moment et sans engagement. Vos données et votre historique restent les vôtres.',
      },
      {
        question: 'Je travaille seul, est-ce utile ?',
        answer:
          'Oui. Sans équipe, Mawid gère un rendez-vous à la fois et c’est exactement ce qu’il vous faut. Vous ajouterez des membres le jour où vous embaucherez.',
      },
      {
        question: 'Dans quelles villes ?',
        answer:
          'Alger, Oran et Constantine. Écrivez-nous si votre ville n’y est pas encore.',
      },
    ],

    finalTitle: 'Prêt à remplir votre agenda ?',
    finalBody:
      'Créez votre salon en trois minutes. Vous n’avez rien à payer tant que vous ne dépassez pas 30 rendez-vous par mois.',
  },
} as const;

export type WeekdayKey = keyof typeof fr.weekdays;
