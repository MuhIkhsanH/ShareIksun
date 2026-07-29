const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode-terminal');

const app = express();
const PORT = 5000;
const SERVER_FOLDER = 'server_folder';
const DELETE_PASSWORD = 'iksun*';
const SETTINGS_PASSWORD = 'iksun*';
const SETTINGS_FILE = 'settings.json';

if (!fs.existsSync(SERVER_FOLDER)) fs.mkdirSync(SERVER_FOLDER);

function loadSettings() {
    if (fs.existsSync(SETTINGS_FILE)) {
        try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
    }
    return { maxFileSizeMB: 50 };
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
    const map = {
        '.mp3': '🎵', '.flac': '🎵', '.ogg': '🎵', '.wav': '🎵', '.aac': '🎵',
        '.mp4': '🎬', '.mkv': '🎬', '.webm': '🎬', '.mov': '🎬', '.avi': '🎬',
        '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️', '.webp': '🖼️', '.svg': '🖼️',
        '.pdf': '📄', '.doc': '📝', '.docx': '📝',
        '.xls': '📊', '.xlsx': '📊', '.csv': '📊',
        '.ppt': '📋', '.pptx': '📋',
        '.zip': '🗜️', '.rar': '🗜️', '.7z': '🗜️', '.tar': '🗜️', '.gz': '🗜️',
        '.txt': '📃', '.js': '⚙️', '.ts': '⚙️', '.json': '🔧',
        '.py': '🐍', '.sh': '💻', '.bat': '💻',
        '.html': '🌐', '.css': '🎨',
        '.apk': '📱', '.exe': '🖥️', '.bin': '🖥️',
        '.php': '🐘', '.sql': '🗃️',
    };
    return map[ext] || '📁';
}

app.get('/', (req, res) => {
    const settings = loadSettings();
    fs.readdir(SERVER_FOLDER, (err, files) => {
        if (err) return res.status(500).send('Gagal membaca folder');

        const fileData = files.map(file => {
            try {
                const stat = fs.statSync(path.join(SERVER_FOLDER, file));
                return { name: file, size: formatSize(stat.size), mtime: stat.mtime.toISOString() };
            } catch {
                return { name: file, size: '?', mtime: '' };
            }
        }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

        const fileListHTML = fileData.map(f => `
            <li data-name="${f.name.toLowerCase()}">
                <div class="file-info">
                    <span class="file-icon">${getIcon(f.name)}</span>
                    <div class="file-meta">
                        <a href="/files/${encodeURIComponent(f.name)}" download class="file-name">${f.name}</a>
                        <span class="file-size">${f.size}</span>
                    </div>
                </div>
                <button class="del-btn" onclick="confirmDelete('${f.name.replace(/'/g, "\\'")}')">🗑️</button>
            </li>`).join('');

        const lastFile = fileData.length > 0 ? fileData[0] : null;

        res.send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>ShareIksun</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #eef2f7; color: #333; padding: 16px; }
        h1 { text-align: center; font-size: 1.8rem; color: #1a73e8; margin-bottom: 18px; letter-spacing: 1px; }
        h1 span { color: #555; font-weight: 400; font-size: 1rem; display: block; }
        .box { background: #fff; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 640px; margin-left: auto; margin-right: auto; }
        .box h2 { font-size: 1rem; color: #555; margin-bottom: 12px; font-weight: 600; }
        .upload-area { border: 2px dashed #1a73e8; border-radius: 10px; padding: 24px 16px; text-align: center; background: #f0f6ff; cursor: pointer; transition: background 0.2s; position: relative; }
        .upload-area:hover, .upload-area.drag-over { background: #dceeff; }
        .upload-area input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .upload-area .upload-icon { font-size: 2.5rem; }
        .upload-area .upload-label { font-size: 0.95rem; color: #1a73e8; margin-top: 6px; }
        .upload-area .upload-hint { font-size: 0.78rem; color: #999; margin-top: 4px; }
        #selected-files { font-size: 0.82rem; color: #555; margin-top: 8px; min-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        button.upload-btn { display: block; width: 100%; margin-top: 12px; padding: 11px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
        button.upload-btn:hover { background: #1558b0; }
        button.upload-btn:disabled { background: #aaa; cursor: not-allowed; }
        #progress { width: 100%; background: #e0e0e0; height: 18px; border-radius: 10px; margin-top: 12px; display: none; }
        #bar { width: 0%; height: 100%; background: #1a73e8; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.75rem; font-weight: bold; position: relative; overflow: hidden; transition: width 0.2s; }
        #bar::after { content: ''; position: absolute; top: 0; left: -60%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 1.5s infinite; }
        @keyframes shimmer { to { left: 110%; } }
        #notification { margin-top: 10px; padding: 10px 14px; border-radius: 8px; font-size: 0.88rem; display: none; }
        .notif-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .notif-error { background: #fde8e8; color: #c62828; border: 1px solid #f5c6cb; }
        #last-upload { font-size: 0.82rem; color: #777; margin-top: 10px; padding: 8px 12px; background: #f7f7f7; border-radius: 8px; border-left: 3px solid #1a73e8; display: ${lastFile ? 'block' : 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .settings-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
        button.settings-btn { background: #f0f0f0; border: none; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; cursor: pointer; color: #555; }
        button.settings-btn:hover { background: #e0e0e0; }
        #searchInput { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; margin-bottom: 10px; outline: none; transition: border 0.2s; }
        #searchInput:focus { border-color: #1a73e8; }
        ul#fileList { list-style: none; padding: 0; }
        ul#fileList li { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 7px; background: #fafafa; transition: background 0.15s; }
        ul#fileList li:hover { background: #f0f6ff; }
        .file-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .file-icon { font-size: 1.4rem; flex-shrink: 0; }
        .file-meta { display: flex; flex-direction: column; min-width: 0; }
        a.file-name { color: #1a73e8; text-decoration: none; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: block; }
        a.file-name:hover { text-decoration: underline; }
        .file-size { font-size: 0.75rem; color: #999; margin-top: 2px; }
        button.del-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: background 0.15s; flex-shrink: 0; }
        button.del-btn:hover { background: #fde8e8; }
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; align-items: center; justify-content: center; }
        .overlay.show { display: flex; }
        .overlay-box { background: #fff; border-radius: 14px; padding: 28px 24px; width: 300px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
        .overlay-box h3 { font-size: 1rem; margin-bottom: 6px; }
        .overlay-box p { font-size: 0.85rem; color: #777; margin-bottom: 14px; word-break: break-all; }
        .overlay-box input[type="password"], .overlay-box input[type="number"] { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.95rem; margin-bottom: 10px; outline: none; text-align: center; }
        .overlay-error { font-size: 0.8rem; color: #e53935; margin-bottom: 10px; display: none; }
        .overlay-btns { display: flex; gap: 10px; }
        .overlay-btns button { flex: 1; padding: 9px; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; }
        .btn-cancel { background: #f0f0f0; color: #333; }
        .btn-danger { background: #e53935; color: #fff; }
        .btn-danger:hover { background: #c62828; }
        .btn-primary { background: #1a73e8; color: #fff; }
        .btn-primary:hover { background: #1558b0; }
        @media (max-width: 480px) { .overlay-box { width: 90%; } }
    </style>
</head>
<body>
    <h1>📦 ShareIksun <span>Local File Sharing</span></h1>

    <div class="box">
        <h2>⬆️ Upload Files <span style="font-weight:400;color:#aaa;font-size:0.8rem">— max ${settings.maxFileSizeMB} MB per file</span></h2>
        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area" id="dropZone">
                <input type="file" name="files" id="fileInput" multiple />
                <div class="upload-icon">☁️</div>
                <div class="upload-label">Klik atau seret file ke sini</div>
                <div class="upload-hint">Semua tipe file diizinkan</div>
            </div>
            <div id="selected-files"></div>
            <button type="submit" class="upload-btn" id="uploadBtn" disabled>Upload</button>
            <div id="progress"><div id="bar"><span id="percentage">0%</span></div></div>
            <div id="notification"></div>
        </form>
        <div id="last-upload">📌 Upload terakhir: <strong>${lastFile ? lastFile.name : ''}</strong> <span style="color:#aaa">(${lastFile ? lastFile.size : ''})</span></div>
    </div>

    <div class="box">
        <div class="settings-row">
            <button class="settings-btn" onclick="openSettings()">⚙️ Pengaturan</button>
        </div>
        <h2>📂 File List <span style="font-weight:400;color:#aaa">(${fileData.length} file)</span></h2>
        <input type="text" id="searchInput" placeholder="🔍 Cari file...">
        <ul id="fileList">${fileListHTML}</ul>
    </div>

    <!-- Delete overlay -->
    <div class="overlay" id="deleteOverlay">
        <div class="overlay-box">
            <h3>🗑️ Hapus File</h3>
            <p id="del-filename"></p>
            <input type="password" id="del-password" placeholder="Password" />
            <div class="overlay-error" id="del-error"></div>
            <div class="overlay-btns">
                <button class="btn-cancel" onclick="closeOverlay('deleteOverlay')">Batal</button>
                <button class="btn-danger" onclick="doDelete()">Hapus</button>
            </div>
        </div>
    </div>

    <!-- Settings overlay -->
    <div class="overlay" id="settingsOverlay">
        <div class="overlay-box">
            <h3>⚙️ Pengaturan</h3>
            <p>Masukkan password untuk melanjutkan</p>
            <input type="password" id="settings-password" placeholder="Password" />
            <div class="overlay-error" id="settings-pw-error"></div>
            <div id="settings-pw-form">
                <div class="overlay-btns">
                    <button class="btn-cancel" onclick="closeOverlay('settingsOverlay')">Batal</button>
                    <button class="btn-primary" onclick="verifySettingsPassword()">Masuk</button>
                </div>
            </div>
            <div id="settings-form" style="display:none;">
                <p style="margin-bottom:8px;font-size:0.85rem;color:#555;">Max file size (MB)</p>
                <input type="number" id="settings-maxsize" min="1" max="10240" value="${settings.maxFileSizeMB}" />
                <div class="overlay-error" id="settings-error"></div>
                <div class="overlay-btns">
                    <button class="btn-cancel" onclick="closeOverlay('settingsOverlay')">Batal</button>
                    <button class="btn-primary" onclick="doSaveSettings()">Simpan</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const fileInput = document.getElementById('fileInput');
        const selectedFilesDiv = document.getElementById('selected-files');
        const uploadBtn = document.getElementById('uploadBtn');
        const dropZone = document.getElementById('dropZone');

        fileInput.addEventListener('change', () => updateSelectedFiles(fileInput.files));
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateSelectedFiles(e.dataTransfer.files);
            }
        });

        function updateSelectedFiles(files) {
            if (!files.length) { selectedFilesDiv.textContent = ''; uploadBtn.disabled = true; return; }
            selectedFilesDiv.textContent = '📎 ' + Array.from(files).map(f => f.name).join(', ');
            uploadBtn.disabled = false;
        }

        const form = document.getElementById('uploadForm');
        const bar = document.getElementById('bar');
        const percentageEl = document.getElementById('percentage');
        const progressEl = document.getElementById('progress');
        const notifEl = document.getElementById('notification');

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!fileInput.files.length) return;
            progressEl.style.display = 'block';
            bar.style.width = '0%';
            percentageEl.textContent = '0%';
            notifEl.style.display = 'none';
            notifEl.className = '';
            uploadBtn.disabled = true;

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload');
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    bar.style.width = pct + '%';
                    percentageEl.textContent = pct + '%';
                }
            });
            xhr.onload = () => {
                uploadBtn.disabled = false;
                if (xhr.status === 200) {
                    const resp = JSON.parse(xhr.responseText);
                    notifEl.className = 'notif-success';
                    notifEl.textContent = '✅ Berhasil upload: ' + resp.files.join(', ');
                    notifEl.style.display = 'block';
                    document.getElementById('last-upload').style.display = 'block';
                    setTimeout(() => location.reload(), 3000);
                } else {
                    let msg = 'Upload gagal.';
                    try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
                    notifEl.className = 'notif-error';
                    notifEl.textContent = '❌ ' + msg;
                    notifEl.style.display = 'block';
                }
            };
            xhr.onerror = () => {
                uploadBtn.disabled = false;
                notifEl.className = 'notif-error';
                notifEl.textContent = '❌ Koneksi gagal.';
                notifEl.style.display = 'block';
            };
            xhr.send(new FormData(form));
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
            if (!pw) { errEl.textContent = '❌ Masukkan password dulu!'; errEl.style.display = 'block'; return; }
            const resp = await fetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: pendingDelete, password: pw })
            });
            const data = await resp.json();
            if (data.success) { closeOverlay('deleteOverlay'); location.reload(); }
            else { errEl.textContent = '❌ ' + (data.error || 'Password salah!'); errEl.style.display = 'block'; document.getElementById('del-password').value = ''; document.getElementById('del-password').focus(); }
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
            if (!pw) { errEl.textContent = '❌ Masukkan password dulu!'; errEl.style.display = 'block'; return; }
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
                errEl.textContent = '❌ Password salah!';
                errEl.style.display = 'block';
                document.getElementById('settings-password').value = '';
            }
        }
        async function doSaveSettings() {
            const val = parseInt(document.getElementById('settings-maxsize').value);
            const errEl = document.getElementById('settings-error');
            if (!val || val < 1) { errEl.textContent = '❌ Ukuran minimal 1 MB'; errEl.style.display = 'block'; return; }
            const resp = await fetch('/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: document.getElementById('settings-password').value, maxFileSizeMB: val })
            });
            const data = await resp.json();
            if (data.success) { closeOverlay('settingsOverlay'); location.reload(); }
            else { errEl.textContent = '❌ ' + (data.error || 'Gagal menyimpan'); errEl.style.display = 'block'; }
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
    if (!filePath.startsWith(base + path.sep)) return res.status(403).send('Akses ditolak');
    res.download(filePath, filename, err => {
        if (err && !res.headersSent) res.status(404).send('File tidak ditemukan');
    });
});

app.post('/upload', (req, res) => {
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
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Nama file tidak valid' });
    }
    const filePath = path.resolve(SERVER_FOLDER, path.basename(filename));
    const base = path.resolve(SERVER_FOLDER);
    if (!filePath.startsWith(base + path.sep)) return res.status(400).json({ success: false, error: 'Akses ditolak' });
    fs.unlink(filePath, err => {
        if (err) return res.status(500).json({ success: false, error: 'Gagal menghapus file' });
        res.json({ success: true });
    });
});

app.post('/settings/verify', (req, res) => {
    const { password } = req.body;
    res.json({ success: password === SETTINGS_PASSWORD });
});

app.post('/settings/save', (req, res) => {
    const { password, maxFileSizeMB } = req.body;
    if (password !== SETTINGS_PASSWORD) return res.status(403).json({ success: false, error: 'Password salah!' });
    const val = parseInt(maxFileSizeMB);
    if (!val || val < 1) return res.status(400).json({ success: false, error: 'Ukuran tidak valid' });
    saveSettings({ maxFileSizeMB: val });
    res.json({ success: true });
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
