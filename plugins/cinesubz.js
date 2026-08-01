const axios = require("axios");

// Chama API Config
const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const MOVIE_SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/search";
const MOVIE_INFODL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/infodl";

const TV_SEARCH_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/search";
const TV_INFO_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/info";
const TV_DL_API = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz/tv/dl";

// Custom Bot Branding
const BOT_FOOTER = "> *✦ ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝙰𝙺𝙰𝚂𝙷 ✦*";

// Memory storage
const pendingSearch = new Map();
const pendingEpisodes = new Map();
const pendingQuality = new Map();

// Helper to extract links
function extractDownloadLinks(obj) {
  let foundLinks = [];
  if (!obj) return foundLinks;

  function traverse(item) {
    if (!item) return;
    if (typeof item === 'string') {
      if (item.startsWith("http") && (item.includes("/proxy?") || item.includes(".mp4") || item.includes("download") || item.includes("pixeldrain") || item.includes("mega"))) {
        foundLinks.push({ quality: "Direct Link / Stream", link: item, size: "" });
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
          quality: item.quality || item.title || "Direct Link",
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

  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(from, {
        text: `🎬 *CINESUBZ MOVIE & TV SEARCH*\n\nUsage: \`.cinesubz <movie or series name>\`\nExample: \`.cinesubz Avatar\`\n\n${BOT_FOOTER}`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: `🔍 *Searching Cinesubz for:* "${query}"...` }, { quoted: msg });

    try {
      const [movieRes, tvRes] = await Promise.allSettled([
        axios.get(`${MOVIE_SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 15000 }),
        axios.get(`${TV_SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 15000 })
      ]);

      let movies = movieRes.status === 'fulfilled' ? (movieRes.value.data?.data || movieRes.value.data?.result || movieRes.value.data || []) : [];
      let tvShows = tvRes.status === 'fulfilled' ? (tvRes.value.data?.data || tvRes.value.data?.result || tvRes.value.data || []) : [];

      if (!Array.isArray(movies)) movies = [];
      if (!Array.isArray(tvShows)) tvShows = [];

      const results = [];

      movies.forEach(m => {
        const link = m.link || m.url || m.href || "";
        const isTv = link.includes("/tvshows/") || (m.title && m.title.toLowerCase().includes("tv series"));
        results.push({ ...m, link, type: isTv ? 'tv' : 'movie' });
      });

      tvShows.forEach(t => {
        const link = t.link || t.url || t.href || "";
        results.push({ ...t, link, type: 'tv' });
      });

      const finalResults = results.slice(0, 30);

      if (finalResults.length === 0) {
        return sock.sendMessage(from, { text: `❌ *No results found on Cinesubz for "${query}"!*` }, { quoted: msg });
      }

      pendingSearch.set(sender, { results: finalResults, timestamp: Date.now() });

      let text = `🎬 *CINESUBZ SEARCH RESULTS*\n\n`;
      finalResults.forEach((m, i) => {
        const num = (i + 1).toString().padStart(2, "0");
        const title = m.title || m.name || "Movie / Series";
        const badge = m.type === 'tv' ? '📺 [TV SERIES]' : '🎥 [MOVIE]';
        text += `*${num}* ❯❯ ${title} ${badge}\n`;
      });

      text += `\n💡 *Reply with the number (e.g., 1 or 01) to view Details Card & Downloads.*\n\n${BOT_FOOTER}`;
      return sock.sendMessage(from, { text }, { quoted: msg });

    } catch (err) {
      console.error("Cinesubz Search Error:", err.message);
      return sock.sendMessage(from, { text: "❌ *Failed to fetch search results.*" }, { quoted: msg });
    }
  },

  onText: async (sock, msg, from, body) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const input = body ? body.trim() : "";

    if (isNaN(input) || input === "") return false;
    const num = parseInt(input, 10);

    // -------------------------------------------------------------
    // STEP 1: Search Selection & Movie/TV Details Card Generation
    // -------------------------------------------------------------
    if (pendingSearch.has(sender)) {
      const session = pendingSearch.get(sender);

      if (num > 0 && num <= session.results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = session.results[num - 1];
        pendingSearch.delete(sender);

        const targetUrl = selected.link || selected.url || selected.href;
        const isTvShow = selected.type === 'tv' || (targetUrl && targetUrl.includes("/tvshows/"));

        // --- DETAILS CARD FOR TV SHOW ---
        if (isTvShow) {
          try {
            const infoUrl = `${TV_INFO_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
            const response = await axios.get(infoUrl, { timeout: 20000 });
            const tvData = response.data?.data || response.data?.result || response.data || {};

            const title = tvData.title || selected.title || "TV Series";
            const thumbnail = tvData.image || tvData.poster || selected.thumb || selected.image || "";
            const imdb = tvData.imdb || tvData.rating || "N/A";
            const year = tvData.year || tvData.date || "N/A";
            const category = tvData.category || tvData.genres || "TV Series";
            const description = tvData.description || tvData.plot || tvData.synopsis || "No description available.";
            const episodes = tvData.episodes || tvData.episode_list || tvData.links || [];

            let cardText = `📺 *${title.toUpperCase()}*\n`;
            cardText += `━─────━━─────━\n`;
            cardText += `📅 *Release:* ${year}\n`;
            cardText += `⭐ *IMDb Rating:* ${imdb}\n`;
            cardText += `🏷️ *Category:* ${category}\n`;
            cardText += `📝 *Plot:* ${description.slice(0, 250)}...\n`;
            cardText += `━─────━━─────━\n\n`;

            if (Array.isArray(episodes) && episodes.length > 0) {
              cardText += `📥 *AVAILABLE EPISODES:*\n\n`;
              episodes.forEach((ep, i) => {
                const epNum = (i + 1).toString().padStart(2, "0");
                const epTitle = typeof ep === 'string' ? `Episode ${i + 1}` : (ep.title || ep.name || `Episode ${i + 1}`);
                cardText += `*${epNum}* ❯❯ ${epTitle}\n`;
              });

              cardText += `\n💡 *Reply with Episode number (e.g., 1) to get Download Links.*\n\n${BOT_FOOTER}`;
              pendingEpisodes.set(sender, { title, episodes, timestamp: Date.now() });
            } else {
              cardText += `⚠️ *No episodes found for this TV show.*\n\n${BOT_FOOTER}`;
            }

            if (thumbnail) {
              await sock.sendMessage(from, { image: { url: thumbnail }, caption: cardText }, { quoted: msg });
            } else {
              await sock.sendMessage(from, { text: cardText }, { quoted: msg });
            }
            return true;
          } catch (err) {
            console.error("TV Card Error:", err.message);
            return sock.sendMessage(from, { text: "❌ *Error fetching TV Details Card.*" }, { quoted: msg });
          }
        }

        // --- DETAILS CARD FOR MOVIE ---
        else {
          try {
            const infoUrl = `${MOVIE_INFODL_API}?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
            const response = await axios.get(infoUrl, { timeout: 20000 });
            const movieData = response.data?.data || response.data?.result || response.data || {};

            const title = movieData.title || selected.title || "Movie";
            const thumbnail = movieData.image || movieData.poster || selected.thumb || selected.image || "";
            const imdb = movieData.imdb || movieData.rating || "N/A";
            const year = movieData.year || movieData.date || "N/A";
            const category = movieData.category || movieData.genres || "Movie";
            const description = movieData.description || movieData.plot || movieData.synopsis || "No description available.";
            const dlLinks = extractDownloadLinks(movieData);

            // Movie Details Card Template
            let cardText = `🎬 *${title.toUpperCase()}*\n`;
            cardText += `━─────━━─────━\n`;
            cardText += `📅 *Release:* ${year}\n`;
            cardText += `⭐ *IMDb Rating:* ${imdb}\n`;
            cardText += `🏷️ *Category:* ${category}\n`;
            cardText += `📝 *Synopsis:* ${description.slice(0, 250)}...\n`;
            cardText += `━─────━━─────━\n\n`;

            if (dlLinks.length > 0) {
              cardText += "📥 *AVAILABLE DOWNLOAD QUALITIES:*\n\n";
              dlLinks.forEach((d, i) => {
                const qNum = (i + 1).toString().padStart(2, "0");
                cardText += `*${qNum}* ❯❯ ${d.quality}${d.size}\n`;
              });
              cardText += `\n💡 *Reply with Quality number (e.g., 1) to Download.*\n\n${BOT_FOOTER}`;
              pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });
            } else {
              cardText += `⚠️ *No download links parsed.*\n🔗 *Web Link:* ${targetUrl}\n\n${BOT_FOOTER}`;
            }

            if (thumbnail) {
              await sock.sendMessage(from, { image: { url: thumbnail }, caption: cardText }, { quoted: msg });
            } else {
              await sock.sendMessage(from, { text: cardText }, { quoted: msg });
            }
            return true;
          } catch (err) {
            console.error("Movie Card Error:", err.message);
            return sock.sendMessage(from, { text: "❌ *Error fetching Movie Details Card.*" }, { quoted: msg });
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

        try {
          const dlUrl = `${TV_DL_API}?q=${encodeURIComponent(epUrl)}&api_key=${API_KEY}`;
          const response = await axios.get(dlUrl, { timeout: 20000 });
          const rawData = response.data;

          const title = `${session.title} - ${epName}`;
          const dlLinks = extractDownloadLinks(rawData);

          let epText = `📺 *${title}*\n\n`;

          if (dlLinks.length > 0) {
            epText += "📥 *SELECT QUALITIES:*\n\n";
            dlLinks.forEach((d, i) => {
              const qNum = (i + 1).toString().padStart(2, "0");
              epText += `*${qNum}* ❯❯ ${d.quality}${d.size}\n`;
            });
            epText += `\n💡 *Reply with Quality number (e.g., 1) to Download.*\n\n${BOT_FOOTER}`;
            pendingQuality.set(sender, { title, dlLinks, timestamp: Date.now() });
          } else {
            epText += `⚠️ *No download links found for this episode.*\n\n${BOT_FOOTER}`;
          }

          await sock.sendMessage(from, { text: epText }, { quoted: msg });
          return true;
        } catch (err) {
          console.error("Episode Link Error:", err.message);
          await sock.sendMessage(from, { text: "❌ *Error fetching episode links.*" }, { quoted: msg });
          return true;
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Quality Selection & Auto Upload
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
          text: `⬇️ *Downloading ${qualityName} directly to WhatsApp...*\n*Please wait...*` 
        }, { quoted: msg });

        try {
          const videoResponse = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 180000
          });

          const videoBuffer = Buffer.from(videoResponse.data);

          if (videoBuffer.length < 100 * 1024) {
            throw new Error("File too small.");
          }

          await sock.sendMessage(from, {
            document: videoBuffer,
            mimetype: "video/mp4",
            fileName: `${title} - ${qualityName}.mp4`.replace(/[^\w\s.-]/gi, ""),
            caption: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n${BOT_FOOTER}`
          }, { quoted: msg });

        } catch (error) {
          await sock.sendMessage(from, { 
            text: `🎬 *${title}*\n📊 *Quality:* ${qualityName}\n\n⚠️ *Direct sending failed! Direct Download Link:*\n🔗 ${fileUrl}\n\n${BOT_FOOTER}` 
          }, { quoted: msg });
        }
        return true;
      }
    }

    return false;
  }
};
