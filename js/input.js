/**
 * Entrées : clavier pour un ou deux joueurs, tactile via joystick virtuel.
 * Le joystick pilote toujours le joueur 1.
 *
 * Deux surfaces tactiles sont acceptées : la carte elle-même, et un pavé
 * sous la carte. Ce pavé permet de garder le pouce en bas de l'écran sans
 * masquer le plan avec la main.
 */
const Input = {
  keys: new Set(),
  touch: { active: false, dx: 0, dy: 0, originX: 0, originY: 0, onPad: false },
  _canvas: null,
  _pad: null,

  /**
   * @param {HTMLCanvasElement} canvas la carte
   * @param {HTMLElement} [pad] zone tactile sous la carte (facultative)
   */
  init(canvas, pad) {
    this._canvas = canvas;
    this._pad = pad || null;

    window.addEventListener('keydown', (e) => {
      // Ne pas voler les touches quand on tape un prénom.
      if (e.target instanceof HTMLInputElement) return;
      if (this._isGameKey(e.key)) e.preventDefault();
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => this.keys.clear());

    [canvas, this._pad].forEach((el) => {
      if (!el) return;
      const onPad = (el === this._pad);
      el.addEventListener('touchstart', (e) => this._onTouchStart(e, onPad), { passive: false });
      el.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      el.addEventListener('touchend', () => this._resetTouch());
      el.addEventListener('touchcancel', () => this._resetTouch());
    });
  },

  _isGameKey(key) {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key);
  },

  _onTouchStart(e, onPad) {
    e.preventDefault();
    const t = e.touches[0];
    this.touch.active = true;
    this.touch.onPad = !!onPad;
    this.touch.originX = t.clientX;
    this.touch.originY = t.clientY;
    this.touch.dx = 0;
    this.touch.dy = 0;
  },

  _onTouchMove(e) {
    e.preventDefault();
    if (!this.touch.active) return;
    const t = e.touches[0];
    const max = 45;
    this.touch.dx = Math.max(-max, Math.min(max, t.clientX - this.touch.originX));
    this.touch.dy = Math.max(-max, Math.min(max, t.clientY - this.touch.originY));
  },

  _resetTouch() {
    this.touch.active = false;
    this.touch.onPad = false;
    this.touch.dx = 0;
    this.touch.dy = 0;
  },

  /**
   * @param {number} index 0 = joueur 1 (flèches + tactile), 1 = joueur 2 (ZQSD)
   * @returns {{x:number, y:number}} vecteur normalisé
   */
  direction(index) {
    const k = this.keys;
    let x = 0;
    let y = 0;

    if (index === 0) {
      if (k.has('arrowleft')) x -= 1;
      if (k.has('arrowright')) x += 1;
      if (k.has('arrowup')) y -= 1;
      if (k.has('arrowdown')) y += 1;

      if (x === 0 && y === 0 && this.touch.active) {
        const dead = 8;
        if (Math.hypot(this.touch.dx, this.touch.dy) > dead) {
          x = this.touch.dx;
          y = this.touch.dy;
        }
      }
    } else {
      if (k.has('q') || k.has('a')) x -= 1;
      if (k.has('d')) x += 1;
      if (k.has('z') || k.has('w')) y -= 1;
      if (k.has('s')) y += 1;
    }

    const len = Math.hypot(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  },

  /**
   * Dessine le joystick sur la carte quand le doigt est posé dessus.
   *
   * Rien n'est dessiné si le doigt est sur le pavé du bas : celui-ci a son
   * propre repère visuel en CSS, et le canvas n'y a pas accès.
   *
   * @param {number} viewScale rapport pixels de dessin / unités du plan
   */
  drawTouchStick(ctx, canvas, viewScale) {
    if (!this.touch.active || this.touch.onPad) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Le contexte est déjà mis à l'échelle : on convertit les pixels écran
    // en unités du plan pour rester cohérent avec le reste du rendu.
    const k = (canvas.width / rect.width) / (viewScale || 1);
    const cx = (this.touch.originX - rect.left) * k;
    const cy = (this.touch.originY - rect.top) * k;

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, 44 * k, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx + this.touch.dx * k, cy + this.touch.dy * k, 17 * k, 0, Math.PI * 2);
    ctx.fill();
  }
};
