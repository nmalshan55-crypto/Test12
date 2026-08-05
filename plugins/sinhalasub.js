const { cmd } = require("../lib/command");
const axios = require("axios");
const cheerio = require("cheerio");

// Map to handle user sessions
const sessions = new Map();

// Helper to clean up session
function clearSession(jid) {
    if (sessions.has(jid)) {
        const session = sessions.get(jid);
        if (session.timeout) clearTimeout(session.timeout);
        sessions.delete(jid);
    }
}

// Global Default Footer
const DEFAULT_FOOTER = "\n\n> *Powered by KIRA-MD*";

// Headers to bypass blockings
const AXIOS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://sinhalasub.lk/"
};

// Helper to search SinhalaSub
async function searchSinhalaSub(query) {
    try {
        const searchUrl = `https://sinhalasub.lk/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { headers: AXIOS_HEADERS, timeout: 15000 });
        const $ = cheerio.load(data);
        const results = [];

        $("div.result-item, article.item-mvs, div.item").each((_, el) => {
            const title = $(el).find("div.title a, h3 a, div.details .title a").text().trim();
            const link = $(el).find("div.title a, h3 a, div.details .title a").attr("href");
            const img = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";

            if (title && link) {
                results.push({ title, link, img });
            }
        });

        return results;
    } catch (err) {
        console.error("Search Scrape Error:", err.message);
        return [];
    }
}

// Helper to scrape details & links from single movie page
async function getMovieDetailsAndLinks(movieUrl) {
    try {
        const { data } = await axios.get(movieUrl, { headers: AXIOS_HEADERS, timeout: 20000 });
        const $ = cheerio.load(data);

        const title = $("div.single-meta h1, h1.entry-title").text().trim() || "Unknown";
        const poster = $("div.poster img, div.mvic-thumb img").attr("src") || $("div.poster img").attr("data-src") || "";

        let releaseDate = "Unknown";
        let country = "Unknown";
        let duration = "Unknown";
        let genres = [];
        let language = "Unknown";
        let director = "Unknown";
        let rating = "Unknown";
        let quality = "Unknown";

        // Extract metadata items
        $("div.custom_fields, div.extra-date, div.sitem, div.meta-p").each((_, el) => {
            const text = $(el).text().trim();
            if (text.includes("IMDb")) rating = text.replace(/IMDb/gi, "").trim();
        });

        $("div.smetadata span, div.extra p, div.meta-content span").each((_, el) => {
            const text = $(el).text().trim();
            if (text.includes("Country")) country = text.replace("Country:", "").trim();
            if (text.includes("Release")) releaseDate = text.replace("Release:", "").trim();
            if (text.includes("Runtime") || text.includes("Duration")) duration = text.replace(/(Runtime:|Duration:)/gi, "").trim();
            if (text.includes("Director")) director = text.replace("Director:", "").trim();
            if (text.includes("Quality")) quality = text.replace("Quality:", "").trim();
            if (text.includes("Language")) language = text.replace("Language:", "").trim();
        });

        // Genres
        $("a[href*='/genre/']").each((_, el) => {
            const g = $(el).text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        });

        // Extract Download Links from Buttons / Tables
        const downloadLinks = [];
        $("a.dl, a.download-link, a.button[href*='pixeldrain'], a[href*='mega'], a[href*='drive'], table tr").each((_, el) => {
            const href = $(el).attr("href") || $(el).find("a").attr("href");
            let label = $(el).text().trim() || $(el).find("td").text().trim();

            if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
                if (!label || label.length > 50) label = "Direct Download Link";
                downloadLinks.push({ label, link: href });
            }
        });

        return {
            details: {
                title,
                poster,
                releaseDate: releaseDate || "N/A",
                country: country || "N/A",
                duration: duration || "N/A",
                genres: genres.length > 0 ? genres.join(", ") : "N/A",
                language: language || "N/A",
                director: director || "N/A",
                rating: rating || "N/A",
                quality: quality || "HD"
            },
            downloadLinks
        };
    } catch (err) {
        console.error("Details Scrape Error:", err.message);
        return {
            details: {
                title: "Movie", poster: "", releaseDate: "N/A", country: "N/A",
                duration: "N/A", genres: "N/A", language: "N/A", director: "N/A", rating: "N/A", quality: "N/A"
            },
            downloadLinks: []
        };
    }
}

// -------------------------------------------------------------
// Primary SinhalaSub Search Command
// -------------------------------------------------------------
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
            if (!q) {
                if (m.react) await m.react("❌");
                return await reply("❌ Please provide a movie name to search." + DEFAULT_FOOTER);
            }

            if (m.react) await m.react("🔎");

            const searchResults = await searchSinhalaSub(q);

            if (!searchResults || searchResults.length === 0) {
                if (m.react) await m.react("❌");
                return await reply("❌ No movies found." + DEFAULT_FOOTER);
            }

            const results = searchResults.slice(0, 10);

            let msg = "━━━━━━━━━━━━━━━━━━\n\n🔎 *SINHALASUB SEARCH RESULTS*\n\n";
            results.forEach((item, index) => {
                msg += `*${index + 1}.* ${item.title}\n`;
            });
            msg += "\n━━━━━━━━━━━━━━━━━━\n\n💬 Reply with the movie number." + DEFAULT_FOOTER;

            clearSession(sender);

            const timeout = setTimeout(() => {
                if (sessions.has(sender)) {
                    sessions.delete(sender);
                    reply("⏱️ Session expired due to inactivity." + DEFAULT_FOOTER).catch(() => {});
                }
            }, 5 * 60 * 1000);

            sessions.set(sender, {
                step: "WAITING_MOVIE_SELECTION",
                results,
                timeout
            });

            await reply(msg);
        } catch (error) {
            console.error("SinhalaSub command error:", error);
            if (m.react) await m.react("❌");
            await reply("❌ An error occurred while searching. Please try again later." + DEFAULT_FOOTER);
        }
    }
);

// -------------------------------------------------------------
// Interactive Selection Handler (on Text)
// -------------------------------------------------------------
cmd(
    {
        on: "text"
    },
    async (conn, mek, m, { from, reply, sender }) => {
        try {
            if (!sessions.has(sender)) return;

            const session = sessions.get(sender);
            const body = m.text ? m.text.trim() : "";

            if (isNaN(body) || body === "") return;

            // STEP 1: User selects movie from search list
            if (session.step === "WAITING_MOVIE_SELECTION") {
                const choice = parseInt(body);
                if (choice < 1 || choice > session.results.length) {
                    if (m.react) await m.react("❌");
                    return await reply(
                        `❌ Invalid choice. Please reply with a number between 1 and ${session.results.length}.` + DEFAULT_FOOTER
                    );
                }

                if (m.react) await m.react("📋");

                const selectedMovie = session.results[choice - 1];
                const { details, downloadLinks } = await getMovieDetailsAndLinks(selectedMovie.link);

                if (!downloadLinks || downloadLinks.length === 0) {
                    clearSession(sender);
                    if (m.react) await m.react("❌");
                    return await reply("❌ No direct download links available for this movie." + DEFAULT_FOOTER);
                }

                let downloadsText = "";
                downloadLinks.forEach((dl, idx) => {
                    downloadsText += `*${idx + 1}.* ${dl.label}\n`;
                });

                const movieTitle = details.title !== "Unknown" ? details.title : selectedMovie.title;

                const detailsCard =
                    `☘️ *Tɪᴛʟᴇ* ➯ *_${movieTitle}_*\n\n` +
                    `*❑ 📅 𝗥ᴇʟᴇᴀꜱᴇ 𝗗ᴀᴛᴇ* ➯ *_${details.releaseDate}_*\n` +
                    `*❑ 🌎 𝗖ᴏᴜɴᴛ𝗥ʏ* ➯ *_${details.country}_*\n` +
                    `*❑ ⏱️ 𝗗ᴜʀᴀᴛɪᴏɴ* ➯ *_${details.duration}_*\n` +
                    `*❑ 🎭 𝗚ᴇɴʀᴇꜱ* ➯ *_${details.genres}_*\n` +
                    `*❑ 🗣️ 𝗟ᴀɴɢᴜᴀɢᴇ* ➯ *_${details.language}_*\n` +
                    `*❑ 👨🏻‍💼 𝗗ɪʀᴇᴄᴛᴏ𝗥* ➯ *_${details.director}_*\n` +
                    `*❑ ⭐ 𝗥ᴀᴛɪɴɢ* ➯ *_${details.rating}_*\n` +
                    `*❑ 🎞️ 𝗤ᴜᴀ🇱🇮𝗧ʏ* ➯ *_${details.quality}_*\n\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `📥 *Available Downloads*\n\n` +
                    `${downloadsText}\n` +
                    `━━━━━━━━━━━━━━━━━━\n\n` +
                    `💬 Reply with the quality/download number.` +
                    DEFAULT_FOOTER;

                if (session.timeout) clearTimeout(session.timeout);
                session.timeout = setTimeout(() => {
                    if (sessions.has(sender)) {
                        sessions.delete(sender);
                        reply("⏱️ Session expired due to inactivity." + DEFAULT_FOOTER).catch(() => {});
                    }
                }, 5 * 60 * 1000);

                session.step = "WAITING_QUALITY_SELECTION";
                session.selectedMovie = { ...selectedMovie, title: movieTitle };
                session.downloadLinks = downloadLinks;

                // Send Poster image with Details Card caption if image exists
                if (details.poster) {
                    await conn.sendMessage(from, { image: { url: details.poster }, caption: detailsCard }, { quoted: mek });
                } else {
                    await reply(detailsCard);
                }
                return;
            }

            // STEP 2: User selects quality/link
            if (session.step === "WAITING_QUALITY_SELECTION") {
                const choice = parseInt(body);
                if (choice < 1 || choice > session.downloadLinks.length) {
                    if (m.react) await m.react("❌");
                    return await reply(
                        `❌ Invalid option. Please reply with a number between 1 and ${session.downloadLinks.length}.` + DEFAULT_FOOTER
                    );
                }

                const selectedDl = session.downloadLinks[choice - 1];
                const movieTitle = session.selectedMovie.title;

                const docCaption = `🎬 *${movieTitle}*\n\n🔗 *Link:* ${selectedDl.link}` + DEFAULT_FOOTER;

                if (m.react) await m.react("📥");
                await reply("📥 *Sending Movie File / Download Link... Please wait.*" + DEFAULT_FOOTER);

                const safeFileName = `${movieTitle.replace(/[/\\?%*:|"<>]/g, "")}.mp4`;

                try {
                    await conn.sendMessage(
                        from,
                        {
                            document: { url: selectedDl.link },
                            mimetype: "video/mp4",
                            fileName: safeFileName,
                            caption: docCaption
                        },
                        { quoted: mek }
                    );
                    if (m.react) await m.react("✅");
                } catch (e) {
                    // Fallback: If direct sending fails, provide the direct download link
                    await conn.sendMessage(
                        from,
                        {
                            text: `🎬 *${movieTitle}*\n\n⚠️ *Direct file upload failed. Here is your direct link:*\n🔗 ${selectedDl.link}` + DEFAULT_FOOTER
                        },
                        { quoted: mek }
                    );
                }

                clearSession(sender);
            }
        } catch (error) {
            console.error("SinhalaSub interactive handler error:", error);
            if (m.react) await m.react("❌");
            await reply("❌ Error processing your request. Please try searching again." + DEFAULT_FOOTER);
            clearSession(sender);
        }
    }
);

