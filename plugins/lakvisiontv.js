const axios = require("axios");

// API Credentials & Endpoints
const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/search";
const INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/infodl";

// Custom Footer Config
const DEFAULT_FOOTER = "> *✦ ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝙰𝙺𝙰𝚂𝙷 ✦*";

// Memory storage for user reply sessions
const pendingSearch = new Map();
const pendingQuality = new Map();

module.exports = {
  cmd: "lakvision",
  alias: ["lak", "lakmovie"],
  desc: "Search & Download movies/series from Lakvision via Chama API",

  // 1. MAIN COMMAND HANDLER (.lak <movie_name>)
  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(from, {
        text: `🎬 *LAKVISION MOVIE & SERIES SEARCH*\n\nUsage: \`.lak <movie_name>\`\nExample: \`.lak Aladdin\`\n\n${DEFAULT_FOOTER}`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: `🔍 *Searching Lakvision for:* "${query}"...` }, { quoted: msg });

    try {
      const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
      const response = await axios.get(searchUrl, { timeout: 15000 });
      
      const results = response.data?.data || response.data?.result || response.data;

      if (!results || !Array.isArray(results) || results.length === 0) {
        return sock.sendMessage(from, { text: `❌ *No movies or series found for "${query}"!*` }, { quoted: msg });
      }

      // Limit results up to 30 as requested
      const searchResults = results.slice(0, 30);
      
      // Save state for direct reply (1, 2, 3...)
      pendingSearch.set(sender, { results: searchResults, timestamp: Date.now() });

      let text = `🎬 *LAKVISION SEARCH RESULTS*\n\n`;
      searchResults.forEach((m, i) => {
        const num = (i + 1).toString().padStart(2, "0");
        const title = m.title || m.name || "Movie / Series";
        text += `*${num}* ❯❯ ${title}\n`;
      });

      text += `\n💡 *Reply to this message with the number (e.g., 1 or 01) to select.*\n\n${DEFAULT_FOOTER}`;
      return sock.sendMessage(from, { text }, { quoted: msg });

    } catch (err) {
      console.error("Lakvision Search Error:", err.message);
      return sock.sendMessage(from, { text: "❌ *Failed to fetch search results. Server error or API rate limit.*" }, { quoted: msg });
    }
  },

  // 2. DIRECT REPLY LISTENER (Catches simple text replies like '1', '2', '03')
  onText: async (sock, msg, from, body) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const input = body ? body.trim() : "";

    // Check if input is a pure number
    if (isNaN(input) || input === "") return false;
    const num = parseInt(input, 10);

    // -------------------------------------------------------------
    // STEP 1: Process Search Result Selection (Replies '1' to '30')
    // -------------------------------------------------------------
    if (pendingSearch.has(sender)) {
      const session = pendingSearch.get(sender);

      if (num > 0 && num <= session.results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = session.results[num - 1];
        pendingSearch.delete(sender); // Clear search session

        await sock.sendMessage(from, { text: "📥 *Fetching movie details & download links...*" }, { quoted: msg });

        try {
          const targetUrl = selected.link || selected.url || selected.href || selected.movieUrl;
          const infoUrl = `${INFODL_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
          
          const response = await axios.get(infoUrl, { timeout: 20000 });
          const movieData = response.data?.data || response.data?.result || response.data;

          if (!movieData) {
            return sock.sendMessage(from, { text: "❌ *Failed to retrieve download details for this title.*" }, { quoted: msg });
          }

          const title = movieData.title || selected.title || "Movie / Series";
          const thumbnail = movieData.image || movieData.thumbnail || movieData.poster || selected.thumb || "";
          const description = movieData.description || movieData.desc || "N/A";
          const dlLinks = movieData.download_links || movieData.dl_links || movieData.links || movieData.downloadLinks || [];

          let detailsText = `🎬 *${title}*\n\n`;
          if (description !== "N/A") {
            detailsText += `📝 *Description:* ${description.slice(0, 250)}...\n\n`;
          }

          if (Array.isArray(dlLinks) && dlLinks.length > 0) {
            detailsText += "📥 *AVAILABLE DOWNLOAD OPTIONS:*\n\n";
            dlLinks.forEach((d, i) => {
              const qNum = (i + 1).toString().padStart(2, "0");
              const quality = d.quality || d.title || d.name || "Video Quality";
              const size = d.size ? ` (${d.size})` : "";
              detailsText += `*${qNum}* ❯❯ ${quality}${size}\n`;
            });

            detailsText += `\n💡 *Reply with the Quality number (e.g., 1) to start direct download.*\n\n${DEFAULT_FOOTER}`;
            
            // Save state for quality reply
            pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });

          } else if (movieData.direct_link || movieData.download_url) {
            const directUrl = movieData.direct_link || movieData.download_url;
            detailsText += `🔗 *Direct Download Link:*\n${directUrl}\n\n${DEFAULT_FOOTER}`;
          } else {
            detailsText += `❌ *No download options parsed for this item.*`;
          }

          if (thumbnail) {
            await sock.sendMessage(from, { image: { url: thumbnail }, caption: detailsText }, { quoted: msg });
          } else {
            await sock.sendMessage(from, { text: detailsText }, { quoted: msg });
          }
          return true;

        } catch (err) {
          console.error("Lakvision InfoDL Error:", err.message);
          await sock.sendMessage(from, { text: "❌ *Error fetching movie links from API.*" }, { quoted: msg });
          return true;
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Process Quality Selection & Direct Document Download
    // -------------------------------------------------------------
    if (pendingQuality.has(sender)) {
      const session = pendingQuality.get(sender);

      if (num > 0 && num <= session.dlLinks.length) {
        await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

        const { title, dlLinks } = session;
        pendingQuality.delete(sender); // Clear quality session

        const selectedDl = dlLinks[num - 1];
        let fileUrl = selectedDl.link || selectedDl.url || selectedDl.download_url || selectedDl.href;
        const qualityName = selectedDl.quality || selectedDl.title || "HD";

        // Append API Key if missing on proxy links
        if (fileUrl && fileUrl.includes("/proxy?") && !fileUrl.includes("api_key=")) {
          fileUrl += `&api_key=${API_KEY}`;
        }

        await sock.sendMessage(from, { 
          text: `⬇️ *Preparing & Uploading ${qualityName} directly to WhatsApp...*\n*Please wait a few moments...*` 
        }, { quoted: msg });

        try {
          // Send video file directly as Document with Custom Footer
          await sock.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `${title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ""),
            caption: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n${DEFAULT_FOOTER}`
          }, { quoted: msg });

        } catch (error) {
          console.error("Direct File Upload Error:", error.message);
          // Fallback if file exceeds WhatsApp limits
          await sock.sendMessage(from, { 
            text: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n⚠️ *Direct stream failed! Here is your Direct Download Link:*\n🔗 ${fileUrl}\n\n${DEFAULT_FOOTER}` 
          }, { quoted: msg });
        }
        return true;
      }
    }

    return false;
  }
};
