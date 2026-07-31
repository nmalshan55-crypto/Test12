const axios = require("axios");

// API Credentials & Endpoints
const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/search";
const INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/lakvision/infodl";

// Custom Footer Config
const DEFAULT_FOOTER = "> *✦ ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝙰𝙺𝙰𝚂🇭 ✦*";

// Memory storage for user reply sessions
const pendingSearch = new Map();
const pendingQuality = new Map();

// Helper to safely parse links array from API response
function extractDownloadLinks(data) {
  if (!data) return [];
  
  // 1. Direct array checks
  let links = data.download_links || data.dl_links || data.links || data.downloadLinks || data.servers || data.episodes || [];
  
  if (Array.isArray(links) && links.length > 0) {
    return links.map(item => {
      if (typeof item === 'string') {
        return { quality: "Standard HD / Direct Stream", link: item };
      }
      return {
        quality: item.quality || item.title || item.name || item.server || item.resolution || "Direct Video Stream",
        link: item.link || item.url || item.download_url || item.href || item.src,
        size: item.size || ""
      };
    }).filter(item => item.link);
  }

  // 2. Single direct link properties check
  const singleUrl = data.direct_link || data.download_url || data.stream_url || data.proxy_url || data.video_url || data.url || data.link;
  if (singleUrl && typeof singleUrl === 'string' && singleUrl.startsWith("http")) {
    return [{ quality: "Direct Download / Stream", link: singleUrl, size: "" }];
  }

  return [];
}

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
        text: `🎬 *LAKVISION MOVIE & SERIES SEARCH*\n\nUsage: \`.lak <movie_name>\`\nExample: \`.lak Kinduru Kumariyo\`\n\n${DEFAULT_FOOTER}`
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

        await sock.sendMessage(from, { text: "📥 *Fetching details & download links...*" }, { quoted: msg });

        try {
          const targetUrl = selected.link || selected.url || selected.href || selected.movieUrl;
          const infoUrl = `${INFODL_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
          
          const response = await axios.get(infoUrl, { timeout: 20000 });
          const rawData = response.data;
          const movieData = rawData?.data || rawData?.result || rawData;

          if (!movieData) {
            return sock.sendMessage(from, { text: "❌ *Failed to retrieve download details for this title.*" }, { quoted: msg });
          }

          const title = movieData.title || selected.title || "Movie / Episode";
          const thumbnail = movieData.image || movieData.thumbnail || movieData.poster || selected.thumb || "";
          const description = movieData.description || movieData.desc || "N/A";
          
          // Extract links array safely using our upgraded extractor
          const dlLinks = extractDownloadLinks(movieData);

          let detailsText = `🎬 *${title}*\n\n`;
          if (description !== "N/A" && description.length > 5) {
            detailsText += `📝 *Description:* ${description.slice(0, 250)}...\n\n`;
          }

          if (dlLinks.length > 0) {
            detailsText += "📥 *AVAILABLE DOWNLOAD OPTIONS:*\n\n";
            dlLinks.forEach((d, i) => {
              const qNum = (i + 1).toString().padStart(2, "0");
              const quality = d.quality;
              const size = d.size ? ` (${d.size})` : "";
              detailsText += `*${qNum}* ❯❯ ${quality}${size}\n`;
            });

            detailsText += `\n💡 *Reply with the Quality number (e.g., 1) to start direct download.*\n\n${DEFAULT_FOOTER}`;
            
            // Save state for quality reply
            pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });

          } else {
            // Fallback: If no links array was parsed, show page/watch link
            detailsText += `⚠️ *No video stream parsed directly by API.*\n🔗 *Watch / Download Link:*\n${targetUrl}\n\n${DEFAULT_FOOTER}`;
          }

          if (thumbnail) {
            await sock.sendMessage(from, { image: { url: thumbnail }, caption: detailsText }, { quoted: msg });
          } else {
            await sock.sendMessage(from, { text: detailsText }, { quoted: msg });
          }
          return true;

        } catch (err) {
          console.error("Lakvision InfoDL Error:", err.message);
          await sock.sendMessage(from, { text: "❌ *Error fetching details from API.*" }, { quoted: msg });
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
        let fileUrl = selectedDl.link;
        const qualityName = selectedDl.quality || "HD";

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
          // Fallback if file exceeds WhatsApp limits or stream fails
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
