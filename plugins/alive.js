module.exports = {
    cmd: 'alive',
    desc: 'Check bot online status',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        // ඔයා හදාගත්තු Direct Image Link එක මෙතනට දැම්මා
        const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

        const aliveText = `*───────────────────*\n` +
                          `🎉 *AKASH-MD CONNECTED!* 🟢\n` +
                          `*───────────────────*\n\n` +
                          `🤖 *Bot Name:* ${BOT_NAME || 'AKASH-MD'}\n` +
                          `⚙️ *Status:* Online & Active\n` +
                          `⚡ *Mode:* Public\n\n` +
                          `*Type .menu to get all commands!*`;

        await sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: aliveText 
        }, { quoted: msg });
    }
};
