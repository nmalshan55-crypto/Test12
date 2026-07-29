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

let sock;
const AUTH_DIR = path.join(__dirname, 'auth_info');
const commands = new Map();

// 📂 Load Plugins Function
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
                delete require.cache[require.resolve(pluginPath)]; // Clear cache for live reloads
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

// Initial plugin load
loadPlugins();

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
            const sessionMsg = `🎉 *${BOT_NAME} CONNECTED!*\n\n🔑 *Session Link:*\n\`\`\`${megaUrl}\`\`\``;
            await sock.sendMessage(userJid, { text: sessionMsg });
        }
    } catch (err) {
        console.error('❌ Mega Upload Error:', err);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
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
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log(`🔴 Connection Closed. Reconnecting...`);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`🟢 [${BOT_NAME}] Connected successfully!`);
            const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await delay(3000);
            await uploadSessionToMega(userJid);
        }
    });

    // 📩 Message Handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg || !msg.message) return;

        const from = msg.key.remoteJid;
        
        // Extract body text safely
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption || '';

        if (!body || !body.startsWith(PREFIX)) return;

        console.log(`📩 Command Received: ${body} from ${from}`);

        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.handler(sock, msg, from, args, { BOT_NAME, PREFIX, commands });
            } catch (err) {
                console.error(`❌ Error executing ${cmdName}:`, err);
                await sock.sendMessage(from, { text: `❌ *Error executing command:* ${err.message}` }, { quoted: msg });
            }
        }
    });
}

app.get('/', (req, res) => {
    res.send(`<h2>${BOT_NAME} Active! Plugins Loaded: ${commands.size}</h2>`);
});

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
        if (!sock.authState.creds.registered) {
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
    console.log(`🌐 Server running on port ${PORT}`);
    startBot();
});
