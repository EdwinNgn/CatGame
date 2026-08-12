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
  CARRY_LABEL: {
    key1: { icon: ICONS.key, label: 'la clé de notre chambre' },
    key2: { icon: ICONS.key, label: 'la clé de la dernière porte' },
    fish: { icon: ICONS.fish, label: 'un poisson' },
    cat: { icon: ICONS.cat, label: null } // complété avec le nom du chat
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

    this._buildAvatars(this.el.p1Avatars, 'p1');
    this._buildAvatars(this.el.p2Avatars, 'p2');

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
      btn.setAttribute('aria-label', `Avatar ${emoji}`);
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
      name: (this.el.p1Name.value || '').trim() || 'Joueur 1',
      avatar: this.selection.p1
    }];
    if (this.el.twoPlayers.checked) {
      players.push({
        name: (this.el.p2Name.value || '').trim() || 'Joueur 2',
        avatar: this.selection.p2
      });
    }
    return { players };
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
      ? `Étape ${Math.min(index + 1, total)} sur ${total}`
      : 'Terminé';
    this.el.hudObjective.textContent = text || '';
  },

  /** Ce que le joueur a dans les mains. */
  setCarrying(id) {
    const el = this.el.hudCarry;
    if (!id || !this.CARRY_LABEL[id]) {
      el.textContent = '';
      return;
    }
    const entry = this.CARRY_LABEL[id];
    const label = entry.label || (CONFIG.cat ? CONFIG.cat.name : 'le chat');
    el.textContent = `${entry.icon} ${CONFIG.hints.carrying} ${label}`;
  },

  updateRooms(seen, total) {
    if (!CONFIG.world.fog) {
      this.el.hudRooms.textContent = '';
      return;
    }
    this.el.hudRooms.textContent = `${seen}/${total} pièces explorées`;
  },

  // ------------------------------------------------------------------
  // Bandeaux
  // ------------------------------------------------------------------

  flashPickup(text) {
    if (text) this._toast(text, 1500);
  },

  flashRoom(name, seen, total) {
    this._toast(`${name} · pièce ${seen}/${total}`, 1200);
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
    this.el.modalClose.textContent = 'Continuer';
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
    const r = CONFIG.reveal;
    this.el.finalIcon.textContent = ICONS.pregnant;
    this.el.finalTitle.textContent = r.title;
    this.el.finalText.textContent = r.text;
    this.el.finalDate.textContent = r.date || '';
    this.el.finalDate.style.display = r.date ? '' : 'none';
    this.el.finalOk.textContent = r.okButton || 'OK';
    this.el.finalReplay.textContent = r.replayButton || 'Rejouer';
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
