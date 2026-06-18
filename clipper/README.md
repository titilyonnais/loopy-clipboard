# Clipper

> **Le gestionnaire de presse-papiers que Windows aurait dû avoir.**
> Historique permanent · Recherche plein texte FTS5 · Catégories & tags · Coloration syntaxique · IA locale (Ollama).

Construit avec **Tauri 2 + Rust + React 18 + TypeScript + SQLite FTS5**.
Bundle Windows < 10 Mo. Aucune télémétrie. 100 % local.

---

## Fonctionnalités

- **Historique illimité** (configurable). Texte, code, URL, fichiers, **images**.
- **Recherche plein texte instantanée** via SQLite FTS5 (avec accents/diacritiques).
- **Détection automatique** du type : code (JSON, SQL, JS/TS, Rust, Python, HTML/CSS, Bash, …), URL, fichiers, texte.
- **Coloration syntaxique** (highlight.js, 200+ langages).
- **Catégories & tags** manuels (édition inline).
- **Épingler / favoris** — les épinglés ne sont jamais effacés par la limite.
- **Actions rapides** : copier · trim · lowercase · UPPERCASE · `JSON escape` · URL encode · Base64.
- **IA locale** via Ollama : résumer / expliquer / reformuler (texte & code). Aucune donnée ne quitte votre PC.
- **Raccourci global** configurable (par défaut `Ctrl+Shift+V`) pour afficher/cacher la fenêtre.
- **Tray icon** + démarrage avec Windows (optionnel).
- **Mica / Acrylic** Windows 11.
- **Navigation 100 % clavier** (↑ ↓ Enter Esc / Ctrl+F).
- **Mode clair / sombre / auto.**

---

## Marche à suivre — compiler un vrai installateur Windows

Vous avez le code source complet. Pour obtenir **un `.msi` ou un `.exe`** d'installation que Windows traitera comme n'importe quelle vraie application :

### 1. Pré-requis (à installer une seule fois sur votre PC Windows 11)

| Outil | Lien | Notes |
|---|---|---|
| **Node.js ≥ 20** | <https://nodejs.org/> | Inclut npm |
| **Yarn 1.x** | `npm install -g yarn` | |
| **Rust** | <https://www.rust-lang.org/tools/install> | Installer `rustup`, accepter les valeurs par défaut |
| **Microsoft C++ Build Tools** | <https://visualstudio.microsoft.com/visual-cpp-build-tools/> | Cocher *Desktop development with C++* — requis par Rust sur Windows |
| **WebView2 Runtime** | Préinstallé sur Windows 11 ✅ | Sinon : <https://developer.microsoft.com/microsoft-edge/webview2/> |
| **WiX Toolset v3** *(pour .msi)* | `cargo install cargo-wix` puis suivre les instructions, ou laisser Tauri le télécharger automatiquement | Optionnel — par défaut le NSIS .exe suffit |

> Sur Linux/macOS le build pour Windows nécessite un cross-compile, c'est plus simple sur Windows directement.

### 2. Récupérer le code

Copiez le dossier `/app/clipper/` sur votre machine Windows (par ex. `C:\dev\clipper`).

### 3. Installer les dépendances

```powershell
cd C:\dev\clipper
yarn install
```

### 4. Tester en mode développement (hot reload)

```powershell
yarn tauri:dev
```

La fenêtre Clipper s'ouvre. Vous pouvez modifier le code React / Rust et voir les changements à chaud.

### 5. Construire l'installateur (`.msi` + `.exe`)

```powershell
yarn tauri:build
```

Sortie après quelques minutes :

```
src-tauri/target/release/bundle/
├── msi/Clipper_1.0.0_x64_en-US.msi    ← installateur MSI
└── nsis/Clipper_1.0.0_x64-setup.exe   ← installateur NSIS
```

Vous pouvez **double-cliquer** sur l'un ou l'autre pour installer Clipper comme n'importe quelle application Windows. Elle apparaîtra :

- Dans le **menu Démarrer**
- Dans **Applications installées** (Paramètres → Applications)
- Lancement comme **Clipper.exe** depuis `C:\Program Files\Clipper\`

### 6. (Optionnel mais recommandé) Éviter les faux positifs antivirus

Les exécutables non signés peuvent déclencher SmartScreen ("L'éditeur n'a pas pu être vérifié") **sans être marqués comme virus**. Pour une installation 100 % silencieuse :

#### Option A — Signature avec un certificat code-signing (recommandée pour distribution)
1. Achetez un certificat **Authenticode** (SectigoCodeSign ~ 80 €/an, ou DigiCert).
2. Ajoutez ces variables d'environnement avant le build :
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY     = "chemin/vers/certificat.pfx"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "mot_de_passe_certif"
   ```
3. Relancez `yarn tauri:build`. L'installateur sera signé.

#### Option B — Soumettre votre exe à Microsoft (gratuit, mais lent)
- <https://www.microsoft.com/wdsi/filesubmission>
- Le SmartScreen apprend votre signature au fil des installations.

#### Option C — Mode développeur (pour vous seul)
- Sur votre PC : `clic droit → Propriétés → Débloquer` sur l'installateur.
- Ou cliquez `Plus d'informations → Exécuter quand même` au premier lancement.

### 7. (Optionnel) Activer l'IA locale

L'IA reste **100 % offline** :

1. Installez **Ollama** : <https://ollama.com/download>
2. Téléchargez un modèle léger :
   ```powershell
   ollama pull llama3.2:3b      # 2 Go, rapide
   # ou
   ollama pull qwen2.5:3b       # alternative excellente
   ```
3. Ollama tourne en tâche de fond. Clipper le détecte automatiquement (point vert dans la barre latérale).
4. Personnalisez l'URL/modèle dans **Paramètres**.

> Si Ollama n'est pas installé, les boutons IA sont simplement désactivés — l'app reste 100 % fonctionnelle.

---

## Architecture

```
clipper/
├── src/                       # Frontend React + TypeScript
│   ├── App.tsx                # Layout principal
│   ├── components/            # SearchBar, Sidebar, ClipListItem, Preview, Settings
│   ├── lib/api.ts             # Bridge typé vers Rust (invoke)
│   ├── lib/utils.ts           # Helpers
│   ├── types.ts               # Types partagés
│   └── styles.css             # Tailwind + design system
└── src-tauri/                 # Backend Rust (Tauri 2)
    ├── src/
    │   ├── main.rs            # Entry point
    │   ├── lib.rs             # Setup app, tray, raccourci global
    │   ├── db.rs              # SQLite + FTS5 + migrations
    │   ├── clipboard_monitor.rs  # Polling presse-papiers + détection type
    │   ├── ai.rs              # Ollama (résumé/explication/reformulation)
    │   ├── commands.rs        # Tauri commands (API exposée au frontend)
    │   └── models.rs          # Types Rust
    ├── tauri.conf.json        # Config bundling (MSI/NSIS, fenêtre, tray)
    └── icons/                 # Icônes générées
```

**Schéma SQLite** (créé automatiquement au premier lancement) :

- Table `clips` : `id, kind, content, preview, language, category, tags, pinned, favorite, source_app, size_bytes, hash, created_at, used_at, use_count`
- Table virtuelle FTS5 `clips_fts` synchronisée via triggers — recherche < 5 ms même avec 100 000 entrées
- Table `settings` : préférences JSON

Stockage : `%APPDATA%\com.clipper.app\clipper.db`

---

## Raccourcis clavier

| Touche | Action |
|---|---|
| `Ctrl+Shift+V` (global) | Afficher / masquer Clipper |
| `↑` / `↓` | Naviguer dans la liste |
| `Enter` | Copier et masquer |
| `Esc` | Masquer Clipper |
| `Ctrl+F` ou `/` | Focus recherche |

---

## Sécurité & vie privée

- **Aucune connexion réseau** sortante (sauf `localhost:11434` si vous activez Ollama).
- Toutes les données sont stockées localement dans `%APPDATA%\com.clipper.app\`.
- Code source ouvert, auditable.
- Pas d'analytics, pas de tracking.

---

## License

MIT — utilisation libre, personnelle et commerciale.
