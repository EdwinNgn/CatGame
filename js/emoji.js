/**
 * Pile de polices emoji, partagée par le CSS et le canvas.
 *
 * Le canvas n'hérite pas des polices de la page : si on lui demande
 * « 20px serif », un emoji sort en carré vide sur les systèmes dont la police
 * serif n'en contient pas. Il faut donc nommer explicitement les polices
 * emoji du système à chaque `ctx.font`.
 *
 * @param {number} size taille en pixels
 * @param {string} [weight] par exemple '600'
 * @returns {string} valeur prête pour `ctx.font`
 */
const EMOJI_STACK =
  '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol",' +
  '"Noto Color Emoji","Android Emoji",sans-serif';

function emojiFont(size, weight) {
  const w = weight ? weight + ' ' : '';
  return `${w}${Math.round(size)}px ${EMOJI_STACK}`;
}
