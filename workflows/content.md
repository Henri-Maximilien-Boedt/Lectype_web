# Mettre à jour les livres et les histoires

Le contenu vient du dépôt `Lectype` (l'app Mac), placé à côté de celui-ci.

1. Dans `Lectype`, régénère le contenu avec ses scripts (`tools/import_books.py`, `tools/import_stories.py`…).
2. Ici :

   ```bash
   npm run content:sync
   ```

   La commande copie `Content/Books`, `Content/Covers` et `Content/Stories` dans `content/`. Elle construit aussi `content/index.json` et les listes de mots des leçons (`content/words/<langue>.json`), et copie les cas de test partagés du moteur de frappe.
3. Lance `npm test`, vérifie dans le navigateur, puis committe `content/`.

Pour lire le contenu ailleurs : `LECTYPE_CONTENT_DIR=/chemin/vers/Content npm run content:sync`.
