use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize)]
struct BoardInfo {
    name: String,
    path: String,
    last_modified: u64,
    element_count: usize,
}

#[tauri::command]
fn ensure_board_dir() -> Result<String, String> {
    if let Some(doc_dir) = dirs::document_dir() {
        let board_dir = doc_dir.join("RecallBoard").join("boards");
        fs::create_dir_all(&board_dir).map_err(|e| e.to_string())?;
        Ok(board_dir.to_string_lossy().to_string())
    } else {
        Err("Could not find Documents directory".to_string())
    }
}

#[tauri::command]
fn save_board(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let tmp_path = path.with_extension("excalidraw.tmp");
    fs::write(&tmp_path, content).map_err(|e| e.to_string())?;
    if fs::rename(&tmp_path, &path).is_err() {
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn load_board(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_boards() -> Result<Vec<BoardInfo>, String> {
    let doc_dir = dirs::document_dir().ok_or("Could not find Documents directory")?;
    let board_dir = doc_dir.join("RecallBoard").join("boards");

    if !board_dir.exists() {
        return Ok(vec![]);
    }

    let mut boards = vec![];
    for entry in fs::read_dir(&board_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("excalidraw") {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let last_modified = metadata
                .modified()
                .map_err(|e| e.to_string())?
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_secs();

            let content = fs::read_to_string(&path).unwrap_or_default();
            let element_count =
                if let Ok(scene) = serde_json::from_str::<serde_json::Value>(&content) {
                    scene
                        .get("elements")
                        .and_then(|e| e.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0)
                } else {
                    0
                };

            boards.push(BoardInfo {
                name: path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                last_modified,
                element_count,
            });
        }
    }

    boards.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(boards)
}

#[tauri::command]
fn delete_board(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_board(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            ensure_board_dir,
            save_board,
            load_board,
            list_boards,
            delete_board,
            rename_board,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
