const { tiktok } = require("sadaslk-dlcore");

module.exports = {
    cmd: 'tiktok',
    alias: ['tt'],
    desc: 'Download TikTok video without watermark',
    handler: async (sock, msg, from, args) => {
        try {
            const q = args.join(" ");
            if (!q) return await sock.sendMessage(from, { text: "📱 Send TikTok link!" }, { quoted: msg });

            await sock.sendMessage(from, { text: "⬇️ Downloading TikTok video..." }, { quoted: msg });

            const data = await tiktok(q);
            if (!data?.no_watermark) return await sock.sendMessage(from, { text: "❌ Failed to download TikTok video!" }, { quoted: msg });

            const caption = `🎵 *${data.title || "TikTok Video"}*\n\n` +
                            `👤 Author: ${data.author || "Unknown"}\n` +
                            `⏱ Duration: ${data.runtime || 'N/A'}s`;

            await sock.sendMessage(from, {
                video: { url: data.no_watermark },
                caption: caption
            }, { quoted: msg });

        } catch (e) {
            console.log("TIKTOK ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Error downloading TikTok video!" }, { quoted: msg });
        }
    }
};

