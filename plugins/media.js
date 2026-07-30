const { ytmp3, ytmp4, tiktok } = require("sadaslk-dlcore");
const yts = require("yt-search");

async function getYoutube(query) {
  const isUrl = /(youtube\.com|youtu\.be)/i.test(query);
  if (isUrl) {
    const id = query.split("v=")[1] || query.split("/").pop();
    return await yts({ videoId: id });
  }
  const search = await yts(query);
  return search.videos.length ? search.videos[0] : null;
}

module.exports = {
    cmd: 'song',
    desc: 'Download YouTube MP3',
    handler: async (sock, msg, from, args) => {
        try {
            const q = args.join(" ");
            if (!q) return await sock.sendMessage(from, { text: "🎵 Send song name or YouTube link!" }, { quoted: msg });

            await sock.sendMessage(from, { text: "🔎 Searching YouTube..." }, { quoted: msg });
            const video = await getYoutube(q);
            if (!video) return await sock.sendMessage(from, { text: "❌ No results found!" }, { quoted: msg });

            const caption = `🎵 *${video.title}*\n\n` +
                            `👤 Channel: ${video.author.name}\n` +
                            `⏱ Duration: ${video.timestamp}\n` +
                            `🔗 ${video.url}`;

            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption }, { quoted: msg });
            await sock.sendMessage(from, { text: "⬇️ Downloading MP3..." }, { quoted: msg });

            const data = await ytmp3(video.url);
            if (!data?.url) return await sock.sendMessage(from, { text: "❌ Failed to download MP3" }, { quoted: msg });

            await sock.sendMessage(from, {
                audio: { url: data.url },
                mimetype: "audio/mpeg"
            }, { quoted: msg });

        } catch (e) {
            console.log("SONG ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Error downloading audio!" }, { quoted: msg });
        }
    }
};
