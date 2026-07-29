module.exports = {
    cmd: 'menu',
    desc: 'Display all commands',
    handler: async (sock, msg, from, args, { BOT_NAME, PREFIX, commands }) => {
        try {
            const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

            let menuText = `*───────────────────*\n` +
                           `🤖 *${BOT_NAME} COMMAND MENU* 🤖\n` +
                           `*───────────────────*\n\n` +
                           `⚙️ *Prefix:* \`${PREFIX}\`\n` +
                           `🟢 *Status:* Online & Active\n\n` +
                           `*───────────────────*\n` +
                           `📌 *AVAILABLE COMMANDS:*\n` +
                           `*───────────────────*\n\n`;

            if (commands && commands instanceof Map) {
                commands.forEach((plugin, name) => {
                    menuText += `👉 *${PREFIX}${name}*\n   ┗ ℹ️ ${plugin.desc || 'No description'}\n\n`;
                });
            } else if (commands && typeof commands === 'object') {
                for (const name in commands) {
                    const plugin = commands[name];
                    menuText += `👉 *${PREFIX}${name}*\n   ┗ ℹ️ ${plugin.desc || 'No description'}\n\n`;
                }
            } else {
                menuText += `👉 *${PREFIX}alive*\n   ┗ ℹ️ Check bot status\n\n`;
                menuText += `👉 *${PREFIX}menu*\n   ┗ ℹ️ Display menu\n\n`;
            }

            menuText += `*───────────────────*\n` +
                        `💡 *Type any command to execute!*\n` +
                        `*───────────────────*`;

            await sock.sendMessage(from, { 
                image: { url: imageUrl }, 
                caption: menuText 
            }, { quoted: msg });

        } catch (err) {
            console.error('Menu Error:', err);
            await sock.sendMessage(from, { text: `❌ Menu Error: ${err.message}` }, { quoted: msg });
        }
    }
};
