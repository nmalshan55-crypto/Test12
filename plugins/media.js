const { ytmp3, ytmp4, tiktok } = require("sadaslk-dlcore");
const yts = require("yt-search");

// YouTube Search Helper Function
async function getYoutube(query) {
  const isUrl = /(youtube\.com|youtu\.be)/i.test(query);
  if (isUrl) {
    const id = query.split("v=")[1] || query.split("/").pop();
    const info = await yts({ videoId: id });
    return info;
  }

  const search = await yts(query);
  if (!search.videos.length) return null;
  return search.videos[0];
}

// 1. YTMP3 / SONG DOWNLOADER
module.exports = [
  {
    cmd: 'song',
    desc: 'Download YouTube MP3 Audio',
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
                        `👀 Views: ${video.views.toLocaleString()}\n` +
                        `🔗 ${video.url}`;

        await sock.sendMessage(from, {
          image: { url: video.thumbnail },
          caption: caption
        }, { quoted: msg });

        await sock.sendMessage(from, { text: "⬇️ Downloading MP3..." }, { quoted: msg });

        const data = await ytmp3(video.url);
        if (!data?.url) return await sock.sendMessage(from, { text: "❌ Failed to download MP3" }, { quoted: msg });

        await sock.sendMessage(from, {
          audio: { url: data.url },
          mimetype: "audio/mpeg"
        }, { quoted: msg });

      } catch (e) {
        console.log("YTMP3 ERROR:", e);
        await sock.sendMessage(from, { text: "❌ Error downloading audio!" }, { quoted: msg });
      }
    }
  },

  // 2. YTMP4 / VIDEO DOWNLOADER
  {
    cmd: 'video',
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
                        `👀 Views: ${video.views.toLocaleString()}\n` +
                        `🔗 ${video.url}`;

        await sock.sendMessage(from, {
          image: { url: video.thumbnail },
          caption: caption
        }, { quoted: msg });

        await sock.sendMessage(from, { text: "⬇️ Downloading video..." }, { quoted: msg });

        const data = await ytmp4(video.url, {
          format: "mp4",
          videoQuality: "720",
        });

        if (!data?.url) return await sock.sendMessage(from, { text: "❌ Failed to download video" }, { quoted: msg });

        await sock.sendMessage(from, {
          video: { url: data.url },
          mimetype: "video/mp4",
          caption: "🎬 YouTube Video"
        }, { quoted: msg });

      } catch (e) {
        console.log("YTMP4 ERROR:", e);
        await sock.sendMessage(from, { text: "❌ Error downloading video!" }, { quoted: msg });
      }
    }
  },

  // 3. TIKTOK DOWNLOADER
  {
    cmd: 'tiktok',
    desc: 'Download TikTok Video without watermark',
    handler: async (sock, msg, from, args) => {
      try {
        const q = args.join(" ");
        if (!q) return await sock.sendMessage(from, { text: "📱 Send TikTok video link!" }, { quoted: msg });

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
  }
];

