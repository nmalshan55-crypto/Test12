const axios = require('axios');

module.exports = {
    cmd: 'xnxx',
    desc: 'Download videos from XNXX',
    handler: async (sock, msg, from, args) => {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(from, { text: '⚠️ කරුණාකර Search කරන්න ඕන නම හෝ Link එක ලබාදෙන්න!\n\n*Example:* `.xnxx japanese`' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⏳ *Searching & Fetching Video... Please wait!*' }, { quoted: msg });

            // Using stable public scraper API
            const res = await axios.get(`https://api.agatz.xyz/api/xnxx?q=${encodeURIComponent(query)}`);
            const data = res.data;

            if (!data || data.status !== 200 || !data.data || data.data.length === 0) {
                return await sock.sendMessage(from, { text: '❌ වීඩියෝව හමු වූයේ නැත. වෙනත් නමක් Try කරන්න!' }, { quoted: msg });
            }

            const video = data.data[0];
            const caption = `🔞 *XNXX DOWNLOADER*\n\n` +
                            `📌 *Title:* ${video.title}\n` +
                            `⏱️ *Duration:* ${video.duration || 'N/A'}\n\n` +
                            `⬇️ *Downloading video...*`;

            // Send Info & Thumbnail first
            if (video.image) {
                await sock.sendMessage(from, { image: { url: video.image }, caption: caption }, { quoted: msg });
            }

            // Fetch Direct Download Link
            const dlRes = await axios.get(`https://api.agatz.xyz/api/xnxxdl?url=${encodeURIComponent(video.link)}`);
            const dlData = dlRes.data;

            const mediaUrl = dlData.data.files.high || dlData.data.files.low;

            if (mediaUrl) {
                await sock.sendMessage(from, { 
                    video: { url: mediaUrl }, 
                    caption: `✅ *${video.title}*`,
                    mimetype: 'video/mp4'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Video file එක Download කරගැනීමට නොහැකි විය.' }, { quoted: msg });
            }

        } catch (err) {
            console.error('XNXX Error:', err);
            await sock.sendMessage(from, { text: '❌ Error එකක් ආවා! API එක දැනට වැඩ නැති වෙන්න පුළුවන්.' }, { quoted: msg });
        }
    }
};

