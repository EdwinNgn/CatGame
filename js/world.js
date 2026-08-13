/**
 * L'appartement : collisions, cadeaux et rendu du plan vu de dessus.
 */
class World {
  constructor() {
    this.tileSize = CONFIG.world.tileSize;
    const map = WorldGen.parse(CONFIG.map);

    this.tiles = map.tiles;
    this.furniture = map.furniture;
    this.pieces = map.pieces;
    this.cols = map.cols;
    this.rows = map.rows;
    this.spawns = map.spawns;
    this.doorTiles = map.doorTiles;

    /** Portes regroupées : une entrée par porte, même large de deux cases. */
    this.doorGroups = map.doorGroups;

    /**
     * Cases réellement encloses de chaque pièce, meubles compris.
     * Sert à dessiner le voile au ras des murs plutôt que d'après un
     * rectangle qui laissait dépasser certains meubles.
     */
    this.zones = map.zones;

    map.warnings.forEach((w) => console.warn('[plan] ' + w));

    this.width = this.cols * this.tileSize;
    this.height = this.rows * this.tileSize;

    const ts = this.tileSize;
    const at = (t) => ({ x: (t.col + 0.5) * ts, y: (t.row + 0.5) * ts });

    /**
     * Les objets ramassables. `active` contrôle leur apparition : le poisson
     * n'existe qu'une fois la chambre ouverte, la deuxième clé qu'une fois
     * Tsuki rentré chez lui.
     */
    this.things = {};
    if (map.things.key1) {
      this.things.key1 = { id: 'key1', icon: ICONS.key, ...at(map.things.key1), active: true, taken: false };
    }
    if (map.things.fish) {
      this.things.fish = { id: 'fish', icon: ICONS.fish, ...at(map.things.fish), active: false, taken: false };
    }
    if (map.things.cat) {
      const p = at(map.things.cat);
      this.cat = {
        x: p.x, y: p.y,
        homeX: p.x, homeY: p.y,
        fed: false,
        carried: false,
        atHome: false,
        phase: 0
      };
    }

    /** Les deux serrures. */
    this.locks = { bedroom: false, nursery: false };

    /**
     * Panne de courant : au départ tout est noir sauf un halo autour des
     * joueurs. Le tableau électrique de la buanderie y met fin.
     */
    this.blackout = true;

    /** Le berceau n'apparaît qu'une fois la dernière chambre ouverte. */
    this.nurseryFurnished = false;

    this.staticLayer = null;

    /**
     * Brouillard : chaque pièce est masquée jusqu'à ce qu'on y entre.
     * Sans ça, tout l'appartement étant visible d'un coup, les cadeaux se
     * repèrent dès le départ et il n'y a plus rien à fouiller.
     */
    this.fog = (CONFIG.world.fog !== false);
    this.discovered = new Set();
  }

  /**
   * Déverrouille une porte.
   * @param {'bedroom'|'nursery'} lock
   */
  unlock(lock) {
    if (this.locks[lock]) return;
    this.locks[lock] = true;
    if (lock === 'nursery') this.nurseryFurnished = true;
    this.staticLayer = null; // à redessiner : porte ouverte (+ berceau)
  }

  /** Rend le poisson visible dans notre chambre. */
  revealFish() {
    if (this.things.fish) this.things.fish.active = true;
  }

  /**
   * Position du tableau électrique, déduite du plan.
   * @returns {{x:number, y:number}|null}
   */
  get breaker() {
    const piece = (this.pieces || []).find((p) => p.kind === 'breaker');
    if (!piece) return null;
    const ts = this.tileSize;
    return {
      x: (piece.col + piece.w / 2) * ts,
      y: (piece.row + piece.h / 2) * ts
    };
  }

  /** Vrai si un joueur est au contact du tableau électrique. */
  isNearBreaker(x, y, range) {
    const b = this.breaker;
    if (!b) return false;
    return Math.hypot(b.x - x, b.y - y) <= range;
  }

  /**
   * Rétablit le courant. Les pièces traversées dans le noir restent
   * découvertes, sinon on aurait l'impression de les avoir explorées pour rien.
   */
  restorePower() {
    this.blackout = false;
    const keep = (CONFIG.blackout && CONFIG.blackout.keepLitRooms) || [];
    keep.forEach((name) => {
      if (this.zones[name]) this.discovered.add(name);
    });
    // Les manettes du tableau basculent : la couche figée doit être refaite.
    this.staticLayer = null;
  }

  /**
   * Tsuki file se cacher dès qu'on récupère le poisson.
   * @returns {boolean} vrai s'il a effectivement bougé
   */
  moveCatToHideout() {
    const target = CONFIG.cat && CONFIG.cat.movesTo;
    if (!this.cat || !target) return false;

    const ts = this.tileSize;
    const x = (target.col + 0.5) * ts;
    const y = (target.row + 0.5) * ts;

    // Sécurité : ne le téléporte pas dans un mur ou un meuble.
    if (!this.isWalkable(x, y)) {
      console.warn(
        `[plan] La cachette de ${CONFIG.cat.name} (ligne ${target.row + 1}, ` +
        `colonne ${target.col + 1}) n'est pas une case libre. Il reste sur place.`
      );
      return false;
    }

    this.cat.x = x;
    this.cat.y = y;
    this.cat.hidden = true;
    return true;
  }

  /** La pièce où Tsuki se cache après avoir entendu le poisson. */
  get catHideoutRoom() {
    const target = CONFIG.cat && CONFIG.cat.movesTo;
    if (!target) return null;
    const ts = this.tileSize;
    return this.roomAt((target.col + 0.5) * ts, (target.row + 0.5) * ts);
  }

  /**
   * Le fauteuil de la chambre de Tsuki : son couchage.
   * @returns {{x:number, y:number, front:{x:number, y:number}}|null}
   *   le centre du fauteuil, et le point juste devant (côté pièce).
   */
  get catChair() {
    const room = this.tsukiRoom;
    if (!room) return null;

    const chair = this.pieces.find((p) => {
      if (p.kind !== 'armchair') return false;
      // Le fauteuil doit être dans la chambre de Tsuki.
      const cx = (p.col + p.w / 2) * this.tileSize;
      const cy = (p.row + p.h / 2) * this.tileSize;
      return this.roomAt(cx, cy) === room;
    });
    if (!chair) return null;

    const ts = this.tileSize;
    const x = (chair.col + chair.w / 2) * ts;
    const y = (chair.row + chair.h / 2) * ts;

    // « Devant » suit l'orientation du meuble, donc l'endroit où l'on peut
    // réellement marcher : la clé n'atterrit jamais dans un mur.
    const step = Math.max(ts * 0.8, (Math.max(chair.w, chair.h) * ts) / 2 + ts * 0.55);
    const offsets = {
      down: { x: 0, y: step },
      up: { x: 0, y: -step },
      left: { x: -step, y: 0 },
      right: { x: step, y: 0 }
    };
    const o = offsets[chair.facing] || offsets.down;

    return { x, y, front: { x: x + o.x, y: y + o.y }, facing: chair.facing };
  }

  /**
   * Tsuki laisse tomber la deuxième clé.
   *
   * Elle tombe devant le fauteuil s'il y en a un dans la chambre, sinon à
   * côté du chat. Un repli vérifie que la case est bien praticable : une clé
   * posée dans un meuble serait impossible à ramasser.
   */
  dropSecondKey() {
    if (this.things.key2) return;

    const chair = this.catChair;
    let x = this.cat.x + this.tileSize * 0.9;
    let y = this.cat.y + this.tileSize * 0.35;

    if (chair && this.isWalkable(chair.front.x, chair.front.y)) {
      x = chair.front.x;
      y = chair.front.y;
    } else if (!this.isWalkable(x, y)) {
      // Ni fauteuil accessible ni case libre : on la met sous le chat.
      x = this.cat.x;
      y = this.cat.y;
    }

    this.things.key2 = {
      id: 'key2',
      icon: ICONS.key,
      x, y,
      active: true,
      taken: false
    };
  }

  /** Installe Tsuki endormi sur son fauteuil. */
  putCatOnChair() {
    const chair = this.catChair;
    if (!chair) return false;
    this.cat.x = chair.x;
    this.cat.y = chair.y;
    return true;
  }

  /** La pièce protégée par la porte « R ». */
  get nursery() {
    return (CONFIG.rooms || []).find((r) => r.nursery) || null;
  }

  /**
   * Position du landau, au centre de la chambre du bébé.
   * C'est le point qui déclenche l'annonce quand on s'en approche.
   */
  get pramPos() {
    const room = this.nursery;
    if (!room) return null;
    const ts = this.tileSize;
    return {
      x: (room.col + room.w / 2) * ts,
      y: (room.row + room.h / 2) * ts - ts * 0.2
    };
  }

  /** Vrai si le joueur est assez près du landau pour déclencher l'annonce. */
  isNearPram(x, y) {
    const p = this.pramPos;
    if (!p || !this.nurseryFurnished) return false;
    return Math.hypot(p.x - x, p.y - y) <= this.tileSize * 2.2;
  }

  /** La pièce où Tsuki doit être déposé. */
  get tsukiRoom() {
    return (CONFIG.rooms || []).find((r) => r.tsukiRoom) || null;
  }

  get isNurseryOpen() {
    return this.locks.nursery;
  }

  /**
   * @returns {object|null} La pièce contenant ce point.
   *
   * S'appuie sur les zones closes calculées à la lecture du plan, et non sur
   * le rectangle déclaré : les deux coïncident presque partout, mais les
   * zones incluent les meubles qui débordent du rectangle.
   */
  roomAt(x, y) {
    const c = Math.floor(x / this.tileSize);
    const r = Math.floor(y / this.tileSize);

    if (!this._zoneIndex) {
      // Index case -> pièce, construit une seule fois.
      this._zoneIndex = new Map();
      Object.entries(this.zones).forEach(([name, cells]) => {
        const room = (CONFIG.rooms || []).find((x2) => x2.id === name);
        if (!room) return;
        cells.forEach((cell) => this._zoneIndex.set(cell.row * this.cols + cell.col, room));
      });
    }

    return this._zoneIndex.get(r * this.cols + c) || null;
  }

  /** Marque comme visitée la pièce où se trouve le joueur. */
  discoverAt(x, y) {
    const room = this.roomAt(x, y);
    if (room && !this.discovered.has(room.id)) {
      this.discovered.add(room.id);
      return room;
    }
    return null;
  }

  /**
   * Nom affichable d'une pièce, dans la langue courante.
   * La chambre du bébé reste anonyme jusqu'à son ouverture.
   */
  displayName(room) {
    if (!room) return '';
    if (room.nursery && !this.nurseryFurnished) {
      return Lang.t('rooms.nurseryHidden');
    }
    return Lang.t('rooms.' + room.id);
  }

  isRoomVisible(room) {
    return !this.fog || !room || this.discovered.has(room.id);
  }

  get roomsTotal() {
    return (CONFIG.rooms || []).length;
  }

  tileAt(x, y) {
    const c = Math.floor(x / this.tileSize);
    const r = Math.floor(y / this.tileSize);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return TILE.WALL;
    return this.tiles[r][c];
  }

  isWalkable(x, y) {
    const t = this.tileAt(x, y);
    if (t === TILE.LOCKED_BEDROOM) return this.locks.bedroom;
    if (t === TILE.LOCKED_NURSERY) return this.locks.nursery;
    return WALKABLE.has(t);
  }

  /**
   * Sur quelle porte fermée le joueur est-il en train de buter ?
   * @returns {'bedroom'|'nursery'|null}
   */
  blockingDoor(x, y, radius) {
    const r = radius * 0.9;
    const points = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    for (const [dx, dy] of points) {
      const t = this.tileAt(x + dx, y + dy);
      if (t === TILE.LOCKED_BEDROOM && !this.locks.bedroom) return 'bedroom';
      if (t === TILE.LOCKED_NURSERY && !this.locks.nursery) return 'nursery';
    }
    return null;
  }

  /** Vrai si le joueur est au contact de la porte indiquée. */
  isAtDoor(x, y, lock) {
    const ts = this.tileSize;
    const tiles = this.doorTiles[lock] || [];
    return tiles.some((t) => {
      const cx = (t.col + 0.5) * ts;
      const cy = (t.row + 0.5) * ts;
      return Math.abs(x - cx) < ts * 1.4 && Math.abs(y - cy) < ts * 1.4;
    });
  }

  /** L'objet ramassable actif le plus proche. */
  thingNear(x, y, range, id) {
    const thing = this.things[id];
    if (!thing || !thing.active || thing.taken) return null;
    return Math.hypot(thing.x - x, thing.y - y) <= range ? thing : null;
  }

  /** Vrai si le joueur est assez près de Tsuki. */
  isNearCat(x, y, range) {
    if (!this.cat || this.cat.carried) return false;
    return Math.hypot(this.cat.x - x, this.cat.y - y) <= range;
  }

  /** Collision d'un cercle, en échantillonnant son contour. */
  canOccupy(x, y, radius) {
    const r = radius * 0.8;
    const points = [
      [x, y],
      [x - r, y], [x + r, y],
      [x, y - r], [x, y + r]
    ];
    return points.every(([px, py]) => this.isWalkable(px, py));
  }

  /** Vrai si le joueur est entré dans la chambre du bébé. */
  isInNursery(x, y) {
    const room = this.nursery;
    if (!room) return false;
    return this.roomAt(x, y) === room;
  }

  /** Vrai si le joueur est dans la chambre de Tsuki. */
  isInTsukiRoom(x, y) {
    const room = this.tsukiRoom;
    if (!room) return false;
    return this.roomAt(x, y) === room;
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------

  /** Le plan est figé : on le dessine une seule fois hors écran. */
  prerender() {
    const layer = document.createElement('canvas');
    layer.width = this.width;
    layer.height = this.height;
    const ctx = layer.getContext('2d');
    const ts = this.tileSize;

    // Sols
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this._drawFloor(ctx, this.tiles[r][c], c * ts, r * ts, ts, c, r);
      }
    }

    // Meubles regroupés : chaque bloc contigu est dessiné d'un seul tenant.
    this.pieces.forEach((piece) => {
      const rect = {
        x: piece.col * ts,
        y: piece.row * ts,
        w: piece.w * ts,
        h: piece.h * ts
      };
      ctx.save();
      this._dropShadow(ctx, rect);
      this._drawPiece(ctx, piece.kind, rect, piece.facing);
      ctx.restore();
    });

    // Portes : une barre par groupe de cases contiguës.
    this._drawDoors(ctx);

    // Murs par-dessus, pour qu'ils restent nets.
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c] === TILE.WALL) this._drawWall(ctx, c * ts, r * ts, ts);
      }
    }

    // Étiquettes en dernier : toujours lisibles au-dessus du mobilier.
    this._drawRoomLabels(ctx);

    this._drawNursery(ctx);
    this._drawNurseryDoor(ctx);
    this.staticLayer = layer;
  }

  _drawFloor(ctx, tile, x, y, ts, c, r) {
    if (tile === TILE.OUTSIDE) {
      ctx.fillStyle = '#1b2b25';
      ctx.fillRect(x, y, ts, ts);
      return;
    }

    if (tile === TILE.WALL) {
      ctx.fillStyle = '#d8cdba';
      ctx.fillRect(x, y, ts, ts);
      return;
    }

    if (tile === TILE.TILEFLOOR) {
      /*
       * Carrelage gris foncé, franchement froid et un peu plus clair que le
       * parquet : les deux sols avaient une luminosité quasi identique, on ne
       * distinguait plus la cuisine du salon.
       */
      const light = (c + r) % 2 === 0;
      ctx.fillStyle = light ? '#6f777d' : '#646c72';
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeStyle = 'rgba(40,46,50,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
      return;
    }

    /*
     * Parquet en lames horizontales, brun foncé.
     *
     * La teinte ne dépend que de la RANGÉE : une lame garde donc la même
     * couleur sur toute sa longueur. Avant, elle variait aussi avec la
     * colonne, ce qui découpait le sol en damier au lieu de lames.
     */
    const shades = ['#7a5433', '#8a6039', '#6f4b2d', '#825935'];
    ctx.fillStyle = shades[r % shades.length];
    ctx.fillRect(x, y, ts, ts);

    // Joint entre deux lames : trait sombre continu en haut de la case.
    ctx.strokeStyle = 'rgba(38,24,12,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.75);
    ctx.lineTo(x + ts, y + 0.75);
    ctx.stroke();

    // Bout de lame : un seul joint vertical, décalé d'une rangée à l'autre,
    // pour suggérer des longueurs différentes sans casser l'horizontale.
    const offset = (r % 2 === 0) ? 0 : ts / 2;
    ctx.strokeStyle = 'rgba(38,24,12,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + offset + 0.5, y + 1.5);
    ctx.lineTo(x + offset + 0.5, y + ts);
    ctx.stroke();

    // Veinage : deux traits clairs dans le sens de la lame.
    ctx.strokeStyle = 'rgba(255,225,190,0.09)';
    ctx.lineWidth = 1;
    [0.38, 0.7].forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(x, y + ts * f);
      ctx.lineTo(x + ts, y + ts * f);
      ctx.stroke();
    });

    // Les portes sont dessinées à part, par groupes de cases contiguës,
    // pour qu'une porte large reste une seule barre. Voir `_drawDoors`.
  }

  /**
   * Dessine les portes, une par groupe de cases contiguës.
   *
   * Appelé après les sols et avant les murs : une porte large obtient ainsi
   * une barre continue et un unique cadenas, au lieu d'un motif répété case
   * par case qui se lisait comme plusieurs portes collées.
   */
  _drawDoors(ctx) {
    const ts = this.tileSize;

    (this.doorGroups || []).forEach((d) => {
      const locked = d.lock ? !this.locks[d.lock] : false;
      const x = d.col * ts;
      const y = d.row * ts;
      const w = d.w * ts;
      const h = d.h * ts;

      // Épaisseur de la barre : dans le sens de la traversée.
      const thick = Math.max(3, ts * 0.3);
      ctx.fillStyle = locked ? '#6f4028' : '#8a5a3c';

      if (d.horizontal) {
        ctx.fillRect(x, y + (h - thick) / 2, w, thick);
      } else {
        ctx.fillRect(x + (w - thick) / 2, y, thick, h);
      }

      if (locked) {
        /*
         * Le cadenas est dimensionné sur la largeur de la porte, pas sur une
         * fraction de la case : il était auparavant si petit (3 % de la
         * surface de la porte) qu'il passait inaperçu, surtout sur mobile où
         * le plan est réduit.
         */
        const span = Math.min(w, h);
        this._drawPadlock(ctx, x + w / 2, y + h / 2, span * 1.15);
      }
    });
  }

  /**
   * Porte vue de dessus : une simple barre en travers de l'ouverture.
   *
   * Vue du dessus, une porte n'est que le battant : une barre. Ouverte ou
   * fermée, c'est la même barre ; seul un cadenas signale qu'elle est
   * verrouillée. Inutile de dessiner chambranle, seuil et poignée, qui ne se
   * lisent pas à cette échelle.
   *
   * @param {boolean} locked ajoute le cadenas
   */
  _drawDoorway(ctx, x, y, ts, c, r, locked) {
    const isWall = (cc, rr) => {
      if (!this.tiles[rr] || this.tiles[rr][cc] === undefined) return true;
      const t = this.tiles[rr][cc];
      return t === TILE.WALL || t === TILE.OUTSIDE;
    };

    // La barre suit le mur qui porte la porte : on compare les deux axes.
    const wallsVert = (isWall(c, r - 1) ? 1 : 0) + (isWall(c, r + 1) ? 1 : 0);
    const wallsHorz = (isWall(c - 1, r) ? 1 : 0) + (isWall(c + 1, r) ? 1 : 0);
    const horizontal = wallsHorz > wallsVert;

    // Le sol de la pièce reste visible autour de la barre.
    const thick = Math.max(3, ts * 0.3);
    ctx.fillStyle = locked ? '#6f4028' : '#8a5a3c';

    if (horizontal) {
      ctx.fillRect(x, y + (ts - thick) / 2, ts, thick);
    } else {
      ctx.fillRect(x + (ts - thick) / 2, y, thick, ts);
    }

    if (locked) this._drawPadlock(ctx, x + ts / 2, y + ts / 2, ts * 0.5);
  }

  /**
   * Mur plein. Le liseré clair n'est tracé que sur les faces exposées à une
   * pièce, ce qui donne du relief au lieu d'un quadrillage uniforme.
   */
  _drawWall(ctx, x, y, ts) {
    /*
     * Mur clair, volontairement contrasté avec les sols.
     * Il était auparavant brun-gris sombre, ce qui se confondait avec le
     * parquet une fois celui-ci assombri : on ne lisait plus le plan.
     */
    ctx.fillStyle = '#cfc6b4';
    ctx.fillRect(x, y, ts, ts);

    const c = Math.round(x / ts);
    const r = Math.round(y / ts);
    const isWall = (cc, rr) => {
      if (!this.tiles[rr] || this.tiles[rr][cc] === undefined) return true;
      const t = this.tiles[rr][cc];
      return t === TILE.WALL || t === TILE.OUTSIDE;
    };

    /*
     * Plinthe sombre sur les faces exposées à une pièce. Sur un mur clair, un
     * liseré blanc ne se verrait pas : c'est donc une ombre qui donne le
     * relief, et elle marque nettement la limite avec le sol.
     */
    ctx.fillStyle = 'rgba(90,78,60,0.4)';
    if (!isWall(c, r - 1)) ctx.fillRect(x, y, ts, 2.5);
    if (!isWall(c - 1, r)) ctx.fillRect(x, y, 2.5, ts);
    if (!isWall(c, r + 1)) ctx.fillRect(x, y + ts - 2.5, ts, 2.5);
    if (!isWall(c + 1, r)) ctx.fillRect(x + ts - 2.5, y, 2.5, ts);
  }

  _drawRoomLabels(ctx) {
    const ts = this.tileSize;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(9, ts * 0.36)}px sans-serif`;
    // Texte clair : les sols sont sombres, une étiquette brune s'y noyait.
    ctx.fillStyle = 'rgba(255,246,230,0.5)';

    (CONFIG.rooms || []).forEach((room) => {
      if (!room.label) return;
      // La chambre du bébé n'est nommée qu'une fois la porte ouverte :
      // avant ça, aucun nom ne doit trahir la surprise.
      if (room.nursery && !this.nurseryFurnished) return;
      ctx.fillText(
        Lang.t('rooms.' + room.id).toUpperCase(),
        room.label.col * ts,
        room.label.row * ts
      );
    });
  }

  /** Encadre les portes encore fermées, pour qu'on les remarque. */
  _drawNurseryDoor(ctx) {
    const ts = this.tileSize;

    Object.entries(this.doorTiles).forEach(([lock, tiles]) => {
      if (!tiles.length || this.locks[lock]) return;

      const cols = tiles.map((t) => t.col);
      const rows = tiles.map((t) => t.row);
      const x = Math.min(...cols) * ts;
      const y = Math.min(...rows) * ts;
      const w = (Math.max(...cols) - Math.min(...cols) + 1) * ts;
      const h = (Math.max(...rows) - Math.min(...rows) + 1) * ts;

      ctx.save();
      ctx.strokeStyle = 'rgba(217,138,123,0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
      ctx.restore();
    });
  }

  /**
   * Meuble la chambre du bébé une fois la porte ouverte : landau, tapis,
   * et le bébé endormi dedans. Dessiné dans la couche figée, donc appelé
   * après `unlock()` qui force un nouveau rendu.
   */
  _drawNursery(ctx) {
    const room = this.nursery;
    if (!room || !this.nurseryFurnished) return;

    const ts = this.tileSize;
    const cx = (room.col + room.w / 2) * ts;
    const cy = (room.row + room.h / 2) * ts;

    // Tapis rond
    const rug = ctx.createRadialGradient(cx, cy, ts, cx, cy, ts * 3.2);
    rug.addColorStop(0, 'rgba(247, 224, 226, 0.95)');
    rug.addColorStop(1, 'rgba(247, 224, 226, 0.25)');
    ctx.fillStyle = rug;
    ctx.beginPath();
    ctx.ellipse(cx, cy + ts * 0.3, ts * 3.2, ts * 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Peluche, dans le coin inférieur gauche
    this._drawTeddy(
      ctx,
      (room.col + 2.6) * ts,
      (room.row + room.h - 1.8) * ts,
      ts * 1.5
    );

    // Landau vide, dans le coin inférieur droit : c'est le bébé au centre qui
    // porte le message, le landau n'est plus qu'un élément de décor.
    this._drawPram(
      ctx,
      (room.col + room.w - 2.4) * ts,
      (room.row + room.h - 2.2) * ts,
      ts * 2.3
    );

    // Le bébé, au centre sur son tapis : c'est lui qu'on doit voir en premier.
    this._drawBigBaby(ctx, cx, cy + ts * 0.2, ts * 2.8);

    // Guirlande de fanions au mur du haut
    const gy = (room.row + 0.5) * ts;
    const colors = ['#d98a7b', '#e0b664', '#8fc4d8', '#f2c4d4'];
    ctx.strokeStyle = 'rgba(120,100,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo((room.col + 1) * ts, gy);
    ctx.quadraticCurveTo(cx, gy + ts * 0.5, (room.col + room.w - 1) * ts, gy);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const px = (room.col + 1) * ts + t * (room.w - 2) * ts;
      const py = gy + Math.sin(Math.PI * t) * ts * 0.34;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(px - ts * 0.15, py);
      ctx.lineTo(px + ts * 0.15, py);
      ctx.lineTo(px, py + ts * 0.42);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Le bébé au centre de la chambre, en grand, sur un tapis rond.
   *
   * C'est l'élément qui porte l'annonce : il est volontairement gros et
   * lisible, plutôt que caché dans un landau où on distinguait mal de quoi
   * il s'agissait. L'emoji est dessiné par-dessus un tapis, avec un halo
   * doux pour qu'il se détache du parquet.
   */
  _drawBigBaby(ctx, cx, cy, size) {
    // Tapis rond sous le bébé
    ctx.fillStyle = '#f6dfe4';
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.78, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8bfc8';
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.stroke();

    // Deux anneaux concentriques, comme un tapis tressé
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(1.5, size * 0.022);
    [0.58, 0.38].forEach((r) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * r, size * (r * 0.9), 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Halo blanc discret sous le bébé, pour le détacher du tapis
    const glow = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.5)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    this._drawSwaddledBaby(ctx, cx, cy, size * 1.15);
  }

  /**
   * Bébé emmailloté, vu de face : tête ronde en haut, corps en cocon vert
   * avec le drap replié en diagonale. Dessiné en primitives plutôt qu'en
   * emoji, pour maîtriser l'allure et le rendu sur tous les appareils.
   */
  _drawSwaddledBaby(ctx, cx, cy, size) {
    const skin = '#f2cfa8';
    const skinShade = '#e6bd93';
    const wrapDark = '#8fd4c4';
    const wrapLight = '#d8f0e6';

    const headR = size * 0.2;
    const headY = cy - size * 0.24;
    const bodyTop = headY + headR * 0.75;
    const bodyH = size * 0.56;
    const bodyW = size * 0.42;

    // ---- Corps : cocon arrondi, plus large en bas
    ctx.fillStyle = wrapDark;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.42, bodyTop);
    ctx.quadraticCurveTo(cx - bodyW * 0.62, bodyTop + bodyH * 0.55,
                         cx - bodyW * 0.34, bodyTop + bodyH * 0.92);
    ctx.quadraticCurveTo(cx, bodyTop + bodyH * 1.14,
                         cx + bodyW * 0.34, bodyTop + bodyH * 0.92);
    ctx.quadraticCurveTo(cx + bodyW * 0.62, bodyTop + bodyH * 0.55,
                         cx + bodyW * 0.42, bodyTop);
    ctx.closePath();
    ctx.fill();

    // Drap replié : un pan clair en diagonale, comme sur un vrai lange
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.42, bodyTop);
    ctx.quadraticCurveTo(cx - bodyW * 0.62, bodyTop + bodyH * 0.55,
                         cx - bodyW * 0.34, bodyTop + bodyH * 0.92);
    ctx.quadraticCurveTo(cx, bodyTop + bodyH * 1.14,
                         cx + bodyW * 0.34, bodyTop + bodyH * 0.92);
    ctx.quadraticCurveTo(cx + bodyW * 0.62, bodyTop + bodyH * 0.55,
                         cx + bodyW * 0.42, bodyTop);
    ctx.closePath();
    ctx.clip();

    /*
     * Le pan clair ne couvre que la partie gauche/haute du cocon : une
     * première version l'étalait sur presque tout le corps et la couleur
     * verte disparaissait, on ne lisait plus le lange.
     */
    ctx.fillStyle = wrapLight;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.7, bodyTop - bodyH * 0.05);
    ctx.lineTo(cx + bodyW * 0.24, bodyTop - bodyH * 0.05);
    ctx.lineTo(cx - bodyW * 0.7, bodyTop + bodyH * 0.86);
    ctx.closePath();
    ctx.fill();

    // Deuxième pan, en bas à droite, qui croise le premier
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.7, bodyTop + bodyH * 0.34);
    ctx.lineTo(cx + bodyW * 0.7, bodyTop + bodyH * 0.72);
    ctx.lineTo(cx - bodyW * 0.2, bodyTop + bodyH * 1.15);
    ctx.closePath();
    ctx.fill();

    // Bords des plis, tracés clairs
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.2, size * 0.02);
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.24, bodyTop - bodyH * 0.05);
    ctx.lineTo(cx - bodyW * 0.7, bodyTop + bodyH * 0.86);
    ctx.moveTo(cx + bodyW * 0.7, bodyTop + bodyH * 0.34);
    ctx.lineTo(cx - bodyW * 0.2, bodyTop + bodyH * 1.15);
    ctx.stroke();
    ctx.restore();

    // Col du lange, juste sous le menton
    ctx.fillStyle = wrapLight;
    ctx.beginPath();
    ctx.ellipse(cx, bodyTop + size * 0.02, bodyW * 0.46, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Oreilles
    ctx.fillStyle = skinShade;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(cx + s * headR * 0.94, headY + headR * 0.1, headR * 0.26, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---- Tête
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Visage
    // Sourcils
    ctx.strokeStyle = 'rgba(90,62,40,0.75)';
    ctx.lineWidth = Math.max(1, size * 0.016);
    ctx.lineCap = 'round';
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(cx + s * headR * 0.38, headY - headR * 0.28, headR * 0.26,
              Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    });

    // Yeux : blanc, iris sombre, reflet
    [-1, 1].forEach((s) => {
      const ex = cx + s * headR * 0.38;
      const ey = headY - headR * 0.02;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, headR * 0.2, headR * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3526';
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + headR * 0.05, ey - headR * 0.06, headR * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });

    // Petit nez
    ctx.fillStyle = skinShade;
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.26, headR * 0.075, headR * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bouche ouverte, avec la langue
    ctx.fillStyle = '#5a3b2a';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.3, headY + headR * 0.44);
    ctx.quadraticCurveTo(cx, headY + headR * 0.88, cx + headR * 0.3, headY + headR * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eb9ec0';
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.66, headR * 0.17, headR * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    // La mèche en boucle sur le crâne, signature du dessin
    ctx.strokeStyle = '#e8b93f';
    ctx.lineWidth = Math.max(1.6, size * 0.026);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + headR * 0.06, headY - headR * 1.12, headR * 0.2,
            Math.PI * 0.75, Math.PI * 2.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + headR * 0.02, headY - headR * 0.96);
    ctx.lineTo(cx - headR * 0.04, headY - headR * 0.7);
    ctx.stroke();
  }

  /** Peluche : un ourson vu de dessus, bras et jambes écartés. */
  _drawTeddy(ctx, cx, cy, size) {
    const fur = '#c99a6a';
    const furDark = '#a97f52';
    const belly = '#e8d3b8';

    // Ombre
    ctx.fillStyle = 'rgba(50,38,26,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.5, size * 0.42, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bras et jambes, quatre pattes arrondies
    ctx.fillStyle = furDark;
    [[-0.42, -0.1], [0.42, -0.1], [-0.3, 0.42], [0.3, 0.42]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.ellipse(cx + size * ox, cy + size * oy, size * 0.17, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Corps
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.12, size * 0.32, size * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ventre clair
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.16, size * 0.18, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Oreilles
    ctx.fillStyle = furDark;
    [-0.26, 0.26].forEach((ox) => {
      ctx.beginPath();
      ctx.arc(cx + size * ox, cy - size * 0.42, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });

    // Tête
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.28, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Museau
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(cx, cy - size * 0.2, size * 0.14, size * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yeux et truffe
    ctx.fillStyle = '#3b2b1e';
    [-0.11, 0.11].forEach((ox) => {
      ctx.beginPath();
      ctx.arc(cx + size * ox, cy - size * 0.34, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.22, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Landau vu de dessus, avec le bébé endormi à l'intérieur. */
  /**
   * Landau vu de dessus.
   *
   * Le dessin est fait couché (tête à gauche, pieds à droite) parce que c'est
   * plus simple à écrire, puis pivoté d'un quart de tour : à l'écran la tête
   * se retrouve EN HAUT, couchée dans le sens de la pièce. C'est l'orientation
   * qu'on attend d'un lit vu de dessus.
   */
  _drawPram(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 2);   // tête vers le haut de l'écran
    ctx.translate(-cx, -cy);
    this._drawPramFlat(ctx, cx, cy, size);
    ctx.restore();
  }

  /** Le tracé, en repère couché : tête à gauche, pieds à droite. */
  _drawPramFlat(ctx, cx, cy, size) {
    const w = size;
    const h = size * 0.66;
    const x = cx - w / 2;
    const y = cy - h / 2;

    // Ombre au sol
    ctx.fillStyle = 'rgba(50,38,26,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.52, w * 0.44, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    /*
     * Le châssis, dessiné AVANT la nacelle pour qu'elle le recouvre.
     * Les roues sont des pastilles allongées posées sur deux essieux
     * visibles : sans eux, on ne lisait que quatre points isolés aux
     * quatre coins, sans rapport avec un landau.
     */
    const axleY1 = y + h * 0.2;
    const axleY2 = y + h * 0.8;
    const wheelR = size * 0.075;
    const inset = w * 0.2;

    ctx.strokeStyle = '#5a636b';
    ctx.lineWidth = Math.max(1.6, size * 0.035);
    ctx.lineCap = 'round';
    [axleY1, axleY2].forEach((ay) => {
      ctx.beginPath();
      ctx.moveTo(x + inset, ay);
      ctx.lineTo(x + w - inset, ay);
      ctx.stroke();
    });
    // Longeron central, qui relie les deux essieux
    ctx.beginPath();
    ctx.moveTo(cx, axleY1);
    ctx.lineTo(cx, axleY2);
    ctx.stroke();

    // Roues : ellipses couchées dans le sens de la marche
    [[x + inset, axleY1], [x + w - inset, axleY1],
     [x + inset, axleY2], [x + w - inset, axleY2]].forEach(([wx, wy]) => {
      ctx.fillStyle = '#33393f';
      ctx.beginPath();
      ctx.ellipse(wx, wy, wheelR * 1.35, wheelR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(wx, wy, wheelR * 0.45, wheelR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Nacelle : ovale, plus lisible qu'un rectangle vu de dessus
    ctx.fillStyle = '#eef3f6';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aebecb';
    ctx.lineWidth = Math.max(1.5, size * 0.028);
    ctx.stroke();

    /*
     * Les trois zones s'enchaînent comme dans un vrai landau, de la tête aux
     * pieds : la capote coiffe la tête à gauche, la couverture part de la
     * poitrine et couvre tout le reste vers la droite.
     *
     * La version précédente plaçait la tête au centre, la capote abritant du
     * vide à côté d'elle : vu de dessus, on ne comprenait plus ce qu'on
     * regardait. La tête doit être SOUS la capote.
     */
    const headX = cx - w * 0.2;   // tête, au tiers gauche
    const br = size * 0.1;        // rayon de la tête

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
    ctx.clip();

    // Capote : coiffe la tête, depuis le bord gauche
    ctx.fillStyle = '#8fb9cf';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.34, cy, w * 0.17, h * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, size * 0.018);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.34, cy, w * 0.1, h * 0.29, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Couverture : commence juste après la tête et va jusqu'aux pieds
    const blanketX = headX + br * 1.15;
    ctx.fillStyle = '#f7ccd6';
    ctx.fillRect(blanketX, cy - h * 0.45, cx + w * 0.45 - blanketX, h * 0.9);

    // Bord replié de la couverture, au niveau de la poitrine
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.2, size * 0.024);
    ctx.beginPath();
    ctx.moveTo(blanketX, cy - h * 0.45);
    ctx.lineTo(blanketX, cy + h * 0.45);
    ctx.stroke();

    // Deux plis dans la longueur, pour ne pas laisser un aplat de rose
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, size * 0.016);
    [0.14, 0.3].forEach((o) => {
      ctx.beginPath();
      ctx.moveTo(cx + w * o, cy - h * 0.35);
      ctx.lineTo(cx + w * o, cy + h * 0.35);
      ctx.stroke();
    });
    ctx.restore();

    // Poignée, au pied du landau
    ctx.strokeStyle = '#6b5647';
    ctx.lineWidth = Math.max(1.8, size * 0.04);
    ctx.beginPath();
    ctx.arc(cx + w * 0.44, cy, h * 0.2, Math.PI * 1.6, Math.PI * 0.4);
    ctx.stroke();

    // Le landau reste vide : le bébé est au centre de la pièce, en grand.
    // Un oreiller sous la capote suffit à suggérer qu'il l'attend.
    this._fillRound(
      ctx,
      headX - br * 0.9, cy - h * 0.2,
      br * 2, h * 0.4,
      br * 0.5, '#ffffff'
    );
  }

  // ------------------------------------------------------------------
  // Meubles : chaque fonction reçoit le rectangle complet du meuble,
  // pas une case isolée. C'est ce qui permet une vraie silhouette.
  // ------------------------------------------------------------------

  _dropShadow(ctx, rect) {
    ctx.fillStyle = 'rgba(60,45,30,0.16)';
    this._roundRect(ctx, rect.x + 3, rect.y + 4, rect.w, rect.h, 4);
    ctx.fill();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _fillRound(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  _drawPiece(ctx, kind, rect, facing) {
    const fn = this[`_piece_${kind}`];
    if (fn) fn.call(this, ctx, rect, facing || 'down');
    else this._fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 3, '#9aa0a6');
  }

  /**
   * Exécute un tracé dans un repère tourné, de sorte que la fonction de
   * dessin puisse toujours travailler « face vers le bas » sans se soucier
   * de l'orientation réelle du meuble.
   *
   * @param {'up'|'down'|'left'|'right'} facing direction que regarde le meuble
   * @param {Function} paint reçoit ({w, h}) dans le repère redressé
   */
  _oriented(ctx, rect, facing, paint) {
    const { x, y, w, h } = rect;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);

    let dims;
    switch (facing) {
      case 'up':
        ctx.rotate(Math.PI);
        dims = { w, h };
        break;
      case 'left':
        ctx.rotate(Math.PI / 2);
        dims = { w: h, h: w };
        break;
      case 'right':
        ctx.rotate(-Math.PI / 2);
        dims = { w: h, h: w };
        break;
      default: // 'down'
        dims = { w, h };
        break;
    }

    ctx.translate(-dims.w / 2, -dims.h / 2);
    paint(dims);
    ctx.restore();
  }

  /**
   * Canapé. Dessiné dossier en haut, assise en bas, puis tourné selon
   * l'orientation détectée : le dossier finit toujours contre le mur.
   */
  _piece_sofa(ctx, rect, facing) {
    const arm = '#5d6e82';
    const body = '#6f8298';
    const cushion = '#8ba2b8';

    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 6, body);

      const backH = Math.min(h * 0.34, 14);
      const armW = Math.min(w * 0.16, 12);

      // Dossier en haut, accoudoirs sur les côtés
      this._fillRound(ctx, 0, 0, w, backH, 6, arm);
      this._fillRound(ctx, 0, 0, armW, h, 6, arm);
      this._fillRound(ctx, w - armW, 0, armW, h, 6, arm);

      // Coussins d'assise, découpés le long du canapé
      const ix = armW + 2;
      const iw = w - armW * 2 - 4;
      const iy = backH + 2;
      const ih = h - backH - 4;
      if (iw > 4 && ih > 4) {
        const n = Math.max(1, Math.round(iw / Math.max(10, ih * 0.95)));
        for (let i = 0; i < n; i++) {
          const cw = iw / n;
          this._fillRound(ctx, ix + i * cw + 1.5, iy, cw - 3, ih, 4, cushion);
        }
      }

      // Liseré clair sur le haut du dossier
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(2, 2, w - 4, 2.5);
    });
  }

  /**
   * Fauteuil : dossier contre le mur, accoudoirs, et un coussin creusé.
   * Plus profond et plus rond qu'un canapé, dont il partage la logique.
   */
  _piece_armchair(ctx, rect, facing) {
    const frame = '#7a6455';
    const body = '#96806d';
    const cushion = '#b09a84';

    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, Math.min(w, h) * 0.22, body);

      const backH = Math.min(h * 0.36, 16);
      const armW = Math.min(w * 0.22, 14);

      // Dossier et accoudoirs
      this._fillRound(ctx, 0, 0, w, backH, Math.min(w, h) * 0.2, frame);
      this._fillRound(ctx, 0, 0, armW, h, Math.min(w, h) * 0.2, frame);
      this._fillRound(ctx, w - armW, 0, armW, h, Math.min(w, h) * 0.2, frame);

      // Assise creusée
      const ix = armW + 2;
      const iw = w - armW * 2 - 4;
      const iy = backH + 2;
      const ih = h - backH - 5;
      if (iw > 4 && ih > 4) {
        this._fillRound(ctx, ix, iy, iw, ih, Math.min(iw, ih) * 0.28, cushion);
        ctx.strokeStyle = 'rgba(90,70,55,0.3)';
        ctx.lineWidth = 1.2;
        this._roundRect(ctx, ix + 2, iy + 2, iw - 4, ih - 4, Math.min(iw, ih) * 0.24);
        ctx.stroke();
      }

      // Liseré clair sur le haut du dossier
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(2, 2, w - 4, 2.5);
    });
  }

  /** Lit : tête de lit contre le mur, oreillers puis couette vers la pièce. */
  _piece_bed(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 5, '#f4efe5');
      ctx.strokeStyle = 'rgba(120,95,70,0.3)';
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 5);
      ctx.stroke();

      // Tête de lit
      const headH = Math.min(h * 0.1, 10);
      this._fillRound(ctx, 0, 0, w, headH, 4, '#8a6a4d');

      // Oreillers
      const pw = w * 0.42;
      const ph = Math.min(h * 0.16, 20);
      this._fillRound(ctx, w * 0.045, headH + 3, pw, ph, 5, '#ffffff');
      this._fillRound(ctx, w * 0.535, headH + 3, pw, ph, 5, '#ffffff');

      // Couette
      const dy = headH + ph + 7;
      this._fillRound(ctx, 2.5, dy, w - 5, h - dy - 2.5, 5, '#aec6d6');
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(5, dy + 5);
      ctx.lineTo(w - 5, dy + 5);
      ctx.stroke();
    });
  }

  /** Douche : receveur carrelé, siphon central et pomme au mur. */
  _piece_shower(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 4, '#cdd9e0');

      // Carrelage du receveur
      ctx.strokeStyle = 'rgba(120,145,160,0.5)';
      ctx.lineWidth = 1;
      const step = Math.max(8, Math.min(w, h) / 3);
      for (let gx = step; gx < w - 1; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 2);
        ctx.lineTo(gx, h - 2);
        ctx.stroke();
      }
      for (let gy = step; gy < h - 1; gy += step) {
        ctx.beginPath();
        ctx.moveTo(2, gy);
        ctx.lineTo(w - 2, gy);
        ctx.stroke();
      }

      // Paroi vitrée du côté ouvert (en bas dans le repère redressé)
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(1.5, h - 4, w - 3, 3);

      // Pomme de douche, contre le mur
      ctx.fillStyle = '#8b9aa5';
      const hd = Math.min(w, h) * 0.16;
      ctx.beginPath();
      ctx.arc(w / 2, hd * 1.1, hd, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(w / 2, hd * 1.1, hd * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Siphon
      ctx.fillStyle = '#94a5ae';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.62, Math.min(w, h) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Vasques : plan, une ou deux cuves, robinet et miroir contre le mur. */
  _piece_sink(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      // Plan de toilette
      this._fillRound(ctx, 0, 0, w, h, 3, '#e8e3da');
      ctx.fillStyle = '#d3ccc1';
      ctx.fillRect(0, h - Math.min(4, h * 0.2), w, Math.min(4, h * 0.2));

      // Miroir collé au mur
      const mirrorH = Math.min(h * 0.22, 6);
      this._fillRound(ctx, w * 0.1, 1.5, w * 0.8, mirrorH, 2, '#a8c4d2');

      /*
       * Deux vasques au maximum : le nombre était auparavant proportionnel à
       * la longueur du meuble, ce qui en alignait quatre ou cinq sur un plan
       * un peu large. Un meuble court n'en reçoit qu'une.
       */
      const n = w < 52 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const cw = w / n;
        const cx = cw * (i + 0.5);
        const rx = Math.min(cw * 0.3, h * 0.34);
        const ry = Math.min(h * 0.3, cw * 0.3);
        const cy = h * 0.56;

        ctx.fillStyle = '#f7f5f1';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b6c6cf';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Bonde
        ctx.fillStyle = '#9fb0b9';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(rx, ry) * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Robinet, côté mur
        ctx.fillStyle = '#8fa0aa';
        ctx.fillRect(cx - 1.5, mirrorH + 2, 3, Math.max(3, h * 0.14));
      }
    });
  }

  /** Toilettes : cuvette et réservoir contre le mur. */
  _piece_toilet(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      // Réservoir
      this._fillRound(ctx, w * 0.15, 1, w * 0.7, h * 0.26, 3, '#f2f4f5');
      ctx.strokeStyle = '#c8d0d5';
      ctx.lineWidth = 1.2;
      this._roundRect(ctx, w * 0.15, 1, w * 0.7, h * 0.26, 3);
      ctx.stroke();

      // Cuvette
      ctx.fillStyle = '#f7f9fa';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.62, w * 0.32, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8d0d5';
      ctx.stroke();

      ctx.fillStyle = '#dde5e9';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.62, w * 0.2, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Machine à laver : hublot rond et bandeau de commandes. */
  _piece_washer(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 3, '#eceff1');
      ctx.strokeStyle = '#c3cace';
      ctx.lineWidth = 1.2;
      this._roundRect(ctx, 0.6, 0.6, w - 1.2, h - 1.2, 3);
      ctx.stroke();

      // Bandeau
      ctx.fillStyle = '#d6dbde';
      ctx.fillRect(2, 2, w - 4, Math.min(5, h * 0.16));

      // Hublot
      const r = Math.min(w, h) * 0.28;
      ctx.fillStyle = '#9fb4c0';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f8b9b';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.6, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Table : plateau avec un liseré, et quatre pieds visibles aux angles. */
  _piece_table(ctx, { x, y, w, h }) {
    const inset = Math.min(w, h) * 0.08;
    this._fillRound(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 5, '#a9784e');
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, x + inset + 3, y + inset + 3, w - inset * 2 - 6, h - inset * 2 - 6, 4);
    ctx.stroke();

    // Pieds
    const s = Math.min(w, h) * 0.13;
    ctx.fillStyle = '#7d5636';
    [[x + inset, y + inset], [x + w - inset - s, y + inset],
     [x + inset, y + h - inset - s], [x + w - inset - s, y + h - inset - s]]
      .forEach(([px, py]) => ctx.fillRect(px, py, s, s));
  }

  /** Plan de travail : évier et plaques de cuisson, orientés vers la pièce. */
  _piece_counter(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 3, '#cfc9bd');

      // Chant plus sombre du côté de la pièce
      ctx.fillStyle = '#b3aca2';
      ctx.fillRect(0, h - Math.min(5, h * 0.22), w, Math.min(5, h * 0.22));

      if (w < 24) return;

      // Évier
      const sw = Math.min(w * 0.18, 26);
      const sh = Math.min(h * 0.5, 16);
      this._fillRound(ctx, w * 0.07, (h - sh) / 2, sw, sh, 3, '#a3adb3');
      ctx.fillStyle = '#7d878d';
      ctx.beginPath();
      ctx.arc(w * 0.07 + sw / 2, h / 2, Math.min(3, sh * 0.18), 0, Math.PI * 2);
      ctx.fill();

      // Plaques de cuisson
      const br = Math.min(h * 0.17, 5.5);
      const bx = w * 0.45;
      ctx.fillStyle = '#40464b';
      [[0, -1], [1, -1], [0, 1], [1, 1]].forEach(([ix, iy]) => {
        ctx.beginPath();
        ctx.arc(bx + ix * br * 2.6, h / 2 + iy * br * 1.2, br, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  /** Frigo : deux portes et poignées côté pièce. */
  _piece_fridge(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 4, '#eaeef1');
      ctx.strokeStyle = '#c0c7cc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, h * 0.34);
      ctx.lineTo(w - 2, h * 0.34);
      ctx.stroke();

      ctx.fillStyle = '#9aa3aa';
      const hw = Math.max(2.5, w * 0.07);
      ctx.fillRect(w - hw * 2.4, h * 0.12, hw, h * 0.16);
      ctx.fillRect(w - hw * 2.4, h * 0.44, hw, h * 0.3);
    });
  }

  /** Baignoire : cuve arrondie dans son socle, avec robinetterie. */
  _piece_bath(ctx, { x, y, w, h }) {
    this._fillRound(ctx, x, y, w, h, 6, '#e6eef3');
    const m = Math.min(w, h) * 0.14;
    this._fillRound(ctx, x + m, y + m, w - m * 2, h - m * 2, Math.min(w, h) * 0.3, '#c9e0ec');
    ctx.strokeStyle = '#9dbccd';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, x + m, y + m, w - m * 2, h - m * 2, Math.min(w, h) * 0.3);
    ctx.stroke();

    // Bonde + robinet
    ctx.fillStyle = '#8fa8b8';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * (h >= w ? 0.78 : 0.5), Math.min(w, h) * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w / 2 - 2, y + m * 0.4, 4, m * 0.8);
  }

  /** Armoire : caisson avec portes et poignées centrales. */
  _piece_wardrobe(ctx, { x, y, w, h }) {
    this._fillRound(ctx, x, y, w, h, 3, '#8a6a4d');
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    const vertical = h >= w;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x + w / 2, y + 3);
      ctx.lineTo(x + w / 2, y + h - 3);
    } else {
      ctx.moveTo(x + 3, y + h / 2);
      ctx.lineTo(x + w - 3, y + h / 2);
    }
    ctx.stroke();

    ctx.fillStyle = '#e0c07a';
    const s = Math.min(w, h) * 0.09;
    if (vertical) {
      ctx.fillRect(x + w / 2 - s * 2, y + h / 2 - s / 2, s, s);
      ctx.fillRect(x + w / 2 + s, y + h / 2 - s / 2, s, s);
    } else {
      ctx.fillRect(x + w / 2 - s / 2, y + h / 2 - s * 2, s, s);
      ctx.fillRect(x + w / 2 - s / 2, y + h / 2 + s, s, s);
    }
  }

  /** Bureau : écran contre le mur, clavier côté chaise. */
  _piece_desk(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 4, '#9b7b5b');
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(2, 2, w - 4, Math.min(5, h * 0.1));

      const sw = Math.min(w * 0.4, 44);
      const sh = Math.min(h * 0.28, 20);

      // Écran, adossé au mur
      this._fillRound(ctx, w * 0.1, h * 0.14, sw, sh, 3, '#333b42');
      this._fillRound(ctx, w * 0.1 + 2.5, h * 0.14 + 2.5, sw - 5, sh - 5, 2, '#6d93a8');

      // Clavier, vers la pièce
      this._fillRound(ctx, w * 0.1, h * 0.62, sw * 1.02, Math.max(4, sh * 0.4), 2, '#e6e1d8');

      // Tasse
      ctx.fillStyle = '#d98a7b';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.38, Math.min(w, h) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Buffet : caisson bas en bois foncé, deux portes à battants avec poignées
   * centrales, et un plateau supérieur légèrement débordant.
   */
  _piece_sideboard(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      const body = '#7d5f42';
      const door = '#8e6d4c';

      this._fillRound(ctx, 0, 0, w, h, 3, body);

      // Plateau : bandeau clair sur le bord côté pièce
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(2, 2, w - 4, Math.min(5, h * 0.16));

      // Portes : deux par tranche d'environ 40 px
      const n = Math.max(2, Math.round(w / 42));
      const pad = 3;
      const dw = (w - pad * (n + 1)) / n;
      const dy = Math.min(7, h * 0.24);
      const dh = h - dy - pad;

      for (let i = 0; i < n; i++) {
        const dx = pad + i * (dw + pad);
        this._fillRound(ctx, dx, dy, dw, dh, 2, door);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.2;
        this._roundRect(ctx, dx, dy, dw, dh, 2);
        ctx.stroke();

        // Poignée verticale, vers le milieu du meuble
        ctx.fillStyle = '#e0c07a';
        const hw = Math.max(2, dw * 0.09);
        const hx = (i < n / 2) ? dx + dw - hw * 2.2 : dx + hw * 1.2;
        ctx.fillRect(hx, dy + dh * 0.4, hw, Math.max(3, dh * 0.24));
      }
    });
  }

  /**
   * Commode : caisson avec des tiroirs pleine largeur empilés, chacun muni
   * d'une poignée horizontale. Se distingue du buffet par ce sens de découpe.
   */
  _piece_dresser(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      const body = '#9b7b5b';
      const drawer = '#ab8b69';

      this._fillRound(ctx, 0, 0, w, h, 3, body);

      // Tiroirs empilés dans la profondeur du meuble
      const n = Math.max(2, Math.min(4, Math.round(h / 16)));
      const pad = 2.5;
      const dh = (h - pad * (n + 1)) / n;

      for (let i = 0; i < n; i++) {
        const dy = pad + i * (dh + pad);
        this._fillRound(ctx, pad, dy, w - pad * 2, dh, 2, drawer);
        ctx.strokeStyle = 'rgba(0,0,0,0.26)';
        ctx.lineWidth = 1.2;
        this._roundRect(ctx, pad, dy, w - pad * 2, dh, 2);
        ctx.stroke();

        // Poignée horizontale, centrée
        ctx.fillStyle = '#e0c07a';
        const hw = Math.max(6, w * 0.3);
        ctx.fillRect((w - hw) / 2, dy + dh * 0.42, hw, Math.max(2, dh * 0.18));
      }
    });
  }

  /**
   * Arbre à chat : plateformes rondes de tailles différentes reliées par un
   * poteau, plus un panier au sommet. Vu de dessus on voit surtout les
   * plateaux qui se chevauchent, et le tronc entre eux.
   */
  _piece_cattree(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      const post = '#b09a84';
      const carpet = '#8d9f8a';
      const carpetDark = '#76886f';

      // Socle
      this._fillRound(ctx, 0, h * 0.62, w, h * 0.38, Math.min(w, h) * 0.14, carpetDark);

      // Poteau, du socle vers la plateforme haute
      ctx.strokeStyle = post;
      ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.18);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.72);
      ctx.lineTo(w * 0.5, h * 0.34);
      ctx.stroke();

      // Corde enroulée : quelques traits sur le poteau
      ctx.strokeStyle = 'rgba(120,100,80,0.45)';
      ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.035);
      for (let i = 0; i < 4; i++) {
        const py = h * (0.4 + i * 0.08);
        ctx.beginPath();
        ctx.moveTo(w * 0.42, py);
        ctx.lineTo(w * 0.58, py);
        ctx.stroke();
      }

      // Plateforme intermédiaire, décalée
      ctx.fillStyle = carpet;
      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.52, w * 0.24, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Panier au sommet, vu de dessus : anneau plus creux
      ctx.fillStyle = carpet;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.26, w * 0.36, h * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = carpetDark;
      ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.06);
      ctx.stroke();

      // Coussin dans le panier
      ctx.fillStyle = '#e4d6c3';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.26, w * 0.22, h * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Plan de travail nu : le plateau et son chant, sans évier ni plaques.
   * Utile pour prolonger une cuisine sans répéter les équipements.
   */
  _piece_worktop(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      this._fillRound(ctx, 0, 0, w, h, 3, '#cfc9bd');

      // Chant plus sombre du côté de la pièce
      ctx.fillStyle = '#b3aca2';
      ctx.fillRect(0, h - Math.min(5, h * 0.22), w, Math.min(5, h * 0.22));

      // Léger veinage, pour ne pas laisser un aplat gris
      ctx.strokeStyle = 'rgba(150,142,130,0.35)';
      ctx.lineWidth = 1;
      const step = Math.max(10, w / 6);
      for (let gx = step; gx < w - 2; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 2);
        ctx.lineTo(gx, h - Math.min(5, h * 0.22));
        ctx.stroke();
      }
    });
  }

  /**
   * Tableau électrique : coffret contre le mur, avec sa rangée de
   * disjoncteurs. Les manettes basculent quand le courant est rétabli.
   */
  _piece_breaker(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      // Coffret
      this._fillRound(ctx, 0, 0, w, h, 3, '#d7d2c6');
      ctx.strokeStyle = '#9a948a';
      ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.06);
      this._roundRect(ctx, 0.8, 0.8, w - 1.6, h - 1.6, 3);
      ctx.stroke();

      // Rail des disjoncteurs
      const rail = h * 0.42;
      ctx.fillStyle = '#3f454a';
      ctx.fillRect(w * 0.12, rail - h * 0.06, w * 0.76, h * 0.12);

      // Manettes : relevées quand le courant est là, baissées sinon
      const n = Math.max(3, Math.round(w / 9));
      const bw = (w * 0.76) / n;
      for (let i = 0; i < n; i++) {
        const bx = w * 0.12 + i * bw;
        ctx.fillStyle = this.blackout ? '#c0392b' : '#7cc27c';
        ctx.fillRect(bx + bw * 0.18, this.blackout ? rail : rail - h * 0.26,
                     bw * 0.64, h * 0.26);
      }

      // Voyant
      ctx.fillStyle = this.blackout ? '#5a2a24' : '#eaf7a0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.82, Math.max(1.2, Math.min(w, h) * 0.07), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Meuble bas : caisson avec tiroirs répartis sur la longueur. */
  _piece_shelf(ctx, { x, y, w, h }) {
    this._fillRound(ctx, x, y, w, h, 3, '#a58463');
    const horizontal = w >= h;
    const n = Math.max(2, Math.round((horizontal ? w : h) / 34));
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;

    for (let i = 1; i < n; i++) {
      ctx.beginPath();
      if (horizontal) {
        const px = x + (w / n) * i;
        ctx.moveTo(px, y + 3);
        ctx.lineTo(px, y + h - 3);
      } else {
        const py = y + (h / n) * i;
        ctx.moveTo(x + 3, py);
        ctx.lineTo(x + w - 3, py);
      }
      ctx.stroke();
    }

    // Poignées
    ctx.fillStyle = '#e0c07a';
    for (let i = 0; i < n; i++) {
      if (horizontal) {
        const cx = x + (w / n) * (i + 0.5);
        ctx.fillRect(cx - w / n * 0.16, y + h * 0.46, w / n * 0.32, Math.max(2, h * 0.08));
      } else {
        const cy = y + (h / n) * (i + 0.5);
        ctx.fillRect(x + w * 0.46, cy - h / n * 0.16, Math.max(2, w * 0.08), h / n * 0.32);
      }
    }
  }

  /** Meuble TV : caisson au mur, écran tourné vers la pièce. */
  _piece_tv(ctx, rect, facing) {
    this._oriented(ctx, rect, facing, ({ w, h }) => {
      // Caisson
      this._fillRound(ctx, 0, 0, w, h, 3, '#4b5157');

      // Écran, occupant la longueur, décalé vers la pièce
      const sw = w * 0.78;
      const sh = Math.max(5, h * 0.42);
      this._fillRound(ctx, (w - sw) / 2, h * 0.46, sw, sh, 2, '#22282d');
      this._fillRound(ctx, (w - sw) / 2 + 2, h * 0.46 + 2, sw - 4, sh - 4, 1.5, '#5f8497');

      // Reflet
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect((w - sw) / 2 + 3, h * 0.46 + 3, sw * 0.35, sh * 0.3);
    });
  }

  /** Carton : rabats croisés sur le dessus. */
  _piece_box(ctx, { x, y, w, h }) {
    const m = Math.min(w, h) * 0.07;
    this._fillRound(ctx, x + m, y + m, w - m * 2, h - m * 2, 2, '#c49a68');
    ctx.strokeStyle = 'rgba(120,88,52,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + m, y + h / 2);
    ctx.lineTo(x + w - m, y + h / 2);
    ctx.moveTo(x + w / 2, y + m);
    ctx.lineTo(x + w / 2, y + h - m);
    ctx.stroke();
  }

  /** Plante : pot et feuillage débordant, plusieurs lobes. */
  _piece_plant(ctx, { x, y, w, h }) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = Math.min(w, h);

    ctx.fillStyle = '#b5714f';
    this._roundRect(ctx, cx - rad * 0.22, cy + rad * 0.08, rad * 0.44, rad * 0.34, 3);
    ctx.fill();

    ctx.fillStyle = '#3f8256';
    [[0, -0.16, 0.3], [-0.22, -0.02, 0.2], [0.22, -0.02, 0.2], [0, -0.34, 0.17]]
      .forEach(([ox, oy, r]) => {
        ctx.beginPath();
        ctx.arc(cx + rad * ox, cy + rad * oy, rad * r, 0, Math.PI * 2);
        ctx.fill();
      });

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(cx - rad * 0.1, cy - rad * 0.24, rad * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Plan figé + objets animés par-dessus. */
  draw(ctx, camera, time) {
    if (!this.staticLayer) this.prerender();

    /*
     * La zone source est bornée au plan : quand la vue est plus grande que
     * l'appartement (grand écran) ou que la caméra frôle un bord, demander
     * des pixels hors de la couche ferait échouer le tracé. On dessine donc
     * l'intersection, à sa place exacte dans la vue.
     */
    const sx = Math.max(0, camera.x);
    const sy = Math.max(0, camera.y);
    const sw = Math.min(this.width - sx, camera.w - (sx - camera.x));
    const sh = Math.min(this.height - sy, camera.h - (sy - camera.y));

    if (sw > 0 && sh > 0) {
      ctx.drawImage(
        this.staticLayer,
        sx, sy, sw, sh,
        sx - camera.x, sy - camera.y, sw, sh
      );
    }

    // Objets à ramasser, uniquement dans les pièces déjà visitées.
    Object.values(this.things).forEach((thing, i) => {
      if (!thing.active || thing.taken) return;
      if (!this.isRoomVisible(this.roomAt(thing.x, thing.y))) return;

      const sx = thing.x - camera.x;
      const sy = thing.y - camera.y;
      if (sx < -40 || sy < -40 || sx > camera.w + 40 || sy > camera.h + 40) return;

      const bob = Math.sin(time / 380 + i) * 3;
      const pulse = 0.55 + 0.45 * Math.sin(time / 260 + i);

      const glow = ctx.createRadialGradient(sx, sy + bob, 2, sx, sy + bob, 26);
      glow.addColorStop(0, `rgba(255, 226, 150, ${0.5 * pulse + 0.22})`);
      glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 26, 0, Math.PI * 2);
      ctx.fill();

      /*
       * Retour à une couleur opaque avant d'écrire l'emoji : sans ça, le
       * dégradé du halo restait le `fillStyle` courant, et comme son bord
       * est transparent, l'emoji était peint en dégradé et paraissait
       * délavé — d'autant plus visible sur mobile, où la case est réduite.
       */
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.font = emojiFont(this.tileSize * 0.8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(thing.icon, sx, sy + bob);
    });

    // Tsuki, seulement s'il n'est pas dans les bras d'un joueur.
    if (this.cat && !this.cat.carried &&
        this.isRoomVisible(this.roomAt(this.cat.x, this.cat.y))) {
      this._drawCat(ctx, this.cat.x - camera.x, this.cat.y - camera.y, time, false);
    }
  }

  /**
   * Tsuki vu de dessus : corps, oreilles, queue qui bat, et des z' quand il
   * dort dans son panier.
   * @param {boolean} carried change la posture quand il est porté
   */
  _drawCat(ctx, sx, sy, time, carried) {
    const ts = this.tileSize;
    const s = ts * (carried ? 0.6 : 0.78);
    const fur = (CONFIG.cat && CONFIG.cat.fur) || '#4f4a46';
    const belly = (CONFIG.cat && CONFIG.cat.belly) || '#e8e2d8';
    const sleeping = this.cat && this.cat.atHome;

    ctx.save();
    ctx.translate(sx, sy);

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.5, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Queue, qui balance doucement
    const wag = Math.sin(time / (sleeping ? 900 : 320)) * (sleeping ? 0.15 : 0.5);
    ctx.strokeStyle = fur;
    ctx.lineWidth = Math.max(2, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, s * 0.1);
    ctx.quadraticCurveTo(
      -s * 0.85, s * 0.1 + wag * s * 0.5,
      -s * 0.7, -s * 0.32 + wag * s * 0.4
    );
    ctx.stroke();

    // Corps
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.06, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ventre clair
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(s * 0.06, s * 0.14, s * 0.24, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tête
    const hx = s * 0.3;
    const hy = -s * 0.16;
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.29, 0, Math.PI * 2);
    ctx.fill();

    // Oreilles
    [[-0.2, -0.24], [0.2, -0.24]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.moveTo(hx + s * ox - s * 0.1, hy + s * oy + s * 0.08);
      ctx.lineTo(hx + s * ox, hy + s * oy - s * 0.16);
      ctx.lineTo(hx + s * ox + s * 0.1, hy + s * oy + s * 0.08);
      ctx.closePath();
      ctx.fill();
    });

    // Yeux : fermés s'il dort, sinon ouverts et verts
    if (sleeping) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1, s * 0.05);
      [-0.11, 0.11].forEach((o) => {
        ctx.beginPath();
        ctx.arc(hx + s * o, hy, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = '#b9e08a';
      [-0.11, 0.11].forEach((o) => {
        ctx.beginPath();
        ctx.ellipse(hx + s * o, hy - s * 0.02, s * 0.065, s * 0.085, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#2b2b2b';
      [-0.11, 0.11].forEach((o) => {
        ctx.beginPath();
        ctx.ellipse(hx + s * o, hy - s * 0.02, s * 0.022, s * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Museau
    ctx.fillStyle = '#e0a0a8';
    ctx.beginPath();
    ctx.moveTo(hx, hy + s * 0.1);
    ctx.lineTo(hx - s * 0.045, hy + s * 0.05);
    ctx.lineTo(hx + s * 0.045, hy + s * 0.05);
    ctx.closePath();
    ctx.fill();

    // Moustaches
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(0.8, s * 0.025);
    [-1, 1].forEach((dir) => {
      [-0.03, 0.05].forEach((oy) => {
        ctx.beginPath();
        ctx.moveTo(hx + dir * s * 0.1, hy + s * (0.06 + oy));
        ctx.lineTo(hx + dir * s * 0.34, hy + s * (0.02 + oy * 1.6));
        ctx.stroke();
      });
    });

    // Petits z' quand il dort
    if (sleeping) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `600 ${Math.max(8, s * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      const t = (time / 700) % 3;
      for (let i = 0; i < 3; i++) {
        const p = (t + i) % 3;
        ctx.globalAlpha = 0.8 - p * 0.25;
        ctx.fillText('z', hx + s * 0.3 + p * s * 0.2, hy - s * 0.4 - p * s * 0.3);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Voile sombre sur les pièces jamais visitées, dessiné par-dessus tout.
   * Les murs restent visibles : on garde la lecture du plan, mais on ne voit
   * pas ce qu'il y a dedans.
   */
  /**
   * L'obscurité de la panne : tout est noir sauf un halo autour de chaque
   * joueur, et l'éclair du tableau électrique qui reste visible pour donner
   * la direction.
   *
   * Dessiné en une passe avec `destination-out` : on peint le noir, puis on
   * y perce les halos. Un dégradé donne un bord doux plutôt qu'un disque net.
   *
   * @param {{x:number,y:number}[]} lights positions des joueurs
   */
  drawBlackout(ctx, camera, lights, time) {
    const ts = this.tileSize;
    const radius = ((CONFIG.blackout && CONFIG.blackout.haloRadius) || 3) * ts;

    // Calque d'obscurité, percé aux positions des joueurs.
    const dark = document.createElement('canvas');
    dark.width = Math.max(1, Math.ceil(camera.w));
    dark.height = Math.max(1, Math.ceil(camera.h));
    const dctx = dark.getContext('2d');

    dctx.fillStyle = 'rgba(6, 10, 12, 0.97)';
    dctx.fillRect(0, 0, dark.width, dark.height);

    dctx.globalCompositeOperation = 'destination-out';
    lights.forEach((p) => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const g = dctx.createRadialGradient(sx, sy, radius * 0.25, sx, sy, radius);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(sx, sy, radius, 0, Math.PI * 2);
      dctx.fill();
    });
    dctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(dark, 0, 0);

    // L'éclair du tableau électrique, par-dessus le noir.
    const b = this.breaker;
    if (b) {
      const sx = b.x - camera.x;
      const sy = b.y - camera.y;
      const pulse = 0.6 + 0.4 * Math.sin(time / 260);

      const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, ts * 1.1);
      glow.addColorStop(0, `rgba(255, 226, 120, ${0.5 * pulse + 0.2})`);
      glow.addColorStop(1, 'rgba(255, 226, 120, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, ts * 1.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.font = emojiFont(ts * 0.95);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ICONS.power, sx, sy);
    }
  }

  drawFog(ctx, camera) {
    if (!this.fog) return;
    const ts = this.tileSize;

    (CONFIG.rooms || []).forEach((room) => {
      if (this.discovered.has(room.id)) return;

      const cells = this.zones[room.id];
      if (!cells || !cells.length) return;

      ctx.save();
      ctx.fillStyle = 'rgba(24, 30, 34, 0.94)';

      // Case par case : le voile épouse la forme réelle de la pièce et
      // recouvre tous ses meubles, même ceux qui dépassent du rectangle.
      // Le +1 comble les jointures dues à l'arrondi de la caméra.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      cells.forEach((cell) => {
        const x = cell.col * ts - camera.x;
        const y = cell.row * ts - camera.y;
        ctx.fillRect(x, y, ts + 1, ts + 1);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + ts > maxX) maxX = x + ts;
        if (y + ts > maxY) maxY = y + ts;
      });

      // Le symbole, centré sur la pièce
      const stillLocked = room.locked && !this.locks[room.locked];
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const size = Math.max(12, ts * 0.62);

      if (stillLocked) {
        // Plus grand que le « ? » des autres pièces : c'est le repère qui
        // indique qu'il faudra une clé, il doit se voir de loin.
        this._drawPadlock(ctx, cx, cy, ts * 2.2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.34)';
        ctx.font = `600 ${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
      }
      ctx.restore();
    });
  }

  /**
   * Cadenas dessiné en primitives plutôt qu'en emoji : le rendu d'un emoji
   * dans un canvas dépend des polices du système et ne s'affiche pas
   * partout de la même façon.
   */
  /**
   * Cadenas, dessiné en primitives plutôt qu'en emoji dont le rendu dépend
   * des polices du système.
   *
   * Doré et opaque : il doit rester lisible aussi bien sur la barre brune
   * d'une porte que sur le voile sombre du brouillard. Il était auparavant
   * blanc semi-transparent, ce qui le faisait disparaître sur la porte.
   */
  _drawPadlock(ctx, cx, cy, size) {
    const w = size * 0.6;
    const h = size * 0.46;
    const x = cx - w / 2;
    const y = cy - h * 0.18;

    // Pastille sombre derrière : détache le cadenas de la barre de la porte
    // comme du voile du brouillard, quel que soit le fond.
    ctx.fillStyle = 'rgba(40,28,16,0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
    ctx.fill();

    // Anse
    ctx.strokeStyle = '#f5dc94';
    ctx.lineWidth = Math.max(1.6, size * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, y, w * 0.34, Math.PI, 0);
    ctx.stroke();

    // Corps
    ctx.fillStyle = '#f5dc94';
    this._roundRect(ctx, x, y, w, h, size * 0.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,15,0.8)';
    ctx.lineWidth = Math.max(1, size * 0.04);
    this._roundRect(ctx, x, y, w, h, size * 0.1);
    ctx.stroke();

    // Trou de serrure
    ctx.fillStyle = '#5c3d14';
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.44, Math.max(1.2, size * 0.075), 0, Math.PI * 2);
    ctx.fill();
  }
}
