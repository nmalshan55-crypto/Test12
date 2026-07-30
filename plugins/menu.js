module.exports = {
    cmd: 'menu',
    desc: 'Display all commands menu',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

        const menuText = `*───────────────────*\n` +
                         `🤖 *${BOT_NAME || 'AKASH-MD'} COMMAND MENU* 🤖\n` +
                         `*───────────────────*\n\n` +
                         `⚙️ *Status:* Online & Active\n` +
                         `⚡ *Mode:* Public\n\n` +
                         `*───────────────────*\n` +
                         `📌 *AVAILABLE COMMANDS:*\n` +
                         `*───────────────────*\n\n` +
                         `👉 *.alive* - Check bot status\n` +
                         `👉 *.menu* - Show command list\n` +
                         `👉 *.xnxx* - Search & Download videos\n\n` +
                         `*───────────────────*\n` +
                         `💡 *Usage:* Type any command above!\n` +
                         `*───────────────────*`;

        await sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: menuText 
        }, { quoted: msg });
    }
};

