mod ai;
mod clipboard_monitor;
mod commands;
mod db;
mod files;
mod models;

use crate::commands::AppState;
use crate::db::Db;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus existing window if user runs again
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
                let _ = w.unminimize();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    builder
        .setup(|app| {
            // Resolve app data dir for SQLite
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            std::fs::create_dir_all(&data_dir).ok();
            let db_path = data_dir.join("clipper.db");
            let db = Arc::new(Db::open(db_path).expect("failed to open database"));

            // Load settings, start monitor
            let settings = db.get_settings().unwrap_or_default();
            let monitor = clipboard_monitor::start_monitor(
                app.handle().clone(),
                db.clone(),
                settings.monitor_paused,
            );

            app.manage(AppState {
                db: db.clone(),
                monitor: monitor.clone(),
            });

            // Tray icon
            build_tray(app.handle())?;

            // Register global shortcut
            register_shortcut(app.handle(), &settings.shortcut);

            // Schedule periodic cleanup of expired entries (every hour).
            // Also runs immediately on startup for instant feedback.
            {
                let db_cleanup = db.clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        let cfg = db_cleanup.get_settings().unwrap_or_default();
                        if cfg.auto_delete_days > 0 {
                            if let Ok(n) = db_cleanup.cleanup_expired(
                                cfg.auto_delete_days,
                                cfg.keep_favorites,
                                cfg.keep_pinned,
                            ) {
                                if n > 0 {
                                    log::info!("cleaned {n} expired clip(s)");
                                }
                            }
                        }
                        tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
                    }
                });
            }

            // First-launch UX: show window if no history yet
            if let Some(w) = app.get_webview_window("main") {
                let total: i64 = db.stats().map(|s| s.total).unwrap_or(0);
                if total == 0 {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_clips,
            commands::get_clip,
            commands::copy_to_clipboard,
            commands::copy_as,
            commands::toggle_pin,
            commands::toggle_favorite,
            commands::update_tags,
            commands::update_category,
            commands::delete_clip,
            commands::clear_all,
            commands::cleanup_now,
            commands::check_paths,
            commands::read_image_b64,
            commands::get_histogram,
            commands::get_stats,
            commands::list_categories,
            commands::list_tags,
            commands::get_settings,
            commands::set_settings,
            commands::pause_monitor,
            commands::hide_window,
            commands::ai_health,
            commands::ai_summarize,
            commands::ai_explain,
            commands::ai_rephrase,
        ])
        .on_window_event(|window, event| {
            // Hide on close instead of quitting (tray app)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Ouvrir Clipper", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause/Reprendre la capture", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &pause, &quit])?;

    TrayIconBuilder::with_id("main")
        .tooltip("Clipper")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => toggle_main_window(app, true),
            "pause" => {
                if let Some(state) = app.try_state::<AppState>() {
                    let cur = state.db.get_settings().unwrap_or_default().monitor_paused;
                    let mut s = state.db.get_settings().unwrap_or_default();
                    s.monitor_paused = !cur;
                    let _ = state.db.set_settings(&s);
                    let _ = state.monitor.paused_tx.send(s.monitor_paused);
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_main_window(app, false);
            }
        })
        .build(app)?;
    Ok(())
}

fn toggle_main_window(app: &AppHandle, force_show: bool) {
    if let Some(w) = app.get_webview_window("main") {
        if force_show {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
            let _ = app.emit("window:show", ());
            return;
        }
        match w.is_visible() {
            Ok(true) => {
                let _ = w.hide();
            }
            _ => {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
                let _ = app.emit("window:show", ());
            }
        }
    }
}

fn register_shortcut(app: &AppHandle, accelerator: &str) {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let shortcut: Shortcut = match accelerator.parse() {
        Ok(s) => s,
        Err(_) => {
            // Fallback to Ctrl+Shift+V if invalid
            "Ctrl+Shift+V".parse().unwrap()
        }
    };
    let app_clone = app.clone();
    let res = gs.on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            toggle_main_window(&app_clone, false);
        }
    });
    if let Err(e) = res {
        log::warn!("Failed to register shortcut {accelerator}: {e}");
    }
}
