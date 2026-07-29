module.exports = {
    cmd: 'alive',
    desc: 'Check bot online status',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        const imageUrl = 'https://i.ibb.co/689N3M4/alive-image.jpg'; // ඔයාට ඕන Image Link එකක් මෙතනට දාන්න පුළුවන්

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
