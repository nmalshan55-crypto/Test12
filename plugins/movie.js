const { cmd } = require("../command");
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

    // Metadata
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

    // Download Links
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

// 3. COMMAND: MOVIE SEARCH
cmd({
  pattern: "movie",
  alias: ["sinhalasub", "films", "cinema"],
  react: "🎬",
  desc: "Search and send movies from Sinhalasub.lk",
  category: "download",
  filename: __filename
}, async (danuwa, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("🎬 *Movie Search Plugin*\n\nUsage: `.movie <movie_name>`\nExample: `.movie Avengers`");

  reply("🔍 *Searching for movies on Sinhalasub...*");
  const searchResults = await searchMovies(q);

  if (!searchResults.length) return reply("❌ *No movies found! Try another name.*");

  pendingSearch[sender] = { results: searchResults, timestamp: Date.now() };

  let text = "🎬 *Sinhalasub Movie Results:*\n\n";
  searchResults.forEach((m, i) => {
    text += `*${i + 1}.* ${m.title}\n   🌐 *Lang:* ${m.language || 'N/A'} | 📊 *Quality:* ${m.quality || 'N/A'}\n\n`;
  });

  text += "💡 *Reply with the movie number (1-" + searchResults.length + ") to select.*";
  return reply(text);
});

// 4. LISTEN FOR NUMBER SELECTION (General Event Listener)
cmd({
  on: "text"
}, async (danuwa, mek, m, { body, sender, reply, from }) => {
  if (!body || isNaN(body.trim())) return;
  const num = parseInt(body.trim());

  // STEP 1: Process Movie Choice
  if (pendingSearch[sender] && num > 0 && num <= pendingSearch[sender].results.length) {
    await danuwa.sendMessage(from, { react: { text: "⏳", key: m.key } });

    const selected = pendingSearch[sender].results[num - 1];
    delete pendingSearch[sender];

    reply("📥 *Fetching movie details and links...*");
    const movieData = await getMovieInfoAndLinks(selected.movieUrl);

    if (!movieData || !movieData.downloadLinks.length) {
      return reply("❌ *Failed to fetch download links or no Pixeldrain links found.*");
    }

    const { metadata, downloadLinks } = movieData;

    let msg = `🎬 *${metadata.title}*\n\n`;
    msg += `🌐 *Language:* ${metadata.language}\n`;
    msg += `⏱️ *Duration:* ${metadata.duration}\n`;
    msg += `⭐ *IMDb:* ${metadata.imdb}\n`;
    msg += `🎭 *Genres:* ${metadata.genres.join(", ")}\n`;
    msg += `🎬 *Directors:* ${metadata.directors.join(", ")}\n`;
    msg += `🌟 *Stars:* ${metadata.stars.slice(0, 5).join(", ")}\n\n`;

    msg += "📥 *Available Qualities:*\n";
    downloadLinks.forEach((d, i) => {
      msg += `*${i + 1}.* ${d.quality} - ${d.size}\n`;
    });

    msg += "\n💡 *Reply with the Quality number to get the document file.*";

    pendingQuality[sender] = { metadata, downloadLinks, timestamp: Date.now() };

    if (metadata.thumbnail) {
      await danuwa.sendMessage(from, { image: { url: metadata.thumbnail }, caption: msg }, { quoted: mek });
    } else {
      await danuwa.sendMessage(from, { text: msg }, { quoted: mek });
    }
    return;
  }

  // STEP 2: Process Quality Choice & Send Document
  if (pendingQuality[sender] && num > 0 && num <= pendingQuality[sender].downloadLinks.length) {
    await danuwa.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    const { metadata, downloadLinks } = pendingQuality[sender];
    delete pendingQuality[sender];

    const selectedLink = downloadLinks[num - 1];
    reply(`⬇️ *Sending ${selectedLink.quality} (${selectedLink.size}) movie...*\n*Please wait a few moments.*`);

    try {
      const directUrl = getDirectPixeldrainUrl(selectedLink.pageLink);

      await danuwa.sendMessage(from, {
        document: { url: directUrl },
        mimetype: "video/mp4",
        fileName: `${metadata.title} - ${selectedLink.quality}.mp4`.replace(/[^\w\s.-]/gi, ''),
        caption: `🎬 *${metadata.title}*\n📊 *Quality:* ${selectedLink.quality}\n💾 *Size:* ${selectedLink.size}\n\n> **AKASH-MD Movie Downloader** ✨`
      }, { quoted: mek });

    } catch (error) {
      console.error("Document Send Error:", error);
      reply(`❌ *Failed to send document file:* ${error.message}`);
    }
  }
});

// CLEANUP TIMEOUT (Clear memory every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 mins
  for (const s in pendingSearch) if (now - pendingSearch[s].timestamp > timeout) delete pendingSearch[s];
  for (const s in pendingQuality) if (now - pendingQuality[s].timestamp > timeout) delete pendingQuality[s];
}, 5 * 60 * 1000);

module.exports = { pendingSearch, pendingQuality };

