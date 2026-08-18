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
  power: '\u{26A1}',       // ⚡ électricité
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
   *   Z tableau électrique (à relancer au début, dans la buanderie)
   *   S canapé   T table    B lit       K plan de travail équipé (évier + plaques)
   *   U plan de travail nu (sans rien dessus)   F frigo
   *   W baignoire  H douche  N vasque (2 max)   C toilettes  M machine à laver
   *   X armoire  D bureau   P plante    V meuble TV
   *   L meuble bas   O carton   A fauteuil
   *   E buffet   G commode   J arbre à chat
   *
   *   Le fauteuil « A » de la chambre de Tsuki est son couchage : c'est là
   *   qu'il s'endort, et la clé tombe juste devant.
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
    '#.............#AA.12.+::::::t:::::TT#',
    '#.............r......+::::::::::::TT#',
    '#AA...........r......#FFLLLUU:::::::#',
    '#AA...GGG.....#......#LLLLLUU:::::::#',
    '###############......########.......#',
    '#DDDDDD...AAAA#......+..............#',
    '#DDDDDD...AAAA#...GG.+..............#',
    '#DDDDDD.......#..#######............#',
    '#.............+..#Z...X#...TTTTT....#',
    '#.............+..+....X#...TTTTT....#',
    '#.............#..#....X#............#',
    '#.............#..#MMUUU#............#',
    '#JJ...GGG.....#..#MMUUU#............#',
    '#JJ...GGG.....#..#######............#',
    '###############..#######P...........#',
    '#.............R..+:::::#VV........SS#',
    '#.............R..+:::::#VV........SS#',
    '#.............#+##:::NN#VV....k...SS#',
    '#.............#::#:::NN#VV........SS#',
    '#.............#::#:::NN#VV........SS#',
    '#.............#::#HHHHH#VV.LLLL...SS#',
    '#.............#C:#HHHHH#...LLLL...SS#',
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
  /*
   * `id` est l'identifiant interne, jamais affiché : il sert de clé pour les
   * zones de brouillard et pour `blackout.keepLitRooms`. Ne le change pas.
   * Le nom visible vient de `I18N.<langue>.rooms.<id>` (js/i18n.js).
   */
  rooms: [
    {
      // Étiquette remontée entre le lit et les fauteuils, sur du parquet libre.
      id: 'bedroom', locked: 'bedroom',
      col: 1, row: 1, w: 13, h: 11, label: { col: 7.5, row: 9.5 }
    },
    {
      // Centrée dans la pièce, entre les bureaux et les arbres à chat.
      id: 'study', tsukiRoom: true,
      col: 1, row: 13, w: 13, h: 9, label: { col: 7.5, row: 17.5 }
    },
    {
      // Descendue sous le tapis du bébé, qui masquait le nom au centre.
      id: 'nursery', nursery: true, locked: 'nursery',
      col: 1, row: 23, w: 13, h: 7, label: { col: 7.5, row: 29.5 }
    },
    { id: 'entrance', col: 15, row: 8,  w: 6,  h: 7,  label: { col: 18,   row: 10.5 } },
    // Centrée sur la bande de carrelage libre, sous les plans de travail.
    { id: 'kitchen',  col: 22, row: 7,  w: 14, h: 5,  label: { col: 30,   row: 9.5 } },
    { id: 'living',   col: 24, row: 13, w: 12, h: 17, label: { col: 30,   row: 21 } },
    // Centrée dans la pièce, au-dessus de la machine à laver.
    { id: 'laundry',  col: 18, row: 16, w: 5,  h: 6,  label: { col: 20.5, row: 18.5 } },
    // Remontée sur le carrelage libre, au-dessus des vasques.
    { id: 'bathroom', col: 18, row: 23, w: 5,  h: 7,  label: { col: 20.5, row: 24.5 } },
    { id: 'wc',       col: 15, row: 26, w: 2,  h: 4,  label: { col: 16,   row: 28 } }
  ],

  /**
   * Le chat de la maison.
   *
   * Tsuki se promène dans tout l'appartement tant qu'on ne l'a pas nourri :
   * il faut donc le chercher. Il ne va jamais dans une pièce encore fermée,
   * et sa présence ne lève pas le voile du brouillard — seuls les joueurs
   * découvrent les pièces.
   *
   * Ses textes sont dans `I18N.<langue>.cat` (js/i18n.js).
   */
  cat: {
    name: 'Tsuki',
    fur: '#4f4a46',
    belly: '#e8e2d8',

    /** Sa déambulation. Mets `enabled: false` pour qu'il reste immobile. */
    wander: {
      enabled: true,
      /**
       * Vitesse en pixels par image. Les joueurs avancent à 2,6 : le chat
       * reste plus lent, mais assez vif pour changer de pièce sans qu'on
       * l'attende. À 0,9 il mettait plus de deux minutes à traverser.
       */
      speed: 1.7,
      /** Durée d'arrêt entre deux déplacements, en millisecondes. */
      pauseMin: 400,
      pauseMax: 1400,
      /**
       * Distance maximale d'une destination, en cases. Le chat fait des
       * petits trajets plutôt qu'une traversée complète : il paraît ainsi
       * flâner, et on le retrouve sans courir après lui à travers le plan.
       */
      maxHop: 9
    }
  },

  /**
   * ------------------------------------------------------------------
   *  LA CHAÎNE DE QUÊTES
   * ------------------------------------------------------------------
   * Les etapes s'enchainent dans cet ordre. Ne change pas les `id` : le code
   * s'appuie dessus, et ce sont aussi les cles des textes.
   *
   * Les libelles (objectif, indice, message de porte fermee, carte) sont
   * dans `I18N.<langue>.steps.<id>` (js/i18n.js). Ici on ne garde que la
   * structure et l'icone de chaque carte ; une etape sans `icon` n'ouvre
   * pas de carte.
   */
  quest: {
    steps: [
      { id: 'power-on',     icon: ICONS.power },
      { id: 'find-key',     icon: ICONS.key },
      { id: 'open-bedroom', icon: ICONS.door },
      { id: 'take-fish',    icon: ICONS.fish },
      { id: 'feed-tsuki',   icon: ICONS.fish },
      { id: 'bring-tsuki',  icon: ICONS.cat },
      { id: 'take-key2' },
      { id: 'open-nursery' },
      { id: 'reach-pram' }
    ]
  },

  /**
   * L'annonce. Elle ne s'affiche PAS à l'ouverture de la porte : les joueurs
   * entrent librement, et le message ne tombe qu'en approchant du landau.
   */
  reveal: {
    /**
     * Les textes sont dans `I18N.<langue>.reveal` (js/i18n.js) :
     * titre, phrase, date, et libellés des deux boutons.
     */

    /**
     * Filet de sécurité : délai, en millisecondes, décompté à partir de
     * l'OUVERTURE de la dernière porte. Passé ce temps l'annonce s'affiche,
     * même si les joueurs hésitent sur le seuil ou n'entrent pas.
     * S'approcher du bébé la déclenche immédiatement, sans attendre.
     * Mets 0 pour n'avoir que le déclenchement par proximité.
     */
    autoDelay: 3000
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

  /**
   * La panne de courant du début.
   *
   * `haloRadius` est le rayon éclairé autour des joueurs, en cases.
   * `keepLitRooms` : les pièces traversées dans le noir restent découvertes
   * une fois le courant revenu, plutôt que d'être remasquées.
   */
  blackout: {
    haloRadius: 1.8,
    // Identifiants de pièces, pas des noms affichés : voir `rooms` ci-dessus.
    keepLitRooms: ['entrance', 'laundry']
  },

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
    pickupRange: 26,

    /**
     * En mode deux joueurs, exige que TOUS les joueurs soient devant la
     * dernière porte pour l'ouvrir : l'annonce se découvre ensemble, pas
     * par celui qui arrive le premier.
     *
     * Mets `false` pour qu'un seul suffise. Sans effet en solo.
     */
    requireBothAtNursery: true
  }
};
