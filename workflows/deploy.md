# Déployer Lectype web sur AlwaysData

## Première mise en ligne

1. **Site Node.js.** Dans l'administration AlwaysData, ouvre *Web › Sites › Ajouter un site* et choisis le type **Node.js**.
   - Commande : `npm start`
   - Répertoire de travail : le dossier du dépôt cloné, par exemple `~/lectype-web`
   - AlwaysData fournit `PORT` et `IP` : le serveur les utilise tout seul.
2. **Code.** En SSH :

   ```bash
   git clone git@github.com:<ton-compte>/Lectype-web.git ~/lectype-web
   cd ~/lectype-web
   npm install --omit=dev
   ```

3. **Données hors du dépôt.** Crée un dossier pour la base, pour qu'un `git pull` n'y touche jamais :

   ```bash
   mkdir -p ~/lectype-data
   ```

4. **Variables d'environnement.** Copie `.env.example` en `.env` dans `~/lectype-web`, puis remplis-le :

   | Variable | Valeur |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | le résultat de `openssl rand -hex 32` (à ne jamais partager ni committer) |
   | `CANONICAL_HOST` | ton domaine, par exemple `lectype.fr` (avant d'avoir le domaine : l'adresse en `.alwaysdata.net`) |
   | `BASE_URL` | `https://` + le même domaine : sert aux liens des e-mails |
   | `DATA_DIR` | `/home/<compte>/lectype-data` |
   | `BREVO_API_KEY` | une clé API Brevo (*SMTP & API › Clés API*) |
   | `BREVO_SENDER_EMAIL` | une adresse d'expéditeur validée dans Brevo |
   | `LEGAL_PUBLISHER`, `LEGAL_CONTACT_EMAIL`, `LEGAL_HOST` | les mentions légales affichées sur `/legal` |

   En production, le serveur refuse de démarrer s'il manque `SESSION_SECRET`, `BASE_URL`, `CANONICAL_HOST`, `BREVO_API_KEY` ou `BREVO_SENDER_EMAIL`.
5. **HTTPS.** Dans *Web › SSL*, ajoute un certificat Let's Encrypt pour le domaine. Le site redirige tout vers `https://` + `CANONICAL_HOST`. HSTS et les cookies `Secure` sont activés.
6. **Base.** `npm run db:init` crée les tables (le serveur le fait aussi au démarrage).
7. **Démarrer.** Redémarre le site dans l'administration, puis ouvre le domaine.

## Domaine

Après l'achat : dans *Domaines › Ajouter*, puis ajoute l'adresse au site (*Web › Sites › Modifier › Adresses*). Mets à jour `CANONICAL_HOST` et `BASE_URL`, refais le certificat SSL, puis redémarre.

Dans Brevo, authentifie le domaine (enregistrements DKIM et DMARC) pour que les e-mails n'arrivent pas dans les indésirables.

## Mettre à jour

```bash
cd ~/lectype-web
git pull
npm install --omit=dev
```

Ensuite, redémarre le site dans l'administration. Les livres et histoires sont versionnés dans `content/` : `git pull` suffit.

## Sauvegardes

Les seules données à sauvegarder sont dans `DATA_DIR` :
- `lectype.db` : les comptes et la progression ;
- `sessions.db` : les sessions, qu'on peut perdre sans dommage.

AlwaysData fait des sauvegardes quotidiennes du compte. Pour une copie à la main, sans arrêter le site :

```bash
sqlite3 ~/lectype-data/lectype.db ".backup '/home/<compte>/lectype-backup.db'"
```

## Vérifier après chaque mise en ligne

- [ ] La page d'accueil répond en `https://` et `http://` redirige.
- [ ] Les en-têtes de sécurité sont là : `curl -sI https://<domaine>` doit montrer `strict-transport-security`, `content-security-policy` et `x-frame-options: DENY`.
- [ ] Inscription avec une vraie adresse : l'e-mail arrive, le lien confirme, la connexion marche.
- [ ] « Mot de passe oublié » : l'e-mail arrive.
- [ ] `/legal` affiche tes informations, et non « Information à compléter ».
