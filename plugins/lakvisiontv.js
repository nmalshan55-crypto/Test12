const axios = require("axios");

const pendingSearch = {};
const pendingQuality = {};

// Chama API endpoints
const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/search";
const INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/infodl";

function getDirectPixeldrainUrl(url) {
  if (!url) return null;
  const match = url.match(/pixeldrain\.com\/u\/(\w+)/);
  if (!match) return url;
  return `https://pixeldrain.com/api/file/${match[1]}?download`;
}

// 📦 MAIN EXPORT FOR INDEX.JS
module.exports = {
  cmd: "lakvision",
  alias: ["lak", "lakmovie"],
  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textMessage = args.join(" ").trim();

    // 💡 IF USER REPLIED WITH A NUMBER (.lak 1, .lak 2...)
    if (!isNaN(textMessage) && textMessage !== "") {
      const num = parseInt(textMessage);

      // STEP 1: Process Movie Choice
      if (pendingSearch[sender] && num > 0 && num <= pendingSearch[sender].results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = pendingSearch[sender].results[num - 1];
        delete pendingSearch[sender];

        await sock.sendMessage(from, { text: "📥 *Fetching movie details and links...*" }, { quoted: msg });
        
        try {
          const targetUrl = selected.link || selected.url || selected.href || selected.movieUrl;
          const infoUrl = `${INFODL_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
          const res = await axios.get(infoUrl, { timeout: 15000 });
          const movieData = res.data?.result;

          if (!movieData) {
            return sock.sendMessage(from, { text: "❌ *Failed to fetch download links for this movie.*" }, { quoted: msg });
          }

          const title = movieData.title || selected.title || "Lakvision Movie";
          const thumbnail = movieData.image || movieData.thumbnail || selected.thumb || "";
          const description = movieData.description || "N/A";
          const dlLinks = movieData.download_links || movieData.dl_links || movieData.links || [];

          let resMsg = `🎬 *${title}*\n\n`;
          if (description !== "N/A") resMsg += `📝 *Description:* ${description.slice(0, 300)}...\n\n`;

          if (Array.isArray(dlLinks) && dlLinks.length > 0) {
            resMsg += "📥 *Available Qualities / Downloads:*\n";
            dlLinks.forEach((d, i) => {
              const quality = d.quality || d.title || `Option ${i + 1}`;
              const size = d.size ? ` (${d.size})` : "";
              resMsg += `*${i + 1}.* ${quality}${size}\n`;
            });
            resMsg += "\n💡 *Reply with `.lak <number>` (e.g. `.lak 1`) to download the document.*";

            pendingQuality[sender] = { title, downloadLinks: dlLinks, timestamp: Date.now() };
          } else {
            resMsg += "❌ *No direct download links found for this movie.*";
          }

          if (thumbnail) {
            await sock.sendMessage(from, { image: { url: thumbnail }, caption: resMsg }, { quoted: msg });
          } else {
            await sock.sendMessage(from, { text: resMsg }, { quoted: msg });
          }
        } catch (err) {
          console.error("Info Fetch Error:", err.message);
          await sock.sendMessage(from, { text: "❌ *Error fetching movie details.*" }, { quoted: msg });
        }
        return;
      }

      // STEP 2: Process Quality Choice & Send Document
      if (pendingQuality[sender] && num > 0 && num <= pendingQuality[sender].downloadLinks.length) {
        await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

        const { title, downloadLinks } = pendingQuality[sender];
        delete pendingQuality[sender];

        const selectedDl = downloadLinks[num - 1];
        let fileUrl = selectedDl.link || selectedDl.url || selectedDl.download_url;
        const qualityName = selectedDl.quality || selectedDl.title || "Video";

        if (fileUrl && fileUrl.includes("pixeldrain.com")) {
          fileUrl = getDirectPixeldrainUrl(fileUrl);
        }

        await sock.sendMessage(from, { text: `⬇️ *Sending ${qualityName} movie file...*\n*Please wait...*` }, { quoted: msg });

        try {
          await sock.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `${title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ''),
            caption: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n> **AKASH-MD Lakvision Downloader** ✨`
          }, { quoted: msg });

        } catch (error) {
          console.error("Document Send Error:", error.message);
          await sock.sendMessage(from, { 
            text: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n🔗 *Download Link:*\n${fileUrl}` 
          }, { quoted: msg });
        }
        return;
      }
    }

    // 🔍 SEARCH MOVIE
    if (!textMessage) {
      return sock.sendMessage(from, { text: "🎬 *Lakvision Movie Search*\n\nUsage: `.lak <movie_name>`\nExample: `.lak Aladdin`" }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: "🔍 *Searching movies on Lakvisiontv...*" }, { quoted: msg });

    try {
      const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(textMessage)}&api_key=${API_KEY}`;
      const response = await axios.get(searchUrl, { timeout: 15000 });
      const searchResults = response.data?.result;

      if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
        return sock.sendMessage(from, { text: "❌ *No movies found! Try another name.*" }, { quoted: msg });
      }

      pendingSearch[sender] = { results: searchResults, timestamp: Date.now() };

      let text = "🎬 *Lakvisiontv Search Results:*\n\n";
      searchResults.slice(0, 10).forEach((m, i) => {
        const mTitle = m.title || m.name || "Movie";
        text += `*${i + 1}.* ${mTitle}\n`;
      });

      text += "\n💡 *Reply with `.lak <number>` (e.g. `.lak 1`) to select.*";
      return sock.sendMessage(from, { text }, { quoted: msg });

    } catch (e) {
      console.error("Lakvision Search API Error:", e.message);
      return sock.sendMessage(from, { text: "❌ *Search failed! Server error or timeout.*" }, { quoted: msg });
    }
  }
};
