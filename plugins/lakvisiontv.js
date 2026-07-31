const axios = require("axios");

const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/search";
const INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/infodl";

// Memory storage for user sessions
const pendingSearch = {};
const pendingDownload = {};

// 1. SEARCH MOVIES FUNCTION
async function searchLakvision(query) {
  try {
    const response = await axios.get(`${SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`);
    
    if (response.data && response.data.result) {
      return response.data.result;
    } else if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (e) {
    console.error("Lakvision Search Error:", e.message);
    return [];
  }
}

// 2. FETCH MOVIE INFO & DOWNLOAD LINKS FUNCTION
async function getLakvisionInfoDl(movieUrl) {
  try {
    const response = await axios.get(`${INFODL_API}?q=${encodeURIComponent(movieUrl)}&api_key=${API_KEY}`);
    
    if (response.data) {
      return response.data.result || response.data;
    }
    return null;
  } catch (e) {
    console.error("Lakvision InfoDL Error:", e.message);
    return null;
  }
}

// 📦 MAIN EXPORT FOR INDEX.JS
module.exports = {
  cmd: "lakvision",
  alias: ["lak", "lakmovie"],
  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textMessage = args.join(" ").trim();

    // 🔍 SEARCH MOVIE
    if (!textMessage) {
      return sock.sendMessage(from, { 
        text: "🎬 *Lakvisiontv Movie Search*\n\nUsage: `.lakvision <movie_name>`\nExample: `.lakvision Aladdin`" 
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: "🔍 *Searching movies on Lakvisiontv...*" }, { quoted: msg });
    const searchResults = await searchLakvision(textMessage);

    if (!searchResults || !searchResults.length) {
      return sock.sendMessage(from, { text: "❌ *No movies found! Try another name.*" }, { quoted: msg });
    }

    pendingSearch[sender] = { results: searchResults, timestamp: Date.now() };

    let text = "🎬 *Lakvisiontv Search Results:*\n\n";
    searchResults.slice(0, 10).forEach((m, i) => {
      const mTitle = m.title || m.name || "Movie";
      text += `*${i + 1}.* ${mTitle}\n`;
    });

    text += "\n💡 *Reply with the number (e.g. 1, 2) to select.*";
    return sock.sendMessage(from, { text }, { quoted: msg });
  },

  // 💡 LISTEN FOR DIRECT NUMBER REPLIES (1, 2, 3...)
  onText: async (sock, msg, from, body) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textTrimmed = body ? body.trim() : "";

    if (isNaN(textTrimmed) || textTrimmed === "") return;
    const num = parseInt(textTrimmed);

    // STEP 1: Process Movie Selection from Search Results
    if (pendingSearch[sender] && num > 0 && num <= pendingSearch[sender].results.length) {
      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

      const selected = pendingSearch[sender].results[num - 1];
      delete pendingSearch[sender];

      await sock.sendMessage(from, { text: "📥 *Fetching movie details & download links...*" }, { quoted: msg });
      
      const targetUrl = selected.link || selected.url || selected.movieUrl || selected.href;
      const movieData = await getLakvisionInfoDl(targetUrl);

      if (!movieData) {
        return sock.sendMessage(from, { text: "❌ *Failed to fetch download links!*" }, { quoted: msg });
      }

      const title = movieData.title || selected.title || "Movie Details";
      const image = movieData.image || movieData.thumbnail || selected.image || selected.thumb || "";
      const desc = movieData.description || movieData.desc || "N/A";
      const dlLinks = movieData.dl_links || movieData.download_links || movieData.links || [];

      let resMsg = `🎬 *${title}*\n\n`;
      if (desc !== "N/A") resMsg += `📝 *Description:* ${desc}\n\n`;

      if (dlLinks && dlLinks.length > 0) {
        resMsg += "📥 *Available Download Options:*\n";
        dlLinks.forEach((d, i) => {
          const quality = d.quality || d.title || `Option ${i + 1}`;
          const size = d.size ? ` (${d.size})` : "";
          resMsg += `*${i + 1}.* ${quality}${size}\n`;
        });
        resMsg += "\n💡 *Reply with the Quality number (e.g. 1) to download.*";

        pendingDownload[sender] = { title, dlLinks, timestamp: Date.now() };
      } else if (movieData.direct_link || movieData.download_url) {
        const directUrl = movieData.direct_link || movieData.download_url;
        resMsg += `🔗 *Direct Download Link:*\n${directUrl}`;
      } else {
        resMsg += "❌ *No download links found for this movie.*";
      }

      if (image) {
        await sock.sendMessage(from, { image: { url: image }, caption: resMsg }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: resMsg }, { quoted: msg });
      }
      return true;
    }

    // STEP 2: Process Download Selection & Send File/Link
    if (pendingDownload[sender] && num > 0 && num <= pendingDownload[sender].dlLinks.length) {
      await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

      const { title, dlLinks } = pendingDownload[sender];
      delete pendingDownload[sender];

      const selectedDl = dlLinks[num - 1];
      const fileUrl = selectedDl.link || selectedDl.url || selectedDl.download_url;
      const qualityName = selectedDl.quality || selectedDl.title || "Video";

      await sock.sendMessage(from, { text: `⬇️ *Processing your download (${qualityName})...*\n*Please wait a moment.*` }, { quoted: msg });

      try {
        await sock.sendMessage(from, {
          document: { url: fileUrl },
          mimetype: "video/mp4",
          fileName: `${title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ''),
          caption: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n> **Lakvision Movie Downloader** ✨`
        }, { quoted: msg });

      } catch (error) {
        console.error("Document Send Error:", error.message);
        await sock.sendMessage(from, {
          text: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n🔗 *Download Link:*\n${fileUrl}`
        }, { quoted: msg });
      }
      return true;
    }

    return false;
  }
};

// CLEANUP TIMEOUT (Clear memory every 10 mins)
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000;
  for (const s in pendingSearch) if (now - pendingSearch[s].timestamp > timeout) delete pendingSearch[s];
  for (const s in pendingDownload) if (now - pendingDownload[s].timestamp > timeout) delete pendingDownload[s];
}, 5 * 60 * 1000);

