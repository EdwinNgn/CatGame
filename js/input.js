/**
 * Entrées : clavier pour un ou deux joueurs, tactile via joystick virtuel.
 * Le joystick pilote toujours le joueur 1.
 */
const Input = {
  keys: new Set(),
  touch: { active: false, dx: 0, dy: 0, originX: 0, originY: 0 },
  _canvas: null,

  init(canvas) {
    this._canvas = canvas;

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

    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', () => this._resetTouch());
    canvas.addEventListener('touchcancel', () => this._resetTouch());
  },

  _isGameKey(key) {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key);
  },

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    this.touch.active = true;
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
   * Dessine le joystick virtuel quand un doigt est posé.
   * Le canvas peut être mis à l'échelle par la largeur OU par la hauteur :
   * on calcule donc les deux facteurs séparément.
   */
  drawTouchStick(ctx, canvas) {
    if (!this.touch.active) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (this.touch.originX - rect.left) * scaleX;
    const cy = (this.touch.originY - rect.top) * scaleY;

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 44 * scaleX, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(cx + this.touch.dx * scaleX, cy + this.touch.dy * scaleY, 17 * scaleX, 0, Math.PI * 2);
    ctx.fill();
  }
};
