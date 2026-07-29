module.exports = {
    cmd: 'alive',
    desc: 'Check bot online status',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        const imageUrl = '<a href="https://ibb.co/9mHXDL2n"><img src="https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png" alt="file-0000000002d48230a5ad48cf94c182d7" border="0"></a>'; // ඔයාට ඕන Image Link එකක් මෙතනට දාන්න පුළුවන්

        const aliveText = `*───────────────────*\n` +
                          `🎉 *${BOT_NAME} CONNECTED!* 🟢\n` +
                          `*───────────────────*\n\n` +
                          `🤖 *Bot Name:* ${BOT_NAME}\n` +
                          `⚙️ *Status:* Online & Active\n` +
                          `⚡ *Mode:* Public\n\n` +
                          `*Type .menu to get all commands!*`;

        await sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: aliveText 
        }, { quoted: msg });
    }
};
