/**
 * Boucle de jeu et enchaînement des quêtes.
 *
 * La progression est une chaîne d'étapes, dans l'ordre défini par
 * CONFIG.quest.steps :
 *
 *   find-key      trouver la clé dans le salon
 *   open-bedroom  ouvrir notre chambre avec cette clé
 *   take-fish     récupérer le poisson à l'intérieur
 *   feed-tsuki    apporter le poisson à Tsuki, en cuisine
 *   bring-tsuki   porter Tsuki jusqu'à sa chambre
 *   take-key2     ramasser la clé que Tsuki laisse tomber
 *   open-nursery  ouvrir la dernière porte : annonce
 */
const Game = {
  canvas: null,
  ctx: null,
  world: null,
  players: [],
  stepIndex: 0,
  carrying: null,
  revealed: false,
  /**
   * Horodatage de l'entrée dans la chambre, pour le déclenchement différé.
   * `null` tant qu'on n'y est pas entré.
   */
  _nurserySince: null,
  camera: { x: 0, y: 0, w: 0, h: 0 },
  _raf: 0,

  boot() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    Input.init(this.canvas, document.getElementById('touchpad'));
    UI.init({
      onStart: (setup) => this.start(setup),
      onReplay: () => this.reset()
    });

    // Rotation de l'écran, redimensionnement de la fenêtre, apparition de la
    // barre d'adresse mobile : on recadre à chaque fois.
    let pending = 0;
    const refit = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => this._fitCanvas());
    };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
  },

  get steps() {
    return CONFIG.quest.steps;
  },

  get step() {
    return this.steps[this.stepIndex] || null;
  },

  start(setup) {
    this.world = new World();

    // Le plan tient en entier dans le cadre : pas de défilement.
    this.camera = { x: 0, y: 0, w: this.world.width, h: this.world.height };

    const colors = ['#d98a7b', '#6fa8c8'];
    const ts = this.world.tileSize;
    this.players = setup.players.map((p, i) => {
      const spawn = this.world.spawns[Math.min(i, this.world.spawns.length - 1)];
      return new Player({
        name: p.name,
        avatar: p.avatar,
        color: colors[i % colors.length],
        x: (spawn.col + 0.5) * ts,
        y: (spawn.row + 0.5) * ts
      });
    });

    this.stepIndex = 0;
    this.carrying = null;
    this.revealed = false;
    this._nurserySince = null;

    // Le couloir de départ compte comme déjà découvert.
    this.players.forEach((p) => this.world.discoverAt(p.x, p.y));

    UI.showGame();
    UI.updateRooms(this.world.discovered.size, this.world.roomsTotal);
    this._syncObjective();

    // Le cadrage vient APRÈS l'affichage et le remplissage du HUD : il faut
    // que la mise en page soit calculée pour mesurer la place restante.
    this._fitCanvas();
    requestAnimationFrame(() => this._fitCanvas());

    cancelAnimationFrame(this._raf);
    this._loop(performance.now());
  },

  /**
   * Adapte le canvas à la place disponible, et décide s'il faut afficher tout
   * le plan ou seulement les environs du joueur.
   *
   * Le plan fait 1184x992, presque carré. Sur un écran étroit c'est la
   * largeur qui contraint, pas la hauteur : tout afficher donnerait des cases
   * de 10 pixels, illisibles. Quand la place manque, on garde donc une taille
   * de case confortable (`world.minTileSize`) et la caméra suit le joueur.
   * Sur grand écran, tout le plan reste visible d'un coup comme avant.
   *
   * Le contexte porte la mise à l'échelle, donc le code de rendu continue de
   * travailler en coordonnées du plan.
   */
  _fitCanvas() {
    if (!this.world) return;

    const stage = document.getElementById('stage');
    const rect = stage ? stage.getBoundingClientRect() : null;
    const availW = (rect && rect.width) ? rect.width : window.innerWidth;
    const availH = (rect && rect.height) ? rect.height : this._availableHeight();

    // Échelle nécessaire pour montrer tout le plan.
    const fullScale = Math.min(availW / this.world.width, availH / this.world.height);

    // Échelle minimale pour que les cases restent lisibles.
    const minTile = CONFIG.world.minTileSize || 22;
    const minScale = minTile / this.world.tileSize;

    // Si tout afficher rendrait les cases trop petites, on zoome et on suit
    // le joueur. Sinon on montre le plan entier.
    const scale = Math.max(fullScale, Math.min(minScale, 1));
    this.followCamera = scale > fullScale + 0.0001;

    // La vue ne dépasse jamais le plan : sinon on verrait des bandes vides
    // sur les écrans larges, la carte ne remplissant pas le cadre.
    const viewW = this.followCamera
      ? Math.min(Math.floor(availW), Math.floor(this.world.width * scale))
      : Math.floor(this.world.width * scale);
    const viewH = this.followCamera
      ? Math.min(Math.floor(availH), Math.floor(this.world.height * scale))
      : Math.floor(this.world.height * scale);

    // Résolution de dessin, limitée à 2x pour ménager les mobiles.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.style.width = viewW + 'px';
    this.canvas.style.height = viewH + 'px';
    this.canvas.width = Math.round(viewW * dpr);
    this.canvas.height = Math.round(viewH * dpr);

    this._scale = scale;
    this._viewScale = scale * dpr;
    this._dpr = dpr;

    // Taille de la fenêtre de vue, en unités du plan.
    this.camera.w = viewW / scale;
    this.camera.h = viewH / scale;

    this._updateCamera(true);
  },

  /**
   * Recentre la vue sur les joueurs, sans jamais sortir du plan.
   * @param {boolean} [immediate] sans lissage (au démarrage, au recadrage)
   */
  _updateCamera(immediate) {
    if (!this.world) return;

    // Vue plus grande que le plan : on centre et on n'y touche plus.
    if (!this.followCamera) {
      this.camera.x = (this.world.width - this.camera.w) / 2;
      this.camera.y = (this.world.height - this.camera.h) / 2;
      return;
    }
    if (!this.players.length) return;

    const avgX = this.players.reduce((s, p) => s + p.x, 0) / this.players.length;
    const avgY = this.players.reduce((s, p) => s + p.y, 0) / this.players.length;

    const maxX = Math.max(0, this.world.width - this.camera.w);
    const maxY = Math.max(0, this.world.height - this.camera.h);
    const targetX = Math.max(0, Math.min(maxX, avgX - this.camera.w / 2));
    const targetY = Math.max(0, Math.min(maxY, avgY - this.camera.h / 2));

    if (immediate) {
      this.camera.x = targetX;
      this.camera.y = targetY;
      return;
    }

    // Lissage : la caméra rattrape le joueur sans à-coups.
    this.camera.x += (targetX - this.camera.x) * 0.14;
    this.camera.y += (targetY - this.camera.y) * 0.14;
  },

  /** Hauteur disponible pour le plan, une fois le HUD et le pavé retirés. */
  _availableHeight() {
    const h = window.innerHeight;
    const used = ['hud', 'touchpad', 'hint'].reduce((sum, id) => {
      const el = document.getElementById(id);
      if (!el || el.offsetParent === null) return sum;
      const r = el.getBoundingClientRect();
      return sum + r.height;
    }, 0);
    // 28px de marges cumulées (padding du body + espacements)
    return Math.max(200, h - used - 28);
  },

  reset() {
    cancelAnimationFrame(this._raf);
    UI.stopConfetti();
    UI.showMenu();
  },

  /** Met le HUD et l'indice à jour selon l'étape courante. */
  _syncObjective() {
    const step = this.step;
    // Les libelles viennent de i18n, reperes par l'id de l'etape.
    UI.setObjective(step ? Lang.t('steps.' + step.id + '.objective') : '',
                    this.stepIndex, this.steps.length);
    UI.setHint(step ? Lang.t('steps.' + step.id + '.hint') : '');
    UI.setCarrying(this.carrying);
  },

  /**
   * Passe à l'étape suivante, en affichant la carte de l'étape franchie.
   * @param {Function} [after] exécuté à la fermeture de la carte
   */
  _completeStep(after) {
    const step = this.step;
    this.stepIndex += 1;

    const done = () => {
      if (after) after();
      this._syncObjective();
    };

    // Une etape n'ouvre une carte que si elle a une icone.
    if (step && step.icon) {
      UI.showCard({
        icon: step.icon,
        title: Lang.t('steps.' + step.id + '.title'),
        text: Lang.t('steps.' + step.id + '.text')
      }, done);
    }
    else done();
  },

  _loop(time) {
    this._update();
    this._draw(time);
    this._raf = requestAnimationFrame((t) => this._loop(t));
  },

  _update() {
    if (UI.isModalOpen) return;

    this.players.forEach((player, i) => {
      player.move(Input.direction(i), this.world);

      const discovered = this.world.discoverAt(player.x, player.y);
      if (discovered) {
        UI.flashRoom(
          this.world.displayName(discovered),
          this.world.discovered.size,
          this.world.roomsTotal
        );
      }
    });

    // Tsuki suit le porteur.
    if (this.carrying === 'cat') {
      const holder = this.players[0];
      this.world.cat.x = holder.x;
      this.world.cat.y = holder.y - this.world.tileSize * 0.42;
    }

    this._checkStep();
    this._checkHungryCat();
    this._checkDoors();
    this._checkNurseryEntry();
    this._updateCamera();
  },

  /**
   * Tsuki croisé les mains vides : il fait comprendre qu'il a faim.
   * Purement indicatif, ça ne fait pas avancer la quête, mais ça met le
   * joueur sur la piste du poisson.
   */
  _checkHungryCat() {
    const cat = this.world.cat;
    if (!cat || cat.fed || cat.carried) return;
    if (this.carrying === 'fish') return; // il va être servi

    const near = this.players.some((p) =>
      this.world.isNearCat(p.x, p.y, CONFIG.player.pickupRange + 10));

    if (near) UI.flashHungry(Lang.t('cat.hungryHint'));
  },

  /** Chaque étape a sa propre condition de réussite. */
  _checkStep() {
    const step = this.step;
    if (!step) return;

    const range = CONFIG.player.pickupRange;

    switch (step.id) {
      case 'power-on':
        for (const p of this.players) {
          if (this.world.isNearBreaker(p.x, p.y, range + 8)) {
            this.world.restorePower();
            this._completeStep();
            return;
          }
        }
        break;

      case 'find-key':
        for (const p of this.players) {
          const key = this.world.thingNear(p.x, p.y, range, 'key1');
          if (key) {
            key.taken = true;
            this.carrying = 'key1';
            UI.flashPickup(Lang.t('steps.' + step.id + '.toast'));
            this._completeStep();
            return;
          }
        }
        break;

      case 'take-fish':
        for (const p of this.players) {
          const fish = this.world.thingNear(p.x, p.y, range, 'fish');
          if (fish) {
            fish.taken = true;
            this.carrying = 'fish';
            UI.flashPickup(Lang.t('steps.' + step.id + '.toast'));

            // Tsuki a entendu le papier : il file se cacher.
            const moved = this.world.moveCatToHideout();
            this._completeStep(() => {
              if (moved) {
                UI.showCard({
                  icon: CONFIG.cat.movedIcon,
                  title: Lang.t('cat.movedTitle'),
                  text: Lang.t('cat.movedText')
                }, () => this._syncObjective());
              }
            });
            return;
          }
        }
        break;

      case 'feed-tsuki':
        for (const p of this.players) {
          if (this.world.isNearCat(p.x, p.y, range + 6)) {
            this.world.cat.fed = true;
            this.world.cat.carried = true;
            this.carrying = 'cat';
            this._completeStep();
            return;
          }
        }
        break;

      case 'bring-tsuki':
        for (const p of this.players) {
          if (this.world.isInTsukiRoom(p.x, p.y)) {
            this.world.cat.carried = false;
            this.world.cat.atHome = true;

            // Il s'installe sur son fauteuil, ou là où on le pose s'il n'y
            // en a pas dans la pièce.
            if (!this.world.putCatOnChair()) {
              this.world.cat.x = p.x;
              this.world.cat.y = p.y;
            }

            this.carrying = null;
            this.world.dropSecondKey();
            this._completeStep();
            return;
          }
        }
        break;

      case 'take-key2':
        for (const p of this.players) {
          const key = this.world.thingNear(p.x, p.y, range, 'key2');
          if (key) {
            key.taken = true;
            this.carrying = 'key2';
            UI.flashPickup(Lang.t('steps.' + step.id + '.toast'));
            this._completeStep();
            return;
          }
        }
        break;

      default:
        break;
    }
  },

  /**
   * Les portes. Avec la bonne clé, arriver au contact suffit à ouvrir ;
   * sans elle, on se cogne et un message s'affiche.
   */
  _checkDoors() {
    const step = this.step;

    for (const p of this.players) {
      const blocked = this.world.blockingDoor(p.x, p.y, CONFIG.player.radius + 4);

      // Ouverture de notre chambre.
      if (step && step.id === 'open-bedroom' &&
          this.world.isAtDoor(p.x, p.y, 'bedroom') && this.carrying === 'key1') {
        this.carrying = null;
        this.world.unlock('bedroom');
        this.world.revealFish();
        this._completeStep();
        return;
      }

      // Ouverture de la dernière porte : pas de message ici, les joueurs
      // entrent librement. L'annonce attend le landau, ou le délai.
      if (step && step.id === 'open-nursery' &&
          this.world.isAtDoor(p.x, p.y, 'nursery') && this.carrying === 'key2') {
        this.carrying = null;
        this.world.unlock('nursery');
        this._completeStep();
        return;
      }

      // Porte fermée, pas la bonne clé : message d'échec.
      if (blocked) {
        const msg = this._lockedMessage(blocked);
        if (msg) {
          UI.setHint(msg);
          UI.flashLocked(msg);
        }
      }
    }
  },

  /** Le message affiché quand on bute sur une porte fermée. */
  _lockedMessage(lock) {
    const stepId = lock === 'bedroom' ? 'open-bedroom' : 'open-nursery';
    const step = this.steps.find((s) => s.id === stepId);
    return step ? Lang.t('steps.' + step.id + '.locked') : null;
  },

  /**
   * L'annonce, une fois dans la chambre. Deux déclencheurs :
   *
   *   1. s'approcher du bébé, au centre de la pièce : immédiat ;
   *   2. un délai décompté depuis l'ENTRÉE dans la pièce
   *      (`reveal.autoDelay`) : filet de sécurité, au cas où l'on ne
   *      s'approcherait pas du centre.
   *
   * Le chronomètre repart de zéro si l'on ressort de la pièce.
   */
  _checkNurseryEntry() {
    const step = this.step;
    if (!step || step.id !== 'reach-pram') return;
    if (this.revealed) return;

    const inside = this.players.some((p) => this.world.isInNursery(p.x, p.y));
    if (!inside) {
      this._nurserySince = null;
      return;
    }

    // 1. Proximité du bébé
    if (this.players.some((p) => this.world.isNearPram(p.x, p.y))) {
      this._reveal();
      return;
    }

    // 2. Délai depuis l'entrée dans la pièce.
    const delay = CONFIG.reveal.autoDelay;
    if (!delay) return;

    // `null` et non 0 comme valeur « pas encore entré » : un horodatage peut
    // légitimement valoir 0, ce qui décalerait le départ du décompte.
    const now = performance.now();
    if (this._nurserySince === null) {
      this._nurserySince = now;
      return;
    }
    if (now - this._nurserySince >= delay) this._reveal();
  },

  /** Bascule sur l'annonce finale. */
  _reveal() {
    this.revealed = true;
    this.stepIndex += 1;
    UI.setObjective('', this.steps.length, this.steps.length);
    UI.setHint('');
    UI.setCarrying(null);
    UI.showFinal();
  },

  _draw(time) {
    const ctx = this.ctx;

    // Repère : mise à l'échelle, puis translation selon la caméra. Tout le
    // rendu reste ainsi exprimé en coordonnées du plan.
    const k = this._viewScale || 1;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, this.camera.w + 2, this.camera.h + 2);

    const cam = {
      x: Math.round(this.camera.x * k) / k,
      y: Math.round(this.camera.y * k) / k,
      w: this.camera.w,
      h: this.camera.h
    };

    this.world.draw(ctx, cam, time);

    [...this.players]
      .sort((a, b) => a.y - b.y)
      .forEach((p) => p.draw(ctx, cam, this.carrying));

    // Tsuki porté : dessiné au-dessus du joueur.
    if (this.carrying === 'cat') {
      this.world._drawCat(
        ctx,
        this.world.cat.x - cam.x,
        this.world.cat.y - cam.y,
        time,
        true
      );
    }

    /*
     * Pendant la panne, l'obscurité remplace le brouillard : tout est noir
     * sauf le halo autour des joueurs. Ensuite le brouillard reprend son rôle.
     * Dans les deux cas c'est dessiné après les joueurs, pour qu'on ne les
     * voie pas à travers un mur.
     */
    if (this.world.blackout) {
      this.world.drawBlackout(ctx, cam, this.players, time);
    } else {
      this.world.drawFog(ctx, cam);
    }

    Input.drawTouchStick(ctx, this.canvas, this._viewScale);
  }
};

document.addEventListener('DOMContentLoaded', () => Game.boot());
