const { cmd } = require("../lib/command");
const axios = require("axios");
const cheerio = require("cheerio");

// Map to manage active user sessions
const sessions = new Map();

// Helper: Clear user session & clear timeout
function clearSession(jid) {
  if (sessions.has(jid)) {
    const session = sessions.get(jid);
    if (session.timeout) clearTimeout(session.timeout);
    sessions.delete(jid);
  }
}

// Bot Footer
const DEFAULT_FOOTER = "\n\n> *✦ ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝙰𝙺𝙰𝚂🇭-ᴍᴅ ✦*";

// Default Request Headers to prevent blocking
const AXIOS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Referer": "https://sinhalasub.lk/"
};

// 1. Helper: Direct Web Scrape for Movie Search
async function searchSinhalaSub(query) {
  try {
    const searchUrl = `https://sinhalasub.lk/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl, { headers: AXIOS_HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const results = [];

    $("div.result-item, article.item-mvs, div.item").each((_, el) => {
      const title = $(el).find("div.title a, h3 a, div.details .title a").text().trim();
      const link = $(el).find("div.title a, h3 a, div.details .title a").attr("href");

      if (title && link) {
        results.push({ title, link });
      }
    });

    return results;
  } catch (err) {
    console.error("SinhalaSub Search Scrape Error:", err.message);
    return [];
  }
}

// 2. Helper: Direct Web Scrape for Movie Details & Download Links
async function getMovieDetailsAndLinks(movieUrl) {
  try {
    const { data } = await axios.get(movieUrl, { headers: AXIOS_HEADERS, timeout: 20000 });
    const $ = cheerio.load(data);

    const title = $("div.single-meta h1, h1.entry-title").text().trim() || "Movie";
    const poster = $("div.poster img, div.mvic-thumb img").attr("src") || $("div.poster img").attr("data-src") || "";

    let releaseDate = "N/A", country = "N/A", duration = "N/A", language = "N/A", director = "N/A", rating = "N/A", quality = "HD";
    let genres = [];

    $("div.smetadata span, div.extra p, div.meta-content span").each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes("Country")) country = text.replace("Country:", "").trim();
      if (text.includes("Release")) releaseDate = text.replace("Release:", "").trim();
      if (text.includes("Runtime") || text.includes("Duration")) duration = text.replace(/(Runtime:|Duration:)/gi, "").trim();
      if (text.includes("Director")) director = text.replace("Director:", "").trim();
      if (text.includes("Quality")) quality = text.replace("Quality:", "").trim();
      if (text.includes("Language")) language = text.replace("Language:", "").trim();
      if (text.includes("IMDb")) rating = text.replace("IMDb", "").trim();
    });

    $("a[href*='/genre/']").each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    const downloadLinks = [];
    $("a.dl, a.download-link, a.button[href*='pixeldrain'], a[href*='mega'], a[href*='drive'], table tr").each((_, el) => {
      const href = $(el).attr("href") || $(el).find("a").attr("href");
      let label = $(el).text().trim() || $(el).find("td").text().trim();

      if (href && href.startsWith("http")) {
        if (!label || label.length > 50) label = "Direct Download Link";
        downloadLinks.push({ label, link: href });
      }
    });

    return {
      details: {
        title, poster, releaseDate, country, duration,
        genres: genres.length > 0 ? genres.join(", ") : "N/A",
        language, director, rating, quality
      },
      downloadLinks
    };
  } catch (err) {
    console.error("SinhalaSub Details Error:", err.message);
    return { details: { title: "Movie", poster: "" }, downloadLinks: [] };
  }
}

// -------------------------------------------------------------------
// MAIN SEARCH COMMAND
// -------------------------------------------------------------------
cmd(
  {
    pattern: "sinhalasub",
    alias: ["ss", "sub"],
    desc: "Search movies from SinhalaSub.lk",
    category: "movie",
    react: "🎬",
    filename: __filename
  },
  async (conn, mek, m, { from, q, reply, sender }) => {
    try {
      const userId = sender || mek.key.participant || mek.key.remoteJid;

      if (!q) {
        return await reply("❌ *Please provide a movie name to search!*\n\nUsage: `.sinhalasub Avatar`" + DEFAULT_FOOTER);
      }

      await reply(`🔍 *Searching SinhalaSub.lk for:* "${q}"...`);

      const searchResults = await searchSinhalaSub(q);

      if (!searchResults || searchResults.length === 0) {
        return await reply(`❌ *No movies found on SinhalaSub for "${q}"!*` + DEFAULT_FOOTER);
      }

      const results = searchResults.slice(0, 10);

      let msgText = "━━━━━━━━━━━━━━━━━━\n";
      msgText += "🔎 *SINHALASUB MOVIE SEARCH*\n";
      msgText += "━━━━━━━━━━━━━━━━━━\n\n";

      results.forEach((item, index) => {
        msgText += `*${index + 1}.* ${item.title}\n`;
      });

      msgText += "\n💡 *Reply to this message with the movie number (e.g., 1).*";
      msgText += DEFAULT_FOOTER;

      // Clear any older session for this sender
      clearSession(userId);

      // Auto-expire session after 5 minutes
      const timeout = setTimeout(() => {
        if (sessions.has(userId)) {
          sessions.delete(userId);
        }
      }, 5 * 60 * 1000);

      sessions.set(userId, {
        step: "WAITING_MOVIE_SELECTION",
        results,
        timeout
      });

      await conn.sendMessage(from, { text: msgText }, { quoted: mek });

    } catch (error) {
      console.error("SinhalaSub Command Error:", error);
      await reply("❌ *An error occurred while searching SinhalaSub.*" + DEFAULT_FOOTER);
    }
  }
);

// -------------------------------------------------------------------
// INTERACTIVE TEXT LISTENER (Listens to reply numbers)
// -------------------------------------------------------------------
cmd(
  {
    on: "text"
  },
  async (conn, mek, m, { from, reply, sender }) => {
    try {
      const userId = sender || mek.key.participant || mek.key.remoteJid;

      if (!sessions.has(userId)) return;

      const session = sessions.get(userId);
      const body = (m.text || m.body || "").trim();

      if (!body || isNaN(body)) return;
      const choice = parseInt(body, 10);

      // STEP 1: Process Selected Movie Number
      if (session.step === "WAITING_MOVIE_SELECTION") {
        if (choice < 1 || choice > session.results.length) {
          return await reply(`❌ *Invalid number! Please reply with 1 to ${session.results.length}.*` + DEFAULT_FOOTER);
        }

        const selectedMovie = session.results[choice - 1];
        await reply("⏳ *Fetching movie details & direct download links...*");

        const { details, downloadLinks } = await getMovieDetailsAndLinks(selectedMovie.link);

        if (!downloadLinks || downloadLinks.length === 0) {
          clearSession(userId);
          return await reply("❌ *No download links found for this movie!*" + DEFAULT_FOOTER);
        }

        let downloadsText = "";
        downloadLinks.forEach((dl, idx) => {
          downloadsText += `*${idx + 1}.* ${dl.label}\n`;
        });

        const movieTitle = details.title !== "Movie" ? details.title : selectedMovie.title;

        let detailsCard = `☘️ *Tɪᴛʟᴇ:* _${movieTitle}_\n\n`;
        detailsCard += `*❑ 📅 𝗥ᴇʟᴇᴀꜱᴇ:* _${details.releaseDate}_\n`;
        detailsCard += `*❑ 🌎 𝗖ᴏᴜɴᴛʀʏ:* _${details.country}_\n`;
        detailsCard += `*❑ ⏱️ 𝗗ᴜʀᴀᴛɪᴏɴ:* _${details.duration}_\n`;
        detailsCard += `*❑ 🎭 𝗚ᴇɴʀᴇꜱ:* _${details.genres}_\n`;
        detailsCard += `*❑ 🗣️ 𝗟ᴀɴɢᴜᴀɢᴇ:* _${details.language}_\n`;
        detailsCard += `*❑ 👨🏻‍💼 𝗗ɪʀᴇᴄᴛᴏʀ:* _${details.director}_\n`;
        detailsCard += `*❑ ⭐ 𝗥ᴀᴛɪɴɢ:* _${details.rating}_\n`;
        detailsCard += `*❑ 🎞️ 𝗤ᴜᴀʟɪᴛʏ:* _${details.quality}_\n\n`;
        detailsCard += `━━━━━━━━━━━━━━━━━━\n`;
        detailsCard += `📥 *AVAILABLE DOWNLOADS:*\n\n${downloadsText}`;
        detailsCard += `━━━━━━━━━━━━━━━━━━\n\n`;
        detailsCard += `💡 *Reply with Quality number (e.g., 1) to download.*`;
        detailsCard += DEFAULT_FOOTER;

        // Reset 5 min timeout for next reply
        if (session.timeout) clearTimeout(session.timeout);
        session.timeout = setTimeout(() => {
          if (sessions.has(userId)) sessions.delete(userId);
        }, 5 * 60 * 1000);

        session.step = "WAITING_QUALITY_SELECTION";
        session.selectedMovie = { title: movieTitle };
        session.downloadLinks = downloadLinks;

        if (details.poster) {
          await conn.sendMessage(from, { image: { url: details.poster }, caption: detailsCard }, { quoted: mek });
        } else {
          await conn.sendMessage(from, { text: detailsCard }, { quoted: mek });
        }
        return;
      }

      // STEP 2: Process Selected Quality Number
      if (session.step === "WAITING_QUALITY_SELECTION") {
        if (choice < 1 || choice > session.downloadLinks.length) {
          return await reply(`❌ *Invalid option! Reply with 1 to ${session.downloadLinks.length}.*` + DEFAULT_FOOTER);
        }

        const selectedDl = session.downloadLinks[choice - 1];
        const movieTitle = session.selectedMovie.title;

        await reply("📥 *Uploading Movie File / Stream Link... Please wait.*" + DEFAULT_FOOTER);

        const safeFileName = `${movieTitle.replace(/[/\\?%*:|"<>]/g, "")}.mp4`;
        const caption = `🎬 *${movieTitle}*\n\n🔗 *Direct Link:* ${selectedDl.link}${DEFAULT_FOOTER}`;

        try {
          await conn.sendMessage(
            from,
            {
              document: { url: selectedDl.link },
              mimetype: "video/mp4",
              fileName: safeFileName,
              caption: caption
            },
            { quoted: mek }
          );
        } catch (e) {
          // Fallback if file upload is blocked or fails
          await conn.sendMessage(
            from,
            {
              text: `🎬 *${movieTitle}*\n\n⚠️ *Direct document upload failed! Here is your download link:*\n🔗 ${selectedDl.link}${DEFAULT_FOOTER}`
            },
            { quoted: mek }
          );
        }

        clearSession(userId);
      }

    } catch (error) {
      console.error("SinhalaSub Interactive Handler Error:", error);
      clearSession(sender || mek.key.participant || mek.key.remoteJid);
    }
  }
);
