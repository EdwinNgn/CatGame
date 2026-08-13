# Une clé, un poisson, un chat

Petit jeu web : on explore l'appartement vu de dessus en suivant une chaîne
d'étapes. Deux portes fermées, un chat à convaincre, et une annonce au bout.

Aucune dépendance, aucun build. HTML + CSS + JavaScript.

## Lancer le jeu

Double-cliquez sur `index.html`, ou servez le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Le déroulé

0. **Remettre l'électricité.** Les plombs ont sauté : l'appartement est noir,
   on n'y voit qu'un halo autour de soi. L'éclair ⚡ du tableau électrique
   reste visible malgré l'obscurité et donne la direction de la buanderie.
   Une fois le courant rétabli, l'entrée et la buanderie restent découvertes
   et le jeu reprend normalement.
1. **Trouver la clé** de notre chambre, cachée dans le salon.
2. **Ouvrir notre chambre** avec cette clé.
3. **Récupérer le poisson** posé près du lit.
4. **Retrouver Tsuki et lui donner le poisson.** Il attendait en cuisine,
   mais il a filé à la salle de bain en entendant le papier du poisson.
   Rassasié, il se laisse enfin porter.
5. **Porter Tsuki jusqu'à sa chambre.** Il s'installe et pousse du bout de la
   patte une deuxième clé.
6. **Ramasser cette clé.**
7. **Ouvrir la dernière porte.** Elle s'ouvre sans un mot : on entre
   librement.
8. **Entrer dans la chambre.** L'annonce se déclenche de deux façons : en
   s'approchant du landau, au milieu de la pièce, ou automatiquement au bout
   de trois secondes passées dans la chambre (`reveal.autoDelay`) — ce filet
   évite de rester bloqué sans comprendre. Aucun texte du jeu ne nomme le
   landau avant, pour ne pas vendre la surprise. Deux boutons : « OK » referme
   le message et laisse continuer la visite, « Rejouer » relance une partie.

Le HUD affiche en permanence l'étape courante, l'objectif, et ce que vous avez
dans les mains. Se cogner à une porte fermée affiche pourquoi elle résiste, et
croiser Tsuki les mains vides vous rappelle qu'il a faim.

### Tsuki

Son comportement se règle dans `CONFIG.cat` :

| Clé | Rôle |
|---|---|
| `name`, `fur`, `belly` | Nom et couleurs du pelage. |
| `hungryHint` | Le message affiché quand on le croise sans poisson. |
| `movesTo` | La case où il part se cacher dès qu'on récupère le poisson (`{ col, row }`). Mets `null` pour qu'il reste en cuisine. |
| `movedCard` | La fenêtre qui explique sa disparition. |

Le jeu vérifie que `movesTo` tombe bien sur une case libre : si tu le
téléportes dans un mur, il reste sur place et te le dit dans la console.

## Dessiner votre appartement

Le plan est du texte, dans `CONFIG.map` (`js/config.js`). Une ligne = une
rangée de cases. **Toutes les lignes doivent avoir exactement la même
longueur** ; sinon le jeu vous prévient dans la console du navigateur
(F12 > Console).

| Signe | Sens |
|---|---|
| `~` | extérieur (l'appartement n'est pas un rectangle) |
| `#` | mur |
| `.` | parquet |
| `:` | carrelage |
| `+` | porte ouverte |
| `r` | porte de notre chambre (clé du salon) |
| `R` | porte de la dernière chambre (clé de Tsuki) |
| `1` `2` | départs des joueurs |
| `k` | la clé de notre chambre |
| `f` | le poisson |
| `t` | Tsuki |

La deuxième clé n'est pas dans le plan : Tsuki la laisse tomber lui-même.

Meubles, infranchissables :

| Signe | Meuble | Signe | Meuble |
|---|---|---|---|
| `S` | canapé | `W` | baignoire |
| `T` | table | `H` | douche |
| `B` | lit | `N` | vasque (2 maximum) |
| `K` | plan de travail équipé (évier + plaques) | `C` | toilettes |
| `U` | plan de travail nu | `M` | machine à laver |
| `F` | frigo | `V` | meuble TV |
| `X` | armoire | `L` | meuble bas |
| `D` | bureau | `O` | carton |
| `P` | plante | `A` | fauteuil |
| `E` | buffet | `G` | commode |
| `J` | arbre à chat | `Z` | tableau électrique |

Le tableau électrique `Z` est l'objectif de la première étape : c'est lui qu'il
faut atteindre dans le noir pour rétablir le courant. Ses manettes passent du
rouge au vert une fois la lumière revenue.

Le buffet `E` a des portes à battants, la commode `G` des tiroirs empilés :
c'est ce qui les distingue visuellement. Le plan de travail existe en deux
versions, `K` avec évier et plaques, `U` nu pour prolonger une cuisine sans
répéter les équipements. La vasque `N` affiche une cuve sur une seule case,
deux au-delà, jamais plus.

Le fauteuil `A` placé dans la chambre de Tsuki (`tsukiRoom: true`) devient son
couchage : il s'y endort et la clé tombe juste devant, du côté ouvert du
fauteuil. Sans fauteuil dans la pièce, il s'installe là où on le dépose.

Les meubles contigus de même lettre sont regroupés en un seul objet : un `S`
sur 2x7 cases devient un vrai canapé, pas quatorze petits carrés.

**Orientation automatique.** Chaque meuble détecte de quel côté se trouve le
mur et se tourne en conséquence : le dossier d'un canapé, la tête d'un lit,
l'écran d'un meuble TV ou la robinetterie d'une vasque se placent contre le
mur, la face utile vers la pièce. Il suffit de coller le meuble au mur.

## Les pièces

`CONFIG.rooms` donne les noms affichés sur le plan et porte trois marqueurs :

```js
{ name: 'Notre chambre', locked: 'bedroom', ... }   // derrière la porte « r »
{ name: 'Chambre de Tsuki', tsukiRoom: true, ... }  // où déposer Tsuki
{ name: 'Chambre du bébé', nursery: true, locked: 'nursery',
  hiddenName: 'Une porte fermée',    // avant l'ouverture
  revealedName: 'Chambre du bébé' }  // après
```

La chambre surprise n'est jamais nommée avant la fin, et le brouillard la
marque d'un cadenas.

## Contrôles de cohérence

Le jeu rejoue la chaîne de quêtes au chargement et vous prévient dans la
console si la partie est insoluble :

- la clé `k` doit être accessible dès le départ (sinon blocage immédiat) ;
- le poisson `f` doit être **derrière** la porte `r`, sinon l'étape de la clé
  ne sert à rien ;
- Tsuki `t` doit être dans une pièce ouverte ;
- la chambre marquée `nursery` ne doit pas avoir de seconde entrée qui
  contournerait la porte `R`.

## Les langues

Le jeu est en français par défaut, avec un choix français / anglais sur
l'écran d'accueil. Le choix est mémorisé d'une partie à l'autre.

Tous les textes visibles sont dans `js/i18n.js`, regroupés par langue. Pour en
modifier un, édite les deux langues : les clés doivent rester identiques, et le
jeu retombe sur le français si une clé manque en anglais.

Point important : les pièces ont un `id` interne (`bedroom`, `laundry`…) qui
sert de clé pour les zones de brouillard et pour `blackout.keepLitRooms`, et
n'est jamais affiché. Le nom visible vient de `I18N.<langue>.rooms.<id>`. Ne
change pas les `id`, ni ceux des étapes de quête qui servent aussi de clés de
traduction.

Pour ajouter une langue, copie un bloc de `I18N` sous un nouveau code, traduis
les valeurs, et ajoute son libellé dans `_buildLangSwitch` (`js/ui.js`).

## Le reste de la configuration

| Clé | Rôle |
|---|---|
| `quest.steps` | Les 9 étapes : objectif affiché, indice, message de porte fermée, et la carte qui s'ouvre à la réussite. Ne change pas les `id`. |
| `blackout` | La panne du début : `haloRadius` le rayon éclairé autour des joueurs en cases, `keepLitRooms` les pièces qui restent découvertes après le rétablissement. |
| `cat` | Le nom et les couleurs du chat. |
| `reveal` | L'annonce : titre, texte, date (`date: ''` pour masquer), libellé des deux boutons (`okButton`, `replayButton`) et `autoDelay`, le délai en millisecondes avant déclenchement automatique dans la chambre (`0` pour n'avoir que la proximité). |
| `world.tileSize` | Taille d'une case en pixels dans le plan. |
| `world.minTileSize` | Taille minimale d'une case à l'écran. En dessous, le jeu zoome et la caméra suit le joueur au lieu de tout afficher. Augmente pour un zoom plus serré. |
| `world.fog` | `true` : les pièces restent masquées jusqu'à ce qu'on y entre. |
| `player.speed` | Vitesse de déplacement. |
| `player.requireBothAtNursery` | À deux joueurs, exige que les deux soient devant la dernière porte pour l'ouvrir. `false` pour qu'un seul suffise. Sans effet en solo. |

## Commandes

- Joueur 1 : flèches du clavier
- Joueur 2 : Z Q S D (mode deux joueurs sur le même écran)
- À deux, l'objet ramassé reste sur celui qui l'a pris, et la dernière porte
  ne s'ouvre que si les deux joueurs sont devant
- Mobile : glissez le doigt sur le plan, ou sur le pavé sous la carte pour
  garder le pouce en bas sans masquer la vue
- Entrée ou Espace pour fermer une carte

## Affichage

Sur grand écran, tout l'appartement est visible d'un coup. Sur mobile,
l'afficher en entier donnerait des cases de 10 pixels : le jeu zoome alors
pour garder des cases lisibles (26 px par défaut) et la caméra suit le joueur,
sans jamais sortir du plan. Le seuil se règle avec `world.minTileSize`.

La mise en page est recalculée à la rotation de l'écran et au
redimensionnement de la fenêtre, et le canvas est dessiné à la résolution de
l'appareil pour rester net sur les écrans haute densité.

## Structure

## Les emoji

Les emoji ne sont jamais écrits en clair dans le code : ils sont déclarés en
séquences d'échappement Unicode dans `ICONS` (`js/config.js`), par exemple
`'\u{1F511}'` pour la clé. Un emoji collé littéralement peut être détruit par
un aller-retour d'encodage et devenir un carré vide ; écrit ainsi, le source
reste en pur ASCII et le glyphe est reconstruit à l'exécution.

Pour en ajouter un, cherchez son codepoint (« emoji unicode codepoint ») et
suivez la même forme. Le canvas et le CSS reçoivent en plus une pile de
polices emoji explicite (`js/emoji.js` et la variable `--emoji`), car le
canvas n'hérite pas des polices de la page.

## Structure

```
index.html          écrans et overlays
css/style.css       styles
js/emoji.js         pile de polices emoji pour le canvas
js/i18n.js          tous les textes, en français et en anglais
js/config.js        le plan, la chaîne de quêtes, les icônes, les réglages
js/worldgen.js      lecture du plan, meubles, zones de brouillard, contrôles
js/world.js         collisions, serrures, objets, Tsuki, rendu
js/player.js        personnage et déplacement
js/input.js         clavier et joystick tactile
js/ui.js            menu, HUD, cartes, annonce, confettis
js/game.js          boucle de jeu et enchaînement des quêtes
```
