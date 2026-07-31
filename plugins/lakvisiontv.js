const axios = require("axios");

const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/search";
const INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/infodl";

// User Session Memory
const pendingSearch = new Map();
const pendingDownload = new Map();

// 1. SEARCH FUNCTION
async function searchLakvision(query) {
  try {
    const url = `${SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
    const response = await axios.get(url, { timeout: 15000 });
    
    // Chama API Response handling
    if (response.data && response.data.result) {
      return Array.isArray(response.data.result) ? response.data.result : [];
    }
    return [];
  } catch (e) {
    console.error("Lakvision Search API Error:", e.message);
    return [];
  }
}

// 2. FETCH MOVIE INFO & DOWNLOAD LINKS FUNCTION
async function getLakvisionInfoDl(movieUrl) {
  try {
    const url = `${INFODL_API}?q=${encodeURIComponent(movieUrl)}&api_key=${API_KEY}`;
    const response = await axios.get(url, { timeout: 15000 });

    if (response.data && response.data.result) {
      return response.data.result;
    }
    return null;
  } catch (e) {
    console.error("Lakvision InfoDL API Error:", e.message);
    return null;
  }
}

module.exports = {
  cmd: "lakvision",
  alias: ["lak", "lakmovie"],
  desc: "Search and download movies via Chama Lakvision API",

  handler: async (sock, msg, from, args, { PREFIX }) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(from, { 
        text: `🎬 *Lakvisiontv Movie Search*\n\nUsage: \`${PREFIX}lakvision <movie_name>\`\nExample: \`${PREFIX}lakvision Aladdin\`` 
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: `🔍 *Searching movies on Chama API:* "${query}"...` }, { quoted: msg });
    const searchResults = await searchLakvision(query);

    if (!searchResults || searchResults.length === 0) {
      return sock.sendMessage(from, { text: "❌ *No movies found! Try another name.*" }, { quoted: msg });
    }

    // Save user search session
    pendingSearch.set(sender, { results: searchResults, timestamp: Date.now() });

    let text = "🎬 *LAKVISIONTV SEARCH RESULTS:*\n\n";
    searchResults.slice(0, 10).forEach((m, i) => {
      const mTitle = m.title || m.name || "Movie";
      text += `*${i + 1}.* ${mTitle}\n`;
    });

    text += "\n💡 *Reply with the number (e.g. 1, 2) to select.*";
    return sock.sendMessage(from, { text }, { quoted: msg });
  },

  // 💡 HANDLE DIRECT NUMBER REPLIES (1, 2, 3...)
  onText: async (sock, msg, from, body) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textTrimmed = body ? body.trim() : "";

    if (isNaN(textTrimmed) || textTrimmed === "") return false;
    const num = parseInt(textTrimmed);

    // STEP 1: Process Movie Selection
    if (pendingSearch.has(sender)) {
      const session = pendingSearch.get(sender);

      if (num > 0 && num <= session.results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = session.results[num - 1];
        pendingSearch.delete(sender); // Clear search session

        await sock.sendMessage(from, { text: "📥 *Fetching movie details & download links...*" }, { quoted: msg });

        const targetUrl = selected.link || selected.url || selected.href;
        const movieData = await getLakvisionInfoDl(targetUrl);

        if (!movieData) {
          return sock.sendMessage(from, { text: "❌ *Failed to fetch download links!*" }, { quoted: msg });
        }

        const title = movieData.title || selected.title || "Movie Details";
        const image = movieData.image || movieData.thumbnail || selected.image || "";
        const desc = movieData.description || "N/A";
        const dlLinks = movieData.download_links || movieData.dl_links || movieData.links || [];

        let resMsg = `🎬 *${title}*\n\n`;
        if (desc !== "N/A") resMsg += `📝 *Description:* ${desc}\n\n`;

        if (Array.isArray(dlLinks) && dlLinks.length > 0) {
          resMsg += "📥 *Available Download Options:*\n";
          dlLinks.forEach((d, i) => {
            const quality = d.quality || d.title || `Option ${i + 1}`;
            const size = d.size ? ` (${d.size})` : "";
            resMsg += `*${i + 1}.* ${quality}${size}\n`;
          });
          resMsg += "\n💡 *Reply with the Quality number (e.g. 1) to download.*";

          pendingDownload.set(sender, { title, dlLinks, timestamp: Date.now() });
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
    }

    // STEP 2: Process Quality Selection & Download
    if (pendingDownload.has(sender)) {
      const session = pendingDownload.get(sender);

      if (num > 0 && num <= session.dlLinks.length) {
        await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

        const { title, dlLinks } = session.dlLinks;
        pendingDownload.delete(sender); // Clear download session

        const selectedDl = session.dlLinks[num - 1];
        const fileUrl = selectedDl.link || selectedDl.url || selectedDl.download_url;
        const qualityName = selectedDl.quality || selectedDl.title || "Video";

        await sock.sendMessage(from, { text: `⬇️ *Processing download (${qualityName})...*\n*Please wait...*` }, { quoted: msg });

        try {
          await sock.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `${session.title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ''),
            caption: `🎬 *${session.title}*\n📊 *Quality:* ${qualityName}\n\n> **Lakvision Downloader** ✨`
          }, { quoted: msg });
        } catch (error) {
          console.error("Document Send Error:", error.message);
          await sock.sendMessage(from, {
            text: `🎬 *${session.title}*\n📊 *Quality:* ${qualityName}\n\n🔗 *Download Link:*\n${fileUrl}`
          }, { quoted: msg });
        }
        return true;
      }
    }

    return false;
  }
};
