# Lectype web — instructions pour Claude Code

Version web de Lectype (app Mac dans le dépôt voisin `../Lectype`, dont `CLAUDE.md` et `docs/CONCEPT.md` décrivent le produit). Même concept et mêmes règles de frappe. L'apparence est propre au web : la direction « Bibliothèque » (papier crème, serif, bleu encre), en version jour et soir. Déployée sur AlwaysData avec `git pull` + `npm install` + `npm start` (voir `workflows/deploy.md`).

## Règles de travail

- Avance par petites étapes. Pour toute tâche de plus de quelques fichiers, commence en mode plan et attends ma validation.
- Après chaque étape : `npm test` (tout doit passer), vérifie dans le navigateur, puis propose un commit.
- Ne fais jamais de grosse réécriture non demandée.
- Si une décision produit n'est ni ici ni dans `../Lectype/CLAUDE.md`, demande-moi.

## Conventions

- **Pas de commentaires dans le code.** Identifiants, fichiers et commits en anglais.
- Textes de l'interface jamais en dur : `locales/fr.json` et `locales/en.json` (`t('clé')` dans les vues ; les textes utilisés par le JavaScript du navigateur sont passés dans un bloc `<script type="application/json">`).
- Pas de dépendance ni de framework sans me demander. Le navigateur charge des modules ES de `public/js`, sans étape de build.
- Logique testable séparée de l'interface : `public/js/core/` (moteur de frappe, métriques, histoires, leçons, statistiques) ne touche pas au DOM et a des tests dans `test/*.test.mjs`.
- Le moteur de frappe passe les cas partagés avec l'app Mac (`test/fixtures/typing-cases.json`, copiés par `npm run content:sync`). Toute règle de frappe modifiée l'est des deux côtés.
- Ne modifie jamais `content/` à la main : `npm run content:sync` (voir `workflows/content.md`).

## Structure

```
app.js                serveur Express (createApp pour les tests, start pour la production)
routes/               public (accueil, légal), app (bibliothèque, frappe, histoires, Apprendre…), auth, account, api
middlewares/          en-têtes de sécurité, CSRF, langue, utilisateur courant, limites de débit
tools/                base (db.js, schema.sql), comptes (users, passwords, tokens, devices, security-log), e-mails, progression, contenu
views/                pages EJS ; partials/ communs
public/js/            pages du navigateur ; core/ = logique pure ; storage.js = localStorage ; account-sync.js = synchro avec le compte
public/css/           site.css (jetons de design jour et soir, composants communs) et app.css (écrans)
public/fonts/         Newsreader et Inter hébergées sur le site (licence SIL dans OFL.txt)
content/              livres, couvertures, histoires, listes de mots (générés)
test/                 node --test ; helpers/server.js lance un serveur en mémoire et simule un navigateur
```

## Apparence

- Maquettes de référence : canvas « Lectype — refonte du site » (page « Bibliothèque — tous les écrans »).
- Les couleurs passent toujours par les variables de `site.css` (`--bg`, `--sheet`, `--ink`, `--accent`…), définies pour `data-theme="day"` et `data-theme="evening"`. Aucune couleur en dur dans les vues ni dans le JavaScript.
- Titres et texte à taper en Newsreader (`--serif`), interface en Inter (`--sans`). Les polices sont servies par le site : jamais de Google Fonts ni d'autre CDN.
- `theme-boot.js` applique l'apparence avant l'affichage (réglage « Jour », « Soir » ou « Comme l'appareil »).
- Sur téléphone (écran étroit ou tactile sans souris), les pages de frappe montrent `partials/no-keyboard.ejs` ; le bouton « J'ai un clavier branché » force la frappe pour la session.

## Sécurité (à respecter dans toute modification)

- **SQL** : toujours des requêtes paramétrées (`args`), jamais de concaténation de valeurs.
- **Vues** : `<%= %>` (échappé) partout ; `<%- %>` seulement pour inclure un partial ou un JSON passé par `JSON.stringify(...).replace(/</g, '\\u003c')`.
- **CSP stricte** : aucun script ni style en ligne, ni attribut `style="…"`, ni attribut `on…`. Tout JavaScript va dans `public/js`.
- **CSRF** : chaque formulaire POST contient `_csrf`, chaque `fetch` qui modifie envoie `x-csrf-token` (balise `meta name="csrf-token"`).
- **Mots de passe** : bcrypt coût 12, 12 caractères minimum, liste locale de mots de passe courants (`tools/data/common-passwords.txt`), 72 octets maximum.
- **Jetons d'e-mail** : à usage unique, seule l'empreinte SHA-256 est stockée ; 24 h pour confirmer, 1 h pour réinitialiser.
- **Pas d'énumération** : inscription, connexion, mot de passe oublié et changement d'e-mail répondent pareil, qu'un compte existe ou non. Les tests le vérifient.
- **Sessions** : regénérées à la connexion, liées à une ligne `devices` (supprimer la ligne déconnecte l'appareil). Les actions sensibles (e-mail, mot de passe, suppression) redemandent le mot de passe actuel.
- **Limites** : `middlewares/rate-limits.js` (par IP) et verrouillage du compte après 10 échecs. Toute nouvelle route qui envoie un e-mail ou vérifie un mot de passe passe par une limite.
- **Journal** : chaque événement de sécurité passe par `logEvent` et a un libellé dans `account.events` (un test le vérifie). Il est effacé avec le compte et purgé après 180 jours.
- **Liens dans les e-mails** : construits depuis `BASE_URL`, jamais depuis l'en-tête `Host`.
- **Données reçues du navigateur** (`/api/sync`) : validées et bornées dans `tools/progress.js` avant d'être enregistrées.
- Les tests n'utilisent jamais la vraie base : `test/helpers/server.js` passe `DATABASE_URL=:memory:`.

## Hors périmètre pour l'instant

Connexion avec Apple, synchro avec l'app Mac, page de téléchargement de l'app, plusieurs profils par compte dans l'interface, sons des touches et musique des histoires. N'ajoute rien de tout ça sans me le demander.
