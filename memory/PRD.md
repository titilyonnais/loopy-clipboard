# PRD — Clipper

## Problème
Construire une application Windows 11 native moderne : gestionnaire de presse-papiers puissant avec historique permanent, recherche plein texte, catégories, et IA locale. Installable via .msi / .exe, ne déclenchant pas les antivirus, avec une interface moderne et minimaliste.

## Stack
- **Tauri 2** (Rust + WebView) — bundle Windows ~5–10 Mo, faux positifs antivirus minimaux
- **Frontend** : React 18 + TypeScript + Vite 6 + Tailwind 3 + framer-motion + highlight.js + lucide-react
- **Backend Rust** : SQLite (rusqlite + FTS5) · arboard (clipboard) · reqwest (Ollama) · tokio · sha2
- **Plugins Tauri** : global-shortcut, clipboard-manager, autostart, single-instance, notification, dialog, opener, tray-icon

## Architecture
```
clipper/
├── src/                         (Frontend)
│   ├── App.tsx                  Layout + navigation clavier
│   ├── components/              SearchBar, Sidebar, ClipListItem, Preview, Settings
│   ├── lib/api.ts               Bridge typé vers commandes Tauri
│   ├── types.ts                 Types partagés
│   └── styles.css               Design system (ink + lime accent + grain)
└── src-tauri/                   (Backend Rust)
    ├── src/
    │   ├── lib.rs               Setup tray, raccourci global, fenêtre
    │   ├── db.rs                SQLite + FTS5 + triggers
    │   ├── clipboard_monitor.rs Polling 500ms + classification (texte/code/url/image/fichier)
    │   ├── ai.rs                Ollama (résumé, explication, reformulation)
    │   ├── commands.rs          API exposée (#[tauri::command])
    │   └── models.rs
    ├── tauri.conf.json          Config MSI + NSIS + tray + Mica/Acrylic
    └── icons/                   PNG + ICO multi-tailles
```

## Stockage
- Base : `%APPDATA%/com.clipper.app/clipper.db` (SQLite + WAL)
- FTS5 avec `unicode61 remove_diacritics 2` → recherche fluide avec/sans accents
- Triggers AI/AD/AU maintiennent l'index automatiquement
- Déduplication via SHA-256 (clés `t:` pour texte, `i:` pour images)
- Settings stockées en JSON dans table `settings`

## Fonctionnalités implémentées
- [x] Historique illimité (configurable, 0 = ∞)
- [x] Recherche plein texte FTS5 instantanée + prefix matching
- [x] Détection auto type : texte / code (JSON, SQL, JS/TS, Rust, Python, HTML/CSS, Bash) / URL / fichier / image
- [x] Coloration syntaxique (highlight.js)
- [x] Aperçu image (PNG base64)
- [x] Catégories (manuelles, édition inline)
- [x] Tags (CSV inline)
- [x] Épingler / Favoris
- [x] Actions rapides : copier, trim, lower/UPPER, JSON escape, URL encode, Base64
- [x] IA locale via Ollama : résumer / expliquer / reformuler (health-check toutes 30 s)
- [x] Raccourci global configurable (par défaut `Ctrl+Shift+V`)
- [x] Tray icon (clic gauche = toggle, menu = ouvrir/pause/quitter)
- [x] Single-instance lock (relance focus l'instance)
- [x] Démarrage avec Windows (plugin autostart)
- [x] Hide on close (l'app reste résidente dans le tray)
- [x] Navigation 100% clavier (↑↓ Enter Esc Ctrl+F)
- [x] Mode clair / sombre / auto
- [x] Window effects : Mica / Acrylic (Windows 11)
- [x] Schema CSP strict
- [x] Bundle MSI + NSIS configuré (FR/EN)

## Marche à suivre déploiement
Voir README.md — section "Marche à suivre — compiler un vrai installateur Windows".

## Backlog / Améliorations futures (P1+)
- [ ] Drag-and-drop d'éléments vers l'extérieur
- [ ] Synchronisation chiffrée multi-PC (P2P, optionnelle)
- [ ] OCR sur images copiées (tesseract local)
- [ ] Détection de mots de passe → auto-flag "sensible" (jamais loggé)
- [ ] Templates / snippets (insertion paramétrée)
- [ ] Export / import CSV / JSON
- [ ] Workflow rules (auto-tag par regex)

## Décisions techniques
- **Polling 500 ms** plutôt que listeners Win32 natifs — portable, robuste, faible coût CPU.
- **Stockage des images en base64 dans SQLite** — simple, atomique. Pour > 100 Mo total, migrer vers blob+filesystem.
- **Pas de telemetry/analytics** — différenciateur UX et de confiance.
- **Plugin global-shortcut natif** — fonctionne sans privilèges admin.

## Statut
✅ **MVP complet et compilable.** Code Rust validé via `cargo check --release` (0 erreur, 0 warning). Frontend validé via `tsc --noEmit && vite build`. UI rendue OK en mode dev (screenshot validé).

L'application est prête à être compilée sur une machine Windows 11 (instructions détaillées dans README.md).
