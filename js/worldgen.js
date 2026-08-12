/**
 * Lecture du plan de l'appartement défini dans CONFIG.map.
 *
 * Le plan est du texte : chaque caractère devient une case. Aucune
 * génération aléatoire, ce que tu dessines est ce que tu obtiens.
 */

const TILE = {
  WALL: 0,
  PARQUET: 1,
  TILEFLOOR: 2,
  DOOR: 3,
  FURNITURE: 4,
  /** Porte de notre chambre : s'ouvre avec la clé du salon. */
  LOCKED_BEDROOM: 5,
  /** Porte de la dernière chambre : s'ouvre avec la clé de Tsuki. */
  LOCKED_NURSERY: 6,
  /** Hors de l'appartement : l'immeuble n'est pas un rectangle. */
  OUTSIDE: 7
};

/** Cases sur lesquelles un joueur peut toujours marcher. */
const WALKABLE = new Set([TILE.PARQUET, TILE.TILEFLOOR, TILE.DOOR]);

/** Les deux portes à clé, par identifiant de serrure. */
const LOCK_TILE = {
  bedroom: TILE.LOCKED_BEDROOM,
  nursery: TILE.LOCKED_NURSERY
};

/** Toutes portes ouvertes : sert aux contrôles d'accessibilité. */
const WALKABLE_IF_OPEN = new Set([
  ...WALKABLE, TILE.LOCKED_BEDROOM, TILE.LOCKED_NURSERY
]);

/**
 * Correspondance caractère du plan -> case + meuble éventuel.
 * `furniture` est la clé de dessin utilisée par world.js.
 */
const LEGEND = {
  '~': { tile: TILE.OUTSIDE },
  '#': { tile: TILE.WALL },
  '.': { tile: TILE.PARQUET },
  ':': { tile: TILE.TILEFLOOR },
  '+': { tile: TILE.DOOR },
  'r': { tile: TILE.LOCKED_BEDROOM },
  'R': { tile: TILE.LOCKED_NURSERY },
  '1': { tile: TILE.PARQUET, spawn: 0 },
  '2': { tile: TILE.PARQUET, spawn: 1 },

  // Objets et personnages posés sur le sol.
  'k': { tile: TILE.PARQUET, thing: 'key1' },
  'f': { tile: TILE.PARQUET, thing: 'fish' },
  't': { tile: TILE.TILEFLOOR, thing: 'cat' },

  'S': { tile: TILE.FURNITURE, furniture: 'sofa' },
  'T': { tile: TILE.FURNITURE, furniture: 'table' },
  'B': { tile: TILE.FURNITURE, furniture: 'bed' },
  'K': { tile: TILE.FURNITURE, furniture: 'counter' },
  'F': { tile: TILE.FURNITURE, furniture: 'fridge' },
  'W': { tile: TILE.FURNITURE, furniture: 'bath' },
  'H': { tile: TILE.FURNITURE, furniture: 'shower' },
  'N': { tile: TILE.FURNITURE, furniture: 'sink' },
  'C': { tile: TILE.FURNITURE, furniture: 'toilet' },
  'M': { tile: TILE.FURNITURE, furniture: 'washer' },
  'X': { tile: TILE.FURNITURE, furniture: 'wardrobe' },
  'D': { tile: TILE.FURNITURE, furniture: 'desk' },
  'P': { tile: TILE.FURNITURE, furniture: 'plant' },
  'V': { tile: TILE.FURNITURE, furniture: 'tv' },
  'L': { tile: TILE.FURNITURE, furniture: 'shelf' },
  'O': { tile: TILE.FURNITURE, furniture: 'box' },
  'A': { tile: TILE.FURNITURE, furniture: 'armchair' },
  'E': { tile: TILE.FURNITURE, furniture: 'sideboard' },
  'G': { tile: TILE.FURNITURE, furniture: 'dresser' },
  'J': { tile: TILE.FURNITURE, furniture: 'cattree' },
  'U': { tile: TILE.FURNITURE, furniture: 'worktop' }
};

const WorldGen = {
  /**
   * @returns {{tiles:number[][], furniture:(string|null)[][], cols:number,
   *            rows:number, spawns:{col:number,row:number}[],
   *            things:Object<string,{col:number,row:number}>,
   *            doorTiles:{bedroom:object[], nursery:object[]},
   *            warnings:string[]}}
   */
  parse(lines) {
    const warnings = [];
    const rows = lines.length;
    const cols = Math.max(...lines.map((l) => l.length));

    lines.forEach((line, i) => {
      if (line.length !== cols) {
        warnings.push(
          `Ligne ${i + 1} du plan : ${line.length} caractères au lieu de ${cols}. ` +
          'Complétée avec des murs.'
        );
      }
    });

    const tiles = [];
    const furniture = [];
    const spawnMap = {};
    const things = {};
    const doorTiles = { bedroom: [], nursery: [] };

    for (let r = 0; r < rows; r++) {
      tiles[r] = [];
      furniture[r] = [];
      const line = lines[r].padEnd(cols, '~');

      for (let c = 0; c < cols; c++) {
        const ch = line[c];
        const entry = LEGEND[ch];

        if (!entry) {
          warnings.push(`Caractère inconnu « ${ch} » ligne ${r + 1}, colonne ${c + 1}. Traité comme un mur.`);
          tiles[r][c] = TILE.WALL;
          furniture[r][c] = null;
          continue;
        }

        tiles[r][c] = entry.tile;
        furniture[r][c] = entry.furniture || null;

        if (entry.spawn !== undefined) spawnMap[entry.spawn] = { col: c, row: r };
        if (entry.thing) things[entry.thing] = { col: c, row: r };
        if (entry.tile === TILE.LOCKED_BEDROOM) doorTiles.bedroom.push({ col: c, row: r });
        if (entry.tile === TILE.LOCKED_NURSERY) doorTiles.nursery.push({ col: c, row: r });
      }
    }

    const spawns = [spawnMap[0], spawnMap[1]].filter(Boolean);
    if (!spawns.length) {
      warnings.push('Aucun point de départ (« 1 ») dans le plan. Placement de secours.');
      const fallback = this._firstWalkable(tiles, cols, rows);
      if (fallback) spawns.push(fallback);
    }
    if (spawns.length === 1) spawns.push(spawns[0]);

    // Chaque élément de la chaîne de quêtes doit être présent une fois.
    const required = {
      key1: 'la clé de notre chambre (« k »)',
      fish: 'le poisson (« f »)',
      cat: `${CONFIG.cat ? CONFIG.cat.name : 'le chat'} (« t »)`
    };
    Object.entries(required).forEach(([id, label]) => {
      if (!things[id]) warnings.push(`Il manque ${label} dans le plan.`);
    });

    if (!doorTiles.bedroom.length) {
      warnings.push('Aucune porte « r » (notre chambre) dans le plan.');
    }
    if (!doorTiles.nursery.length) {
      warnings.push('Aucune porte « R » (dernière chambre) dans le plan.');
    }

    const map = {
      tiles, furniture, cols, rows, spawns, things, doorTiles, warnings
    };
    map.pieces = this._groupFurniture(map);
    map.doorGroups = this._groupDoors(map);
    map.zones = this._buildZones(map);
    this._checkReachability(map);
    return map;
  },

  /**
   * Regroupe les cases de porte contiguës et de même type en une seule porte.
   *
   * Une porte peut faire deux cases de large : sans regroupement, elle était
   * dessinée deux fois et se lisait comme deux portes côte à côte. En la
   * traitant comme un seul rectangle, on obtient une barre continue et un
   * seul cadenas, quelle que soit sa largeur.
   *
   * @returns {{lock:(string|null), col:number, row:number, w:number, h:number,
   *            horizontal:boolean}[]}
   */
  _groupDoors(map) {
    const { tiles, cols, rows } = map;

    const doorKind = (t) => {
      if (t === TILE.DOOR) return 'plain';
      if (t === TILE.LOCKED_BEDROOM) return 'bedroom';
      if (t === TILE.LOCKED_NURSERY) return 'nursery';
      return null;
    };

    const seen = new Uint8Array(cols * rows);
    const groups = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kind = doorKind(tiles[r][c]);
        if (!kind || seen[r * cols + c]) continue;

        // Étend vers la droite puis vers le bas, comme pour les meubles.
        let w = 0;
        while (c + w < cols && doorKind(tiles[r][c + w]) === kind &&
               !seen[r * cols + c + w]) w++;

        let h = 1;
        outer: while (r + h < rows) {
          for (let i = 0; i < w; i++) {
            if (doorKind(tiles[r + h][c + i]) !== kind ||
                seen[(r + h) * cols + c + i]) break outer;
          }
          h++;
        }

        for (let rr = r; rr < r + h; rr++) {
          for (let cc = c; cc < c + w; cc++) seen[rr * cols + cc] = 1;
        }

        /*
         * Sens de la barre. Une porte allongée suit sa propre forme. Sur une
         * porte carrée d'une seule case, la forme ne dit rien : on regarde
         * alors les murs voisins, la barre suivant le mur qui la porte.
         */
        let horizontal;
        if (w !== h) {
          horizontal = w > h;
        } else {
          const isWall = (cc, rr) => {
            if (!tiles[rr] || tiles[rr][cc] === undefined) return true;
            const t = tiles[rr][cc];
            return t === TILE.WALL || t === TILE.OUTSIDE;
          };
          /*
           * Des murs à gauche ET à droite signifient que la porte est percée
           * dans un mur horizontal : la barre est donc horizontale, et on la
           * traverse verticalement.
           */
          const wallsLeftRight = (isWall(c - 1, r) ? 1 : 0) + (isWall(c + w, r) ? 1 : 0);
          const wallsTopBottom = (isWall(c, r - 1) ? 1 : 0) + (isWall(c, r + h) ? 1 : 0);
          horizontal = wallsLeftRight > wallsTopBottom;
        }

        groups.push({
          lock: kind === 'plain' ? null : kind,
          col: c, row: r, w, h, horizontal
        });
      }
    }
    return groups;
  },

  /**
   * Découpe l'appartement en zones closes, et rattache chaque zone à la pièce
   * déclarée qui la recouvre le mieux.
   *
   * Pourquoi : le voile du brouillard était dessiné d'après le rectangle
   * `col/row/w/h` de chaque pièce. Or un meuble adossé à un mur dépasse
   * souvent ce rectangle (le plan de travail de la cuisine, la vasque de la
   * salle de bain), et restait donc visible sous le voile. En s'appuyant sur
   * les cases réellement encloses, le voile épouse exactement la pièce,
   * meubles compris, quoi qu'on change dans le plan.
   *
   * Les murs, les portes et l'extérieur servent de frontières : chaque pièce
   * devient donc sa propre zone, et le couloir la sienne (sans pièce
   * déclarée, il n'est jamais masqué).
   *
   * @returns {Object<string, {col:number,row:number}[]>} cases par nom de pièce
   */
  _buildZones(map) {
    const { tiles, cols, rows } = map;
    const rooms = CONFIG.rooms || [];

    const isBarrier = (t) =>
      t === TILE.WALL || t === TILE.OUTSIDE ||
      t === TILE.DOOR || t === TILE.LOCKED_BEDROOM || t === TILE.LOCKED_NURSERY;

    const seen = new Uint8Array(cols * rows);
    const zones = {};

    const roomAt = (c, r) => rooms.find((room) =>
      c >= room.col && c < room.col + room.w &&
      r >= room.row && r < room.row + room.h);

    for (let r0 = 0; r0 < rows; r0++) {
      for (let c0 = 0; c0 < cols; c0++) {
        const idx0 = r0 * cols + c0;
        if (seen[idx0] || isBarrier(tiles[r0][c0])) continue;

        // Parcours de la zone close contenant cette case.
        const cells = [];
        const votes = new Map();
        const queue = [{ col: c0, row: r0 }];
        seen[idx0] = 1;

        while (queue.length) {
          const cur = queue.pop();
          cells.push(cur);

          const owner = roomAt(cur.col, cur.row);
          if (owner) votes.set(owner.name, (votes.get(owner.name) || 0) + 1);

          const around = [
            { col: cur.col + 1, row: cur.row },
            { col: cur.col - 1, row: cur.row },
            { col: cur.col, row: cur.row + 1 },
            { col: cur.col, row: cur.row - 1 }
          ];
          for (const n of around) {
            if (n.col < 0 || n.row < 0 || n.col >= cols || n.row >= rows) continue;
            const idx = n.row * cols + n.col;
            if (seen[idx] || isBarrier(tiles[n.row][n.col])) continue;
            seen[idx] = 1;
            queue.push(n);
          }
        }

        // Quelles pièces déclarées touchent cette zone ?
        const involved = rooms.filter((room) => votes.has(room.name));
        if (!involved.length) continue; // aucun nom déclaré : jamais masqué

        if (involved.length === 1) {
          const name = involved[0].name;
          zones[name] = (zones[name] || []).concat(cells);
          continue;
        }

        /*
         * Plusieurs pièces dans un même espace ouvert (chez nous la cuisine
         * et le salon, qui communiquent sans porte). On ne peut pas les
         * séparer par les murs : on rattache donc chaque case à la pièce
         * déclarée dont le rectangle est le plus proche. Chacune garde ainsi
         * son propre voile, et la frontière tombe au milieu du passage.
         */
        cells.forEach((cell) => {
          let bestRoom = null;
          let bestDist = Infinity;

          involved.forEach((room) => {
            const dx = Math.max(room.col - cell.col, 0, cell.col - (room.col + room.w - 1));
            const dy = Math.max(room.row - cell.row, 0, cell.row - (room.row + room.h - 1));
            const d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; bestRoom = room; }
          });

          if (bestRoom) {
            zones[bestRoom.name] = (zones[bestRoom.name] || []);
            zones[bestRoom.name].push(cell);
          }
        });
      }
    }

    // Prévient si une pièce déclarée n'a aucune case : le voile ne la
    // couvrirait pas et le jeu ne la détecterait jamais comme visitée.
    rooms.forEach((room) => {
      if (!zones[room.name] || !zones[room.name].length) {
        map.warnings.push(
          `La pièce « ${room.name} » ne contient aucune case close. ` +
          'Vérifie ses coordonnées : le brouillard ne pourra pas la masquer.'
        );
      }
    });

    return zones;
  },

  /**
   * Regroupe les cases de meuble contiguës et de même type en un seul objet.
   *
   * Sans ça, un canapé de 2x6 cases serait dessiné comme douze petits carrés
   * juxtaposés. En le traitant comme un rectangle unique, on peut lui donner
   * une vraie silhouette (accoudoirs, dossier, coussins).
   *
   * @returns {{kind:string, col:number, row:number, w:number, h:number}[]}
   */
  _groupFurniture(map) {
    const { furniture, cols, rows } = map;
    const seen = new Set();
    const pieces = [];
    const key = (c, r) => r * cols + c;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kind = furniture[r][c];
        if (!kind || seen.has(key(c, r))) continue;

        // Étend d'abord vers la droite, puis vers le bas tant que la
        // rangée entière est du même meuble : donne un rectangle propre.
        let w = 0;
        while (c + w < cols && furniture[r][c + w] === kind && !seen.has(key(c + w, r))) w++;

        let h = 1;
        outer: while (r + h < rows) {
          for (let i = 0; i < w; i++) {
            if (furniture[r + h][c + i] !== kind || seen.has(key(c + i, r + h))) break outer;
          }
          h++;
        }

        for (let rr = r; rr < r + h; rr++) {
          for (let cc = c; cc < c + w; cc++) seen.add(key(cc, rr));
        }

        const piece = { kind, col: c, row: r, w, h };
        piece.facing = this._faceOf(map, piece);
        pieces.push(piece);
      }
    }
    return pieces;
  },

  /**
   * De quel côté ce meuble est-il adossé ?
   *
   * On compte, sur chacun des quatre côtés, combien de cases voisines sont un
   * mur (ou un autre meuble). Le côté le plus muré est le dos du meuble ; la
   * face utile regarde à l'opposé. C'est ce qui permet à un canapé de tourner
   * son dossier vers le mur et son assise vers la pièce, quel que soit
   * l'endroit où on le place dans le plan.
   *
   * @returns {'up'|'down'|'left'|'right'} direction vers laquelle le meuble regarde
   */
  _faceOf(map, piece) {
    const { tiles, cols, rows } = map;
    const solid = (c, r) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return 1;
      const t = tiles[r][c];
      return (t === TILE.WALL || t === TILE.OUTSIDE || t === TILE.FURNITURE) ? 1 : 0;
    };

    let up = 0;
    let down = 0;
    for (let i = 0; i < piece.w; i++) {
      up += solid(piece.col + i, piece.row - 1);
      down += solid(piece.col + i, piece.row + piece.h);
    }

    let left = 0;
    let right = 0;
    for (let i = 0; i < piece.h; i++) {
      left += solid(piece.col - 1, piece.row + i);
      right += solid(piece.col + piece.w, piece.row + i);
    }

    // Ramené en proportion : un côté court entièrement muré ne doit pas
    // peser plus qu'un long côté muré à moitié.
    const scores = [
      { back: 'up',    face: 'down',  v: up / piece.w },
      { back: 'down',  face: 'up',    v: down / piece.w },
      { back: 'left',  face: 'right', v: left / piece.h },
      { back: 'right', face: 'left',  v: right / piece.h }
    ];

    // Un meuble allongé s'adosse presque toujours à son long côté :
    // on favorise légèrement les côtés longs en cas d'égalité.
    const longIsVertical = piece.h > piece.w;
    scores.forEach((s) => {
      const isLongSide = longIsVertical
        ? (s.back === 'left' || s.back === 'right')
        : (s.back === 'up' || s.back === 'down');
      if (isLongSide) s.v += 0.01;
    });

    scores.sort((a, b) => b.v - a.v);
    return scores[0].face;
  },

  _firstWalkable(tiles, cols, rows) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (WALKABLE.has(tiles[r][c])) return { col: c, row: r };
      }
    }
    return null;
  },

  /**
   * Contrôles d'accessibilité, en suivant la chaîne de quêtes.
   *
   * La difficulté est que l'appartement s'ouvre progressivement : ce qui est
   * atteignable dépend des portes déjà déverrouillées. On rejoue donc la
   * progression dans l'ordre, et on vérifie qu'à chaque étape l'objectif
   * suivant est bien accessible avec les portes ouvertes à ce moment-là.
   */
  _checkReachability(map) {
    if (!map.spawns.length) return;
    const key = (t) => `${t.col},${t.row}`;
    const start = map.spawns[0];

    // État 1 : rien n'est ouvert.
    const phase1 = new Set(this.floodFill(map, start, []).map(key));
    // État 2 : notre chambre est ouverte.
    const phase2 = new Set(this.floodFill(map, start, ['bedroom']).map(key));
    // État 3 : les deux chambres sont ouvertes.
    const phase3 = new Set(this.floodFill(map, start, ['bedroom', 'nursery']).map(key));

    const near = (set, t) =>
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dc, dr]) => set.has(`${t.col + dc},${t.row + dr}`));

    // 1. La clé du salon doit être accessible dès le départ.
    if (map.things.key1 && !phase1.has(key(map.things.key1))) {
      map.warnings.push(
        'La clé « k » n\'est pas accessible au départ : la partie serait ' +
        'bloquée d\'entrée. Place-la dans une pièce ouverte, comme le salon.'
      );
    }

    // 2. La porte de notre chambre doit pouvoir être atteinte dès le départ.
    if (map.doorTiles.bedroom.length &&
        !map.doorTiles.bedroom.some((t) => near(phase1, t))) {
      map.warnings.push('La porte « r » n\'est atteignable depuis aucun couloir.');
    }

    // 3. Le poisson doit être derrière la porte de notre chambre.
    if (map.things.fish) {
      if (phase1.has(key(map.things.fish))) {
        map.warnings.push(
          'Le poisson « f » est accessible sans ouvrir notre chambre : ' +
          'l\'étape de la clé ne sert alors à rien.'
        );
      } else if (!phase2.has(key(map.things.fish))) {
        map.warnings.push(
          'Le poisson « f » reste inaccessible même après ouverture de ' +
          'notre chambre. Vérifie qu\'il est bien dans la pièce.'
        );
      }
    }

    // 4. Tsuki doit être accessible dès le départ (il attend en cuisine).
    if (map.things.cat && !phase1.has(key(map.things.cat))) {
      map.warnings.push(
        `${CONFIG.cat ? CONFIG.cat.name : 'Le chat'} « t » n'est pas accessible : ` +
        'place-le dans une pièce ouverte, comme la cuisine.'
      );
    }

    // 5. La chambre de Tsuki doit être atteignable pour l'y déposer.
    const tsukiRoom = (CONFIG.rooms || []).find((r) => r.tsukiRoom);
    if (tsukiRoom) {
      const anyTile = [];
      for (let r = tsukiRoom.row; r < tsukiRoom.row + tsukiRoom.h; r++) {
        for (let c = tsukiRoom.col; c < tsukiRoom.col + tsukiRoom.w; c++) {
          if (map.tiles[r] && WALKABLE.has(map.tiles[r][c])) anyTile.push({ col: c, row: r });
        }
      }
      if (!anyTile.some((t) => phase1.has(key(t)))) {
        map.warnings.push(
          `La chambre de ${CONFIG.cat ? CONFIG.cat.name : 'Tsuki'} ` +
          '(`tsukiRoom: true`) est inaccessible.'
        );
      }
    }

    // 6. La dernière porte : atteignable de l'extérieur, et franchissable
    //    une fois déverrouillée.
    if (map.doorTiles.nursery.length) {
      if (!map.doorTiles.nursery.some((t) => near(phase1, t))) {
        map.warnings.push('La porte « R » n\'est atteignable depuis aucun couloir.');
      }
      if (!map.doorTiles.nursery.some((t) => phase3.has(key(t)))) {
        map.warnings.push('La porte « R » reste bloquée même déverrouillée.');
      }
    }

    // 7. La chambre surprise doit rester scellée avant sa clé.
    const nursery = (CONFIG.rooms || []).find((r) => r.nursery);
    if (nursery) {
      let leaked = 0;
      for (let r = nursery.row; r < nursery.row + nursery.h; r++) {
        for (let c = nursery.col; c < nursery.col + nursery.w; c++) {
          if (phase2.has(`${c},${r}`)) leaked++;
        }
      }
      if (leaked > 0) {
        map.warnings.push(
          `La chambre surprise est accessible (${leaked} cases) avant d'avoir ` +
          'la clé de Tsuki. Vérifie qu\'elle n\'a pas une seconde entrée.'
        );
      }
    }

    map.reachableCount = phase1.size;
  },

  /**
   * Parcours en largeur sur les cases praticables.
   * @param {string[]} [unlockedLocks] serrures ouvertes ('bedroom', 'nursery'),
   *   ou `true` pour tout ouvrir.
   */
  floodFill(map, start, unlockedLocks = []) {
    const { tiles, cols, rows } = map;

    let passable;
    if (unlockedLocks === true) {
      passable = WALKABLE_IF_OPEN;
    } else {
      passable = new Set(WALKABLE);
      (unlockedLocks || []).forEach((lock) => {
        if (LOCK_TILE[lock] !== undefined) passable.add(LOCK_TILE[lock]);
      });
    }
    const seen = new Set();
    const out = [];
    const key = (c, r) => r * cols + c;
    const queue = [start];
    seen.add(key(start.col, start.row));

    while (queue.length) {
      const cur = queue.shift();
      out.push(cur);
      const around = [
        { col: cur.col + 1, row: cur.row },
        { col: cur.col - 1, row: cur.row },
        { col: cur.col, row: cur.row + 1 },
        { col: cur.col, row: cur.row - 1 }
      ];
      for (const n of around) {
        if (n.col < 0 || n.row < 0 || n.col >= cols || n.row >= rows) continue;
        if (!passable.has(tiles[n.row][n.col])) continue;
        const k = key(n.col, n.row);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return out;
  }
};
