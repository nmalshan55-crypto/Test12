module.exports = {
    cmd: 'menu',
    desc: 'Display all commands menu',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

        const menuText = `┌───「 *${BOT_NAME || 'AKASH-MD'} MENU* 」───\n` +
                         `│\n` +
                         `│ ⚙️ *Status:* Online & Active\n` +
                         `│ ⚡ *Mode:* Public\n` +
                         `│\n` +
                         `├───「 *COMMANDS LIST* 」───\n` +
                         `│\n` +
                         `├ 🤖 *.alive* - Check status\n` +
                         `├ 📋 *.menu* - Show this menu\n` +
                         `├ 🎵 *.song* - Download MP3\n` +
                         `├ 🎬 *.video* - Download MP4\n` +
                         `├ 📱 *.tiktok* - Download TikTok\n` +
                         `└ 🔞 *.xnxx* - Search Videos\n` +
                         `│\n` +
                         `─────────────────────`;

        await sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: menuText 
        }, { quoted: msg });
    }
};
