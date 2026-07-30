const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode-terminal');

const app = express();
const PORT = 5000;
const SERVER_FOLDER = 'server_folder';
const DELETE_PASSWORD = 'iksun*'; // SETTING BEBAS COY
const SETTINGS_PASSWORD = 'iksun*'; // JANGAN NIRU :v
const SETTINGS_FILE = 'settings.json';

if (!fs.existsSync(SERVER_FOLDER)) fs.mkdirSync(SERVER_FOLDER);

function loadSettings() {
    const defaultSettings = { maxFileSizeMB: 50, maxServerSizeMB: 1024 };
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
        '.jpg': svgImage, '.jpeg': svgImage, '.png': svgImage, '.gif': svgImage, '.webp': svgImage, '.svg': svgImage,
        '.pdf': svgDoc, '.doc': svgDoc, '.docx': svgDoc, '.xls': svgDoc, '.xlsx': svgDoc, '.csv': svgDoc, '.ppt': svgDoc, '.pptx': svgDoc, '.txt': svgDoc,
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
                return { name: file, size: formatSize(stat.size), mtime: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs };
            } catch {
                return { name: file, size: '?', mtime: '', mtimeMs: 0 };
            }
        }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

        let maxMtime = 0;
        if (fileData.length > 0) {
            maxMtime = Math.max(...fileData.map(f => f.mtimeMs));
        }
        const initialState = { fileCount: fileData.length, maxMtime, settings, totalSizeBytes };

        const totalSizeFormatted = formatSize(totalSizeBytes);
        const serverMaxFormatted = settings.maxServerSizeMB >= 1024 ? (settings.maxServerSizeMB / 1024).toFixed(1) + ' GB' : settings.maxServerSizeMB + ' MB';
        const serverUsagePct = Math.min((totalSizeBytes / (settings.maxServerSizeMB * 1024 * 1024)) * 100, 100);
        const isServerFull = serverUsagePct >= 100;

        const fileListHTML = fileData.map(f => {
            const ext = path.extname(f.name).toLowerCase();
            let previewLink = '';
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                previewLink = `<a href="/preview/${encodeURIComponent(f.name)}" target="_blank" rel="noopener noreferrer" class="preview-link">PREVIEW_IMG</a>`;
            } else if (ext === '.pdf') {
                previewLink = `<a href="/preview/${encodeURIComponent(f.name)}" target="_blank" rel="noopener noreferrer" class="preview-link">PREVIEW_PDF</a>`;
            }
            return `
            <li data-name="${f.name.toLowerCase()}">
                <div class="file-info">
                    <input type="checkbox" class="file-checkbox" value="${f.name.replace(/"/g, '&quot;')}" style="margin-right: 14px; transform: scale(1.3); cursor: pointer; accent-color: #ccff00;" />
                    <span class="file-icon">${getIcon(f.name)}</span>
                    <div class="file-meta">
                        <a href="/files/${encodeURIComponent(f.name)}" download class="file-name">${f.name}</a>
                        <span class="file-size">${f.size}${previewLink}</span>
                    </div>
                </div>
                <button class="del-btn" onclick="confirmDelete('${f.name.replace(/'/g, "\\'")}')">✖</button>
            </li>`;
        }).join('');

        const lastFile = fileData.length > 0 ? fileData[0] : null;

        res.send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>ShareIksun</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; width: 100%; }
        /* ZZZ Tech Aesthetic */
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #080808; color: #eaeaea; padding: 16px 12px; min-height: 100vh; background-image: linear-gradient(rgba(204, 255, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(204, 255, 0, 0.03) 1px, transparent 1px); background-size: 30px 30px; }
        @media (min-width: 768px) { body { padding: 24px 16px; } }
        .app-container { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; width: 100%; }
        header { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px; background: transparent; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative; }
        header::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100px; height: 2px; background: #ccff00; }
        @media (min-width: 768px) { header { flex-direction: row; align-items: baseline; gap: 16px; } }
        header h1 { font-size: 1.8rem; color: #fff; font-weight: 800; font-style: italic; letter-spacing: -1px; text-transform: uppercase; }
        @media (min-width: 768px) { header h1 { font-size: 2.5rem; } }
        header span { color: #ccff00; font-weight: 700; font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase; padding: 2px 6px; border: 1px solid #ccff00; }
        .main-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; width: 100%; }
        @media (min-width: 768px) { .main-layout { grid-template-columns: 320px minmax(0, 1fr); gap: 24px; } }
        .box { background: #121212; border: 1px solid #2a2a2a; padding: 20px; position: relative; overflow: hidden; }
        .box::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #2a2a2a; transition: background 0.3s; }
        .box:hover::before { background: #ccff00; }
        @media (min-width: 768px) { .box { padding: 24px; } }
        .box h2 { font-size: 1.1rem; color: #fff; margin-bottom: 20px; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px; }
        .upload-area { border: 1px dashed #444; padding: 32px 16px; text-align: center; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.3s; position: relative; }
        .upload-area:hover, .upload-area.drag-over { background: rgba(204, 255, 0, 0.05); border-color: #ccff00; box-shadow: 0 0 15px rgba(204, 255, 0, 0.1); }
        .upload-area input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .upload-area .upload-icon { font-size: 2.5rem; opacity: 0.8; }
        .upload-area .upload-label { font-size: 1rem; color: #fff; margin-top: 12px; font-weight: 700; letter-spacing: 0.5px; }
        .upload-area .upload-hint { font-size: 0.8rem; color: #888; margin-top: 6px; }
        #selected-files { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; min-height: 18px; }
        .file-tag { background: #1a1a1a; color: #ccc; border: 1px solid #333; font-size: 0.85rem; display: flex; flex-direction: column; max-width: 100%; overflow: hidden; }
        .file-tag-content { display: flex; align-items: center; gap: 6px; padding: 6px 12px; }
        .file-tag-content > span.tag-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .file-tag-pct { font-size: 0.8rem; font-weight: 700; color: #ccff00; margin-left: 4px; display: none; }
        .file-tag button { background: none; border: none; color: #ff4500; cursor: pointer; font-size: 1.2rem; line-height: 1; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .file-tag button:hover { color: #fff; background: #ff4500; }
        .file-tag button:disabled { cursor: not-allowed; opacity: 0.5; }
        .file-prog-container { height: 2px; background: #333; width: 100%; display: none; }
        .file-prog-bar { height: 100%; width: 0%; background: #ccff00; transition: width 0.2s, background 0.2s; box-shadow: 0 0 8px #ccff00; }
        button.upload-btn { display: block; width: 100%; margin-top: 16px; padding: 12px; background: #ccff00; color: #000; border: none; font-size: 1rem; cursor: pointer; transition: all 0.2s; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: 1px; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
        button.upload-btn:hover { background: #e6ff00; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(204,255,0,0.3); }
        button.upload-btn:active { transform: translateY(0); }
        button.upload-btn:disabled { background: #333; color: #666; cursor: not-allowed; box-shadow: none; transform: none; clip-path: none; }
        #notification { margin-top: 16px; padding: 12px 16px; font-size: 0.9rem; display: none; font-weight: 600; font-family: monospace; border-left: 4px solid; }
        .notif-success { background: rgba(204,255,0,0.1); color: #ccff00; border-color: #ccff00; }
        .notif-error { background: rgba(255,69,0,0.1); color: #ff4500; border-color: #ff4500; }
        #last-upload { font-size: 0.85rem; color: #aaa; margin-top: 16px; padding: 12px 16px; background: #161616; border-left: 2px solid #ccff00; display: ${lastFile ? 'block' : 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .settings-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
        button.settings-btn { background: transparent; border: 1px solid #444; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; color: #ccc; font-weight: 700; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; }
        button.settings-btn:hover { background: #fff; color: #000; border-color: #fff; }
        #searchInput { width: 100%; padding: 12px 16px; border: 1px solid #333; font-size: 0.95rem; margin-bottom: 16px; outline: none; font-family: 'Plus Jakarta Sans', sans-serif; background: #0a0a0a; color: #fff; transition: all 0.2s; }
        #searchInput:focus { border-color: #ccff00; box-shadow: 0 0 10px rgba(204,255,0,0.1); }
        #searchInput::placeholder { color: #555; }
        ul#fileList { list-style: none; padding: 0; }
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
        button.del-btn { background: transparent; border: 1px solid transparent; color: #666; font-size: 1.2rem; cursor: pointer; padding: 6px; transition: all 0.2s; flex-shrink: 0; border-radius: 4px; }
        button.del-btn:hover { color: #ff4500; border-color: #ff4500; background: rgba(255,69,0,0.1); }
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
        <span>Local File Sharing</span>
    </header>

    <div class="main-layout">
        <aside class="left-panel" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="box" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 0.9rem; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">SERVER_CAPACITY</span>
                    <strong style="font-size: 0.95rem; color: ${isServerFull ? '#ff4500' : '#ccff00'}; font-family: monospace; white-space: nowrap;">[ ${totalSizeFormatted} / ${serverMaxFormatted} ]</strong>
                </div>
                <div style="width: 100%; height: 6px; background: #222; overflow: hidden; position: relative;">
                    <div style="width: ${serverUsagePct}%; height: 100%; background: ${serverUsagePct > 90 ? '#ff4500' : '#ccff00'}; transition: width 0.3s; box-shadow: 0 0 10px ${serverUsagePct > 90 ? '#ff4500' : '#ccff00'};"></div>
                </div>
            </div>

            <div class="box">
                <h2 style="margin-bottom: 20px;">
                    <span><span style="color: #ccff00;">//</span> UPLOAD_FILES</span>
                    <span style="font-weight:600;color:#666;font-size:0.75rem;font-family:monospace;border:1px solid #444;padding:2px 6px;letter-spacing:0;">MAX ${settings.maxFileSizeMB} MB</span>
                </h2>
                <form id="uploadForm" enctype="multipart/form-data">
                    <div class="upload-area" id="dropZone">
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
                    <strong style="color: #fff; font-size: 0.9rem; font-family: monospace;">${lastFile ? lastFile.name : '-'}</strong> 
                    <span style="color: #666; font-size: 0.8rem; font-family: monospace; margin-left: 8px;">[${lastFile ? lastFile.size : ''}]</span>
                </div>
            </div>
        </aside>

        <main class="right-panel">
            <div class="box" style="height: 100%; min-height: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px;">
                    <h2 style="margin-bottom: 0; border: none; padding: 0;">
                        <span><span style="color: #ccff00;">//</span> FILE_DATABASE</span>
                        <span style="font-weight:700;color:#ccff00;font-size:0.8rem; margin-left: 12px; font-family: monospace; background: rgba(204,255,0,0.1); padding: 2px 6px; letter-spacing:0;">[ ${fileData.length} ] FILES</span>
                    </h2>
                    <button class="settings-btn" onclick="openSettings()">⚙ SYSTEM_CONFIG</button>
                </div>
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <input type="text" id="searchInput" placeholder="SEARCH_DATABASE..." style="flex: 1; min-width: 200px;">
                    <button id="bulkDeleteBtn" onclick="confirmBulkDelete()" style="display: none; background: rgba(255,69,0,0.1); color: #ff4500; border: 1px solid #ff4500; padding: 0 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-transform: uppercase; font-family: monospace; letter-spacing:1px;">[X] DELETE (<span id="bulkCount">0</span>)</button>
                </div>
                <ul id="fileList">${fileListHTML}</ul>
            </div>
        </main>
    </div>
</div>

    <!-- Delete overlay -->
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
                <button class="btn-cancel" onclick="closeOverlay('errorOverlay')" style="width: 100%;">ACKNOWLEDGE</button>
            </div>
        </div>
    </div>

    <script>
        function showError(msg) {
            document.getElementById('error-message').textContent = msg;
            document.getElementById('errorOverlay').classList.add('show');
        }

        const initialState = ${JSON.stringify(initialState)};
        setInterval(async () => {
            if (typeof selectedFilesArray !== 'undefined' && selectedFilesArray.length > 0) return;
            if (document.querySelector('.overlay.show')) return;
            try {
                const resp = await fetch('/api/state');
                const state = await resp.json();
                if (state.fileCount !== initialState.fileCount || Math.floor(state.maxMtime) !== Math.floor(initialState.maxMtime)) {
                    location.reload();
                }
            } catch (e) {}
        }, 3000);

        const fileInput = document.getElementById('fileInput');
        const selectedFilesDiv = document.getElementById('selected-files');
        const uploadBtn = document.getElementById('uploadBtn');
        const dropZone = document.getElementById('dropZone');
        let selectedFilesArray = [];

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
                        if (pctEl) { pctEl.textContent = '❌'; pctEl.style.color = '#c62828'; }
                        if (progBar) progBar.style.background = '#dc3545';
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

        document.getElementById('searchInput').addEventListener('input', function() {
            const q = this.value.toLowerCase();
            document.querySelectorAll('#fileList li').forEach(li => {
                li.style.display = li.dataset.name.includes(q) ? '' : 'none';
            });
        });

        function closeOverlay(id) {
            document.getElementById(id).classList.remove('show');
        }
        document.querySelectorAll('.overlay').forEach(o => {
            o.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
        });

        let pendingDelete = null;
        let bulkDeleteFiles = [];

        document.addEventListener('change', e => {
            if (e.target.classList.contains('file-checkbox')) {
                const checked = document.querySelectorAll('.file-checkbox:checked');
                const btn = document.getElementById('bulkDeleteBtn');
                const count = document.getElementById('bulkCount');
                if (checked.length > 0) {
                    count.textContent = checked.length;
                    btn.style.display = 'block';
                } else {
                    btn.style.display = 'none';
                }
            }
        });

        function confirmBulkDelete() {
            const checked = document.querySelectorAll('.file-checkbox:checked');
            bulkDeleteFiles = Array.from(checked).map(cb => cb.value);
            if (bulkDeleteFiles.length === 0) return;
            
            pendingDelete = null;
            document.getElementById('del-filename').textContent = bulkDeleteFiles.length + ' FILES SELECTED';
            document.getElementById('del-password').value = '';
            document.getElementById('del-error').style.display = 'none';
            document.getElementById('deleteOverlay').classList.add('show');
            setTimeout(() => document.getElementById('del-password').focus(), 100);
        }

        function confirmDelete(filename) {
            pendingDelete = filename;
            bulkDeleteFiles = [];
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
            
            const payload = bulkDeleteFiles.length > 0 ? bulkDeleteFiles : pendingDelete;

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
            const serverVal = parseInt(document.getElementById('settings-maxserver').value);
            const errEl = document.getElementById('settings-error');
            if (!val || val < 1) { errEl.textContent = '[ERROR] MINIMUM FILE SIZE IS 1 MB'; errEl.style.display = 'block'; return; }
            if (!serverVal || serverVal < 1) { errEl.textContent = '[ERROR] MINIMUM CAPACITY IS 1 MB'; errEl.style.display = 'block'; return; }
            const resp = await fetch('/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: document.getElementById('settings-password').value, maxFileSizeMB: val, maxServerSizeMB: serverVal })
            });
            const data = await resp.json();
            if (data.success) { closeOverlay('settingsOverlay'); location.reload(); }
            else { errEl.textContent = '[ERROR] ' + (data.error || 'FAILED TO SAVE'); errEl.style.display = 'block'; }
        }
        document.getElementById('settings-password').addEventListener('keydown', e => { if (e.key === 'Enter') verifySettingsPassword(); });
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
    let totalSizeBytes = 0;
    try {
        const files = fs.readdirSync(SERVER_FOLDER);
        files.forEach(f => {
            const stat = fs.statSync(path.join(SERVER_FOLDER, f));
            totalSizeBytes += stat.size;
        });
    } catch {}

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
    const { password, maxFileSizeMB, maxServerSizeMB } = req.body;
    if (password !== SETTINGS_PASSWORD) return res.status(403).json({ success: false, error: 'Password salah!' });
    const val = parseInt(maxFileSizeMB);
    const serverVal = parseInt(maxServerSizeMB);
    if (!val || val < 1) return res.status(400).json({ success: false, error: 'Ukuran file tidak valid' });
    if (!serverVal || serverVal < 1) return res.status(400).json({ success: false, error: 'Kapasitas tidak valid' });
    
    const current = loadSettings();
    saveSettings({ ...current, maxFileSizeMB: val, maxServerSizeMB: serverVal });
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
        res.json({ fileCount: files.length, maxMtime });
    } catch {
        res.json({ fileCount: 0, maxMtime: 0 });
    }
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

app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('\n📦 ShareIksun Server running!\n');
    ips.forEach(ip => {
        const url = `http://${ip}:${PORT}`;
        console.log('🌐 ' + url);
        QRCode.generate(url, { small: true });
    });
});
