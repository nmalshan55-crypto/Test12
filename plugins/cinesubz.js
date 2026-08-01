const axios = require("axios");

// API Credentials & Endpoints
const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const MOVIE_SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/search";
const MOVIE_INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/infodl";

const TV_SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/search";
const TV_INFO_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/info";
const TV_DL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/dl";

// Custom Footer Config
const DEFAULT_FOOTER = "> *✦ ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝙰𝙺𝙰𝚂𝙷 ✦*";

// Memory storage for user reply sessions
const pendingSearch = new Map();
const pendingEpisodes = new Map();
const pendingQuality = new Map();

// Deep recursive extractor for video download/proxy links
function extractDownloadLinks(obj) {
  let foundLinks = [];
  if (!obj) return foundLinks;

  function traverse(item) {
    if (!item) return;

    if (typeof item === 'string') {
      if (item.startsWith("http") && (item.includes("/proxy?") || item.includes(".mp4") || item.includes("download") || item.includes("pixeldrain") || item.includes("mega"))) {
        foundLinks.push({ quality: "Direct Download / Stream", link: item, size: "" });
      }
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(elem => traverse(elem));
      return;
    }

    if (typeof item === 'object') {
      const possibleArrays = item.download_links || item.dl_links || item.links || item.downloadLinks || item.servers || item.qualities;
      if (Array.isArray(possibleArrays) && possibleArrays.length > 0) {
        possibleArrays.forEach(d => {
          if (typeof d === 'string') {
            foundLinks.push({ quality: "Standard HD Link", link: d, size: "" });
          } else if (d && typeof d === 'object') {
            const url = d.link || d.url || d.download_url || d.href || d.src || d.proxy_url;
            if (url) {
              foundLinks.push({
                quality: d.quality || d.title || d.name || d.server || d.resolution || "HD Video",
                link: url,
                size: d.size ? ` (${d.size})` : ""
              });
            }
          }
        });
        return;
      }

      const singleUrl = item.direct_link || item.download_url || item.stream_url || item.proxy_url || item.video_url || item.download || item.link;
      if (singleUrl && typeof singleUrl === 'string' && singleUrl.startsWith("http")) {
        foundLinks.push({
          quality: item.quality || item.title || "Direct Download Link",
          link: singleUrl,
          size: item.size ? ` (${item.size})` : ""
        });
        return;
      }

      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key) && key !== "q" && key !== "referer") {
          traverse(item[key]);
        }
      }
    }
  }

  traverse(obj);

  const uniqueLinks = [];
  const map = new Map();
  for (const item of foundLinks) {
    if(!map.has(item.link)){
        map.set(item.link, true);
        uniqueLinks.push(item);
    }
  }

  return uniqueLinks;
}

module.exports = {
  cmd: "cinesubz",
  alias: ["cine", "cinesub"],
  desc: "Search & Download movies and TV series from Cinesubz.lk",

  // 1. MAIN COMMAND HANDLER (.cinesubz <movie/tv name>)
  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(from, {
        text: `🎬 *CINESUBZ MOVIE & TV SEARCH*\n\nUsage: \`.cinesubz <movie or series name>\`\nExample: \`.cinesubz Avatar\`\n\n${DEFAULT_FOOTER}`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: `🔍 *Searching Cinesubz for:* "${query}"...` }, { quoted: msg });

    try {
      // Parallel API calls for Movies and TV Series
      const [movieRes, tvRes] = await Promise.allSettled([
        axios.get(`${MOVIE_SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 15000 }),
        axios.get(`${TV_SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 15000 })
      ]);

      let movies = movieRes.status === 'fulfilled' ? (movieRes.value.data?.data || movieRes.value.data?.result || movieRes.value.data || []) : [];
      let tvShows = tvRes.status === 'fulfilled' ? (tvRes.value.data?.data || tvRes.value.data?.result || tvRes.value.data || []) : [];

      if (!Array.isArray(movies)) movies = [];
      if (!Array.isArray(tvShows)) tvShows = [];

      // Combine and tag types
      const results = [
        ...movies.map(m => ({ ...m, type: 'movie' })),
        ...tvShows.map(t => ({ ...t, type: 'tv' }))
      ].slice(0, 30);

      if (results.length === 0) {
        return sock.sendMessage(from, { text: `❌ *No movies or TV series found on Cinesubz for "${query}"!*` }, { quoted: msg });
      }

      // Store search results state
      pendingSearch.set(sender, { results, timestamp: Date.now() });

      let text = `🎬 *CINESUBZ SEARCH RESULTS*\n\n`;
      results.forEach((m, i) => {
        const num = (i + 1).toString().padStart(2, "0");
        const title = m.title || m.name || "Movie / Series";
        const badge = m.type === 'tv' ? '📺 [TV SERIES]' : '🎥 [MOVIE]';
        text += `*${num}* ❯❯ ${title} ${badge}\n`;
      });

      text += `\n💡 *Reply with the number (e.g., 1 or 01) to select.*\n\n${DEFAULT_FOOTER}`;
      return sock.sendMessage(from, { text }, { quoted: msg });

    } catch (err) {
      console.error("Cinesubz Search Error:", err.message);
      return sock.sendMessage(from, { text: "❌ *Failed to fetch search results. API error or limit reached.*" }, { quoted: msg });
    }
  },

  // 2. DIRECT REPLY LISTENER (OnText Handler)
  onText: async (sock, msg, from, body) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const input = body ? body.trim() : "";

    if (isNaN(input) || input === "") return false;
    const num = parseInt(input, 10);

    // -------------------------------------------------------------
    // STEP 1: Process Search Selection (Movie or TV Show)
    // -------------------------------------------------------------
    if (pendingSearch.has(sender)) {
      const session = pendingSearch.get(sender);

      if (num > 0 && num <= session.results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = session.results[num - 1];
        pendingSearch.delete(sender);

        const targetUrl = selected.link || selected.url || selected.href;

        // --- IF TV SHOW SELECTED ---
        if (selected.type === 'tv') {
          await sock.sendMessage(from, { text: "📺 *Fetching TV Show episode list...*" }, { quoted: msg });

          try {
            const infoUrl = `${TV_INFO_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
            const response = await axios.get(infoUrl, { timeout: 20000 });
            const rawData = response.data;
            const tvData = rawData?.data || rawData?.result || rawData;

            const title = tvData?.title || selected.title || "TV Series";
            const thumbnail = tvData?.image || tvData?.poster || selected.thumb || "";
            const episodes = tvData?.episodes || tvData?.episode_list || tvData?.links || [];

            if (Array.isArray(episodes) && episodes.length > 0) {
              let epText = `📺 *${title}*\n\n📥 *SELECT AN EPISODE:*\n\n`;
              episodes.forEach((ep, i) => {
                const epNum = (i + 1).toString().padStart(2, "0");
                const epTitle = typeof ep === 'string' ? `Episode ${i + 1}` : (ep.title || ep.name || `Episode ${i + 1}`);
                epText += `*${epNum}* ❯❯ ${epTitle}\n`;
              });

              epText += `\n💡 *Reply with the Episode number (e.g., 1) to get download links.*\n\n${DEFAULT_FOOTER}`;

              // Store TV Episode selection state
              pendingEpisodes.set(sender, { title, episodes, timestamp: Date.now() });

              if (thumbnail) {
                await sock.sendMessage(from, { image: { url: thumbnail }, caption: epText }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { text: epText }, { quoted: msg });
              }
              return true;
            } else {
              return sock.sendMessage(from, { text: "❌ *No episodes found for this TV show.*" }, { quoted: msg });
            }
          } catch (err) {
            console.error("Cinesubz TV Info Error:", err.message);
            return sock.sendMessage(from, { text: "❌ *Error fetching TV show episodes.*" }, { quoted: msg });
          }
        }

        // --- IF MOVIE SELECTED ---
        else {
          await sock.sendMessage(from, { text: "📥 *Fetching movie download links...*" }, { quoted: msg });

          try {
            const infoUrl = `${MOVIE_INFODL_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
            const response = await axios.get(infoUrl, { timeout: 20000 });
            const rawData = response.data;

            const title = rawData?.title || rawData?.data?.title || selected.title || "Movie";
            const thumbnail = rawData?.image || rawData?.poster || selected.thumb || "";
            const description = rawData?.description || "N/A";
            const dlLinks = extractDownloadLinks(rawData);

            let detailsText = `🎥 *${title}*\n\n`;
            if (description !== "N/A" && description.length > 5) {
              detailsText += `📝 *Description:* ${description.slice(0, 200)}...\n\n`;
            }

            if (dlLinks.length > 0) {
              detailsText += "📥 *AVAILABLE DOWNLOAD QUALITIES:*\n\n";
              dlLinks.forEach((d, i) => {
                const qNum = (i + 1).toString().padStart(2, "0");
                detailsText += `*${qNum}* ❯❯ ${d.quality}${d.size}\n`;
              });
              detailsText += `\n💡 *Reply with the Quality number (e.g., 1) to start download.*\n\n${DEFAULT_FOOTER}`;
              
              pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });
            } else {
              detailsText += `⚠️ *No direct video download links parsed.*\n🔗 *Page Link:*\n${targetUrl}\n\n${DEFAULT_FOOTER}`;
            }

            if (thumbnail) {
              await sock.sendMessage(from, { image: { url: thumbnail }, caption: detailsText }, { quoted: msg });
            } else {
              await sock.sendMessage(from, { text: detailsText }, { quoted: msg });
            }
            return true;
          } catch (err) {
            console.error("Cinesubz Movie InfoDL Error:", err.message);
            return sock.sendMessage(from, { text: "❌ *Error fetching movie download links.*" }, { quoted: msg });
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Process TV Episode Selection
    // -------------------------------------------------------------
    if (pendingEpisodes.has(sender)) {
      const session = pendingEpisodes.get(sender);

      if (num > 0 && num <= session.episodes.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selectedEp = session.episodes[num - 1];
        pendingEpisodes.delete(sender);

        const epUrl = typeof selectedEp === 'string' ? selectedEp : (selectedEp.link || selectedEp.url || selectedEp.href);
        const epName = typeof selectedEp === 'object' ? (selectedEp.title || `Episode ${num}`) : `Episode ${num}`;

        await sock.sendMessage(from, { text: `📥 *Fetching links for ${epName}...*` }, { quoted: msg });

        try {
          const dlUrl = `${TV_DL_API}?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`;
          const response = await axios.get(dlUrl, { timeout: 20000 });
          const rawData = response.data;

          const title = `${session.title} - ${epName}`;
          const dlLinks = extractDownloadLinks(rawData);

          let detailsText = `📺 *${title}*\n\n`;

          if (dlLinks.length > 0) {
            detailsText += "📥 *AVAILABLE DOWNLOAD QUALITIES:*\n\n";
            dlLinks.forEach((d, i) => {
              const qNum = (i + 1).toString().padStart(2, "0");
              detailsText += `*${qNum}* ❯❯ ${d.quality}${d.size}\n`;
            });
            detailsText += `\n💡 *Reply with the Quality number (e.g., 1) to start download.*\n\n${DEFAULT_FOOTER}`;
            
            pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });
          } else {
            detailsText += `⚠️ *No download links parsed for this episode.*\n🔗 *Page Link:*\n${epUrl}\n\n${DEFAULT_FOOTER}`;
          }

          await sock.sendMessage(from, { text: detailsText }, { quoted: msg });
          return true;
        } catch (err) {
          console.error("Cinesubz TV DL Error:", err.message);
          await sock.sendMessage(from, { text: "❌ *Error fetching episode download links.*" }, { quoted: msg });
          return true;
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Process Quality Selection & Direct Buffer/Link Upload
    // -------------------------------------------------------------
    if (pendingQuality.has(sender)) {
      const session = pendingQuality.get(sender);

      if (num > 0 && num <= session.dlLinks.length) {
        await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

        const { title, dlLinks } = session;
        pendingQuality.delete(sender);

        const selectedDl = dlLinks[num - 1];
        let fileUrl = selectedDl.link;
        const qualityName = selectedDl.quality || "HD";

        if (fileUrl && fileUrl.includes("/proxy?") && !fileUrl.includes("api_key=")) {
          fileUrl += `&api_key=${API_KEY}`;
        }

        await sock.sendMessage(from, { 
          text: `⬇️ *Downloading & Sending ${qualityName} directly to WhatsApp...*\n*Please wait...*` 
        }, { quoted: msg });

        try {
          // Download video stream as Buffer using Axios
          const videoResponse = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            timeout: 180000
          });

          const videoBuffer = Buffer.from(videoResponse.data);

          // If Buffer is corrupted or too small (< 100KB)
          if (videoBuffer.length < 100 * 1024) {
            throw new Error("File too small or direct stream link protected.");
          }

          // Send Buffer as Document Video
          await sock.sendMessage(from, {
            document: videoBuffer,
            mimetype: "video/mp4",
            fileName: `${title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ""),
            caption: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n${DEFAULT_FOOTER}`
          }, { quoted: msg });

        } catch (error) {
          console.error("Direct File Upload Error:", error.message);
          // Fallback if video buffer fails or exceeds RAM/size limits
          await sock.sendMessage(from, { 
            text: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n⚠️ *Direct video file sending failed! Here is your Direct Download Link:*\n🔗 ${fileUrl}\n\n${DEFAULT_FOOTER}` 
          }, { quoted: msg });
        }
        return true;
      }
    }

    return false;
  }
};

