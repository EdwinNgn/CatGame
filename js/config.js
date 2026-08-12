/**
 * Configuration du jeu.
 *
 * ====================================================================
 *  TOUT SE PERSONNALISE ICI : le plan de l'appartement, la chaîne de
 *  quêtes, et l'annonce finale.
 * ====================================================================
 */
/**
 * Les emoji, écrits en séquences d'échappement Unicode plutôt qu'en
 * caractères littéraux.
 *
 * Pourquoi : un emoji collé directement dans le fichier peut être détruit par
 * un aller-retour d'encodage (il devient « ? » ou un carré) selon l'éditeur ou
 * l'outil qui touche le fichier. Écrit en `\u{...}`, le source reste en pur
 * ASCII et l'emoji est reconstruit à l'exécution : il ne peut plus se corrompre.
 *
 * Pour en ajouter un, cherche « emoji unicode codepoint » et reprends la même
 * forme. Exemple : 🧦 est U+1F9E6, donc '\u{1F9E6}'.
 */
const ICONS = {
  key: '\u{1F511}',        // 🔑 clé
  door: '\u{1F6AA}',       // 🚪 porte
  fish: '\u{1F41F}',       // 🐟 poisson
  cat: '\u{1F431}',        // 🐱 tête de chat
  paw: '\u{1F43E}',        // 🐾 empreintes
  pregnant: '\u{1F930}',   // 🤰 femme enceinte
  heart: '\u{1F90D}',      // 🤍 cœur blanc
  bottle: '\u{1F37C}'      // 🍼 biberon
};

const CONFIG = {

  /**
   * ------------------------------------------------------------------
   *  LE PLAN DE L'APPARTEMENT  (37 colonnes x 31 rangées)
   * ------------------------------------------------------------------
   * Une ligne de texte = une rangée de cases. Toutes les lignes doivent
   * avoir EXACTEMENT la même longueur (le jeu vérifie et te prévient
   * dans la console du navigateur si ce n'est pas le cas).
   *
   *   ~  extérieur (hors de l'appartement, dessiné en sombre)
   *   #  mur
   *   .  parquet
   *   :  carrelage
   *   +  porte / ouverture (on passe)
   *   1  point de départ du joueur 1
   *   2  point de départ du joueur 2
   *
   *   Portes verrouillées :
   *   r  porte de notre chambre  (s'ouvre avec la clé du salon)
   *   R  porte de la dernière chambre (s'ouvre avec la clé de Tsuki)
   *
   *   Objets et personnages :
   *   k  la clé de notre chambre       (à placer dans le salon)
   *   f  le poisson                    (à placer dans notre chambre)
   *   t  Tsuki, le chat                (à placer dans la cuisine)
   *
   *   La deuxième clé n'est pas dans le plan : Tsuki la laisse lui-même
   *   quand on le dépose dans sa chambre.
   *
   *   Meubles (infranchissables) :
   *   S canapé   T table    B lit       K plan de travail   F frigo
   *   W baignoire  H douche  N vasque   C toilettes  M machine à laver
   *   X armoire  D bureau   P plante    V meuble TV
   *   L meuble bas   O carton
   *
   * Les meubles s'orientent tout seuls : le dossier d'un canapé, la tête
   * d'un lit ou la robinetterie d'une vasque se placent contre le mur voisin.
   * Il n'y a donc rien à indiquer, il suffit de coller le meuble au mur.
   */
  map: [
    '###############~~~~~~~~~~~~~~~~~~~~~~',
    '#...BBBBBBB..X#~~~~~~~~~~~~~~~~~~~~~~',
    '#...BBBBBBB..X#~~~~~~~~~~~~~~~~~~~~~~',
    '#...BBBBBBB.fX#~~~~~~~~~~~~~~~~~~~~~~',
    '#...BBBBBBB..X#~~~~~~~~~~~~~~~~~~~~~~',
    '#...BBBBBBB..X#~~~~~~################',
    '#...BBBBBBB..X#~~~~~~#KKKKKKKKKKK:::#',
    '#...BBBBBBB...########KKKKKKKKKKK:::#',
    '#.............#SS....+::::::t:::::TT#',
    '#.............r......+::::::::::::TT#',
    '#.............r......#FFLLLKK:::::::#',
    '#.............#......#LLLLLKK:::::::#',
    '###############.12...########.......#',
    '#DDDDDD...SSSS#......+..............#',
    '#DDDDDD...SSSS#..LL..+..............#',
    '#DDDDDD.......#..#######............#',
    '#.............+..+....X#...TTTTT....#',
    '#.............+..+....X#...TTTTT....#',
    '#.............#..#....X#............#',
    '#.............#..#MM...#............#',
    '#.............#..#MMKKK#............#',
    '#.....TT......#..#######............#',
    '###############..#NNNNN#P...........#',
    '#.............R..+:::::#V.........SS#',
    '#.............R..+:::::#V.........SS#',
    '#.............#+##:::WW#V.....k...SS#',
    '#.............#::#:::WW#V.........SS#',
    '#.............#::#:::WW#V.........SS#',
    '#.............#::#HH:::#V.........SS#',
    '#.............#C:#HHNNN#V..LLL....SS#',
    '#####################################'
  ],

  /**
   * Noms affichés sur le plan. `label` est la position du texte en cases
   * (les décimales servent à centrer). `col/row/w/h` délimitent la pièce.
   *
   *   locked: 'bedroom' | 'nursery'  la pièce est derrière une porte fermée
   *   tsukiRoom: true                c'est là qu'il faut déposer Tsuki
   *   nursery: true                  la pièce surprise, jamais nommée avant
   */
  rooms: [
    {
      name: 'Notre chambre', locked: 'bedroom',
      col: 1, row: 1, w: 13, h: 11, label: { col: 7.5, row: 10.6 }
    },
    {
      name: 'Chambre de Tsuki', tsukiRoom: true,
      col: 1, row: 13, w: 13, h: 9, label: { col: 7.5, row: 21 }
    },
    {
      name: 'Chambre du bébé', nursery: true, locked: 'nursery',
      hiddenName: 'Une porte fermée',
      revealedName: 'Chambre du bébé',
      col: 1, row: 23, w: 13, h: 7, label: { col: 7.5, row: 29 }
    },
    { name: 'Entrée',        col: 15, row: 8,  w: 6,  h: 7,  label: { col: 18,   row: 10.5 } },
    { name: 'Cuisine',       col: 22, row: 7,  w: 14, h: 5,  label: { col: 29,   row: 10.6 } },
    { name: 'Salon',         col: 24, row: 13, w: 12, h: 17, label: { col: 30,   row: 21 } },
    { name: 'Buanderie',     col: 18, row: 16, w: 5,  h: 6,  label: { col: 20.5, row: 19 } },
    { name: 'Salle de bain', col: 18, row: 23, w: 5,  h: 7,  label: { col: 20.5, row: 26 } },
    { name: 'WC',            col: 15, row: 26, w: 2,  h: 4,  label: { col: 16,   row: 28 } }
  ],

  /**
   * Le chat de la maison.
   *
   * `hungryHint` s'affiche quand on le croise les mains vides : il a faim,
   * mais on n'a rien à lui donner.
   *
   * `movesTo` est la case où il part se cacher dès qu'on met la main sur le
   * poisson : il file à la salle de bain, et il faut aller le chercher.
   * Mets `movesTo: null` pour qu'il reste en cuisine.
   */
  cat: {
    name: 'Tsuki',
    fur: '#4f4a46',
    belly: '#e8e2d8',
    hungryHint: 'Tsuki miaule, il semble avoir faim.',
    movesTo: { col: 20, row: 24 },
    movedCard: {
      icon: ICONS.paw,
      title: 'Plus personne en cuisine',
      text: 'Tsuki a filé' +
            'Il ne doit pas être bien loin.'
    }
  },

  /**
   * ------------------------------------------------------------------
   *  LA CHAÎNE DE QUÊTES
   * ------------------------------------------------------------------
   * Les étapes s'enchaînent dans cet ordre. Chaque étape affiche son
   * `objective` dans le HUD et son `hint` sous le plan. `card` est la
   * fenêtre qui s'ouvre quand l'étape est franchie.
   *
   * Ne change pas les `id` : le code s'appuie dessus.
   */
  quest: {
    steps: [
      {
        id: 'find-key',
        objective: 'Trouver la clé de notre chambre',
        hint: 'Notre chambre est fermée. La clé traîne quelque part dans le salon.',
        toast: 'Clé trouvée',
        card: {
          icon: ICONS.key,
          title: 'Une petite clé',
          text: 'Oubliée sous un coussin du canapé. C\'est celle de notre chambre, ' +
                'aucun doute.'
        }
      },
      {
        id: 'open-bedroom',
        objective: 'Ouvrir notre chambre',
        hint: 'La clé en main, direction la porte de notre chambre.',
        locked: 'Fermée à clé. La clé doit être quelque part dans le salon.',
        card: {
          icon: ICONS.door,
          title: 'La porte s\'ouvre',
          text: 'Un tour de clé, et notre chambre s\'ouvre. Quelque chose brille ' +
                'près du lit.'
        }
      },
      {
        id: 'take-fish',
        objective: 'Récupérer le poisson',
        hint: 'Il y a quelque chose près du lit, dans notre chambre.',
        toast: 'Poisson récupéré',
        card: {
          icon: ICONS.fish,
          title: 'Un poisson',
          text: 'Emballé, encore frais. Ce n\'est pas pour nous : ' +
                'quelqu\'un dans cette maison en raffole.'
        }
      },
      {
        id: 'feed-tsuki',
        objective: 'Retrouver Tsuki et lui donner le poisson',
        hint: 'Tsuki a quitté la cuisine. Il se cache quelque part dans l\'appartement.',
        card: {
          icon: ICONS.fish,
          title: 'Tsuki est conquis',
          text: 'Il engloutit le poisson en trois bouchées, se frotte contre ' +
                'vos jambes et se laisse enfin porter. Le ventre plein, il est ' +
                'maintenant l\'heure de la sieste : amenez-le dans sa chambre.'
        }
      },
      {
        id: 'bring-tsuki',
        objective: 'Porter Tsuki jusqu\'à sa chambre',
        hint: 'Tsuki est dans vos bras. Sa chambre est la deuxième porte à gauche.',
        card: {
          icon: ICONS.cat,
          title: 'Tsuki rentre chez lui',
          text: 'Il se love dans son panier, s\'étire… et pousse du bout de la ' +
                'patte une deuxième clé, cachée là depuis un moment.'
        }
      },
      {
        id: 'take-key2',
        objective: 'Récupérer la clé laissée par Tsuki',
        hint: 'Tsuki a fait tomber une clé à côté de lui.',
        toast: 'Deuxième clé trouvée'
      },
      {
        id: 'open-nursery',
        objective: 'Ouvrir la dernière porte',
        hint: 'Il reste une porte fermée, au fond du couloir. Vous avez sa clé.',
        locked: 'Fermée à clé. Cette clé-là, c\'est Tsuki qui l\'a.'
      },
      {
        /**
         * L'étape ne nomme jamais le landau : ce serait vendre la surprise
         * avant même d'avoir passé la porte.
         */
        id: 'reach-pram',
        objective: 'Entrer dans la chambre',
        hint: 'La porte est ouverte. Entrez…'
      }
    ]
  },

  /**
   * L'annonce. Elle ne s'affiche PAS à l'ouverture de la porte : les joueurs
   * entrent librement, et le message ne tombe qu'en approchant du landau.
   */
  reveal: {
    title: 'On va être trois ' + ICONS.heart,
    text: 'Ce n\'est plus une pièce vide. C\'est sa chambre, et il arrive.',
    /** Mets '' pour masquer complètement cette ligne. */
    date: 'Prévu pour mars 2027',
    /** Deux boutons : fermer et rester sur place, ou relancer une partie. */
    okButton: 'OK',
    replayButton: 'Rejouer'
  },

  /** Textes d'ambiance génériques. */
  hints: {
    carrying: 'Vous portez'
  },

  /**
   * Avatars proposés au choix des joueurs.
   * Écrits en séquences d'échappement, comme ICONS ci-dessus. J'évite ici les
   * emoji composés (du type « femme blonde », qui assemble plusieurs
   * codepoints avec un liant) : ils s'affichent de façon inégale d'un système
   * à l'autre, et se cassent facilement à la copie.
   */
  avatars: [
    '\u{1F9D1}',  // 🧑 personne
    '\u{1F469}',  // 👩 femme
    '\u{1F9D4}',  // 🧔 personne barbue
    '\u{1F471}',  // 👱 personne blonde
    '\u{1F436}',  // 🐶 chien
    '\u{1F431}'   // 🐱 chat
  ],

  /** Réglages d'affichage et de gameplay. */
  world: {
    /**
     * Taille d'une case en pixels. On dessine volontairement grand
     * (le plan est ensuite réduit par le CSS) : ça donne un rendu net
     * sur les écrans à haute densité et de la place pour les détails.
     */
    tileSize: 32,

    /**
     * Taille minimale d'une case à l'écran, en pixels.
     *
     * Sur un grand écran, tout le plan est visible d'un coup. Sur un
     * téléphone, l'afficher en entier donnerait des cases de 10 pixels :
     * en dessous de cette valeur, le jeu zoome et la caméra suit le joueur.
     * Augmente pour un zoom plus serré, diminue pour voir plus large.
     */
    minTileSize: 26,

    /**
     * Brouillard : les pièces restent masquées jusqu'à ce qu'on y entre,
     * ce qui oblige à explorer. Mets `false` pour tout afficher d'emblée.
     */
    fog: true
  },

  player: {
    speed: 2.6,
    radius: 11,
    pickupRange: 26
  }
};
