const axios = require("axios");
const cheerio = require("cheerio");

const pendingSearch = {};
const pendingQuality = {};

function normalizeQuality(text) {
  if (!text) return "720p";
  text = text.toUpperCase();
  if (/1080|FHD/.test(text)) return "1080p";
  if (/720|HD/.test(text)) return "720p";
  if (/480|SD/.test(text)) return "480p";
  return text.trim();
}

function getDirectPixeldrainUrl(url) {
  if (!url) return null;
  const match = url.match(/pixeldrain\.com\/u\/(\w+)/);
  if (!match) return url;
  return `https://pixeldrain.com/api/file/${match[1]}?download`;
}

// 1. FAST HTML SEARCH (Cheerio)
async function searchMovies(query) {
  try {
    const searchUrl = `https://sinhalasub.lk/?s=${encodeURIComponent(query)}&post_type=movies`;
    const { data } = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(data);
    const results = [];

    $(".display-item .item-box").slice(0, 10).each((index, element) => {
      const a = $(element).find("a");
      const img = $(element).find(".thumb");
      const lang = $(element).find(".item-desc-giha .language").text() || "";
      const quality = $(element).find(".item-desc-giha .quality").text() || "";
      const qty = $(element).find(".item-desc-giha .qty").text() || "";

      const title = a.attr("title") || "";
      const movieUrl = a.attr("href") || "";

      if (title && movieUrl) {
        results.push({
          id: index + 1,
          title: title.trim(),
          movieUrl: movieUrl.trim(),
          thumb: img.attr("src") || "",
          language: lang.trim(),
          quality: quality.trim(),
          qty: qty.trim(),
        });
      }
    });

    return results;
  } catch (e) {
    console.error("Search Error:", e.message);
    return [];
  }
}

// 2. FETCH METADATA & PIXELDRAIN LINKS
async function getMovieInfoAndLinks(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(data);

    const title = $(".info-details .details-title h3").text().trim() || "Movie";
    const duration = $(".info-details .data-views[itemprop='duration']").text().trim() || "N/A";
    const imdb = $(".info-details .data-imdb").text().replace("IMDb:", "").trim() || "N/A";
    const thumbnail = $(".splash-bg img").attr("src") || "";

    let language = "N/A", directors = [], stars = [];
    $(".info-col p").each((_, p) => {
      const txt = $(p).find("strong").text().trim();
      if (txt.includes("Language:")) language = $(p).text().replace("Language:", "").trim();
      if (txt.includes("Director:")) directors = $(p).find("a").map((_, a) => $(a).text().trim()).get();
      if (txt.includes("Stars:")) stars = $(p).find("a").map((_, a) => $(a).text().trim()).get();
    });

    const genres = $(".details-genre a").map((_, a) => $(a).text().trim()).get();

    const downloadLinks = [];
    $(".link-pixeldrain tbody tr").each((_, row) => {
      const pageLink = $(row).find(".link-opt a").attr("href") || "";
      const quality = $(row).find(".quality").text().trim() || "";
      const size = $(row).find("td:nth-child(3) span").text().trim() || "";

      if (pageLink) {
        downloadLinks.push({
          pageLink,
          quality: normalizeQuality(quality),
          size
        });
      }
    });

    return {
      metadata: { title, language, duration, imdb, genres, directors, stars, thumbnail },
      downloadLinks
    };
  } catch (e) {
    console.error("Movie Info Error:", e.message);
    return null;
  }
}

// 📦 MAIN EXPORT FOR INDEX.JS
module.exports = {
  cmd: "movie",
  handler: async (sock, msg, from, args, extra) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textMessage = args.join(" ").trim();

    // 💡 IF USER REPLIED WITH A NUMBER (1, 2, 3...)
    if (!isNaN(textMessage) && textMessage !== "") {
      const num = parseInt(textMessage);

      // STEP 1: Process Movie Choice
      if (pendingSearch[sender] && num > 0 && num <= pendingSearch[sender].results.length) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        const selected = pendingSearch[sender].results[num - 1];
        delete pendingSearch[sender];

        await sock.sendMessage(from, { text: "📥 *Fetching movie details and links...*" }, { quoted: msg });
        const movieData = await getMovieInfoAndLinks(selected.movieUrl);

        if (!movieData || !movieData.downloadLinks.length) {
          return sock.sendMessage(from, { text: "❌ *Failed to fetch download links or no Pixeldrain links found.*" }, { quoted: msg });
        }

        const { metadata, downloadLinks } = movieData;

        let resMsg = `🎬 *${metadata.title}*\n\n`;
        resMsg += `🌐 *Language:* ${metadata.language}\n`;
        resMsg += `⏱️ *Duration:* ${metadata.duration}\n`;
        resMsg += `⭐ *IMDb:* ${metadata.imdb}\n`;
        resMsg += `🎭 *Genres:* ${metadata.genres.join(", ")}\n`;
        resMsg += `🎬 *Directors:* ${metadata.directors.join(", ")}\n`;
        resMsg += `🌟 *Stars:* ${metadata.stars.slice(0, 5).join(", ")}\n\n`;

        resMsg += "📥 *Available Qualities:*\n";
        downloadLinks.forEach((d, i) => {
          resMsg += `*${i + 1}.* ${d.quality} - ${d.size}\n`;
        });

        resMsg += "\n💡 *Reply with `.movie <number>` to get the document file.*";

        pendingQuality[sender] = { metadata, downloadLinks, timestamp: Date.now() };

        if (metadata.thumbnail) {
          await sock.sendMessage(from, { image: { url: metadata.thumbnail }, caption: resMsg }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: resMsg }, { quoted: msg });
        }
        return;
      }

      // STEP 2: Process Quality Choice & Send Document
      if (pendingQuality[sender] && num > 0 && num <= pendingQuality[sender].downloadLinks.length) {
        await sock.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

        const { metadata, downloadLinks } = pendingQuality[sender];
        delete pendingQuality[sender];

        const selectedLink = downloadLinks[num - 1];
        await sock.sendMessage(from, { text: `⬇️ *Sending ${selectedLink.quality} (${selectedLink.size}) movie...*\n*Please wait a few moments.*` }, { quoted: msg });

        try {
          const directUrl = getDirectPixeldrainUrl(selectedLink.pageLink);

          await sock.sendMessage(from, {
            document: { url: directUrl },
            mimetype: "video/mp4",
            fileName: `${metadata.title} - ${selectedLink.quality}.mp4`.replace(/[^\w\s.-]/gi, ''),
            caption: `🎬 *${metadata.title}*\n📊 *Quality:* ${selectedLink.quality}\n💾 *Size:* ${selectedLink.size}\n\n> **AKASH-MD Movie Downloader** ✨`
          }, { quoted: msg });

        } catch (error) {
          console.error("Document Send Error:", error);
          await sock.sendMessage(from, { text: `❌ *Failed to send document file:* ${error.message}` }, { quoted: msg });
        }
        return;
      }
    }

    // 🔍 SEARCH MOVIE
    if (!textMessage) {
      return sock.sendMessage(from, { text: "🎬 *Movie Search Plugin*\n\nUsage: `.movie <movie_name>`\nExample: `.movie Avengers`" }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: "🔍 *Searching for movies on Sinhalasub...*" }, { quoted: msg });
    const searchResults = await searchMovies(textMessage);

    if (!searchResults.length) {
      return sock.sendMessage(from, { text: "❌ *No movies found! Try another name.*" }, { quoted: msg });
    }

    pendingSearch[sender] = { results: searchResults, timestamp: Date.now() };

    let text = "🎬 *Sinhalasub Movie Results:*\n\n";
    searchResults.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}\n   🌐 *Lang:* ${m.language || 'N/A'} | 📊 *Quality:* ${m.quality || 'N/A'}\n\n`;
    });

    text += "💡 *Reply with `.movie <number>` (e.g. `.movie 1`) to select.*";
    return sock.sendMessage(from, { text }, { quoted: msg });
  }
};
