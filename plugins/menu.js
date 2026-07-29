module.exports = {
    cmd: 'menu',
    desc: 'Display main command menu',
    handler: async (sock, msg, from, args, { BOT_NAME, PREFIX, commands }) => {
        // Alive එකට පාවිච්චි කරපු Image URL එකම මෙතනටත් යොදාගෙන ඇත
        const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

        let menuText = `*───────────────────*\n` +
                       `🤖 *${BOT_NAME} COMMAND MENU* 🤖\n` +
                       `*───────────────────*\n\n` +
                       `⚙️ *Prefix:* \`${PREFIX}\`\n` +
                       `📦 *Total Commands:* ${commands.size}\n` +
                       `🟢 *Status:* Online & Active\n\n` +
                       `*───────────────────*\n` +
                       `📌 *AVAILABLE COMMANDS:*\n` +
                       `*───────────────────*\n\n`;

        commands.forEach((plugin, name) => {
            menuText += `👉 *${PREFIX}${name}* \n   ┗ ℹ️ ${plugin.desc || 'No description available'}\n\n`;
        });

        menuText += `*───────────────────*\n` +
                    `💡 *Usage:* Type any command with prefix \`${PREFIX}\` (e.g. \`${PREFIX}alive\`)\n` +
                    `*───────────────────*`;

        await sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: menuText 
        }, { quoted: msg });
    }
};

