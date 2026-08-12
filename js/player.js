/**
 * Un personnage jouable.
 */
class Player {
  constructor(options) {
    this.name = options.name;
    this.avatar = options.avatar;
    this.color = options.color;
    this.x = options.x;
    this.y = options.y;
    this.radius = CONFIG.player.radius;
    this.speed = CONFIG.player.speed;
    this.facing = 1;
    this.walkPhase = 0;
  }

  /**
   * Déplacement avec glissement le long des murs : on tente les deux axes
   * séparément, ce qui évite de rester bloqué contre un arbre.
   * @param {{x:number, y:number}} dir vecteur normalisé
   * @param {World} world
   */
  move(dir, world) {
    if (dir.x === 0 && dir.y === 0) {
      this.walkPhase = 0;
      return;
    }

    const dx = dir.x * this.speed;
    const dy = dir.y * this.speed;

    if (world.canOccupy(this.x + dx, this.y, this.radius)) this.x += dx;
    if (world.canOccupy(this.x, this.y + dy, this.radius)) this.y += dy;

    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    this.walkPhase += 0.25;
  }

  /**
   * @param {string|null} [carrying] objet porté, affiché en médaillon
   */
  draw(ctx, camera, carrying) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const bounce = Math.abs(Math.sin(this.walkPhase)) * 3;

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.radius * 0.9, this.radius * 0.8, this.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pastille de couleur, pour distinguer les joueurs
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy - bounce, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Avatar
    ctx.font = emojiFont(14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.avatar, sx, sy - bounce + 1);

    // Objet porté, en petit médaillon près de l'épaule (sauf le chat, qui
    // est dessiné en entier par le jeu).
    const icons = { key1: ICONS.key, key2: ICONS.key, fish: ICONS.fish };
    if (carrying && icons[carrying]) {
      const ix = sx + this.radius * 0.95;
      const iy = sy - this.radius * 0.75 - bounce;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ix, iy, this.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = emojiFont(this.radius * 0.95);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icons[carrying], ix, iy + 0.5);
    }

    // Étiquette
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = this.name;
    const w = ctx.measureText(label).width + 10;
    const ly = sy - this.radius - 12 - bounce;
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, ly - 8, w, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, sx, ly);
  }
}

/** Repli pour les navigateurs sans CanvasRenderingContext2D.roundRect. */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}
