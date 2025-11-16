const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode-terminal'); // ✅ QR terminal

const app = express();
const PORT = 5000;
const SERVER_FOLDER = 'server_folder';

if (!fs.existsSync(SERVER_FOLDER)) fs.mkdirSync(SERVER_FOLDER);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SERVER_FOLDER),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Serve files langsung dari server_folder
app.use(express.static(SERVER_FOLDER));
app.use(express.urlencoded({ extended: true }));

// Halaman utama
app.get('/', (req, res) => {
    fs.readdir(SERVER_FOLDER, (err, files) => {
        if (err) return res.status(500).send('Gagal membaca file');

        const fileList = files.map(file => 
            `<li><a href="${file}" download style="color:#007BFF;">${file}</a></li>`).join('');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>ShareIksun</title>
            <style>
                body { font-family: sans-serif; max-width: 600px; margin: 20px auto; padding: 10px; background: #f5f5f5; }
                .box { background: #fff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                h1 { text-align: center; color: #333; }
                h2 { margin-top: 0; }
                form { margin-bottom: 0; }
                input[type="file"] { width: 100%; padding: 10px; }
                button { padding: 10px 15px; background: #007BFF; border: none; color: white; border-radius: 5px; cursor: pointer; }
                ul { list-style: none; padding: 0; }
                li a { display: block; padding: 10px; background: #fff; border: 1px solid #ddd; margin-bottom: 5px; color: #007BFF; text-decoration: none; border-radius: 5px; }
                li a:hover { background: #e0e0e0; }
                #progress { width: 100%; background: #ccc; height: 20px; border-radius: 10px; margin-top: 10px; }
                #bar {
                    width: 0%;
                    height: 100%;
                    background: #007BFF;
                    border-radius: 10px;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                }
                #bar::after {
                    content: '';
                    position: absolute;
                    top: 0; left: -50%;
                    width: 100%; height: 100%;
                    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
                    animation: wave 2s infinite linear;
                }
                @keyframes wave {
                    0% { transform: translateX(-50%); }
                    100% { transform: translateX(150%); }
                }
                #percentage { z-index: 1; }
                #notification { margin-top: 15px; padding: 10px; background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 5px; display: none; }
                #searchInput { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
            </style>
        </head>
        <body>
            <h1>ShareIksun</h1>
            <div class="box">
                <h2>Upload Files</h2>
                <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="files" multiple />
                    <button type="submit">Upload</button>
                    <div id="progress"><div id="bar"><div id="percentage">0%</div></div></div>
                </form>
                <div id="notification"></div>
            </div>
            <div class="box">
                <h2>File List</h2>
                <input type="text" id="searchInput" onkeyup="searchFiles()" placeholder="Search for files..">
                <ul id="fileList">${fileList}</ul>
            </div>
            <script>
                const form = document.getElementById('uploadForm');
                const bar = document.getElementById('bar');
                const fileInput = document.querySelector('input[type="file"]');
                const fileListElement = document.getElementById('fileList');

                function searchFiles() {
                    const input = document.getElementById('searchInput');
                    const filter = input.value.toLowerCase();
                    const ul = document.getElementById("fileList");
                    const items = ul.querySelectorAll('li');

                    items.forEach(item => {
                        const a = item.querySelector("a");
                        if (a) {
                            const text = a.textContent || a.innerText;
                            if (text.toLowerCase().includes(filter)) {
                                item.style.display = "";
                            } else {
                                item.style.display = "none";
                            }
                        }
                    });
                }

                form.addEventListener('submit', function(e) {
                    e.preventDefault();

                    if (fileInput.files.length === 0) {
                        alert("Please select at least one file to upload.");
                        return;
                    }

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/upload');
                    xhr.upload.addEventListener('progress', e => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            bar.style.width = percent + '%';
                            document.getElementById('percentage').textContent = percent + '%';
                        }
                    });

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            const response = JSON.parse(xhr.responseText);
                            const notification = document.getElementById('notification');
                            notification.textContent = response.message + ': ' + response.files.join(', ');
                            notification.style.display = 'block';

                            setTimeout(() => {
                                location.reload();
                            }, 3000); // Reload after 3 seconds
                        } else {
                            alert('Upload failed.');
                        }
                    };

                    const formData = new FormData(form);
                    xhr.send(formData);
                });
            </script>
        </body>
        </html>`;
        res.send(html);
    });
});

// Upload multiple files
app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded');
    }

    const uploadedFiles = req.files.map(f => f.originalname);
    res.json({ message: 'Successfully uploaded', files: uploadedFiles });
});

// Get IP address
const getLocalIPs = () => {
    const nets = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                results.push(net.address);
            }
        }
    }
    return results;
};

app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('ShareIksun Server is running!\n');
    ips.forEach(ip => {
        const url = `http://${ip}:${PORT}`;
        console.log(url);
        QRCode.generate(url, { small: true }); // ✅ Tampilkan QR code
    });
});
