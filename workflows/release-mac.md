# Publier une version de l'app Mac

Le bouton « Télécharger pour Mac » de `/download` pointe vers
`https://github.com/Henri-Maximilien-Boedt/Lectype_web/releases/latest/download/Lectype.dmg` :
la dernière Release GitHub qui contient un fichier nommé exactement `Lectype.dmg`.

1. Dans le dépôt `Lectype`, augmente la version si besoin (Xcode › cible Lectype › General › Version et Build).
2. Construis le DMG :

   ```bash
   cd ../Lectype && ./tools/make_dmg.sh
   ```

   Le script compile l'app en Release (puces Apple et Intel), la signe en ad hoc sans droit de débogage, vérifie la signature et crée `dist/Lectype.dmg`. Il travaille dans un dossier temporaire, parce qu'iCloud Drive ajoute aux fichiers de `Documents` des métadonnées qui cassent la signature.
3. Sur GitHub, dans Lectype_web : *Releases › Draft a new release*.
   - Tag : `mac-v<version>`, par exemple `mac-v1.0`.
   - Glisse `dist/Lectype.dmg` dans la zone des fichiers. Ne le renomme pas.
   - *Publish release*.
4. Vérifie : le bouton de `lectype.eu/download` télécharge bien la nouvelle version.

Le dépôt Lectype_web doit rester **public**, sinon le téléchargement échoue pour les visiteurs. Pour héberger le DMG ailleurs, mets son adresse dans la variable `MAC_DOWNLOAD_URL`.

L'app n'est pas notarisée (pas de compte Apple Developer) : au premier lancement, macOS demande une confirmation dans *Réglages Système › Confidentialité et sécurité › Ouvrir quand même*. La page `/download` l'explique. Avec un compte Apple Developer, il faudra signer avec un certificat Developer ID et notariser l'app dans ce script.
