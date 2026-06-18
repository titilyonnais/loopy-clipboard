# Clipper — Notes de version

## v1.1.0 (2026-01)

### 🐛 Corrections
- **Light mode complet** : refonte avec CSS variables — toutes les surfaces (panneaux, cartes, bordures, scrollbars, syntax highlighting, glass effects) suivent maintenant le thème. Plus de texte noir sur fond noir.
- **Icône clavier corrigée** : remplacement de l'icône `⌘` (Apple) par `Ctrl` dans la barre de recherche sur toutes les plateformes.
- **Copie depuis l'Explorateur Windows** : ajout du support natif `CF_HDROP` via `clipboard-win`. Les fichiers et dossiers copiés via clic droit → Copier s'enregistrent désormais correctement dans Clipper, et un collage les remet dans l'Explorateur avec leur format de fichier d'origine.

### ✨ Nouvelles fonctionnalités

#### Stockage permanent garanti
La base SQLite est dans `%APPDATA%\com.clipper.app\clipper.db`. Elle persiste :
- ✅ Redémarrages
- ✅ Mises à jour de Clipper
- ✅ Mises en veille / arrêts forcés (mode WAL)

Le panneau **Paramètres → Stockage local** affiche en temps réel : nombre d'éléments, épinglés, taille totale et le chemin du fichier.

#### Auto-suppression configurable
**Paramètres → Rétention de l'historique** :
- Presets : Jamais · 1 jour · 7 jours · 30 jours · 90 jours · 1 an · personnalisé
- Tourne automatiquement toutes les heures en arrière-plan
- Bouton **Nettoyer maintenant** pour forcer le passage

**Exclusions garanties :**
- 📌 **Épinglés** — toujours conservés (verrouillé, c'est la promesse de l'app)
- ⭐ **Favoris** — conservés par défaut, activable/désactivable

#### Vue Calendrier
Nouvelle section dans la barre latérale pour parcourir l'historique par période :
- Aujourd'hui · Hier · Cette semaine · Ce mois · Cette année

Tous les filtres se combinent : ex. "Cette semaine + Code + catégorie Travail".

#### Vue Populaires 🔥
Clic sur **Populaires** dans la sidebar → tri par `use_count` décroissant. Permet de retrouver instantanément les snippets/textes que tu utilises tout le temps (les *power moves* de ton clipboard).

#### Endpoint histogramme (API future)
Une commande Rust `get_histogram(days)` est exposée pour générer un graphe d'activité (clips/jour). Prête pour une future vue analytics graphique.

### 🛠 Code
- 0 erreur, 0 warning sur `cargo check --release`
- TypeScript strict, build Vite OK
- CSS du thème centralisé via `rgb(var(--ink-XXX) / <alpha-value>)` — la palette ink est désormais dynamique
