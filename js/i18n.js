/**
 * Traductions.
 *
 * Le français est la langue par défaut ; l'anglais se choisit sur l'écran
 * d'accueil. Le choix est mémorisé d'une partie à l'autre.
 *
 * ====================================================================
 *  Pour modifier un texte, édite les deux langues ici. Les clés doivent
 *  rester identiques entre `fr` et `en` : le jeu retombe sur le français
 *  si une clé manque en anglais.
 * ====================================================================
 */
const I18N = {

  fr: {
    lang: 'fr',
    htmlLang: 'fr',

    /** Écran d'accueil */
    menu: {
      title: 'Une clé, un poisson, un chat',
      subtitle: 'Deux portes fermées, un chat qui ne se laisse pas porter, ' +
                'et un secret au fond du couloir. Suivez les étapes, ' +
                'elles vous mèneront jusque-là.',
      player1: 'Joueur 1',
      player2: 'Joueur 2',
      namePlaceholder: 'Prénom',
      twoPlayers: 'Jouer à deux sur le même écran',
      start: 'Commencer l\'exploration',
      avatarLabel: 'Avatar',
      avatar1Group: 'Avatar du joueur 1',
      avatar2Group: 'Avatar du joueur 2',
      help1: '<b>Joueur 1</b> : flèches du clavier',
      help2: '<b>Joueur 2</b> : Z Q S D',
      help3: '<b>Mobile</b> : glissez le doigt sur le plan, ou sur la zone ' +
             'sous la carte',
      help4: 'Marchez sur un objet pour le prendre',
      langLabel: 'Langue'
    },

    /** Interface en jeu */
    hud: {
      step: 'Étape {n} sur {total}',
      done: 'Terminé',
      carrying: 'Vous portez',
      roomsExplored: '{n}/{total} pièces explorées',
      roomToast: '{name} · pièce {n}/{total}',
      continue: 'Continuer',
      canvasLabel: 'Plan de l\'appartement',
      touchpad: 'Glissez le doigt ici pour vous déplacer'
    },

    /** Noms des pièces, par identifiant */
    rooms: {
      bedroom: 'Notre chambre',
      study: 'Chambre de Tsuki / Bureau',
      nursery: 'Chambre du bébé',
      nurseryHidden: 'Une porte fermée',
      entrance: 'Entrée',
      kitchen: 'Cuisine',
      living: 'Salon',
      laundry: 'Buanderie',
      bathroom: 'Salle de bain',
      wc: 'WC'
    },

    /** Ce que le joueur a dans les mains */
    carry: {
      key1: 'la clé de notre chambre',
      key2: 'la clé de la dernière porte',
      fish: 'un poisson'
    },

    /** Le chat */
    cat: {
      hungryHint: 'Tsuki miaule, il semble avoir faim.'
    },

    /** Les neuf étapes, par identifiant */
    steps: {
      'power-on': {
        objective: 'Remettre l\'électricité',
        hint: 'Les plombs ont sauté. Le tableau électrique est dans la buanderie.',
        title: 'La lumière revient',
        text: 'Un coup sur le disjoncteur et l\'appartement se rallume. ' +
              'Bien. Maintenant, au travail.'
      },
      'find-key': {
        objective: 'Trouver la clé de notre chambre',
        hint: 'Notre chambre est fermée. La clé traîne quelque part dans le salon.',
        toast: 'Clé trouvée',
        title: 'Une petite clé',
        text: 'Oubliée sous un coussin du canapé. C\'est celle de notre chambre, ' +
              'aucun doute.'
      },
      'open-bedroom': {
        objective: 'Ouvrir notre chambre',
        hint: 'La clé en main, direction la porte de notre chambre.',
        locked: 'Fermée à clé. La clé doit être quelque part dans le salon.',
        title: 'La porte s\'ouvre',
        text: 'Un tour de clé, et notre chambre s\'ouvre. Quelque chose brille ' +
              'près du lit.'
      },
      'take-fish': {
        objective: 'Récupérer le poisson',
        hint: 'Il y a quelque chose près du lit, dans notre chambre.',
        toast: 'Poisson récupéré',
        title: 'Un poisson',
        text: 'Emballé, encore frais. Ce n\'est pas pour nous : ' +
              'quelqu\'un dans cette maison en raffole.'
      },
      'feed-tsuki': {
        objective: 'Retrouver Tsuki et lui donner le poisson',
        hint: 'Tsuki se promène dans l\'appartement. Trouvez-le pour lui donner le poisson.',
        title: 'Tsuki est conquis',
        text: 'Il engloutit le poisson en trois bouchées, se frotte contre ' +
              'vos jambes et se laisse enfin porter. Le ventre plein, il est ' +
              'maintenant l\'heure de la sieste : amenez-le dans sa chambre.'
      },
      'bring-tsuki': {
        objective: 'Porter Tsuki jusqu\'à sa chambre',
        hint: 'Tsuki est dans vos bras. Sa chambre est la deuxième porte à gauche.',
        title: 'Tsuki rentre chez lui',
        text: 'Il se love dans son panier, s\'étire… et pousse du bout de la ' +
              'patte une deuxième clé, cachée là depuis un moment.'
      },
      'take-key2': {
        objective: 'Récupérer la clé laissée par Tsuki',
        hint: 'Tsuki a fait tomber une clé à côté de lui.',
        toast: 'Deuxième clé trouvée'
      },
      'open-nursery': {
        objective: 'Ouvrir la dernière porte',
        /** Variante affichée en mode deux joueurs. */
        objective2p: 'Ouvrir la dernière porte, tous les deux',
        hint: 'Il reste une porte fermée, au fond du couloir. Vous avez sa clé.',
        locked: 'Fermée à clé. Cette clé-là, c\'est Tsuki qui l\'a.',
        /** Affiché à deux joueurs quand l'autre n'est pas encore là. */
        waiting: 'Attendez l\'autre joueur devant la porte…'
      },
      'reach-pram': {
        objective: 'Entrer dans la chambre',
        hint: 'La porte est ouverte. Entrez…'
      }
    },

    /** L'annonce */
    reveal: {
      title: 'On va être trois',
      text: 'Ce n\'est plus une chambre d\'amis. C\'est sa chambre, et il arrive.',
      date: 'Prévu pour mars 2027',
      okButton: 'OK',
      replayButton: 'Rejouer'
    }
  },

  en: {
    lang: 'en',
    htmlLang: 'en',

    menu: {
      title: 'A key, a fish, a cat',
      subtitle: 'Two locked doors, a cat who refuses to be carried, ' +
                'and a secret at the end of the hallway. Follow the steps, ' +
                'they will take you there.',
      player1: 'Player 1',
      player2: 'Player 2',
      namePlaceholder: 'First name',
      twoPlayers: 'Two players on the same screen',
      start: 'Start exploring',
      avatarLabel: 'Avatar',
      avatar1Group: 'Player 1 avatar',
      avatar2Group: 'Player 2 avatar',
      help1: '<b>Player 1</b>: arrow keys',
      help2: '<b>Player 2</b>: W A S D',
      help3: '<b>Mobile</b>: drag your finger on the plan, or on the area ' +
             'below the map',
      help4: 'Walk onto an object to pick it up',
      langLabel: 'Language'
    },

    hud: {
      step: 'Step {n} of {total}',
      done: 'Done',
      carrying: 'You are carrying',
      roomsExplored: '{n}/{total} rooms explored',
      roomToast: '{name} · room {n}/{total}',
      continue: 'Continue',
      canvasLabel: 'Floor plan',
      touchpad: 'Drag your finger here to move'
    },

    rooms: {
      bedroom: 'Our bedroom',
      study: 'Tsuki\'s room / Study',
      nursery: 'Baby\'s room',
      nurseryHidden: 'A locked door',
      entrance: 'Entrance',
      kitchen: 'Kitchen',
      living: 'Living room',
      laundry: 'Laundry',
      bathroom: 'Bathroom',
      wc: 'Toilet'
    },

    carry: {
      key1: 'our bedroom key',
      key2: 'the key to the last door',
      fish: 'a fish'
    },

    cat: {
      hungryHint: 'Tsuki is meowing, he looks hungry.'
    },

    steps: {
      'power-on': {
        objective: 'Restore the power',
        hint: 'The fuses have blown. The breaker panel is in the laundry room.',
        title: 'The lights come back',
        text: 'One flick of the breaker and the flat lights up again. ' +
              'Good. Now, to work.'
      },
      'find-key': {
        objective: 'Find our bedroom key',
        hint: 'Our bedroom is locked. The key is somewhere in the living room.',
        toast: 'Key found',
        title: 'A small key',
        text: 'Forgotten under a sofa cushion. It is our bedroom key, ' +
              'no doubt about it.'
      },
      'open-bedroom': {
        objective: 'Unlock our bedroom',
        hint: 'Key in hand, head for our bedroom door.',
        locked: 'Locked. The key must be somewhere in the living room.',
        title: 'The door opens',
        text: 'One turn of the key and our bedroom opens. Something is ' +
              'glinting near the bed.'
      },
      'take-fish': {
        objective: 'Pick up the fish',
        hint: 'There is something near the bed, in our room.',
        toast: 'Fish picked up',
        title: 'A fish',
        text: 'Wrapped up, still fresh. It is not for us: ' +
              'someone in this house is rather fond of it.'
      },
      'feed-tsuki': {
        objective: 'Find Tsuki and give him the fish',
        hint: 'Tsuki is wandering around the flat. Find him to give him the fish.',
        title: 'Tsuki is won over',
        text: 'He wolfs the fish down in three bites, rubs against your legs ' +
              'and finally lets himself be carried. Belly full, it is now ' +
              'nap time: take him to his room.'
      },
      'bring-tsuki': {
        objective: 'Carry Tsuki to his room',
        hint: 'Tsuki is in your arms. His room is the second door on the left.',
        title: 'Tsuki goes home',
        text: 'He curls up in his basket, stretches… and nudges out a second ' +
              'key with one paw, hidden there for a while.'
      },
      'take-key2': {
        objective: 'Pick up the key Tsuki left',
        hint: 'Tsuki has dropped a key beside him.',
        toast: 'Second key found'
      },
      'open-nursery': {
        objective: 'Unlock the last door',
        /** Variant shown in two-player mode. */
        objective2p: 'Unlock the last door, both of you',
        hint: 'One door is still locked, at the end of the hallway. You have its key.',
        locked: 'Locked. That key is the one Tsuki has.',
        /** Shown in two-player mode when the other one has not arrived. */
        waiting: 'Wait for the other player at the door…'
      },
      'reach-pram': {
        objective: 'Step into the room',
        hint: 'The door is open. Come in…'
      }
    },

    reveal: {
      title: 'We are going to be three',
      text: 'This is not a spare room any more. It is his room, and he is on his way.',
      date: 'Due March 2027',
      okButton: 'OK',
      replayButton: 'Play again'
    }
  }
};

/**
 * Gestion de la langue courante.
 *
 * `t('menu.title')` renvoie le texte, avec repli sur le français si la clé
 * manque dans la langue choisie. `t('hud.step', {n: 2, total: 9})` remplace
 * les jetons `{n}` par leur valeur.
 */
const Lang = {
  current: 'fr',
  STORAGE_KEY: 'catgame.lang',

  /** Charge la langue mémorisée, sinon le français. */
  init() {
    let saved = null;
    try {
      saved = window.localStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
      // Navigation privée ou stockage refusé : on reste sur le défaut.
      saved = null;
    }
    this.current = (saved && I18N[saved]) ? saved : 'fr';
    this._applyHtmlLang();
    return this.current;
  },

  set(lang) {
    if (!I18N[lang]) return;
    this.current = lang;
    try {
      window.localStorage.setItem(this.STORAGE_KEY, lang);
    } catch (e) {
      // Le choix ne sera pas mémorisé, sans conséquence pour la partie.
    }
    this._applyHtmlLang();
  },

  _applyHtmlLang() {
    const pack = I18N[this.current];
    if (document.documentElement && pack) {
      document.documentElement.setAttribute('lang', pack.htmlLang);
    }
  },

  /** @returns {string[]} les langues disponibles */
  get available() {
    return Object.keys(I18N);
  },

  /**
   * @param {string} key chemin séparé par des points, ex. 'menu.title'
   * @param {Object} [vars] valeurs des jetons `{nom}`
   */
  t(key, vars) {
    const pick = (lang) => key.split('.').reduce(
      (o, k) => (o && o[k] !== undefined ? o[k] : undefined), I18N[lang]
    );

    let out = pick(this.current);
    if (out === undefined) out = pick('fr');
    if (out === undefined) return key;

    if (vars) {
      Object.keys(vars).forEach((k) => {
        out = String(out).split('{' + k + '}').join(String(vars[k]));
      });
    }
    return out;
  }
};
