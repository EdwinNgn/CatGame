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
        const room = (CONFIG.rooms || []).find((x2) => x2.name === name);
        if (!room) return;
        cells.forEach((cell) => this._zoneIndex.set(cell.row * this.cols + cell.col, room));
      });
    }

    return this._zoneIndex.get(r * this.cols + c) || null;
  }

  /** Marque comme visitée la pièce où se trouve le joueur. */
  discoverAt(x, y) {
    const room = this.roomAt(x, y);
    if (room && !this.discovered.has(room.name)) {
      this.discovered.add(room.name);
      return room;
    }
    return null;
  }

  /** Nom affichable d'une pièce : la chambre reste anonyme jusqu'au bout. */
  displayName(room) {
    if (!room) return '';
    if (room.nursery) {
      return this.nurseryFurnished
        ? (room.revealedName || room.name)
        : (room.hiddenName || 'Une porte fermée');
    }
    return room.name;
  }

  isRoomVisible(room) {
    return !this.fog || !room || this.discovered.has(room.name);
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
      const light = (c + r) % 2 === 0;
      ctx.fillStyle = light ? '#e7eaec' : '#dde2e6';
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeStyle = 'rgba(150,160,170,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
      return;
    }

    // Parquet : lames à joints décalés d'une rangée sur l'autre.
    const shades = ['#dcc09a', '#d7b992', '#e0c6a2', '#d3b48c'];
    ctx.fillStyle = shades[(r * 3 + c) % shades.length];
    ctx.fillRect(x, y, ts, ts);

    ctx.strokeStyle = 'rgba(150,110,70,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + ts, y + 0.5);
    ctx.stroke();

    const offset = (r % 2 === 0) ? 0 : ts / 2;
    ctx.strokeStyle = 'rgba(150,110,70,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + offset + 0.5, y);
    ctx.lineTo(x + offset + 0.5, y + ts);
    ctx.stroke();

    if (tile === TILE.DOOR) {
      // Seuil clair : on voit où l'on passe d'une pièce à l'autre.
      ctx.fillStyle = 'rgba(255,244,222,0.5)';
      ctx.fillRect(x, y, ts, ts);
    }

    if (tile === TILE.LOCKED_BEDROOM || tile === TILE.LOCKED_NURSERY) {
      const open = (tile === TILE.LOCKED_BEDROOM)
        ? this.locks.bedroom
        : this.locks.nursery;

      if (open) {
        // Porte ouverte : simple seuil, un peu plus chaud que les autres.
        ctx.fillStyle = 'rgba(255,236,206,0.6)';
        ctx.fillRect(x, y, ts, ts);
      } else {
        // Panneau de porte fermé, avec cadre, poignée et serrure.
        ctx.fillStyle = '#7d4a34';
        ctx.fillRect(x, y, ts, ts);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
        ctx.fillStyle = '#e8c463';
        ctx.beginPath();
        ctx.arc(x + ts * 0.72, y + ts * 0.5, Math.max(2, ts * 0.07), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + ts * 0.66, y + ts * 0.62, Math.max(2, ts * 0.1), Math.max(3, ts * 0.13));
      }
    }
  }

  /**
   * Mur plein. Le liseré clair n'est tracé que sur les faces exposées à une
   * pièce, ce qui donne du relief au lieu d'un quadrillage uniforme.
   */
  _drawWall(ctx, x, y, ts) {
    ctx.fillStyle = '#575048';
    ctx.fillRect(x, y, ts, ts);

    const c = Math.round(x / ts);
    const r = Math.round(y / ts);
    const isWall = (cc, rr) => {
      if (!this.tiles[rr] || this.tiles[rr][cc] === undefined) return true;
      const t = this.tiles[rr][cc];
      return t === TILE.WALL || t === TILE.OUTSIDE;
    };

    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    if (!isWall(c, r - 1)) ctx.fillRect(x, y, ts, 2.5);
    if (!isWall(c - 1, r)) ctx.fillRect(x, y, 2.5, ts);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    if (!isWall(c, r + 1)) ctx.fillRect(x, y + ts - 2.5, ts, 2.5);
    if (!isWall(c + 1, r)) ctx.fillRect(x + ts - 2.5, y, 2.5, ts);
  }

  _drawRoomLabels(ctx) {
    const ts = this.tileSize;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(9, ts * 0.36)}px sans-serif`;
    ctx.fillStyle = 'rgba(70,58,45,0.42)';

    (CONFIG.rooms || []).forEach((room) => {
      if (!room.label) return;
      // La chambre du bébé n'est nommée qu'une fois la porte ouverte :
      // avant ça, aucun nom ne doit trahir la surprise.
      if (room.nursery && !this.nurseryFurnished) return;
      ctx.fillText(
        (room.nursery ? room.revealedName || room.name : room.name).toUpperCase(),
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

    this._drawPram(ctx, cx, cy - ts * 0.2, ts * 2.6);

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

  /** Landau vu de dessus, avec le bébé endormi à l'intérieur. */
  _drawPram(ctx, cx, cy, size) {
    const w = size;
    const h = size * 0.72;
    const x = cx - w / 2;
    const y = cy - h / 2;

    // Ombre
    ctx.fillStyle = 'rgba(60,45,30,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.96, w * 0.42, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Roues
    ctx.fillStyle = '#3c4349';
    [[0.16, 0.1], [0.84, 0.1], [0.16, 0.9], [0.84, 0.9]].forEach(([fx, fy]) => {
      ctx.beginPath();
      ctx.arc(x + w * fx, y + h * fy, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });

    // Nacelle
    this._fillRound(ctx, x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, size * 0.2, '#e8eef2');
    ctx.strokeStyle = '#b9c8d2';
    ctx.lineWidth = 2;
    this._roundRect(ctx, x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, size * 0.2);
    ctx.stroke();

    // Capote relevée, côté tête
    ctx.fillStyle = '#9fc3d6';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.5);
    ctx.arc(x + w * 0.3, y + h * 0.5, w * 0.22, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Couverture
    this._fillRound(ctx, x + w * 0.42, y + h * 0.24, w * 0.46, h * 0.52, size * 0.12, '#f7ccd6');
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.36);
    ctx.lineTo(x + w * 0.85, y + h * 0.36);
    ctx.stroke();

    // Le bébé : tête, deux yeux fermés et une joue
    const bx = x + w * 0.33;
    const by = y + h * 0.5;
    const br = size * 0.13;
    ctx.fillStyle = '#f6d9c0';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,65,45,0.75)';
    ctx.lineWidth = Math.max(1, size * 0.022);
    [-0.42, 0.42].forEach((o) => {
      ctx.beginPath();
      ctx.arc(bx + br * o, by - br * 0.12, br * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(226,138,131,0.5)';
    [-0.6, 0.6].forEach((o) => {
      ctx.beginPath();
      ctx.arc(bx + br * o, by + br * 0.34, br * 0.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Mèche de cheveux
    ctx.strokeStyle = '#8a6a4d';
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.arc(bx, by - br * 0.85, br * 0.3, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
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

      // Une cuve par tranche d'environ 30 px de longueur
      const n = Math.max(1, Math.round(w / 34));
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
  drawFog(ctx, camera) {
    if (!this.fog) return;
    const ts = this.tileSize;

    (CONFIG.rooms || []).forEach((room) => {
      if (this.discovered.has(room.name)) return;

      const cells = this.zones[room.name];
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
        this._drawPadlock(ctx, cx, cy, size);
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
  _drawPadlock(ctx, cx, cy, size) {
    const w = size * 0.72;
    const h = size * 0.56;
    const x = cx - w / 2;
    const y = cy - h * 0.28;

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = Math.max(1.6, size * 0.1);
    ctx.beginPath();
    ctx.arc(cx, y, w * 0.3, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this._roundRect(ctx, x, y, w, h, size * 0.12);
    ctx.fill();

    ctx.fillStyle = 'rgba(24,30,34,0.9)';
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.48, size * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
}
