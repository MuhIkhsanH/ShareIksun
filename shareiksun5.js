const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode-terminal');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 5000;
const SERVER_FOLDER = 'server_folder';
const PASTE_FOLDER = 'paste_folder';
const DELETE_PASSWORD = 'iksun*';
const SETTINGS_PASSWORD = 'iksun*';
const SETTINGS_FILE = 'settings.json';
const TEXT_DB_FILE = 'database.txt';
const NOTES_DB_FILE = 'notes_db.json';
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

if (!fs.existsSync(SERVER_FOLDER)) fs.mkdirSync(SERVER_FOLDER);
if (!fs.existsSync(PASTE_FOLDER)) fs.mkdirSync(PASTE_FOLDER);

// ----------------------------------------------------
// UI ICONS (SVG) - didefinisikan sekali di server,
// lalu dipakai di HTML & dikirim ke script client lewat JSON.
// ----------------------------------------------------
const ICONS = {
    gear: '<svg class="ico" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    lock: '<svg class="ico" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
    lockOpen: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>',
    trash: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    download: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    paste: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>'
};

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ----------------------------------------------------
// HITUNG UKURAN (file sharing + paste sharing digabung)
// ----------------------------------------------------
function folderSize(dir) {
    let total = 0;
    try {
        fs.readdirSync(dir).forEach(f => {
            try {
                const st = fs.statSync(path.join(dir, f));
                if (st.isFile()) total += st.size;
            } catch {}
        });
    } catch {}
    return total;
}

function getTotalSize() {
    return folderSize(SERVER_FOLDER) + folderSize(PASTE_FOLDER);
}

function loadSettings() {
    const defaultSettings = { maxFileSizeMB: 50, maxServerSizeMB: 1024, maxTextSizeMB: 1 };
    if (fs.existsSync(SETTINGS_FILE)) {
        try { 
            const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); 
            return { ...defaultSettings, ...data };
        } catch {}
    }
    return defaultSettings;
}

function saveSettings(data) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// Multi-note database management & backward compatibility migration
function loadNotes() {
    if (fs.existsSync(NOTES_DB_FILE)) {
        try {
            const notes = JSON.parse(fs.readFileSync(NOTES_DB_FILE, 'utf8'));
            if (Array.isArray(notes) && notes.length > 0) return notes;
        } catch {}
    }
    // Migration from database.txt if notes_db.json doesn't exist
    let initialText = '';
    if (fs.existsSync(TEXT_DB_FILE)) {
        try { initialText = fs.readFileSync(TEXT_DB_FILE, 'utf8'); } catch {}
    }
    const defaultNotes = [
        {
            id: 'note_' + Date.now(),
            title: 'Catatan Utama',
            content: initialText,
            locked: false,
            updatedAt: Date.now()
        }
    ];
    saveNotes(defaultNotes);
    return defaultNotes;
}

function saveNotes(notes) {
    fs.writeFileSync(NOTES_DB_FILE, JSON.stringify(notes, null, 2));
    // Keep database.txt synced with first note content for backwards compatibility
    if (notes.length > 0) {
        try { fs.writeFileSync(TEXT_DB_FILE, notes[0].content); } catch {}
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SERVER_FOLDER),
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, originalName);
    }
});

function getUpload() {
    const settings = loadSettings();
    return multer({
        storage,
        limits: { fileSize: settings.maxFileSizeMB * 1024 * 1024 }
    });
}

// Storage khusus paste: nama disimpan sebagai  <timestamp>_<rand>__<namaAsli>
// supaya paste berulang dengan nama sama (mis. image.png) tidak saling menimpa.
const pasteStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTE_FOLDER),
    filename: (req, file, cb) => {
        let name = Buffer.from(file.originalname, 'latin1').toString('utf8');
        name = path.basename(name).replace(/[\x00-\x1f]/g, '').trim() || 'file';
        if (name.length > 150) {
            const ext = path.extname(name).slice(0, 20);
            name = name.slice(0, 150 - ext.length) + ext;
        }
        cb(null, Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '__' + name);
    }
});

function getPasteUpload() {
    const settings = loadSettings();
    return multer({
        storage: pasteStorage,
        limits: { fileSize: settings.maxFileSizeMB * 1024 * 1024 }
    });
}

function pasteDisplayName(stored) {
    const i = stored.indexOf('__');
    return i >= 0 ? stored.slice(i + 2) : stored;
}

function resolvePastePath(id) {
    const safe = path.basename(String(id));
    const p = path.resolve(PASTE_FOLDER, safe);
    const base = path.resolve(PASTE_FOLDER);
    if (!p.startsWith(base + path.sep)) return null;
    return p;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function getIcon(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // ZZZ / Techwear SVG Icons
    const svgMusic = `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    const svgVideo = `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;
    const svgImage = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
    const svgDoc = `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    const svgCode = `<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;
    const svgArchive = `<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>`;
    const svgApp = `<svg viewBox="0 0 24 24"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H7v-2h4v2zm4-4H7V9h8v2z"/></svg>`; 
    const svgWeb = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
    const svgDefault = `<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>`;

    const map = {
        '.mp3': svgMusic, '.flac': svgMusic, '.ogg': svgMusic, '.wav': svgMusic, '.aac': svgMusic,
        '.mp4': svgVideo, '.mkv': svgVideo, '.webm': svgVideo, '.mov': svgVideo, '.avi': svgVideo,
        '.jpg': svgImage, '.jpeg': svgImage, '.png': svgImage, '.gif': svgImage, '.webp': svgImage, '.svg': svgImage, '.bmp': svgImage,
        '.pdf': svgDoc, '.doc': svgDoc, '.docx': svgDoc, '.xls': svgDoc, '.xlsx': svgDoc, '.csv': svgDoc, '.ppt': svgDoc, '.pptx': svgDoc, '.txt': svgDoc, '.odt': svgDoc,
        '.zip': svgArchive, '.rar': svgArchive, '.7z': svgArchive, '.tar': svgArchive, '.gz': svgArchive,
        '.js': svgCode, '.ts': svgCode, '.json': svgCode, '.py': svgCode, '.sh': svgCode, '.bat': svgCode,
        '.html': svgWeb, '.css': svgWeb, '.php': svgWeb, '.sql': svgCode,
        '.apk': svgApp, '.exe': svgApp, '.bin': svgApp,
    };
    return map[ext] || svgDefault;
}

app.get('/', (req, res) => {
    const settings = loadSettings();
    fs.readdir(SERVER_FOLDER, (err, files) => {
        if (err) return res.status(500).send('Gagal membaca folder');

        let totalSizeBytes = 0;
        const fileData = files.map(file => {
            try {
                const stat = fs.statSync(path.join(SERVER_FOLDER, file));
                totalSizeBytes += stat.size;
                return { name: file, size: formatSize(stat.size), mtime: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs, iconSvg: getIcon(file) };
            } catch {
                return { name: file, size: '?', mtime: '', mtimeMs: 0, iconSvg: getIcon(file) };
            }
        }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

        // Ukuran paste sharing ikut dihitung ke kapasitas server
        totalSizeBytes += folderSize(PASTE_FOLDER);

        let maxMtime = 0;
        if (fileData.length > 0) {
            maxMtime = Math.max(...fileData.map(f => f.mtimeMs));
        }
        let textMtime = 0;
        try { if (fs.existsSync(NOTES_DB_FILE)) textMtime = fs.statSync(NOTES_DB_FILE).mtimeMs; } catch {}
        const initialState = { fileCount: fileData.length, maxMtime, settings, totalSizeBytes, textMtime, fileData };
        // Aman dari </script> di dalam nama file
        const initialStateJson = JSON.stringify(initialState).replace(/</g, '\\u003c');

        const totalSizeFormatted = formatSize(totalSizeBytes);
        const serverMaxFormatted = settings.maxServerSizeMB >= 1024 ? (settings.maxServerSizeMB / 1024).toFixed(1) + ' GB' : settings.maxServerSizeMB + ' MB';
        const serverUsagePct = Math.min((totalSizeBytes / (settings.maxServerSizeMB * 1024 * 1024)) * 100, 100);
        const isServerFull = serverUsagePct >= 100;

        const lastFile = fileData.length > 0 ? fileData[0] : null;

        // Kotak kapasitas dipakai di tab File & tab Paste (di-update lewat JS)
        const capacityHtml = `<div class="box" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 0.9rem; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">SERVER_CAPACITY</span>
                    <strong class="cap-text" style="font-size: 0.95rem; color: ${isServerFull ? '#ff4500' : '#ccff00'}; font-family: monospace; white-space: nowrap;">[ ${totalSizeFormatted} / ${serverMaxFormatted} ]</strong>
                </div>
                <div style="width: 100%; height: 6px; background: #222; overflow: hidden; position: relative;">
                    <div class="cap-bar" style="width: ${serverUsagePct}%; height: 100%; background: ${serverUsagePct > 90 ? '#ff4500' : '#ccff00'}; transition: width 0.3s; box-shadow: 0 0 10px ${serverUsagePct > 90 ? '#ff4500' : '#ccff00'};"></div>
                </div>
            </div>`;

        res.send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>ShareIksun</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; width: 100%; }
        /* ZZZ Tech Aesthetic */
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #080808; color: #eaeaea; padding: 16px 12px; min-height: 100vh; background-image: linear-gradient(rgba(204, 255, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(204, 255, 0, 0.03) 1px, transparent 1px); background-size: 30px 30px; }
        @media (min-width: 768px) { body { padding: 24px 16px; } }

        /* Inline SVG icons */
        .ico { width: 1.1em; height: 1.1em; fill: currentColor; vertical-align: middle; flex-shrink: 0; }

        .app-container { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; width: 100%; }
        header { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px; background: transparent; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative; }
        header::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100px; height: 2px; background: #ccff00; }
        @media (min-width: 768px) { header { flex-direction: row; align-items: baseline; gap: 16px; } }
        header h1 { font-size: 1.8rem; color: #fff; font-weight: 800; font-style: italic; letter-spacing: -1px; text-transform: uppercase; }
        @media (min-width: 768px) { header h1 { font-size: 2.5rem; } }
        .nav-btn { background: transparent; color: #ccff00; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px; text-transform: uppercase; padding: 6px 12px; border: 1px solid #ccff00; cursor: pointer; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .nav-btn:hover, .nav-btn.active-nav { background: #ccff00; color: #000; box-shadow: 0 0 10px rgba(204,255,0,0.5); }
        .nav-container { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; width: 100%; }
        @media (min-width: 768px) { .nav-container { margin-top: 0; margin-left: auto; width: auto; } }
        .main-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; width: 100%; }
        @media (min-width: 768px) { .main-layout { grid-template-columns: 320px minmax(0, 1fr); gap: 24px; } }
        .box { background: #121212; border: 1px solid #2a2a2a; padding: 20px; position: relative; overflow: hidden; }
        .box::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #2a2a2a; transition: background 0.3s; }
        .box:hover::before { background: #ccff00; }
        @media (min-width: 768px) { .box { padding: 24px; } }
        .box h2 { font-size: 1.1rem; color: #fff; margin-bottom: 20px; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px; }
        
        /* Upload Area Fix - Clickable Box */
        .upload-area { border: 1px dashed #444; padding: 32px 16px; text-align: center; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.3s; position: relative; user-select: none; }
        .upload-area:hover, .upload-area.drag-over { background: rgba(204, 255, 0, 0.05); border-color: #ccff00; box-shadow: 0 0 15px rgba(204, 255, 0, 0.1); }
        .upload-area * { pointer-events: none; }
        .upload-area input[type="file"] { pointer-events: auto !important; position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; display: block; }
        .upload-area .upload-icon { font-size: 2.5rem; opacity: 0.8; margin-bottom: 8px; }
        .upload-area .upload-label { font-size: 1rem; color: #fff; margin-top: 8px; font-weight: 700; letter-spacing: 0.5px; }
        .upload-area .upload-hint { font-size: 0.8rem; color: #888; margin-top: 6px; }
        
        #selected-files { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; min-height: 18px; }
        .file-tag { background: #1a1a1a; color: #ccc; border: 1px solid #333; font-size: 0.85rem; display: flex; flex-direction: column; max-width: 100%; overflow: hidden; }
        .file-tag-content { display: flex; align-items: center; gap: 6px; padding: 6px 12px; }
        .file-tag-content > span.tag-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .file-tag-pct { font-size: 0.8rem; font-weight: 700; color: #ccff00; margin-left: 4px; display: none; }
        .file-tag button { background: none; border: none; color: #ff4500; cursor: pointer; font-size: 1.2rem; line-height: 1; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; pointer-events: auto; }
        .file-tag button:hover { color: #fff; background: #ff4500; }
        .file-tag button:disabled { cursor: not-allowed; opacity: 0.5; }
        .file-prog-container { height: 2px; background: #333; width: 100%; display: none; }
        .file-prog-bar { height: 100%; width: 0%; background: #ccff00; transition: width 0.2s, background 0.2s; box-shadow: 0 0 8px #ccff00; }
        button.upload-btn { display: block; width: 100%; margin-top: 16px; padding: 12px; background: #ccff00; color: #000; border: none; font-size: 1rem; cursor: pointer; transition: all 0.2s; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 1px; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
        button.upload-btn:hover { background: #e6ff00; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(204,255,0,0.3); }
        button.upload-btn:active { transform: translateY(0); }
        button.upload-btn:disabled { background: #333; color: #666; cursor: not-allowed; box-shadow: none; transform: none; clip-path: none; }
        #notification, #pasteNotice { margin-top: 16px; padding: 12px 16px; font-size: 0.9rem; display: none; font-weight: 600; font-family: monospace; border-left: 4px solid; }
        .notif-success { background: rgba(204,255,0,0.1); color: #ccff00; border-color: #ccff00; }
        .notif-error { background: rgba(255,69,0,0.1); color: #ff4500; border-color: #ff4500; }
        #last-upload { font-size: 0.85rem; color: #aaa; margin-top: 16px; padding: 12px 16px; background: #161616; border-left: 2px solid #ccff00; display: ${lastFile ? 'block' : 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        button.settings-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 1px solid #444; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; color: #ccc; font-weight: 700; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; }
        button.settings-btn:hover { background: #fff; color: #000; border-color: #fff; }
        #searchInput { width: 100%; padding: 12px 16px; border: 1px solid #333; font-size: 0.95rem; outline: none; font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; transition: all 0.2s; }
        #searchInput:focus { border-color: #ccff00; box-shadow: 0 0 10px rgba(204,255,0,0.1); }
        #searchInput::placeholder { color: #555; }
        
        ul#fileList { list-style: none; padding: 0; min-height: 200px; }
        ul#fileList li { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #222; margin-bottom: 8px; background: #161616; transition: all 0.2s; border-left: 3px solid transparent; gap: 12px; }
        ul#fileList li:hover { background: #1a1a1a; border-color: #333; border-left-color: #ccff00; transform: translateX(4px); }
        .file-info { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
        .file-icon { width: 44px; height: 44px; border-radius: 50%; background: #000; border: 4px solid #333; position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: border-color 0.15s ease-out; }
        .file-icon::after { content: ''; position: absolute; top: -5px; left: -5px; right: -5px; bottom: -5px; border-radius: 50%; border: 1px solid transparent; transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out; pointer-events: none; }
        .file-icon svg { width: 22px; height: 22px; fill: #aaa; transition: fill 0.15s ease-out; z-index: 1; }
        ul#fileList li:hover .file-icon { border-color: #444; }
        ul#fileList li:hover .file-icon::after { border-color: #ccff00; box-shadow: inset 0 0 0 1px #ccff00, 0 0 8px rgba(204,255,0,0.3); }
        ul#fileList li:hover .file-icon svg { fill: #ccff00; }
        .file-meta { display: flex; flex-direction: column; min-width: 0; }
        a.file-name { color: #fff; text-decoration: none; font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block; margin-bottom: 4px; transition: color 0.2s; }
        a.file-name:hover { color: #ccff00; }
        .file-size { font-size: 0.8rem; color: #888; font-family: monospace; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        a.preview-link { color: #ccff00; text-decoration: none; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; border: 1px solid #ccff00; padding: 2px 6px; border-radius: 2px; transition: all 0.2s; margin-left: 0; }
        a.preview-link:hover { background: #ccff00; color: #000; box-shadow: 0 0 8px rgba(204,255,0,0.4); }
        button.del-btn { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; color: #666; font-size: 1.2rem; cursor: pointer; padding: 6px; transition: all 0.2s; flex-shrink: 0; border-radius: 4px; }
        button.del-btn:hover { color: #ff4500; border-color: #ff4500; background: rgba(255,69,0,0.1); }
        
        /* Pagination Controls Styling */
        .pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a2a2a; flex-wrap: wrap; gap: 12px; }
        .page-info { font-family: monospace; font-size: 0.8rem; color: #888; font-weight: 600; }
        .page-nav { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .page-btn { background: #161616; color: #ccc; border: 1px solid #333; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; font-family: monospace; cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { background: #222; border-color: #ccff00; color: #ccff00; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #222; color: #555; }
        .page-number-btn { background: #121212; color: #888; border: 1px solid #2a2a2a; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-family: monospace; cursor: pointer; transition: all 0.2s; font-weight: 700; }
        .page-number-btn:hover { border-color: #555; color: #fff; }
        .page-number-btn.active { background: #ccff00; color: #000; border-color: #ccff00; box-shadow: 0 0 10px rgba(204,255,0,0.4); }

        /* ---------- PASTE SHARING ---------- */
        .paste-layout { display: none; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; width: 100%; }
        @media (min-width: 768px) { .paste-layout { grid-template-columns: 320px minmax(0, 1fr); gap: 24px; } }
        .paste-zone { border: 1px dashed #444; padding: 36px 16px; text-align: center; background: rgba(255,255,255,0.02); transition: all 0.3s; outline: none; user-select: none; }
        .paste-zone:hover, .paste-zone:focus, .paste-zone.drag-over { background: rgba(204, 255, 0, 0.05); border-color: #ccff00; box-shadow: 0 0 15px rgba(204, 255, 0, 0.1); }
        .paste-zone .paste-big-icon { color: #ccff00; opacity: 0.85; margin-bottom: 8px; display: flex; justify-content: center; }
        .paste-zone .paste-big-icon .ico { width: 2.6em; height: 2.6em; }
        .paste-zone .upload-label { font-size: 1rem; color: #fff; margin-top: 8px; font-weight: 700; letter-spacing: 0.5px; }
        .paste-zone .upload-hint { font-size: 0.8rem; color: #888; margin-top: 6px; line-height: 1.5; }
        .kbd { display: inline-block; font-family: monospace; font-weight: 700; color: #ccff00; border: 1px solid #ccff00; padding: 1px 8px; margin: 0 2px; background: rgba(204,255,0,0.08); }
        .paste-pick-btn { margin-top: 16px; background: transparent; color: #ccff00; border: 1px solid #ccff00; padding: 8px 14px; font-weight: 700; font-size: 0.8rem; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .paste-pick-btn:hover { background: #ccff00; color: #000; box-shadow: 0 0 10px rgba(204,255,0,0.5); }

        /* Khusus HP / layar sentuh: tombol TEMPEL + kotak ketuk-lama */
        .mobile-only { display: none; }
        .paste-mobile-btn { display: none; margin-top: 14px; width: 100%; align-items: center; justify-content: center; gap: 8px; background: #ccff00; color: #000; border: none; padding: 14px; font-size: 1rem; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
        .paste-mobile-btn:active { background: #e6ff00; }
        .paste-mobile-btn .ico { width: 1.3em; height: 1.3em; }
        @media (hover: none) and (pointer: coarse) {
            .mobile-only { display: block; }
            .desktop-only { display: none; }
            .paste-mobile-btn { display: flex; }
        }
        .paste-catcher { display: none; margin-top: 12px; min-height: 72px; border: 1px dashed #ccff00; background: #0a0a0a; color: #ccff00; padding: 16px; font-family: monospace; font-size: 0.85rem; text-align: center; outline: none; -webkit-user-select: text; user-select: text; word-break: break-all; }
        .paste-catcher:empty::before { content: attr(data-placeholder); color: #888; }

        .paste-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; min-height: 200px; align-content: start; }
        .paste-empty { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: #666; font-family: monospace; padding: 48px 12px; text-align: center; }
        .paste-card { background: #161616; border: 1px solid #222; position: relative; display: flex; flex-direction: column; transition: all 0.2s; overflow: hidden; }
        .paste-card:hover { border-color: #ccff00; transform: translateY(-2px); box-shadow: 0 4px 14px rgba(204,255,0,0.12); }
        .paste-card.selected { border-color: #ccff00; background: rgba(204,255,0,0.06); }
        .paste-card.pending { border-style: dashed; border-color: #555; }
        .paste-thumb { height: 110px; background: #0a0a0a; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #222; }
        .paste-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .paste-thumb svg { width: 44px; height: 44px; fill: #aaa; transition: fill 0.15s; }
        .paste-card:hover .paste-thumb svg { fill: #ccff00; }
        .paste-card.pending .paste-thumb svg { fill: #ccff00; }
        .paste-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .paste-name { color: #fff; font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none; display: block; }
        a.paste-name:hover { color: #ccff00; }
        .paste-meta { color: #888; font-size: 0.7rem; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .paste-check { position: absolute; top: 8px; left: 8px; z-index: 3; accent-color: #ccff00; transform: scale(1.25); cursor: pointer; }
        .paste-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; z-index: 3; }
        .paste-act { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(0,0,0,0.75); border: 1px solid #333; color: #bbb; cursor: pointer; transition: all 0.2s; text-decoration: none; padding: 0; }
        .paste-act:hover { color: #ccff00; border-color: #ccff00; }
        .paste-act.danger:hover { color: #ff4500; border-color: #ff4500; background: rgba(255,69,0,0.15); }
        
        /* Multi-Note Sidebar & Editor Styling */
        .notes-layout { display: flex; flex-direction: column; width: 100%; gap: 20px; }
        @media (min-width: 768px) { .notes-layout { flex-direction: row; min-height: 72vh; } }
        
        .notes-sidebar { width: 100%; background: #121212; border: 1px solid #2a2a2a; padding: 20px; display: flex; flex-direction: column; gap: 16px; position: relative; }
        @media (min-width: 768px) { .notes-sidebar { width: 320px; flex-shrink: 0; } }
        
        .notes-sidebar-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a2a; padding-bottom: 12px; gap: 8px; }
        .notes-sidebar-title { font-size: 0.9rem; color: #fff; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .new-note-btn { background: #ccff00; color: #000; border: none; padding: 6px 12px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); flex-shrink: 0; }
        .new-note-btn:hover { background: #e6ff00; box-shadow: 0 0 10px rgba(204,255,0,0.4); }
        
        .notes-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 250px; flex: 1; padding-right: 4px; }
        @media (min-width: 768px) { .notes-list { max-height: calc(72vh - 100px); } }
        
        .note-item { background: #161616; border: 1px solid #222; border-left: 3px solid transparent; padding: 12px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .note-item:hover { background: #1c1c1c; border-color: #333; border-left-color: rgba(204,255,0,0.5); transform: translateX(2px); }
        .note-item.active { background: rgba(204,255,0,0.06); border-color: #333; border-left: 3px solid #ccff00; }
        .note-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .note-item-title { color: #ddd; font-weight: 700; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .note-item.active .note-item-title { color: #ccff00; }
        .note-item-date { color: #666; font-size: 0.72rem; font-family: monospace; }
        .note-lock-badge { color: #ff4500; margin-left: 6px; display: inline-flex; vertical-align: middle; }
        .note-lock-badge .ico { width: 0.85em; height: 0.85em; }

        /* Tombol kunci catatan */
        .note-lock-btn { background: #161616; border: 1px solid #333; color: #888; padding: 4px 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; border-radius: 4px; flex-shrink: 0; }
        .note-lock-btn:hover { border-color: #ccff00; color: #ccff00; background: #1f1f1f; }
        .note-lock-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .note-lock-btn.is-locked { background: rgba(255, 69, 0, 0.15); border-color: #ff4500; color: #ff4500; box-shadow: 0 0 8px rgba(255, 69, 0, 0.3); }
        .note-lock-btn.is-locked:hover { background: rgba(255, 69, 0, 0.25); color: #fff; }
        
        .note-item-del { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: #555; cursor: pointer; padding: 4px 8px; transition: all 0.2s; border-radius: 4px; opacity: 0.7; }
        .note-item-del .ico { width: 1.25em; height: 1.25em; }
        .note-item-del:hover { color: #ff4500; background: rgba(255,69,0,0.15); opacity: 1; }
        
        .notes-editor-box { flex: 1; background: #121212; border: 1px solid #2a2a2a; padding: 20px; display: flex; flex-direction: column; min-height: 500px; position: relative; }
        @media (min-width: 768px) { .notes-editor-box { padding: 24px; } }
        
        .editor-header { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #2a2a2a; padding-bottom: 16px; }
        @media (min-width: 600px) { .editor-header { flex-direction: row; justify-content: space-between; align-items: center; } }
        
        .editor-title-container { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .editor-title-prefix { color: #ccff00; font-weight: 800; font-size: 1.2rem; font-family: monospace; }
        .editor-title-input { background: transparent; border: none; border-bottom: 1px dashed #333; color: #fff; font-size: 1.2rem; font-weight: 800; width: 100%; outline: none; padding: 4px 0; font-family: 'Plus Jakarta Sans', sans-serif; transition: border-color 0.2s; }
        .editor-title-input:focus { border-bottom-color: #ccff00; }
        .editor-title-input:disabled { cursor: not-allowed; opacity: 0.6; }
        
        .editor-status-bar { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .sync-badge { font-family: monospace; font-size: 0.75rem; font-weight: 700; color: #ccff00; background: rgba(204,255,0,0.1); border: 1px solid rgba(204,255,0,0.3); padding: 4px 10px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
        .sync-badge.saving { color: #ffaa00; background: rgba(255,170,0,0.1); border-color: rgba(255,170,0,0.3); }
        .sync-badge.error { color: #ff4500; background: rgba(255,69,0,0.1); border-color: rgba(255,69,0,0.3); }
        
        #textData { flex: 1; width: 100%; min-height: 400px; background: #0a0a0a; color: #ccff00; border: 1px solid #333; padding: 20px; font-family: monospace; font-size: 1rem; line-height: 1.6; resize: none; outline: none; transition: border 0.3s; }
        #textData:focus { border-color: #ccff00; box-shadow: inset 0 0 10px rgba(204,255,0,0.05); }
        #textData:disabled { cursor: not-allowed; opacity: 0.6; }
        #textData.is-locked { color: #ff8a65; border-color: rgba(255,69,0,0.5); }

        /* Overlays */
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
        .overlay.show { display: flex; }
        .overlay-box { background: #111; border: 1px solid #333; padding: 32px 24px; width: 340px; text-align: center; position: relative; }
        .overlay-box::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: #ccff00; }
        .overlay-box.error-box::before { background: #ff4500; }
        .overlay-box h3 { font-size: 1.2rem; margin-bottom: 12px; font-weight: 800; font-style: italic; text-transform: uppercase; color: #fff; letter-spacing: 1px; }
        .overlay-box p { font-size: 0.9rem; color: #aaa; margin-bottom: 20px; word-break: break-all; }
        .overlay-box input[type="password"], .overlay-box input[type="number"] { width: 100%; padding: 12px; border: 1px solid #444; font-size: 1rem; margin-bottom: 16px; outline: none; text-align: center; font-family: monospace; background: #0a0a0a; color: #ccff00; transition: border 0.2s; }
        .overlay-box input:focus { border-color: #ccff00; }
        .overlay-error { font-size: 0.85rem; color: #ff4500; background: rgba(255,69,0,0.1); padding: 8px; border: 1px solid #ff4500; margin-bottom: 16px; display: none; font-family: monospace; }
        .overlay-btns { display: flex; gap: 12px; }
        .overlay-btns button { flex: 1; padding: 10px; border: none; font-size: 0.95rem; cursor: pointer; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }
        .btn-cancel { background: #333; color: #aaa; }
        .btn-cancel:hover { background: #444; color: #fff; }
        .btn-danger { background: rgba(255,69,0,0.2); color: #ff4500; border: 1px solid #ff4500; clip-path: none; }
        .btn-danger:hover { background: #ff4500; color: #000; box-shadow: 0 0 10px rgba(255,69,0,0.5); }
        .btn-primary { background: #ccff00; color: #000; }
        .btn-primary:hover { background: #e6ff00; box-shadow: 0 0 10px rgba(204,255,0,0.5); }
        @media (max-width: 480px) { .overlay-box { width: 90%; } }
    </style>
</head>
<body>
<div class="app-container">
    <header>
        <h1 style="display: flex; align-items: center; gap: 12px;">
            <svg width="0.9em" height="0.9em" viewBox="0 0 24 24" style="fill: #ccff00;"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zM19 15.91v-6.7l-6 3.37v6.71l6-3.38z"/></svg>
            ShareIksun
        </h1>
        <div class="nav-container">
            <button id="nav-file" class="nav-btn active-nav" onclick="switchTab('file')">Local File Sharing</button>
            <button id="nav-text" class="nav-btn" onclick="switchTab('text')">Local Text Sharing</button>
            <button id="nav-paste" class="nav-btn" onclick="switchTab('paste')">Paste Sharing</button>
        </div>
    </header>

    <!-- File sharing layout -->
    <div class="main-layout">
        <aside class="left-panel" style="display: flex; flex-direction: column; gap: 24px;">
            ${capacityHtml}

            <div class="box">
                <h2 style="margin-bottom: 20px;">
                    <span><span style="color: #ccff00;">//</span> UPLOAD_FILES</span>
                    <span style="font-weight:600;color:#666;font-size:0.75rem;font-family:monospace;border:1px solid #444;padding:2px 6px;letter-spacing:0;">MAX ${settings.maxFileSizeMB} MB</span>
                </h2>
                <form id="uploadForm" enctype="multipart/form-data">
                    <div class="upload-area" id="dropZone" onclick="triggerFileInput(event)">
                        <input type="file" name="files" id="fileInput" multiple />
                        <div class="upload-icon"><svg width="1.5em" height="1.5em" viewBox="0 0 24 24" style="fill: #ccff00;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg></div>
                        <div class="upload-label">CLICK OR DRAG FILES HERE</div>
                        <div class="upload-hint">All file types allowed</div>
                    </div>
                    <div id="selected-files"></div>
                    <button type="submit" class="upload-btn" id="uploadBtn" disabled>START UPLOAD</button>
                    <div id="notification"></div>
                </form>
                <div id="last-upload" style="display: ${lastFile ? 'block' : 'none'};">
                    <span style="font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">LATEST_UPLOAD:</span><br>
                    <strong style="color: #fff; font-size: 0.9rem; font-family: monospace;">${lastFile ? esc(lastFile.name) : '-'}</strong> 
                    <span style="color: #666; font-size: 0.8rem; font-family: monospace; margin-left: 8px;">[${lastFile ? lastFile.size : ''}]</span>
                </div>
            </div>
        </aside>

        <main class="right-panel">
            <div class="box" style="height: 100%; min-height: 500px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px;">
                    <h2 style="margin-bottom: 0; border: none; padding: 0;">
                        <span><span style="color: #ccff00;">//</span> FILE_DATABASE</span>
                        <span style="font-weight:700;color:#ccff00;font-size:0.8rem; margin-left: 12px; font-family: monospace; background: rgba(204,255,0,0.1); padding: 2px 6px; letter-spacing:0;" id="fileCountBadge">[ ${fileData.length} ] FILES</span>
                    </h2>
                    <button class="settings-btn" onclick="openSettings()">${ICONS.gear} SYSTEM_CONFIG</button>
                </div>
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <input type="text" id="searchInput" placeholder="SEARCH_DATABASE..." style="flex: 1; min-width: 200px;">
                    <button id="bulkDeleteBtn" onclick="confirmBulkDelete()" style="display: none; background: rgba(255,69,0,0.1); color: #ff4500; border: 1px solid #ff4500; padding: 0 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-transform: uppercase; font-family: monospace; letter-spacing:1px;">[X] DELETE (<span id="bulkCount">0</span>)</button>
                </div>
                <ul id="fileList" style="flex: 1;"></ul>
                
                <!-- Pagination Controls -->
                <div class="pagination-container" id="paginationControls">
                    <button id="prevPageBtn" onclick="changePage(-1)" class="page-btn">&laquo; PREV</button>
                    <div class="page-nav" id="pageNumbers"></div>
                    <div class="page-info" id="pageInfo">PAGE 1 / 1</div>
                    <button id="nextPageBtn" onclick="changePage(1)" class="page-btn">NEXT &raquo;</button>
                </div>
            </div>
        </main>
    </div>

    <!-- Paste sharing layout -->
    <div class="paste-layout">
        <aside class="paste-left" style="display: flex; flex-direction: column; gap: 24px;">
            ${capacityHtml}

            <div class="box">
                <h2 style="margin-bottom: 20px;">
                    <span><span style="color: #ccff00;">//</span> PASTE_ZONE</span>
                    <span style="font-weight:600;color:#666;font-size:0.75rem;font-family:monospace;border:1px solid #444;padding:2px 6px;letter-spacing:0;">MAX ${settings.maxFileSizeMB} MB</span>
                </h2>
                <div class="paste-zone" id="pasteZone" tabindex="0">
                    <div class="paste-big-icon">${ICONS.paste}</div>
                    <div class="upload-label desktop-only">TEKAN <span class="kbd">CTRL</span>+<span class="kbd">V</span></div>
                    <div class="upload-label mobile-only">TEMPEL DARI CLIPBOARD</div>
                    <div class="upload-hint desktop-only">Tempel gambar, screenshot, atau file (docx, pdf, zip, dll) yang sudah kamu copy. Langsung ter-upload otomatis.</div>
                    <div class="upload-hint mobile-only">Salin gambar atau file dulu, lalu tekan tombol TEMPEL di bawah. Langsung ter-upload otomatis.</div>
                    <button type="button" class="paste-pick-btn" onclick="document.getElementById('pasteFileInput').click()">ATAU PILIH FILE</button>
                </div>
                <button type="button" class="paste-mobile-btn" onclick="pasteFromButton()">${ICONS.paste} TEMPEL</button>
                <div class="paste-catcher" id="pasteCatcher" contenteditable="true" inputmode="none" spellcheck="false" data-placeholder="KETUK LAMA DI SINI, LALU PILIH TEMPEL"></div>
                <input type="file" id="pasteFileInput" multiple style="display: none;" />
                <div id="pasteNotice"></div>
            </div>
        </aside>

        <main class="paste-right">
            <div class="box" style="min-height: 500px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px;">
                    <h2 style="margin-bottom: 0; border: none; padding: 0;">
                        <span><span style="color: #ccff00;">//</span> PASTE_DATABASE</span>
                        <span style="font-weight:700;color:#ccff00;font-size:0.8rem; margin-left: 12px; font-family: monospace; background: rgba(204,255,0,0.1); padding: 2px 6px; letter-spacing:0;" id="pasteCountBadge">[ 0 ] ITEMS</span>
                    </h2>
                    <button id="pasteBulkBtn" onclick="confirmPasteBulkDelete()" style="display: none; background: rgba(255,69,0,0.1); color: #ff4500; border: 1px solid #ff4500; padding: 6px 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-transform: uppercase; font-family: monospace; letter-spacing:1px;">[X] DELETE (<span id="pasteBulkCount">0</span>)</button>
                </div>
                <div class="paste-grid" id="pasteGrid"></div>
            </div>
        </main>
    </div>

    <!-- Multi-Note Text sharing layout -->
    <div class="text-layout" style="display: none; width: 100%;">
        <div class="notes-layout">
            <!-- Left Sidebar: Note List -->
            <aside class="notes-sidebar">
                <div class="notes-sidebar-header">
                    <span class="notes-sidebar-title"><span style="color: #ccff00;">//</span> DAFTAR_CATATAN</span>
                    <button class="new-note-btn" onclick="createNewNote()" title="Butuh password">+ BARU</button>
                </div>
                <div class="notes-list" id="notesList">
                    <!-- Note items dynamically rendered -->
                </div>
            </aside>

            <!-- Right Main Editor Area -->
            <main class="notes-editor-box">
                <div class="editor-header">
                    <div class="editor-title-container">
                        <span class="editor-title-prefix">//</span>
                        <input type="text" id="noteTitleInput" class="editor-title-input" placeholder="Judul Catatan..." oninput="onNoteTitleInput()" />
                        <button type="button" id="noteLockBtn" class="note-lock-btn" onclick="openNoteLockModal()" title="Kunci / Buka Kunci Catatan">
                            <span id="noteLockIcon" style="display: flex; align-items: center;">${ICONS.lockOpen}</span>
                            <span id="noteLockLabel" style="font-size: 0.72rem; font-family: monospace; font-weight: 700; text-transform: uppercase;">UNLOCKED</span>
                        </button>
                    </div>
                    <div class="editor-status-bar">
                        <div class="sync-badge" id="syncStatus">
                            <span>&#9679;</span> <span id="syncStatusText">REALTIME SYNCED</span>
                        </div>
                        <button class="note-item-del" onclick="confirmDeleteCurrentNote()" title="Hapus Catatan Ini">${ICONS.trash}</button>
                    </div>
                </div>
                <textarea id="textData" placeholder="Ketik atau tempel catatan Anda di sini... (Otomatis tersimpan realtime)" oninput="onNoteContentInput()"></textarea>
            </main>
        </div>
    </div>
</div>

    <!-- Delete file overlay -->
    <div class="overlay" id="deleteOverlay">
        <div class="overlay-box">
            <h3><span style="color:#ff4500;">//</span> DELETE_FILE</h3>
            <p id="del-filename" style="font-family: monospace;"></p>
            <input type="password" id="del-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="del-error"></div>
            <div class="overlay-btns">
                <button class="btn-cancel" onclick="closeOverlay('deleteOverlay')">CANCEL</button>
                <button class="btn-danger" onclick="doDelete()">CONFIRM_DEL</button>
            </div>
        </div>
    </div>

    <!-- Delete paste overlay -->
    <div class="overlay" id="pasteDeleteOverlay">
        <div class="overlay-box error-box">
            <h3><span style="color:#ff4500;">//</span> DELETE_PASTE</h3>
            <p id="paste-del-name" style="font-family: monospace;"></p>
            <input type="password" id="paste-del-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="paste-del-error"></div>
            <div class="overlay-btns">
                <button class="btn-cancel" onclick="closeOverlay('pasteDeleteOverlay')">CANCEL</button>
                <button class="btn-danger" onclick="doPasteDelete()">CONFIRM_DEL</button>
            </div>
        </div>
    </div>

    <!-- Create note overlay (butuh password) -->
    <div class="overlay" id="createNoteOverlay">
        <div class="overlay-box">
            <h3><span style="color:#ccff00;">//</span> BARU_CATATAN</h3>
            <p style="font-family: monospace;">AUTHENTICATION_REQUIRED</p>
            <input type="password" id="create-note-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="create-note-error"></div>
            <div class="overlay-btns">
                <button class="btn-cancel" onclick="closeOverlay('createNoteOverlay')">CANCEL</button>
                <button class="btn-primary" onclick="doCreateNote()">CREATE</button>
            </div>
        </div>
    </div>

    <!-- Delete note overlay -->
    <div class="overlay" id="deleteNoteOverlay">
        <div class="overlay-box error-box">
            <h3><span style="color:#ff4500;">//</span> HAPUS_CATATAN</h3>
            <p id="del-notename" style="font-family: monospace;"></p>
            <input type="password" id="del-note-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="del-note-error"></div>
            <div class="overlay-btns" style="margin-top: 16px;">
                <button class="btn-cancel" onclick="closeOverlay('deleteNoteOverlay')">CANCEL</button>
                <button class="btn-danger" onclick="doDeleteNote()">CONFIRM_DEL</button>
            </div>
        </div>
    </div>

    <!-- Lock note overlay -->
    <div class="overlay" id="lockNoteOverlay">
        <div class="overlay-box">
            <h3><span style="color:#ccff00;">//</span> <span id="lock-overlay-action">LOCK</span>_CATATAN</h3>
            <p id="lock-notename" style="font-family: monospace;"></p>
            <input type="password" id="lock-note-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="lock-note-error"></div>
            <div class="overlay-btns">
                <button class="btn-cancel" onclick="closeOverlay('lockNoteOverlay')">CANCEL</button>
                <button class="btn-primary" onclick="doToggleNoteLock()">CONFIRM</button>
            </div>
        </div>
    </div>

    <!-- Settings overlay -->
    <div class="overlay" id="settingsOverlay">
        <div class="overlay-box">
            <h3><span style="color:#ccff00;">//</span> SYSTEM_CONFIG</h3>
            <p style="font-family: monospace;">AUTHENTICATION_REQUIRED</p>
            <input type="password" id="settings-password" placeholder="AUTH_PASSWORD" />
            <div class="overlay-error" id="settings-pw-error"></div>
            <div id="settings-pw-form">
                <div class="overlay-btns">
                    <button class="btn-cancel" onclick="closeOverlay('settingsOverlay')">CANCEL</button>
                    <button class="btn-primary" onclick="verifySettingsPassword()">ACCESS</button>
                </div>
            </div>
            <div id="settings-form" style="display:none;">
                <p style="margin-bottom:8px;font-size:0.85rem;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;">MAX_FILE_SIZE (MB)</p>
                <input type="number" id="settings-maxsize" min="1" max="10240" value="${settings.maxFileSizeMB}" />
                <p style="margin-top:16px; margin-bottom:8px;font-size:0.85rem;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;">MAX_TEXT_SIZE (MB)</p>
                <input type="number" id="settings-maxtext" min="1" max="10" value="${settings.maxTextSizeMB || 1}" />
                <p style="margin-top:16px; margin-bottom:8px;font-size:0.85rem;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;">SERVER_CAPACITY (MB)</p>
                <input type="number" id="settings-maxserver" min="1" value="${settings.maxServerSizeMB}" />
                <div class="overlay-error" id="settings-error"></div>
                <div class="overlay-btns">
                    <button class="btn-cancel" onclick="closeOverlay('settingsOverlay')">CANCEL</button>
                    <button class="btn-primary" onclick="doSaveSettings()">SAVE_CHANGES</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Error overlay -->
    <div class="overlay" id="errorOverlay">
        <div class="overlay-box error-box">
            <h3><span style="color:#ff4500;">//</span> SYSTEM_ERROR</h3>
            <p id="error-message" style="font-family: monospace; color: #ff4500; font-weight: 700; font-size: 0.95rem; line-height: 1.5; text-transform: uppercase;"></p>
            <div class="overlay-btns" style="margin-top: 24px;">
                <button class="btn-cancel" onclick="closeOverlay('errorOverlay')" style="width: 100%;">TUTUP</button>
            </div>
        </div>
    </div>

    <script>
        // Ikon SVG dari server (tanpa backtick supaya aman)
        const ICONS = ${JSON.stringify(ICONS)};

        function escapeHtml(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatSizeClient(b) {
            if (b < 1024) return b + ' B';
            if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
            if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
            return (b / 1073741824).toFixed(2) + ' GB';
        }

        function showError(msg) {
            document.getElementById('error-message').textContent = msg;
            document.getElementById('errorOverlay').classList.add('show');
        }

        const initialState = ${initialStateJson};
        let allFilesData = initialState.fileData || [];
        let currentPage = 1;
        const itemsPerPage = 10;
        let selectedBulkFiles = new Set();

        // Update bar kapasitas (dipakai tab File & tab Paste)
        function updateCapacityUI(total) {
            if (typeof total !== 'number') return;
            initialState.totalSizeBytes = total;
            const maxMB = initialState.settings.maxServerSizeMB;
            const pct = Math.min((total / (maxMB * 1024 * 1024)) * 100, 100);
            const maxLabel = maxMB >= 1024 ? (maxMB / 1024).toFixed(1) + ' GB' : maxMB + ' MB';
            document.querySelectorAll('.cap-text').forEach(el => {
                el.textContent = '[ ' + formatSizeClient(total) + ' / ' + maxLabel + ' ]';
                el.style.color = pct >= 100 ? '#ff4500' : '#ccff00';
            });
            const barColor = pct > 90 ? '#ff4500' : '#ccff00';
            document.querySelectorAll('.cap-bar').forEach(el => {
                el.style.width = pct + '%';
                el.style.background = barColor;
                el.style.boxShadow = '0 0 10px ' + barColor;
            });
        }

        // ----------------------------------------------------
        // PAGINATION & FILE LIST SYSTEM (10 Items per Page)
        // ----------------------------------------------------
        function getFilteredFiles() {
            const q = document.getElementById('searchInput').value.toLowerCase().trim();
            if (!q) return allFilesData;
            return allFilesData.filter(f => f.name.toLowerCase().includes(q));
        }

        function renderFileList() {
            const filtered = getFilteredFiles();
            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIdx = (currentPage - 1) * itemsPerPage;
            const endIdx = startIdx + itemsPerPage;
            const pageFiles = filtered.slice(startIdx, endIdx);

            const fileListEl = document.getElementById('fileList');
            if (pageFiles.length === 0) {
                fileListEl.innerHTML = '<li style="justify-content: center; color: #666; font-family: monospace; padding: 24px;">[ NO FILES FOUND ]</li>';
            } else {
                fileListEl.innerHTML = pageFiles.map(f => {
                    const dot = f.name.lastIndexOf('.');
                    const ext = dot >= 0 ? f.name.substring(dot).toLowerCase() : '';
                    let previewLink = '';
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                        previewLink = '<a href="/preview/' + encodeURIComponent(f.name) + '" target="_blank" rel="noopener noreferrer" class="preview-link">PREVIEW_IMG</a>';
                    } else if (ext === '.pdf') {
                        previewLink = '<a href="/preview/' + encodeURIComponent(f.name) + '" target="_blank" rel="noopener noreferrer" class="preview-link">PREVIEW_PDF</a>';
                    }
                    const isChecked = selectedBulkFiles.has(f.name) ? 'checked' : '';
                    const safeAttr = escapeHtml(f.name);
                    
                    return '<li>' +
                        '<div class="file-info">' +
                            '<input type="checkbox" class="file-checkbox" data-name="' + safeAttr + '" ' + isChecked + ' onchange="toggleBulkFile(this.dataset.name, this.checked)" style="margin-right: 14px; transform: scale(1.3); cursor: pointer; accent-color: #ccff00;" />' +
                            '<span class="file-icon">' + f.iconSvg + '</span>' +
                            '<div class="file-meta">' +
                                '<a href="/files/' + encodeURIComponent(f.name) + '" download class="file-name">' + safeAttr + '</a>' +
                                '<span class="file-size">' + f.size + previewLink + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<button class="del-btn" data-name="' + safeAttr + '" onclick="confirmDelete(this.dataset.name)" title="Hapus File">' + ICONS.trash + '</button>' +
                    '</li>';
                }).join('');
            }

            // Render Pagination Controls
            document.getElementById('pageInfo').textContent = 'PAGE ' + currentPage + ' / ' + totalPages + ' (' + totalItems + ' FILES)';
            document.getElementById('prevPageBtn').disabled = currentPage <= 1;
            document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;

            const pageNumbersEl = document.getElementById('pageNumbers');
            pageNumbersEl.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
                    if (i === 2 || i === totalPages - 1) {
                        const span = document.createElement('span');
                        span.textContent = '..';
                        span.style.color = '#555';
                        span.style.fontFamily = 'monospace';
                        pageNumbersEl.appendChild(span);
                    }
                    continue;
                }
                const btn = document.createElement('button');
                btn.className = 'page-number-btn' + (i === currentPage ? ' active' : '');
                btn.textContent = i;
                btn.onclick = () => { currentPage = i; renderFileList(); };
                pageNumbersEl.appendChild(btn);
            }
            
            updateBulkButtonUI();
        }

        function changePage(delta) {
            currentPage += delta;
            renderFileList();
        }

        function toggleBulkFile(filename, isChecked) {
            if (isChecked) selectedBulkFiles.add(filename);
            else selectedBulkFiles.delete(filename);
            updateBulkButtonUI();
        }

        function updateBulkButtonUI() {
            const btn = document.getElementById('bulkDeleteBtn');
            const count = document.getElementById('bulkCount');
            if (selectedBulkFiles.size > 0) {
                count.textContent = selectedBulkFiles.size;
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        }

        document.getElementById('searchInput').addEventListener('input', function() {
            currentPage = 1;
            renderFileList();
        });

        // Initialize File List rendering
        renderFileList();

        // Server state polling check (hanya saat tab File aktif)
        setInterval(async () => {
            if (!document.getElementById('nav-file').classList.contains('active-nav')) return;
            if (typeof selectedFilesArray !== 'undefined' && selectedFilesArray.length > 0) return;
            if (document.querySelector('.overlay.show')) return;
            try {
                const resp = await fetch('/api/state?t=' + Date.now());
                const state = await resp.json();
                updateCapacityUI(state.totalSizeBytes);

                if (state.fileCount !== initialState.fileCount || Math.floor(state.maxMtime) !== Math.floor(initialState.maxMtime)) {
                    location.reload();
                }
            } catch (e) {}
        }, 3000);

        // ----------------------------------------------------
        // UPLOAD BOX & CLICK FUNCTIONALITY
        // ----------------------------------------------------
        const fileInput = document.getElementById('fileInput');
        const selectedFilesDiv = document.getElementById('selected-files');
        const uploadBtn = document.getElementById('uploadBtn');
        const dropZone = document.getElementById('dropZone');
        let selectedFilesArray = [];

        function triggerFileInput(e) {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        }

        function validateFiles(newFiles) {
            let validFiles = [];
            let totalSelectedSize = selectedFilesArray.reduce((acc, f) => acc + f.size, 0);
            const maxSingleFileSize = initialState.settings.maxFileSizeMB * 1024 * 1024;
            const maxServerCapacity = initialState.settings.maxServerSizeMB * 1024 * 1024;
            let currentServerSize = initialState.totalSizeBytes;

            for (const file of newFiles) {
                if (file.size > maxSingleFileSize) {
                    showError('[ERROR] FILE "' + file.name + '" EXCEEDS THE MAX SIZE LIMIT OF ' + initialState.settings.maxFileSizeMB + ' MB!');
                    continue;
                }
                if (currentServerSize + totalSelectedSize + file.size > maxServerCapacity) {
                    showError('[ERROR] CANNOT ADD "' + file.name + '". SERVER CAPACITY (' + initialState.settings.maxServerSizeMB + ' MB) WILL BE EXCEEDED!');
                    continue;
                }
                validFiles.push(file);
                totalSelectedSize += file.size;
            }
            return validFiles;
        }

        fileInput.addEventListener('change', () => {
            const valid = validateFiles(Array.from(fileInput.files));
            selectedFilesArray = selectedFilesArray.concat(valid);
            updateFileInput();
            updateSelectedFilesUI();
        });

        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                const valid = validateFiles(Array.from(e.dataTransfer.files));
                selectedFilesArray = selectedFilesArray.concat(valid);
                updateFileInput();
                updateSelectedFilesUI();
            }
        });

        function removeFile(index) {
            selectedFilesArray.splice(index, 1);
            updateFileInput();
            updateSelectedFilesUI();
        }

        function updateFileInput() {
            const dt = new DataTransfer();
            selectedFilesArray.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
        }

        function updateSelectedFilesUI() {
            selectedFilesDiv.innerHTML = '';
            if (selectedFilesArray.length === 0) {
                uploadBtn.disabled = true;
                return;
            }
            selectedFilesArray.forEach((f, index) => {
                const tag = document.createElement('div');
                tag.className = 'file-tag';
                
                const content = document.createElement('div');
                content.className = 'file-tag-content';
                
                const span = document.createElement('span');
                span.className = 'tag-name';
                span.textContent = '[FILE] ' + f.name;
                span.title = f.name;
                
                const pct = document.createElement('span');
                pct.className = 'file-tag-pct';
                pct.id = 'pct-' + index;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.innerHTML = '&times;';
                btn.id = 'btn-del-' + index;
                btn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); removeFile(index); };
                
                content.appendChild(span);
                content.appendChild(pct);
                content.appendChild(btn);

                const progCont = document.createElement('div');
                progCont.className = 'file-prog-container';
                progCont.id = 'prog-cont-' + index;

                const progBar = document.createElement('div');
                progBar.className = 'file-prog-bar';
                progBar.id = 'prog-bar-' + index;

                progCont.appendChild(progBar);
                
                tag.appendChild(content);
                tag.appendChild(progCont);
                
                selectedFilesDiv.appendChild(tag);
            });
            uploadBtn.disabled = false;
        }

        const form = document.getElementById('uploadForm');
        const notifEl = document.getElementById('notification');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (selectedFilesArray.length === 0) return;
            notifEl.style.display = 'none';
            notifEl.className = '';
            uploadBtn.disabled = true;

            let successCount = 0;
            let failCount = 0;
            let lastErr = '';

            const uploadPromises = selectedFilesArray.map((file, index) => {
                return new Promise((resolve) => {
                    const btn = document.getElementById('btn-del-' + index);
                    const pctEl = document.getElementById('pct-' + index);
                    const progCont = document.getElementById('prog-cont-' + index);
                    const progBar = document.getElementById('prog-bar-' + index);

                    if (btn) btn.style.display = 'none';
                    if (pctEl) { pctEl.style.display = 'inline'; pctEl.textContent = '0%'; pctEl.style.color = '#ccff00'; }
                    if (progCont) progCont.style.display = 'block';
                    if (progBar) { progBar.style.width = '0%'; progBar.style.background = '#ccff00'; }

                    const fd = new FormData();
                    fd.append('files', file);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/upload');
                    xhr.upload.addEventListener('progress', e => {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            if (progBar) progBar.style.width = pct + '%';
                            if (pctEl) pctEl.textContent = pct + '%';
                        }
                    });
                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            successCount++;
                            if (pctEl) { pctEl.textContent = '[OK]'; pctEl.style.color = '#ccff00'; }
                            if (progBar) progBar.style.background = '#ccff00';
                        } else {
                            failCount++;
                            try { lastErr = JSON.parse(xhr.responseText).error || 'FAILED'; } catch { lastErr = 'FAILED'; }
                            if (pctEl) { pctEl.textContent = '[FAIL]'; pctEl.style.color = '#ff4500'; }
                            if (progBar) progBar.style.background = '#ff4500';
                        }
                        resolve();
                    };
                    xhr.onerror = () => {
                        failCount++;
                        lastErr = 'Koneksi gagal';
                        if (pctEl) { pctEl.textContent = '[FAIL]'; pctEl.style.color = '#ff4500'; }
                        if (progBar) progBar.style.background = '#ff4500';
                        resolve();
                    };
                    xhr.send(fd);
                });
            });

            await Promise.all(uploadPromises);
            uploadBtn.disabled = false;
            
            if (failCount === 0) {
                notifEl.className = 'notif-success';
                notifEl.textContent = '[OK] ALL FILES UPLOADED SUCCESSFULLY!';
                notifEl.style.display = 'block';
                document.getElementById('last-upload').style.display = 'block';
                setTimeout(() => location.reload(), 2000);
            } else {
                notifEl.className = 'notif-error';
                notifEl.textContent = '[WARN] ' + successCount + ' SUCCEEDED, ' + failCount + ' FAILED (' + lastErr + ')';
                notifEl.style.display = 'block';
            }
        });

        // Delete File functions
        function closeOverlay(id) {
            document.getElementById(id).classList.remove('show');
        }

        document.querySelectorAll('.overlay').forEach(o => {
            o.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
        });

        let pendingDelete = null;

        function confirmBulkDelete() {
            if (selectedBulkFiles.size === 0) return;
            pendingDelete = null;
            document.getElementById('del-filename').textContent = selectedBulkFiles.size + ' FILES SELECTED';
            document.getElementById('del-password').value = '';
            document.getElementById('del-error').style.display = 'none';
            document.getElementById('deleteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('del-password').focus(), 100);
        }

        function confirmDelete(filename) {
            pendingDelete = filename;
            document.getElementById('del-filename').textContent = filename;
            document.getElementById('del-password').value = '';
            document.getElementById('del-error').style.display = 'none';
            document.getElementById('deleteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('del-password').focus(), 100);
        }

        async function doDelete() {
            const pw = document.getElementById('del-password').value;
            const errEl = document.getElementById('del-error');
            if (!pw) { errEl.textContent = '[ERROR] PASSWORD REQUIRED!'; errEl.style.display = 'block'; return; }
            
            const payload = pendingDelete ? pendingDelete : Array.from(selectedBulkFiles);

            const resp = await fetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: payload, password: pw })
            });
            const data = await resp.json();
            if (data.success) { 
                closeOverlay('deleteOverlay'); 
                if (data.message) alert(data.message);
                location.reload(); 
            }
            else { errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!'); errEl.style.display = 'block'; document.getElementById('del-password').value = ''; document.getElementById('del-password').focus(); }
        }
        document.getElementById('del-password').addEventListener('keydown', e => { if (e.key === 'Enter') doDelete(); });

        // Settings Overlay functions
        function openSettings() {
            document.getElementById('settings-password').value = '';
            document.getElementById('settings-pw-error').style.display = 'none';
            document.getElementById('settings-error').style.display = 'none';
            document.getElementById('settings-form').style.display = 'none';
            document.getElementById('settings-pw-form').style.display = 'block';
            document.getElementById('settingsOverlay').classList.add('show');
            setTimeout(() => document.getElementById('settings-password').focus(), 100);
        }

        async function verifySettingsPassword() {
            const pw = document.getElementById('settings-password').value;
            const errEl = document.getElementById('settings-pw-error');
            if (!pw) { errEl.textContent = '[ERROR] PASSWORD REQUIRED!'; errEl.style.display = 'block'; return; }
            const resp = await fetch('/settings/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw })
            });
            const data = await resp.json();
            if (data.success) {
                errEl.style.display = 'none';
                document.getElementById('settings-pw-form').style.display = 'none';
                document.getElementById('settings-form').style.display = 'block';
            } else {
                errEl.textContent = '[ERROR] INCORRECT PASSWORD!';
                errEl.style.display = 'block';
                document.getElementById('settings-password').value = '';
            }
        }

        async function doSaveSettings() {
            const val = parseInt(document.getElementById('settings-maxsize').value);
            const textVal = parseInt(document.getElementById('settings-maxtext').value);
            const serverVal = parseInt(document.getElementById('settings-maxserver').value);
            const errEl = document.getElementById('settings-error');
            if (!val || val < 1) { errEl.textContent = '[ERROR] MINIMUM FILE SIZE IS 1 MB'; errEl.style.display = 'block'; return; }
            if (!textVal || textVal < 1) { errEl.textContent = '[ERROR] MINIMUM TEXT SIZE IS 1 MB'; errEl.style.display = 'block'; return; }
            if (!serverVal || serverVal < 1) { errEl.textContent = '[ERROR] MINIMUM CAPACITY IS 1 MB'; errEl.style.display = 'block'; return; }
            const resp = await fetch('/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: document.getElementById('settings-password').value, maxFileSizeMB: val, maxTextSizeMB: textVal, maxServerSizeMB: serverVal })
            });
            const data = await resp.json();
            if (data.success) { closeOverlay('settingsOverlay'); location.reload(); }
            else { errEl.textContent = '[ERROR] ' + (data.error || 'FAILED TO SAVE'); errEl.style.display = 'block'; }
        }
        document.getElementById('settings-password').addEventListener('keydown', e => { if (e.key === 'Enter') verifySettingsPassword(); });

        // ----------------------------------------------------
        // TAB SWITCHING (File / Text / Paste)
        // ----------------------------------------------------
        function switchTab(tab) {
            const tabs = {
                file: ['nav-file', '.main-layout', 'grid'],
                text: ['nav-text', '.text-layout', 'flex'],
                paste: ['nav-paste', '.paste-layout', 'grid']
            };
            Object.keys(tabs).forEach(k => {
                const cfg = tabs[k];
                const on = (k === tab);
                document.getElementById(cfg[0]).classList.toggle('active-nav', on);
                document.querySelector(cfg[1]).style.display = on ? cfg[2] : 'none';
            });
            if (tab === 'text') initNotesSystem();
            if (tab === 'paste') {
                loadPasteList(true);
                startPasteTimer();
                const zone = document.getElementById('pasteZone');
                if (zone) zone.focus({ preventScroll: true });
            } else {
                stopPasteTimer();
            }
        }

        // ----------------------------------------------------
        // PASTE SHARING (Ctrl+V gambar / file -> kotak-kotak)
        // ----------------------------------------------------
        let pasteItems = [];
        let pasteSig = '';
        let pendingUploads = [];
        let inflightBytes = 0;
        let selectedPaste = new Set();
        let pasteDeleteTargets = [];
        let pasteTimer = null;
        let pasteNoticeTimer = null;

        function isPasteTabActive() {
            return document.getElementById('nav-paste').classList.contains('active-nav');
        }

        function startPasteTimer() {
            if (pasteTimer) return;
            pasteTimer = setInterval(() => {
                if (!isPasteTabActive()) return;
                loadPasteList(false);
            }, 3000);
        }

        function stopPasteTimer() {
            if (pasteTimer) { clearInterval(pasteTimer); pasteTimer = null; }
        }

        function showPasteNotice(msg, ok) {
            const el = document.getElementById('pasteNotice');
            el.className = ok ? 'notif-success' : 'notif-error';
            el.textContent = msg;
            el.style.display = 'block';
            clearTimeout(pasteNoticeTimer);
            pasteNoticeTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
        }

        async function loadPasteList(force) {
            try {
                const res = await fetch('/api/paste?t=' + Date.now());
                const data = await res.json();
                updateCapacityUI(data.totalSizeBytes);
                const sig = data.items.map(i => i.id + ':' + i.sizeBytes).join('|');
                if (force || sig !== pasteSig) {
                    pasteSig = sig;
                    pasteItems = data.items;
                    selectedPaste = new Set(Array.from(selectedPaste).filter(id => pasteItems.some(i => i.id === id)));
                    renderPasteGrid();
                }
            } catch (e) {}
        }

        function renderPasteGrid() {
            const grid = document.getElementById('pasteGrid');
            document.getElementById('pasteCountBadge').textContent = '[ ' + pasteItems.length + ' ] ITEMS';

            if (pasteItems.length === 0 && pendingUploads.length === 0) {
                grid.innerHTML = '<div class="paste-empty">[ BELUM ADA ITEM - TEKAN CTRL+V ATAU TOMBOL TEMPEL ]</div>';
                updatePasteBulkUI();
                return;
            }

            let html = '';

            // Kotak sementara (sedang upload)
            pendingUploads.forEach(u => {
                html += '<div class="paste-card pending">' +
                    '<div class="paste-thumb">' + ICONS.paste + '</div>' +
                    '<div class="paste-info">' +
                        '<span class="paste-name" title="' + escapeHtml(u.name) + '">' + escapeHtml(u.name) + '</span>' +
                        '<span class="paste-meta" id="pend-pct-' + u.tid + '">' + (u.failed ? '[FAIL] ' + escapeHtml(u.err) : u.pct + '%') + '</span>' +
                    '</div>' +
                    '<div class="file-prog-container" style="display:block;"><div class="file-prog-bar" id="pend-bar-' + u.tid + '" style="width:' + u.pct + '%;' + (u.failed ? 'background:#ff4500;box-shadow:none;' : '') + '"></div></div>' +
                '</div>';
            });

            // Kotak item yang sudah tersimpan
            pasteItems.forEach(it => {
                const sid = escapeHtml(it.id);
                const sname = escapeHtml(it.name);
                const isSel = selectedPaste.has(it.id);
                const enc = encodeURIComponent(it.id);
                const thumb = it.isImage
                    ? '<a href="/paste/view/' + enc + '" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;"><img loading="lazy" src="/paste/view/' + enc + '" alt=""></a>'
                    : it.iconSvg;

                html += '<div class="paste-card' + (isSel ? ' selected' : '') + '">' +
                    '<input type="checkbox" class="paste-check" data-id="' + sid + '" ' + (isSel ? 'checked' : '') + ' onchange="togglePasteSelect(this.dataset.id, this.checked)" />' +
                    '<div class="paste-actions">' +
                        '<a class="paste-act" href="/paste/file/' + enc + '" download title="Download">' + ICONS.download + '</a>' +
                        '<button type="button" class="paste-act danger" data-id="' + sid + '" onclick="confirmPasteDelete([this.dataset.id])" title="Hapus">' + ICONS.trash + '</button>' +
                    '</div>' +
                    '<div class="paste-thumb">' + thumb + '</div>' +
                    '<div class="paste-info">' +
                        '<a class="paste-name" href="/paste/file/' + enc + '" download title="' + sname + '">' + sname + '</a>' +
                        '<span class="paste-meta">' + it.size + ' | ' + formatNoteTime(it.mtimeMs) + '</span>' +
                    '</div>' +
                '</div>';
            });

            grid.innerHTML = html;
            updatePasteBulkUI();
        }

        function updatePendingUI(up) {
            const bar = document.getElementById('pend-bar-' + up.tid);
            const pct = document.getElementById('pend-pct-' + up.tid);
            if (bar) bar.style.width = up.pct + '%';
            if (pct) pct.textContent = up.pct + '%';
        }

        function togglePasteSelect(id, checked) {
            if (checked) selectedPaste.add(id);
            else selectedPaste.delete(id);
            renderPasteGrid();
        }

        function updatePasteBulkUI() {
            const btn = document.getElementById('pasteBulkBtn');
            document.getElementById('pasteBulkCount').textContent = selectedPaste.size;
            btn.style.display = selectedPaste.size > 0 ? 'block' : 'none';
        }

        // Nama untuk gambar hasil clipboard (biasanya "image.png")
        function pasteName(file) {
            const n = file.name || '';
            const m = /^image[.]([a-z0-9]+)$/i.exec(n);
            if (!n || m) {
                let ext = m ? m[1].toLowerCase() : ((file.type && file.type.split('/')[1]) || 'png');
                ext = ext.split('+')[0].replace('jpeg', 'jpg');
                const d = new Date();
                const p = x => String(x).padStart(2, '0');
                return 'paste_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + ext;
            }
            return n;
        }

        function uploadPasteFiles(fileList) {
            const arr = Array.from(fileList || []);
            if (!arr.length) return;
            const maxSingle = initialState.settings.maxFileSizeMB * 1024 * 1024;
            const maxServer = initialState.settings.maxServerSizeMB * 1024 * 1024;
            let reserved = 0;
            let accepted = 0;

            arr.forEach(file => {
                const name = pasteName(file);
                if (file.size === 0) {
                    showPasteNotice('[ERROR] "' + name + '" KOSONG / FOLDER TIDAK DIDUKUNG', false);
                    return;
                }
                if (file.size > maxSingle) {
                    showError('[ERROR] FILE "' + name + '" EXCEEDS THE MAX SIZE LIMIT OF ' + initialState.settings.maxFileSizeMB + ' MB!');
                    return;
                }
                if (initialState.totalSizeBytes + inflightBytes + reserved + file.size > maxServer) {
                    showError('[ERROR] CANNOT ADD "' + name + '". SERVER CAPACITY (' + initialState.settings.maxServerSizeMB + ' MB) WILL BE EXCEEDED!');
                    return;
                }
                reserved += file.size;
                accepted++;
                sendPasteFile(file, name);
            });

            if (accepted > 0) showPasteNotice('[OK] ' + accepted + ' ITEM DITEMPEL, MENGUNGGAH...', true);
        }

        function sendPasteFile(file, name) {
            const tid = 'u' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const up = { tid: tid, name: name, pct: 0, failed: false, err: '' };
            pendingUploads.push(up);
            inflightBytes += file.size;
            renderPasteGrid();

            const fd = new FormData();
            fd.append('files', file, name);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/paste/upload');
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) {
                    up.pct = Math.round((e.loaded / e.total) * 100);
                    updatePendingUI(up);
                }
            });

            const finish = async (ok) => {
                inflightBytes -= file.size;
                if (ok) {
                    await loadPasteList(true);
                    pendingUploads = pendingUploads.filter(u => u.tid !== tid);
                    renderPasteGrid();
                } else {
                    up.failed = true;
                    renderPasteGrid();
                    showPasteNotice('[ERROR] GAGAL: ' + up.err, false);
                    setTimeout(() => {
                        pendingUploads = pendingUploads.filter(u => u.tid !== tid);
                        renderPasteGrid();
                    }, 4000);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    finish(true);
                } else {
                    try { up.err = JSON.parse(xhr.responseText).error || 'FAILED'; } catch { up.err = 'FAILED'; }
                    finish(false);
                }
            };
            xhr.onerror = () => { up.err = 'Koneksi gagal'; finish(false); };
            xhr.send(fd);
        }

        // Ctrl+V di mana saja (selama tab Paste aktif & tidak sedang mengetik di input)
        // Juga menangani tempel dari kotak ketuk-lama (pasteCatcher) di HP.
        document.addEventListener('paste', function(e) {
            if (!isPasteTabActive()) return;
            const t = e.target;
            const isCatcher = Boolean(t && t.id === 'pasteCatcher');
            if (!isCatcher && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            const cd = e.clipboardData;
            if (!cd) return;

            let files = Array.from(cd.files || []);
            if (!files.length && cd.items) {
                for (const item of cd.items) {
                    if (item.kind === 'file') {
                        const f = item.getAsFile();
                        if (f) files.push(f);
                    }
                }
            }
            if (!files.length) {
                if (isCatcher) { e.preventDefault(); t.innerHTML = ''; }
                showPasteNotice('[WARN] CLIPBOARD TIDAK BERISI GAMBAR / FILE', false);
                return;
            }
            e.preventDefault();
            if (isCatcher) { t.innerHTML = ''; t.style.display = 'none'; }
            uploadPasteFiles(files);
        });

        // Tombol TEMPEL (khusus HP).
        // 1) Kalau Clipboard API tersedia (HTTPS / localhost) -> baca clipboard langsung.
        // 2) Kalau tidak (mis. http://192.168.x.x) atau izin ditolak -> tampilkan kotak ketuk-lama.
        async function pasteFromButton() {
            if (navigator.clipboard && navigator.clipboard.read && window.isSecureContext) {
                try {
                    const items = await navigator.clipboard.read();
                    const files = [];
                    for (const item of items) {
                        for (const type of item.types) {
                            if (type.indexOf('text/') === 0) continue;
                            const blob = await item.getType(type);
                            const ext = (type.split('/')[1] || 'bin').split('+')[0].replace('jpeg', 'jpg');
                            files.push(new File([blob], 'image.' + ext, { type: type }));
                        }
                    }
                    if (files.length) {
                        uploadPasteFiles(files);
                        return;
                    }
                    showPasteNotice('[WARN] CLIPBOARD TIDAK BERISI GAMBAR / FILE', false);
                    return;
                } catch (e) {
                    // izin ditolak / tidak didukung -> pakai kotak ketuk-lama
                }
            }
            openPasteCatcher();
        }

        function openPasteCatcher() {
            const c = document.getElementById('pasteCatcher');
            c.innerHTML = '';
            c.style.display = 'block';
            c.focus();
            showPasteNotice('[INFO] KETUK LAMA DI KOTAK, LALU PILIH TEMPEL', true);
        }

        // Drag & drop + pilih file (cadangan kalau Ctrl+V tidak tersedia)
        const pasteZone = document.getElementById('pasteZone');
        const pasteFileInput = document.getElementById('pasteFileInput');
        pasteZone.addEventListener('click', () => pasteZone.focus());
        pasteZone.addEventListener('dragover', e => { e.preventDefault(); pasteZone.classList.add('drag-over'); });
        pasteZone.addEventListener('dragleave', () => pasteZone.classList.remove('drag-over'));
        pasteZone.addEventListener('drop', e => {
            e.preventDefault();
            pasteZone.classList.remove('drag-over');
            if (e.dataTransfer && e.dataTransfer.files.length) uploadPasteFiles(e.dataTransfer.files);
        });
        pasteFileInput.addEventListener('change', () => {
            uploadPasteFiles(pasteFileInput.files);
            pasteFileInput.value = '';
        });

        // Hapus paste (pakai password)
        function confirmPasteDelete(ids) {
            if (!ids || !ids.length) return;
            pasteDeleteTargets = ids;
            let label;
            if (ids.length === 1) {
                const found = pasteItems.find(i => i.id === ids[0]);
                label = found ? found.name : ids[0];
            } else {
                label = ids.length + ' ITEMS SELECTED';
            }
            document.getElementById('paste-del-name').textContent = label;
            document.getElementById('paste-del-password').value = '';
            document.getElementById('paste-del-error').style.display = 'none';
            document.getElementById('pasteDeleteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('paste-del-password').focus(), 100);
        }

        function confirmPasteBulkDelete() {
            confirmPasteDelete(Array.from(selectedPaste));
        }

        async function doPasteDelete() {
            const pw = document.getElementById('paste-del-password').value;
            const errEl = document.getElementById('paste-del-error');
            if (!pw) { errEl.textContent = '[ERROR] PASSWORD REQUIRED!'; errEl.style.display = 'block'; return; }
            try {
                const resp = await fetch('/paste/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: pasteDeleteTargets, password: pw })
                });
                const data = await resp.json();
                if (data.success) {
                    closeOverlay('pasteDeleteOverlay');
                    pasteDeleteTargets.forEach(id => selectedPaste.delete(id));
                    pasteDeleteTargets = [];
                    if (data.message) showPasteNotice('[WARN] ' + data.message, false);
                    await loadPasteList(true);
                } else {
                    errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                    errEl.style.display = 'block';
                    document.getElementById('paste-del-password').value = '';
                    document.getElementById('paste-del-password').focus();
                }
            } catch (e) {
                errEl.textContent = '[ERROR] KONEKSI GAGAL';
                errEl.style.display = 'block';
            }
        }
        document.getElementById('paste-del-password').addEventListener('keydown', e => { if (e.key === 'Enter') doPasteDelete(); });

        // ----------------------------------------------------
        // MULTI-NOTE & REALTIME WEBSOCKET AUTO-SAVE SYSTEM
        // ----------------------------------------------------
        let notesList = [];
        let activeNoteId = null;
        let ws = null;
        let saveTimer = null;

        function getActiveNote() {
            return notesList.find(n => n.id === activeNoteId) || null;
        }

        function formatNoteTime(timestamp) {
            if (!timestamp) return '';
            const d = new Date(timestamp);
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + hours + ':' + mins;
        }

        function setSyncBadge(status) {
            const badge = document.getElementById('syncStatus');
            const textEl = document.getElementById('syncStatusText');
            if (status === 'saving') {
                badge.className = 'sync-badge saving';
                textEl.textContent = 'SAVING...';
            } else if (status === 'error') {
                badge.className = 'sync-badge error';
                textEl.textContent = 'SAVE ERROR';
            } else {
                badge.className = 'sync-badge';
                textEl.textContent = 'REALTIME SYNCED';
            }
        }

        // Pilih catatan yang baru dibuat sebagai catatan aktif
        function activateCreatedNote(note) {
            if (!note) return;
            if (!notesList.some(n => n.id === note.id)) notesList.unshift(note);
            activeNoteId = note.id;
            renderNotesSidebar();
            loadActiveNoteToEditor();
        }

        function initNotesWebSocket() {
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + location.host + '/ws');

            ws.onopen = () => {
                setSyncBadge('synced');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'init') {
                        notesList = data.notes || [];
                        if (notesList.length > 0 && !notesList.some(n => n.id === activeNoteId)) {
                            activeNoteId = notesList[0].id;
                        }
                        renderNotesSidebar();
                        loadActiveNoteToEditor();
                    } else if (data.type === 'note_updated') {
                        const updated = data.note;
                        const idx = notesList.findIndex(n => n.id === updated.id);
                        if (idx !== -1) {
                            notesList[idx] = updated;
                        } else {
                            notesList.unshift(updated);
                        }
                        renderNotesSidebar();
                        if (updated.id === activeNoteId) {
                            const titleIn = document.getElementById('noteTitleInput');
                            const textIn = document.getElementById('textData');
                            const isLocked = Boolean(updated.locked);
                            // Status kunci SELALU disinkronkan ke UI
                            if (isLocked || document.activeElement !== titleIn) titleIn.value = updated.title || '';
                            if (isLocked || document.activeElement !== textIn) textIn.value = updated.content || '';
                            updateLockUI(isLocked);
                        }
                    } else if (data.type === 'note_created') {
                        if (!notesList.some(n => n.id === data.note.id)) notesList.unshift(data.note);
                        renderNotesSidebar();
                    } else if (data.type === 'create_ack') {
                        if (data.success) {
                            closeOverlay('createNoteOverlay');
                            activateCreatedNote(data.note);
                        } else {
                            const errEl = document.getElementById('create-note-error');
                            if (errEl) {
                                errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                                errEl.style.display = 'block';
                                document.getElementById('create-note-password').value = '';
                                document.getElementById('create-note-password').focus();
                            }
                        }
                    } else if (data.type === 'note_deleted') {
                        notesList = data.notes;
                        if (data.id === activeNoteId) {
                            activeNoteId = notesList.length > 0 ? notesList[0].id : null;
                            loadActiveNoteToEditor();
                        }
                        renderNotesSidebar();
                    } else if (data.type === 'ack') {
                        setSyncBadge('synced');
                    } else if (data.type === 'error') {
                        setSyncBadge('synced');
                        showError(data.message || 'TERJADI KESALAHAN');
                    } else if (data.type === 'lock_ack') {
                        if (data.success) {
                            closeOverlay('lockNoteOverlay');
                            const current = getActiveNote();
                            if (current && data.note) current.locked = Boolean(data.note.locked);
                            updateLockUI(data.note ? Boolean(data.note.locked) : false);
                            renderNotesSidebar();
                        } else {
                            const errEl = document.getElementById('lock-note-error');
                            if (errEl) {
                                errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                                errEl.style.display = 'block';
                                document.getElementById('lock-note-password').value = '';
                                document.getElementById('lock-note-password').focus();
                            }
                        }
                    } else if (data.type === 'delete_ack') {
                        if (data.success) {
                            closeOverlay('deleteNoteOverlay');
                            notesList = data.notes;
                            activeNoteId = notesList.length > 0 ? notesList[0].id : null;
                            renderNotesSidebar();
                            loadActiveNoteToEditor();
                        } else {
                            const errEl = document.getElementById('del-note-error');
                            if (errEl) {
                                errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                                errEl.style.display = 'block';
                                document.getElementById('del-note-password').value = '';
                                document.getElementById('del-note-password').focus();
                            }
                        }
                    }
                } catch (e) {
                    console.error('WS client message parse error:', e);
                }
            };

            ws.onclose = () => {
                setSyncBadge('error');
                // Auto reconnect WS after 3 seconds
                setTimeout(initNotesWebSocket, 3000);
            };
        }

        async function initNotesSystem() {
            initNotesWebSocket();
            if (notesList.length === 0) {
                try {
                    const res = await fetch('/api/notes');
                    notesList = await res.json();
                    if (notesList.length > 0 && !activeNoteId) {
                        activeNoteId = notesList[0].id;
                    }
                    renderNotesSidebar();
                    loadActiveNoteToEditor();
                } catch (e) {}
            }
        }

        function renderNotesSidebar() {
            const container = document.getElementById('notesList');
            if (notesList.length === 0) {
                container.innerHTML = '<div style="color:#666; font-size:0.8rem; font-family:monospace; padding:12px; text-align:center;">[ TIDAK ADA CATATAN ]</div>';
                return;
            }
            container.innerHTML = notesList.map(n => {
                const isActive = n.id === activeNoteId ? 'active' : '';
                const lockBadge = n.locked ? '<span class="note-lock-badge" title="Catatan Terkunci">' + ICONS.lock + '</span>' : '';
                const safeTitle = escapeHtml(n.title || 'Catatan Tanpa Judul');
                const safeId = escapeHtml(n.id);
                return '<div class="note-item ' + isActive + '" data-id="' + safeId + '" onclick="selectNote(this.dataset.id)">' +
                    '<div class="note-item-info">' +
                        '<div class="note-item-title">' + safeTitle + lockBadge + '</div>' +
                        '<div class="note-item-date">' + formatNoteTime(n.updatedAt) + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        function flushPendingSave() {
            if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
                triggerAutoSaveNow();
            }
        }

        function selectNote(id) {
            flushPendingSave();
            activeNoteId = id;
            renderNotesSidebar();
            loadActiveNoteToEditor();
        }

        function loadActiveNoteToEditor() {
            const current = getActiveNote();
            const titleInput = document.getElementById('noteTitleInput');
            const textInput = document.getElementById('textData');
            const lockBtn = document.getElementById('noteLockBtn');
            if (current) {
                titleInput.value = current.title || '';
                textInput.value = current.content || '';
                if (lockBtn) lockBtn.disabled = false;
                updateLockUI(Boolean(current.locked));
            } else {
                titleInput.value = '';
                textInput.value = '';
                if (lockBtn) lockBtn.disabled = true;
                updateLockUI(false);
                titleInput.disabled = true;
                textInput.disabled = true;
            }
        }

        function openNoteLockModal() {
            if (!activeNoteId) return;
            const current = getActiveNote();
            if (!current) return;
            document.getElementById('lock-notename').textContent = '"' + (current.title || 'Catatan') + '"';
            document.getElementById('lock-overlay-action').textContent = current.locked ? 'UNLOCK' : 'LOCK';
            document.getElementById('lock-note-password').value = '';
            document.getElementById('lock-note-error').style.display = 'none';
            document.getElementById('lockNoteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('lock-note-password').focus(), 100);
        }

        async function doToggleNoteLock() {
            if (!activeNoteId) return;
            const pw = document.getElementById('lock-note-password').value;
            const errEl = document.getElementById('lock-note-error');
            if (!pw) {
                errEl.textContent = '[ERROR] PASSWORD REQUIRED!';
                errEl.style.display = 'block';
                return;
            }
            const current = getActiveNote();
            if (!current) return;

            // Simpan dulu isi terakhir sebelum dikunci
            if (!current.locked) flushPendingSave();

            const targetLockState = !current.locked;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'toggle_lock',
                    id: activeNoteId,
                    password: pw,
                    locked: targetLockState
                }));
            } else {
                const res = await fetch('/api/notes/lock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: activeNoteId, password: pw, locked: targetLockState })
                });
                const data = await res.json();
                if (data.success) {
                    current.locked = Boolean(data.note.locked);
                    closeOverlay('lockNoteOverlay');
                    updateLockUI(current.locked);
                    renderNotesSidebar();
                } else {
                    errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                    errEl.style.display = 'block';
                    document.getElementById('lock-note-password').value = '';
                    document.getElementById('lock-note-password').focus();
                }
            }
        }

        function updateLockUI(isLocked) {
            const btn = document.getElementById('noteLockBtn');
            const icon = document.getElementById('noteLockIcon');
            const label = document.getElementById('noteLockLabel');
            const deleteBtn = document.querySelector('.editor-status-bar .note-item-del');
            const titleInput = document.getElementById('noteTitleInput');
            const textInput = document.getElementById('textData');

            if (!btn) return;
            if (isLocked) {
                btn.classList.add('is-locked');
                icon.innerHTML = ICONS.lock;
                label.textContent = 'LOCKED';
                if (deleteBtn) {
                    deleteBtn.style.opacity = '0.3';
                    deleteBtn.style.cursor = 'not-allowed';
                    deleteBtn.title = 'Catatan Terkunci (Buka Kunci Untuk Menghapus)';
                }
                textInput.classList.add('is-locked');
            } else {
                btn.classList.remove('is-locked');
                icon.innerHTML = ICONS.lockOpen;
                label.textContent = 'UNLOCKED';
                if (deleteBtn) {
                    deleteBtn.style.opacity = '';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.title = 'Hapus Catatan Ini';
                }
                textInput.classList.remove('is-locked');
            }
            // Terkunci = tidak bisa diketik sama sekali
            titleInput.disabled = isLocked;
            titleInput.readOnly = isLocked;
            textInput.disabled = isLocked;
            textInput.readOnly = isLocked;
        }

        function onNoteTitleInput() {
            if (!activeNoteId) return;
            const current = getActiveNote();
            if (!current || current.locked) return;
            current.title = document.getElementById('noteTitleInput').value;
            current.updatedAt = Date.now();
            renderNotesSidebar();
            queueAutoSave();
        }

        function onNoteContentInput() {
            if (!activeNoteId) return;
            const current = getActiveNote();
            if (!current || current.locked) return;
            current.content = document.getElementById('textData').value;
            current.updatedAt = Date.now();
            renderNotesSidebar();
            queueAutoSave();
        }

        function queueAutoSave() {
            setSyncBadge('saving');
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                saveTimer = null;
                triggerAutoSaveNow();
            }, 300);
        }

        function triggerAutoSaveNow() {
            if (!activeNoteId) return;
            const current = getActiveNote();
            if (!current || current.locked) return;
            const title = document.getElementById('noteTitleInput').value;
            const content = document.getElementById('textData').value;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'save_note',
                    id: activeNoteId,
                    title: title,
                    content: content
                }));
            } else {
                // Fallback REST API
                fetch('/api/notes/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: activeNoteId, title, content })
                }).then(res => res.json()).then(data => {
                    if (data.success) setSyncBadge('synced');
                    else setSyncBadge('error');
                }).catch(() => setSyncBadge('error'));
            }
        }

        // "+ BARU" sekarang butuh password: buka dialog dulu
        function createNewNote() {
            flushPendingSave();
            document.getElementById('create-note-password').value = '';
            document.getElementById('create-note-error').style.display = 'none';
            document.getElementById('createNoteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('create-note-password').focus(), 100);
        }

        async function doCreateNote() {
            const pw = document.getElementById('create-note-password').value;
            const errEl = document.getElementById('create-note-error');
            if (!pw) {
                errEl.textContent = '[ERROR] PASSWORD REQUIRED!';
                errEl.style.display = 'block';
                return;
            }
            const defaultTitle = 'Catatan Baru ' + (notesList.length + 1);

            if (ws && ws.readyState === WebSocket.OPEN) {
                // Hasilnya datang lewat pesan 'create_ack'
                ws.send(JSON.stringify({ type: 'create_note', title: defaultTitle, content: '', password: pw }));
            } else {
                try {
                    const res = await fetch('/api/notes/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: defaultTitle, content: '', password: pw })
                    });
                    const data = await res.json();
                    if (data.success && data.note) {
                        closeOverlay('createNoteOverlay');
                        activateCreatedNote(data.note);
                    } else {
                        errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                        errEl.style.display = 'block';
                        document.getElementById('create-note-password').value = '';
                        document.getElementById('create-note-password').focus();
                    }
                } catch (e) {
                    errEl.textContent = '[ERROR] KONEKSI GAGAL';
                    errEl.style.display = 'block';
                }
            }
        }

        let pendingDeleteNoteId = null;
        function confirmDeleteCurrentNote() {
            if (!activeNoteId) return;
            const current = getActiveNote();
            if (current && current.locked) {
                showError('[ERROR] CATATAN "' + (current.title || 'Catatan') + '" TERKUNCI DAN TIDAK DAPAT DIHAPUS! Buka kunci dulu lewat tombol LOCKED di sebelah judul.');
                return;
            }
            pendingDeleteNoteId = activeNoteId;
            document.getElementById('del-notename').textContent = '"' + (current ? current.title : 'Catatan') + '"';
            document.getElementById('del-note-password').value = '';
            document.getElementById('del-note-error').style.display = 'none';
            document.getElementById('deleteNoteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('del-note-password').focus(), 100);
        }

        async function doDeleteNote() {
            if (!pendingDeleteNoteId) return;
            const pw = document.getElementById('del-note-password').value;
            const errEl = document.getElementById('del-note-error');
            if (!pw) {
                errEl.textContent = '[ERROR] PASSWORD REQUIRED!';
                errEl.style.display = 'block';
                return;
            }

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'delete_note', id: pendingDeleteNoteId, password: pw }));
            } else {
                const res = await fetch('/api/notes/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: pendingDeleteNoteId, password: pw })
                });
                const data = await res.json();
                if (data.success) {
                    closeOverlay('deleteNoteOverlay');
                    notesList = data.notes;
                    activeNoteId = notesList.length > 0 ? notesList[0].id : null;
                    renderNotesSidebar();
                    loadActiveNoteToEditor();
                } else {
                    errEl.textContent = '[ERROR] ' + (data.error || 'INCORRECT PASSWORD!');
                    errEl.style.display = 'block';
                    document.getElementById('del-note-password').value = '';
                    document.getElementById('del-note-password').focus();
                }
            }
            pendingDeleteNoteId = null;
        }

        document.getElementById('lock-note-password').addEventListener('keydown', e => { if (e.key === 'Enter') doToggleNoteLock(); });
        document.getElementById('del-note-password').addEventListener('keydown', e => { if (e.key === 'Enter') doDeleteNote(); });
        document.getElementById('create-note-password').addEventListener('keydown', e => { if (e.key === 'Enter') doCreateNote(); });
    </script>
</body>
</html>`);
    });
});

app.get('/files/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.resolve(SERVER_FOLDER, filename);
    const base = path.resolve(SERVER_FOLDER);
    if (!filePath.startsWith(base + path.sep)) return res.status(403).send('Access Denied');
    res.download(filePath, filename, err => {
        if (err && !res.headersSent) res.status(404).send('File Not Found');
    });
});

app.get('/preview/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.resolve(SERVER_FOLDER, filename);
    const base = path.resolve(SERVER_FOLDER);
    if (!filePath.startsWith(base + path.sep)) return res.status(403).send('Akses ditolak');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath, err => {
            if (err && !res.headersSent) res.status(404).send('File tidak ditemukan');
        });
    } else {
        res.status(404).send('File tidak ditemukan');
    }
});

app.post('/upload', (req, res, next) => {
    const settings = loadSettings();
    // Total = file sharing + paste sharing
    const totalSizeBytes = getTotalSize();

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (totalSizeBytes + contentLength > settings.maxServerSizeMB * 1024 * 1024) {
        return res.status(400).json({ error: 'Kapasitas server penuh!' });
    }
    next();
}, (req, res) => {
    const uploadHandler = getUpload();
    uploadHandler.array('files')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.files || !req.files.length) return res.status(400).json({ error: 'Tidak ada file yang diupload' });
        res.json({ message: 'Berhasil', files: req.files.map(f => f.filename) });
    });
});

app.post('/delete', (req, res) => {
    const { filename, password } = req.body;
    if (password !== DELETE_PASSWORD) return res.status(403).json({ success: false, error: 'Password salah!' });
    
    const filesToDelete = Array.isArray(filename) ? filename : [filename];
    let failedCount = 0;
    
    for (const f of filesToDelete) {
        if (!f || typeof f !== 'string' || f.includes('..') || f.includes('/') || f.includes('\\')) {
            failedCount++;
            continue;
        }
        const filePath = path.resolve(SERVER_FOLDER, path.basename(f));
        const base = path.resolve(SERVER_FOLDER);
        if (filePath.startsWith(base + path.sep) && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                failedCount++;
            }
        } else {
            failedCount++;
        }
    }
    
    if (failedCount > 0 && failedCount === filesToDelete.length) {
        return res.status(500).json({ success: false, error: 'Gagal menghapus file' });
    } else if (failedCount > 0) {
        return res.json({ success: true, message: `Berhasil, tapi ${failedCount} file gagal dihapus` });
    }
    res.json({ success: true });
});

app.post('/settings/verify', (req, res) => {
    const { password } = req.body;
    res.json({ success: password === SETTINGS_PASSWORD });
});

app.post('/settings/save', (req, res) => {
    const { password, maxFileSizeMB, maxTextSizeMB, maxServerSizeMB } = req.body;
    if (password !== SETTINGS_PASSWORD) return res.status(403).json({ success: false, error: 'Password salah!' });
    const val = parseInt(maxFileSizeMB);
    const textVal = parseInt(maxTextSizeMB);
    const serverVal = parseInt(maxServerSizeMB);
    if (!val || val < 1) return res.status(400).json({ success: false, error: 'Ukuran file tidak valid' });
    if (!textVal || textVal < 1) return res.status(400).json({ success: false, error: 'Ukuran teks tidak valid' });
    if (!serverVal || serverVal < 1) return res.status(400).json({ success: false, error: 'Kapasitas tidak valid' });
    
    const current = loadSettings();
    saveSettings({ ...current, maxFileSizeMB: val, maxTextSizeMB: textVal, maxServerSizeMB: serverVal });
    res.json({ success: true });
});

app.get('/api/state', (req, res) => {
    try {
        const files = fs.readdirSync(SERVER_FOLDER);
        let maxMtime = 0;
        files.forEach(f => {
            try {
                const stat = fs.statSync(path.join(SERVER_FOLDER, f));
                if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
            } catch {}
        });
        let textMtime = 0;
        try { if (fs.existsSync(NOTES_DB_FILE)) textMtime = fs.statSync(NOTES_DB_FILE).mtimeMs; } catch {}
        res.json({ fileCount: files.length, maxMtime, textMtime, totalSizeBytes: getTotalSize() });
    } catch {
        res.json({ fileCount: 0, maxMtime: 0, textMtime: 0, totalSizeBytes: 0 });
    }
});

// ----------------------------------------------------
// PASTE SHARING APIs
// File disimpan di PASTE_FOLDER, ukurannya ikut dihitung
// ke kapasitas server (getTotalSize).
// ----------------------------------------------------
app.get('/api/paste', (req, res) => {
    let items = [];
    try {
        items = fs.readdirSync(PASTE_FOLDER).map(id => {
            try {
                const st = fs.statSync(path.join(PASTE_FOLDER, id));
                if (!st.isFile()) return null;
                const name = pasteDisplayName(id);
                return {
                    id,
                    name,
                    size: formatSize(st.size),
                    sizeBytes: st.size,
                    mtimeMs: st.mtimeMs,
                    isImage: IMAGE_EXTS.includes(path.extname(name).toLowerCase()),
                    iconSvg: getIcon(name)
                };
            } catch {
                return null;
            }
        }).filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch {}
    res.json({ items, totalSizeBytes: getTotalSize() });
});

app.post('/paste/upload', (req, res, next) => {
    const settings = loadSettings();
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (getTotalSize() + contentLength > settings.maxServerSizeMB * 1024 * 1024) {
        return res.status(400).json({ error: 'Kapasitas server penuh!' });
    }
    next();
}, (req, res) => {
    const handler = getPasteUpload();
    handler.array('files')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.files || !req.files.length) return res.status(400).json({ error: 'Tidak ada file yang ditempel' });
        res.json({ message: 'Berhasil', files: req.files.map(f => f.filename) });
    });
});

app.get('/paste/view/:id', (req, res) => {
    const filePath = resolvePastePath(req.params.id);
    if (!filePath) return res.status(403).send('Akses ditolak');
    if (!fs.existsSync(filePath)) return res.status(404).send('File tidak ditemukan');
    // SVG dibuka langsung di tab baru tidak boleh menjalankan script
    if (path.extname(filePath).toLowerCase() === '.svg') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
    res.sendFile(filePath, err => {
        if (err && !res.headersSent) res.status(404).send('File tidak ditemukan');
    });
});

app.get('/paste/file/:id', (req, res) => {
    const filePath = resolvePastePath(req.params.id);
    if (!filePath) return res.status(403).send('Access Denied');
    if (!fs.existsSync(filePath)) return res.status(404).send('File Not Found');
    res.download(filePath, pasteDisplayName(path.basename(filePath)), err => {
        if (err && !res.headersSent) res.status(404).send('File Not Found');
    });
});

app.post('/paste/delete', (req, res) => {
    const { ids, password } = req.body;
    if (password !== DELETE_PASSWORD) return res.status(403).json({ success: false, error: 'Password salah!' });

    const list = Array.isArray(ids) ? ids : [ids];
    let failedCount = 0;

    for (const id of list) {
        if (!id || typeof id !== 'string' || path.basename(id) !== id) {
            failedCount++;
            continue;
        }
        const filePath = resolvePastePath(id);
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                failedCount++;
            }
        } else {
            failedCount++;
        }
    }

    if (failedCount > 0 && failedCount === list.length) {
        return res.status(500).json({ success: false, error: 'Gagal menghapus item' });
    } else if (failedCount > 0) {
        return res.json({ success: true, message: `Berhasil, tapi ${failedCount} item gagal dihapus` });
    }
    res.json({ success: true });
});

// ----------------------------------------------------
// Notes REST APIs
// ATURAN:
//  - Catatan terkunci TIDAK BOLEH diubah (judul/isi) sama sekali.
//  - Status "locked" hanya bisa diubah lewat toggle_lock + password.
//  - Save biasa tidak pernah menyentuh status "locked".
//  - MEMBUAT catatan baru juga butuh password.
// ----------------------------------------------------
app.get('/api/notes', (req, res) => {
    const notes = loadNotes();
    res.json(notes);
});

app.post('/api/notes/save', (req, res) => {
    const { id, title, content } = req.body;
    const notes = loadNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Catatan tidak ditemukan' });
    }
    if (notes[idx].locked) {
        return res.status(400).json({ success: false, error: 'Catatan terkunci dan tidak dapat diedit!' });
    }
    if (typeof title === 'string') notes[idx].title = title;
    if (typeof content === 'string') notes[idx].content = content;
    notes[idx].updatedAt = Date.now();
    saveNotes(notes);
    broadcastWs({ type: 'note_updated', note: notes[idx] });
    res.json({ success: true, note: notes[idx] });
});

app.post('/api/notes/create', (req, res) => {
    const { title, content, password } = req.body;
    if (password !== DELETE_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Password salah!' });
    }
    const notes = loadNotes();
    const newNote = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: title || 'Catatan Tanpa Judul',
        content: content || '',
        locked: false,
        updatedAt: Date.now()
    };
    notes.unshift(newNote);
    saveNotes(notes);
    broadcastWs({ type: 'note_created', note: newNote });
    res.json({ success: true, note: newNote });
});

app.post('/api/notes/lock', (req, res) => {
    const { id, password, locked } = req.body;
    if (password !== DELETE_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Password salah!' });
    }
    const notes = loadNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
        notes[idx].locked = Boolean(locked);
        notes[idx].updatedAt = Date.now();
        saveNotes(notes);
        broadcastWs({ type: 'note_updated', note: notes[idx] });
        res.json({ success: true, note: notes[idx] });
    } else {
        res.status(404).json({ success: false, error: 'Catatan tidak ditemukan' });
    }
});

app.post('/api/notes/delete', (req, res) => {
    const { id, password } = req.body;
    if (password !== DELETE_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Password salah!' });
    }
    let notes = loadNotes();
    const target = notes.find(n => n.id === id);
    if (target && target.locked) {
        return res.status(400).json({ success: false, error: 'Catatan terkunci! Buka kunci terlebih dahulu.' });
    }
    notes = notes.filter(n => n.id !== id);
    if (notes.length === 0) {
        notes.push({
            id: 'note_' + Date.now(),
            title: 'Catatan Utama',
            content: '',
            locked: false,
            updatedAt: Date.now()
        });
    }
    saveNotes(notes);
    broadcastWs({ type: 'note_deleted', id, notes });
    res.json({ success: true, notes });
});

// Create HTTP & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

function broadcastWs(data, exceptWs = null) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client !== exceptWs && client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

wss.on('connection', (ws) => {
    const notes = loadNotes();
    ws.send(JSON.stringify({ type: 'init', notes }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            let notes = loadNotes();

            if (data.type === 'save_note') {
                const { id, title, content } = data;
                const idx = notes.findIndex(n => n.id === id);
                if (idx !== -1) {
                    // Catatan terkunci: tolak semua edit, lalu kembalikan versi asli ke pengirim
                    if (notes[idx].locked) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Catatan terkunci dan tidak dapat diedit!' }));
                        ws.send(JSON.stringify({ type: 'note_updated', note: notes[idx] }));
                        return;
                    }
                    if (typeof title === 'string') notes[idx].title = title;
                    if (typeof content === 'string') notes[idx].content = content;
                    notes[idx].updatedAt = Date.now();
                    saveNotes(notes);
                    broadcastWs({ type: 'note_updated', note: notes[idx] }, ws);
                    ws.send(JSON.stringify({ type: 'ack', id: notes[idx].id, updatedAt: notes[idx].updatedAt }));
                }
            } else if (data.type === 'create_note') {
                // Membuat catatan baru wajib password (dicek di server)
                if (data.password !== DELETE_PASSWORD) {
                    ws.send(JSON.stringify({ type: 'create_ack', success: false, error: 'Password salah!' }));
                    return;
                }
                const newNote = {
                    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    title: data.title || 'Catatan Tanpa Judul',
                    content: data.content || '',
                    locked: false,
                    updatedAt: Date.now()
                };
                notes.unshift(newNote);
                saveNotes(notes);
                broadcastWs({ type: 'note_created', note: newNote });
                ws.send(JSON.stringify({ type: 'create_ack', success: true, note: newNote }));
            } else if (data.type === 'toggle_lock') {
                const { id, password, locked } = data;
                if (password !== DELETE_PASSWORD) {
                    ws.send(JSON.stringify({ type: 'lock_ack', success: false, error: 'Password salah!' }));
                    return;
                }
                const idx = notes.findIndex(n => n.id === id);
                if (idx !== -1) {
                    notes[idx].locked = Boolean(locked);
                    notes[idx].updatedAt = Date.now();
                    saveNotes(notes);
                    broadcastWs({ type: 'note_updated', note: notes[idx] });
                    ws.send(JSON.stringify({ type: 'lock_ack', success: true, note: notes[idx] }));
                }
            } else if (data.type === 'delete_note') {
                const { id, password } = data;
                if (password !== DELETE_PASSWORD) {
                    ws.send(JSON.stringify({ type: 'delete_ack', success: false, error: 'Password salah!' }));
                    return;
                }
                const target = notes.find(n => n.id === id);
                if (target && target.locked) {
                    ws.send(JSON.stringify({ type: 'delete_ack', success: false, error: 'Catatan terkunci! Buka kunci terlebih dahulu.' }));
                    return;
                }
                notes = notes.filter(n => n.id !== id);
                if (notes.length === 0) {
                    notes.push({
                        id: 'note_' + Date.now(),
                        title: 'Catatan Utama',
                        content: '',
                        locked: false,
                        updatedAt: Date.now()
                    });
                }
                saveNotes(notes);
                broadcastWs({ type: 'note_deleted', id, notes });
                ws.send(JSON.stringify({ type: 'delete_ack', success: true, id, notes }));
            }
        } catch (e) {
            console.error('WebSocket payload error:', e);
        }
    });
});

const getLocalIPs = () => {
    const nets = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) results.push(net.address);
        }
    }
    return results;
};

server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('\n[ShareIksun] Server running!\n');
    ips.forEach(ip => {
        const url = `http://${ip}:${PORT}`;
        console.log('>> ' + url);
        QRCode.generate(url, { small: true });
    });
});
