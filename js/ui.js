/**
 * Interface : menu, HUD d'objectif, cartes d'étape, annonce et confettis.
 */
const UI = {
  el: {},
  selection: { p1: CONFIG.avatars[0], p2: CONFIG.avatars[1] },
  handlers: null,
  _onCardClose: null,
  _confetti: null,
  _toastTimer: 0,

  /**
   * Ce que représente chaque objet porté, pour le bandeau « Vous portez ».
   * Les icônes viennent de ICONS (config.js) : voir le commentaire là-bas
   * sur les emoji écrits en séquences d'échappement.
   */
  CARRY_ICON: {
    key1: ICONS.key,
    key2: ICONS.key,
    fish: ICONS.fish,
    cat: ICONS.cat
  },

  init(handlers) {
    this.handlers = handlers;
    this.el = {
      menu: document.getElementById('screen-menu'),
      game: document.getElementById('screen-game'),
      p1Name: document.getElementById('p1-name'),
      p2Name: document.getElementById('p2-name'),
      p1Avatars: document.getElementById('p1-avatars'),
      p2Avatars: document.getElementById('p2-avatars'),
      twoPlayers: document.getElementById('two-players'),
      p2Field: document.getElementById('p2-field'),
      start: document.getElementById('btn-start'),
      hudStep: document.getElementById('hud-step'),
      hudObjective: document.getElementById('hud-objective'),
      hudCarry: document.getElementById('hud-carry'),
      hudRooms: document.getElementById('hud-rooms'),
      hint: document.getElementById('hint'),
      toast: document.getElementById('toast'),
      modal: document.getElementById('modal'),
      modalIcon: document.getElementById('modal-icon'),
      modalTitle: document.getElementById('modal-title'),
      modalText: document.getElementById('modal-text'),
      modalStep: document.getElementById('modal-step'),
      modalClose: document.getElementById('modal-close'),
      final: document.getElementById('final'),
      finalIcon: document.getElementById('final-icon'),
      finalTitle: document.getElementById('final-title'),
      finalText: document.getElementById('final-text'),
      finalDate: document.getElementById('final-date'),
      finalOk: document.getElementById('final-ok'),
      finalReplay: document.getElementById('final-replay'),
      confetti: document.getElementById('confetti-canvas')
    };

    Lang.init();
    this._buildLangSwitch();
    this._buildAvatars(this.el.p1Avatars, 'p1');
    this._buildAvatars(this.el.p2Avatars, 'p2');
    this.applyLang();

    this.el.twoPlayers.addEventListener('change', () => {
      this.el.p2Field.classList.toggle('is-hidden', !this.el.twoPlayers.checked);
    });

    this.el.start.addEventListener('click', () => handlers.onStart(this.readSetup()));
    this.el.modalClose.addEventListener('click', () => this.closeCard());
    this.el.finalOk.addEventListener('click', () => this.dismissFinal());
    this.el.finalReplay.addEventListener('click', () => handlers.onReplay());

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (this.el.modal.classList.contains('is-visible')) {
        e.preventDefault();
        this.closeCard();
      } else if (this.el.menu.classList.contains('is-visible') && e.key === 'Enter') {
        handlers.onStart(this.readSetup());
      }
    });
  },

  _buildAvatars(container, who) {
    CONFIG.avatars.forEach((emoji, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar';
      btn.textContent = emoji;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', `${Lang.t('menu.avatarLabel')} ${emoji}`);
      btn.setAttribute('aria-checked', String(who === 'p1' ? i === 0 : i === 1));
      btn.addEventListener('click', () => {
        container.querySelectorAll('.avatar')
          .forEach((b) => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        this.selection[who] = emoji;
      });
      container.appendChild(btn);
    });
  },

  readSetup() {
    const players = [{
      name: (this.el.p1Name.value || '').trim() || Lang.t('menu.player1'),
      avatar: this.selection.p1
    }];
    if (this.el.twoPlayers.checked) {
      players.push({
        name: (this.el.p2Name.value || '').trim() || Lang.t('menu.player2'),
        avatar: this.selection.p2
      });
    }
    return { players };
  },

  /**
   * Applique la langue courante à tous les textes fixes de la page.
   *
   * Appelé au démarrage et à chaque changement de langue. Les textes qui
   * dépendent de l'état de la partie (objectif, indices) sont rafraîchis
   * séparément par le jeu.
   */
  applyLang() {
    const set = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Lang.t(key);
    };
    const setHtml = (id, key) => {
      const el = document.getElementById(id);
      // Ces libellés contiennent du <b> : ils sont écrits dans les
      // traductions, jamais saisis par un joueur.
      if (el) el.innerHTML = Lang.t(key);
    };

    document.title = Lang.t('menu.title');
    set('menu-title', 'menu.title');
    set('menu-subtitle', 'menu.subtitle');
    set('p1-label', 'menu.player1');
    set('p2-label', 'menu.player2');
    set('two-players-label', 'menu.twoPlayers');
    set('btn-start', 'menu.start');
    set('lang-label', 'menu.langLabel');
    setHtml('help-1', 'menu.help1');
    setHtml('help-2', 'menu.help2');
    setHtml('help-3', 'menu.help3');
    setHtml('help-4', 'menu.help4');
    set('touchpad-label', 'hud.touchpad');

    [this.el.p1Name, this.el.p2Name].forEach((input) => {
      if (input) input.placeholder = Lang.t('menu.namePlaceholder');
    });
    if (this.el.p1Avatars) {
      this.el.p1Avatars.setAttribute('aria-label', Lang.t('menu.avatar1Group'));
    }
    if (this.el.p2Avatars) {
      this.el.p2Avatars.setAttribute('aria-label', Lang.t('menu.avatar2Group'));
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.setAttribute('aria-label', Lang.t('hud.canvasLabel'));

    // Boutons de langue : le courant est marqué comme sélectionné.
    const box = document.getElementById('lang-switch');
    if (box) {
      box.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.lang === Lang.current));
      });
    }
  },

  /** Construit les boutons de langue de l'écran d'accueil. */
  _buildLangSwitch() {
    const box = document.getElementById('lang-switch');
    if (!box) return;

    const labels = { fr: 'Français', en: 'English' };
    box.innerHTML = '';

    Lang.available.forEach((code) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn';
      btn.dataset.lang = code;
      btn.textContent = labels[code] || code;
      btn.setAttribute('aria-pressed', String(code === Lang.current));
      btn.addEventListener('click', () => {
        Lang.set(code);
        this.applyLang();
      });
      box.appendChild(btn);
    });
  },

  showGame() {
    this.el.menu.classList.remove('is-visible');
    this.el.game.classList.add('is-visible');
    // Bascule la page en pleine hauteur et fait apparaître le pavé tactile.
    document.body.classList.add('is-playing');
  },

  showMenu() {
    this.el.game.classList.remove('is-visible');
    this.el.menu.classList.add('is-visible');
    this.el.final.classList.remove('is-visible');
    this.el.modal.classList.remove('is-visible');
    document.body.classList.remove('is-playing');
    this.stopConfetti();
  },

  setHint(text) {
    this.el.hint.textContent = text || '';
  },

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------

  /** L'objectif courant, avec la progression dans la chaîne de quêtes. */
  setObjective(text, index, total) {
    this.el.hudStep.textContent = text
      ? Lang.t('hud.step', { n: Math.min(index + 1, total), total: total })
      : Lang.t('hud.done');
    this.el.hudObjective.textContent = text || '';
  },

  /** Ce que le joueur a dans les mains. */
  setCarrying(id) {
    const el = this.el.hudCarry;
    if (!id || !this.CARRY_ICON[id]) {
      el.textContent = '';
      return;
    }
    // Le chat est nomme, les objets sont traduits.
    const label = (id === 'cat')
      ? (CONFIG.cat ? CONFIG.cat.name : Lang.t('carry.cat'))
      : Lang.t('carry.' + id);
    el.textContent = `${this.CARRY_ICON[id]} ${Lang.t('hud.carrying')} ${label}`;
  },

  updateRooms(seen, total) {
    if (!CONFIG.world.fog) {
      this.el.hudRooms.textContent = '';
      return;
    }
    this.el.hudRooms.textContent = Lang.t('hud.roomsExplored', { n: seen, total: total });
  },

  // ------------------------------------------------------------------
  // Bandeaux
  // ------------------------------------------------------------------

  flashPickup(text) {
    if (text) this._toast(text, 1500);
  },

  flashRoom(name, seen, total) {
    this._toast(Lang.t('hud.roomToast', { name: name, n: seen, total: total }), 1200);
    this.updateRooms(seen, total);
  },

  /**
   * Bandeau quand on se cogne à une porte fermée. Rafraîchi tant qu'on
   * pousse contre la porte, sans réarmer l'animation à chaque image.
   */
  flashLocked(message) {
    this._sticky('locked', message, 900);
  },

  /** Bandeau quand on croise Tsuki affamé, les mains vides. */
  flashHungry(message) {
    this._sticky('hungry', message, 1100);
  },

  /**
   * Bandeau maintenu tant que la condition dure (contact avec une porte,
   * proximité du chat), sans relancer l'animation à chaque image — sinon il
   * clignoterait à 60 images par seconde.
   */
  _sticky(kind, message, delay) {
    const t = this.el.toast;
    if (t.dataset.sticky === kind && t.classList.contains('is-visible')) {
      t.textContent = message;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        t.classList.remove('is-visible');
        delete t.dataset.sticky;
      }, delay);
      return;
    }
    t.dataset.sticky = kind;
    this._toast(message, delay);
  },

  _toast(text, delay) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('is-visible');
      delete t.dataset.sticky;
    }, delay);
  },

  // ------------------------------------------------------------------
  // Cartes d'étape
  // ------------------------------------------------------------------

  /**
   * Affiche la carte d'une étape franchie.
   * @param {{icon:string, title:string, text:string}} card
   * @param {Function} [onClose]
   */
  showCard(card, onClose) {
    this.el.modalStep.textContent = '';
    this.el.modalIcon.textContent = card.icon || '';
    this.el.modalTitle.textContent = card.title || '';
    this.el.modalText.textContent = card.text || '';
    this.el.modalClose.textContent = Lang.t('hud.continue');
    this.el.modal.classList.add('is-visible');
    this.el.modalClose.focus();
    this._onCardClose = onClose || null;
  },

  closeCard() {
    if (!this.el.modal.classList.contains('is-visible')) return;
    this.el.modal.classList.remove('is-visible');
    const cb = this._onCardClose;
    this._onCardClose = null;
    if (cb) cb();
  },

  get isModalOpen() {
    return this.el.modal.classList.contains('is-visible') ||
           this.el.final.classList.contains('is-visible');
  },

  // ------------------------------------------------------------------
  // Annonce et mot de la fin
  // ------------------------------------------------------------------

  /**
   * L'annonce, affichée en approchant du landau.
   *
   * Deux boutons : « OK » referme simplement le message et laisse les joueurs
   * dans la chambre (ils peuvent continuer à s'y promener), « Rejouer »
   * relance une partie.
   */
  showFinal() {
    const date = Lang.t('reveal.date');
    this.el.finalIcon.textContent = ICONS.pregnant;
    this.el.finalTitle.textContent = Lang.t('reveal.title') + ' ' + ICONS.heart;
    this.el.finalText.textContent = Lang.t('reveal.text');
    this.el.finalDate.textContent = date || '';
    this.el.finalDate.style.display = date ? '' : 'none';
    this.el.finalOk.textContent = Lang.t('reveal.okButton');
    this.el.finalReplay.textContent = Lang.t('reveal.replayButton');
    this.el.final.classList.add('is-visible');
    this.el.finalOk.focus();
    this.startConfetti();
  },

  /** « OK » : on referme et on reste dans la chambre. */
  dismissFinal() {
    this.el.final.classList.remove('is-visible');
    this.stopConfetti();
  },

  // ------------------------------------------------------------------
  // Confettis
  // ------------------------------------------------------------------

  startConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = this.el.confetti;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#d98a7b', '#e0b664', '#8fc4d8', '#f2c4d4', '#fbf6ec'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 1 + Math.random() * 2.4,
      vx: -0.7 + Math.random() * 1.4,
      spin: -0.1 + Math.random() * 0.2,
      angle: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.angle += p.spin;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();

    this._confetti = {
      stop: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      }
    };
  },

  stopConfetti() {
    if (this._confetti) {
      this._confetti.stop();
      this._confetti = null;
    }
    const canvas = this.el.confetti;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
};
