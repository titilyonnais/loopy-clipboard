# PRD — Clipper

## Problème
Construire une application Windows 11 native moderne : gestionnaire de presse-papiers puissant avec historique permanent, recherche plein texte, catégories, et IA locale. Installable via .msi / .exe, ne déclenchant pas les antivirus, avec une interface moderne minimaliste.

## Stack
- **Tauri 2** (Rust + WebView)
- **Frontend** : React 18 + TypeScript + Vite 6 + Tailwind 3 + framer-motion + highlight.js + lucide-react
- **Backend Rust** : SQLite (rusqlite + FTS5) · arboard + clipboard-win (Windows CF_HDROP) · reqwest (Ollama) · tokio · sha2 · image
- **Plugins Tauri** : global-shortcut, clipboard-manager, autostart, single-instance, notification, dialog, opener, tray-icon

## Status
✅ **MVP + iteration 1.1 livrée.** Compile sans erreur ni warning (Rust + TS).

## Fonctionnalités (à jour)
### Capture
- [x] Texte (avec dédup SHA-256)
- [x] Images (PNG, base64)
- [x] **Fichiers depuis l'Explorateur Windows (CF_HDROP)** ← iter 1.1
- [x] URLs (détection auto)
- [x] Code avec détection langage (JSON, SQL, JS/TS, Rust, Python, HTML/CSS, Bash, XML…)

### UI
- [x] Sidebar : Bibliothèque (Tout / Épinglés / Favoris / Populaires)
- [x] **Sidebar : Calendrier (Aujourd'hui / Hier / Semaine / Mois / Année)** ← iter 1.1
- [x] Sidebar : Types + Catégories dynamiques
- [x] Recherche plein texte FTS5 instantanée
- [x] Preview avec coloration syntaxique
- [x] **Preview pour fichiers** (liste avec icônes, chemins) ← iter 1.1
- [x] Mode dark / light / auto
- [x] **Light mode entièrement fonctionnel via CSS variables** ← fix iter 1.1
- [x] **Ctrl au lieu de ⌘ (fix Windows)** ← fix iter 1.1
- [x] Animations soignées, grain texture, glass effects

### Actions
- [x] Copier / Trim / lower / UPPER / JSON escape / URL encode / Base64
- [x] **Copier fichiers → Explorateur via write CF_HDROP** ← iter 1.1
- [x] Épingler / Favoris / Tags / Catégorie
- [x] IA locale (Ollama) : résumer / expliquer / reformuler

### Storage & rétention
- [x] SQLite WAL dans `%APPDATA%/com.clipper.app/clipper.db` (persistant)
- [x] **Auto-suppression configurable** (jamais / 1j / 7j / 30j / 90j / 1an / custom) ← iter 1.1
- [x] **Exclusions** : épinglés (toujours), favoris (toggle) ← iter 1.1
- [x] **Cleanup auto toutes les heures + bouton manuel "Nettoyer maintenant"** ← iter 1.1
- [x] Limite max d'éléments (en plus de la rétention)
- [x] **Stats stockage temps réel dans Settings** ← iter 1.1
- [x] **Histogramme d'activité (API exposée)** ← iter 1.1

### System
- [x] Tray icon + menu
- [x] Raccourci global configurable (Ctrl+Shift+V)
- [x] Single-instance
- [x] Autostart Windows
- [x] Hide on close (résident dans le tray)
- [x] Bundle MSI + NSIS

## Architecture
```
clipper/
├── src/                         (React + TS)
│   ├── App.tsx                  (états filter, timeRange, sort, theme)
│   ├── components/
│   │   ├── SearchBar.tsx        (Ctrl F)
│   │   ├── Sidebar.tsx          (Bibliothèque + Calendrier + Types + Catégories)
│   │   ├── ClipListItem.tsx
│   │   ├── Preview.tsx          (image + file list + code/text + AI)
│   │   └── Settings.tsx         (storage stats + retention + theme + Ollama)
│   ├── lib/api.ts               (typed Tauri bridge)
│   ├── types.ts                 (ClipItem, Settings, TimeRange, SortMode…)
│   └── styles.css               (CSS variables: --ink-50..950, --accent)
└── src-tauri/
    └── src/
        ├── lib.rs               (setup + scheduler cleanup horaire)
        ├── db.rs                (FTS5 + time_range_bounds + cleanup_expired + histogram)
        ├── clipboard_monitor.rs (Files→Image→Text, write_files Windows)
        ├── ai.rs                (Ollama health/summarize/explain/rephrase)
        ├── commands.rs          (cleanup_now, get_histogram, …)
        └── models.rs            (Settings.auto_delete_days, ListParams.time_range/sort)
```

## Backlog (P1+)
- [ ] Graph d'activité visuel basé sur `get_histogram`
- [ ] Snippets paramétrés ({{date}}, {{cursor}})
- [ ] OCR sur images
- [ ] Détection auto des secrets (auto-flag sensible)
- [ ] Drag-and-drop vers l'extérieur
- [ ] Export/import JSON

## Iteration 1.7 — UX lancement Windows (2026-02)
- [x] `launch_at_startup` désormais relié au plugin autostart (enable/disable sur l'OS quand le toggle change + sync au démarrage)
- [x] Fenêtre affichée au premier plan au lancement manuel ; reste cachée si lancée via Windows (flag `--minimized`)
- [x] `skipTaskbar: true` → un seul logo (system tray uniquement), plus de doublon dans la barre des tâches
