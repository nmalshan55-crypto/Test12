const { ytmp4 } = require("sadaslk-dlcore");
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
    cmd: 'video',
    alias: ['ytv', 'ytmp4'],
    desc: 'Download YouTube MP4 Video',
    handler: async (sock, msg, from, args) => {
        try {
            const q = args.join(" ");
            if (!q) return await sock.sendMessage(from, { text: "🎬 Send video name or YouTube link!" }, { quoted: msg });

            await sock.sendMessage(from, { text: "🔎 Searching YouTube..." }, { quoted: msg });
            const video = await getYoutube(q);
            if (!video) return await sock.sendMessage(from, { text: "❌ No results found!" }, { quoted: msg });

            const caption = `🎬 *${video.title}*\n\n` +
                            `👤 Channel: ${video.author.name}\n` +
                            `⏱ Duration: ${video.timestamp}\n` +
                            `🔗 ${video.url}`;

            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption }, { quoted: msg });
            await sock.sendMessage(from, { text: "⬇️ Downloading Video..." }, { quoted: msg });

            const data = await ytmp4(video.url, { format: "mp4", videoQuality: "720" });
            if (!data?.url) return await sock.sendMessage(from, { text: "❌ Failed to download video" }, { quoted: msg });

            await sock.sendMessage(from, {
                video: { url: data.url },
                mimetype: "video/mp4",
                caption: "🎬 YouTube Video"
            }, { quoted: msg });

        } catch (e) {
            console.log("VIDEO ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Error downloading video!" }, { quoted: msg });
        }
    }
};

