const axios = require('axios');
const cheerio = require('cheerio');

// In-memory cache to store movie selection per user/chat
const movieCache = new Map();

module.exports = {
    cmd: 'cinesubz',
    alias: ['cinesub', 'cine', 'subz'],
    desc: 'Search Sinhala Subtitled Movies from Cinesubz & Pick Quality',
    handler: async (sock, msg, from, args) => {
        try {
            const text = args.join(" ").trim();

            // Reply කරපු message එකක්ද සහ cache එකේ Data තියෙනවාද බලනවා
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (movieCache.has(from) && (quotedMsg || ['1', '2', '3', '480p', '720p', '1080p'].includes(text.toLowerCase()))) {
                const session = movieCache.get(from);
                let selectedQuality = text.toLowerCase();

                if (selectedQuality === '1') selectedQuality = '480p';
                if (selectedQuality === '2') selectedQuality = '720p';
                if (selectedQuality === '3') selectedQuality = '1080p';

                const targetLink = session.qualities[selectedQuality] || session.qualities[Object.keys(session.qualities)[0]];

                if (!targetLink) {
                    return await sock.sendMessage(from, { text: "❌ තෝරාගත් Quality එකට අදාළ Cinesubz Link එක හමු වූයේ නැත!" }, { quoted: msg });
                }

                await sock.sendMessage(from, { text: `⏳ *Cinesubz ${selectedQuality.toUpperCase()} Link එක සූදානම් කරමින් පවතී...*` }, { quoted: msg });

                // Memory cache එක clear කිරීම
                movieCache.delete(from);

                const downloadMsg = `🎬 *${session.title}*\n` +
                                    `📺 *Quality:* ${selectedQuality.toUpperCase()}\n` +
                                    `🌐 *Source:* Cinesubz.co\n\n` +
                                    `📥 *Direct Download Link:*\n${targetLink}\n\n` +
                                    `> *AKASH-MD Cinesubz Downloader*`;

                return await sock.sendMessage(from, {
                    image: { url: session.img },
                    caption: downloadMsg
                }, { quoted: msg });
            }

            if (!text) {
                return await sock.sendMessage(from, { 
                    text: "🎬 *Cinesubz එකෙන් හොයන්න ඕන Movie එකේ නම දෙන්න!*\n\nExample: `.cinesubz Avatar`" 
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { text: "🔎 *Cinesubz.co අඩවියෙන් Movie & Quality Links සෙවීම සිදු කරයි...*" }, { quoted: msg });

            const searchUrl = `https://cinesubz.co/?s=${encodeURIComponent(text)}`;
            const { data } = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
                }
            });

            const $ = cheerio.load(data);
            const firstMovieLink = $('.result-item a, .post-item a, article a').first().attr('href');
            const movieTitle = $('.result-item .title, .post-item .title, article h3').first().text().trim() || text;
            const movieImg = $('.result-item img, .post-item img, article img').first().attr('src') || 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

            if (!firstMovieLink) {
                return await sock.sendMessage(from, { text: "❌ *Cinesubz එකේ මෙම චිත්‍රපටය හමු වූයේ නැත!* නම නිවැරදිව ටයිප් කරන්න." }, { quoted: msg });
            }

            // Movie Details Scraping
            const moviePage = await axios.get(firstMovieLink, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
                }
            });
            const $$ = cheerio.load(moviePage.data);

            const qualities = {};
            $$('a').each((i, el) => {
                const linkText = $$(el).text().toLowerCase();
                const href = $$(el).attr('href');
                if (href && href.startsWith('http')) {
                    if (linkText.includes('480p') || linkText.includes('sd')) qualities['480p'] = href;
                    if (linkText.includes('720p') || linkText.includes('hd')) qualities['720p'] = href;
                    if (linkText.includes('1080p') || linkText.includes('fhd')) qualities['1080p'] = href;
                }
            });

            if (!qualities['480p']) qualities['480p'] = firstMovieLink;
            if (!qualities['720p']) qualities['720p'] = firstMovieLink;
            if (!qualities['1080p']) qualities['1080p'] = firstMovieLink;

            // Session එක Save කිරීම
            movieCache.set(from, {
                title: movieTitle,
                img: movieImg,
                qualities: qualities
            });

            const qualityMenu = `🎬 *${movieTitle.toUpperCase()}* (Cinesubz)\n\n` +
                                `මෙම Message එකට *Reply* කර ඔබට අවශ්‍ය අංකය යවන්න:\n\n` +
                                `1️⃣ - 480p (SD Quality)\n` +
                                `2️⃣ - 720p (HD Quality)\n` +
                                `3️⃣ - 1080p (Full HD Quality)\n\n` +
                                `> *AKASH-MD Cinesubz Movie Downloader*`;

            await sock.sendMessage(from, {
                image: { url: movieImg },
                caption: qualityMenu
            }, { quoted: msg });

        } catch (e) {
            console.log("CINESUBZ QUALITY ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Cinesubz එකෙන් Movie Qualities ලබාගැනීමේදී දෝෂයක් සිදු විය!" }, { quoted: msg });
        }
    }
};
