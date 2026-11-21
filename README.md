# Lectype web

Apprendre la dactylographie en recopiant de vraies œuvres libres de droits. Version web de l'app Mac [Lectype](../Lectype), utilisable dans n'importe quel navigateur, Windows compris.

## Démarrer

```bash
npm install
npm run content:sync   # copie le contenu depuis ../Lectype (déjà versionné dans content/)
npm run dev            # http://localhost:3000, redémarre à chaque modification
npm test
```

Sans `.env`, le serveur utilise une clé de session aléatoire, il garde la base dans `./data` et écrit les e-mails dans la console au lieu de les envoyer.

## Ce qu'il y a dedans

- **Sans compte** : bibliothèque, frappe avec clavier à l'écran, histoires interactives et originales, parcours Apprendre, mode lecture, statistiques, réglages et trois thèmes. La progression reste dans le navigateur.
- **Avec un compte** (e-mail et mot de passe) : la progression est transférée sur le compte à la première connexion, puis synchronisée. « Mon compte » permet de modifier ses informations, de voir et déconnecter ses appareils, d'exporter ses données et de supprimer son compte.

## Stack

Node.js et Express 5, pages EJS, SQLite (`@libsql/client`), sessions `express-session` gardées en SQLite, bcrypt, e-mails par Brevo, tests avec `node --test`. Côté navigateur : des modules JavaScript, sans framework.

## Documentation

- [`workflows/deploy.md`](workflows/deploy.md) : mise en ligne sur AlwaysData, domaine, sauvegardes.
- [`workflows/content.md`](workflows/content.md) : mise à jour des livres et des histoires.
- [`CLAUDE.md`](CLAUDE.md) : conventions et règles de sécurité du projet.
