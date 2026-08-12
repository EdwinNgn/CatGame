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
  camera: { x: 0, y: 0, w: 0, h: 0 },
  _raf: 0,

  boot() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    Input.init(this.canvas);
    UI.init({
      onStart: (setup) => this.start(setup),
      onReplay: () => this.reset()
    });
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
    this.canvas.width = this.world.width;
    this.canvas.height = this.world.height;
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

    // Le couloir de départ compte comme déjà découvert.
    this.players.forEach((p) => this.world.discoverAt(p.x, p.y));

    UI.showGame();
    UI.updateRooms(this.world.discovered.size, this.world.roomsTotal);
    this._syncObjective();

    cancelAnimationFrame(this._raf);
    this._loop(performance.now());
  },

  reset() {
    cancelAnimationFrame(this._raf);
    UI.stopConfetti();
    UI.showMenu();
  },

  /** Met le HUD et l'indice à jour selon l'étape courante. */
  _syncObjective() {
    const step = this.step;
    UI.setObjective(step ? step.objective : '', this.stepIndex, this.steps.length);
    UI.setHint(step ? step.hint : '');
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

    if (step && step.card) UI.showCard(step.card, done);
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
    if (!CONFIG.cat.hungryHint) return;

    const near = this.players.some((p) =>
      this.world.isNearCat(p.x, p.y, CONFIG.player.pickupRange + 10));

    if (near) UI.flashHungry(CONFIG.cat.hungryHint);
  },

  /** Chaque étape a sa propre condition de réussite. */
  _checkStep() {
    const step = this.step;
    if (!step) return;

    const range = CONFIG.player.pickupRange;

    switch (step.id) {
      case 'find-key':
        for (const p of this.players) {
          const key = this.world.thingNear(p.x, p.y, range, 'key1');
          if (key) {
            key.taken = true;
            this.carrying = 'key1';
            UI.flashPickup(step.toast);
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
            UI.flashPickup(step.toast);

            // Tsuki a entendu le papier : il file se cacher.
            const moved = this.world.moveCatToHideout();
            this._completeStep(() => {
              if (moved && CONFIG.cat.movedCard) {
                UI.showCard(CONFIG.cat.movedCard, () => this._syncObjective());
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
            // Tsuki s'installe et lâche la clé.
            this.world.cat.carried = false;
            this.world.cat.atHome = true;
            this.world.cat.x = p.x;
            this.world.cat.y = p.y;
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
            UI.flashPickup(step.toast);
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
      // entrent librement. L'annonce attend le landau.
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
    return step ? step.locked : null;
  },

  /**
   * L'annonce, déclenchée en approchant du landau et non à la porte.
   * C'est le vrai point d'orgue : les joueurs entrent, traversent la pièce,
   * découvrent le landau, et le message tombe à ce moment-là.
   */
  _checkNurseryEntry() {
    const step = this.step;
    if (!step || step.id !== 'reach-pram') return;
    if (this.revealed) return;

    if (this.players.some((p) => this.world.isNearPram(p.x, p.y))) {
      this.revealed = true;
      this.stepIndex += 1;
      UI.setObjective('', this.steps.length, this.steps.length);
      UI.setHint('');
      UI.setCarrying(null);
      UI.showFinal();
    }
  },

  _draw(time) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const cam = { x: 0, y: 0, w: this.camera.w, h: this.camera.h };
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

    // Le voile passe après les joueurs : on ne les voit pas à travers un mur.
    this.world.drawFog(ctx, cam);

    Input.drawTouchStick(ctx, this.canvas);
  }
};

document.addEventListener('DOMContentLoaded', () => Game.boot());
