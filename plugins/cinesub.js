const axios = require('axios');

// User session memory cache
const movieCache = new Map();

const API_KEY = "chama_api_ccdab200e680aeff09382486f99f093b";
const BASE_URL = "https://chama-movie-api.koyeb.app/api/v1/movie/cinesubz";

module.exports = {
    cmd: 'cinesubz',
    alias: ['cinesub', 'cine', 'subz'],
    desc: 'Search Sinhala Subtitled Movies from Cinesubz API',
    handler: async (sock, msg, from, args) => {
        try {
            const text = args.join(" ").trim();

            // Message එකට reply කරලා quality (1, 2, 3) තෝරාගැනීම
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (movieCache.has(from) && (quotedMsg || ['1', '2', '3', '480p', '720p', '1080p'].includes(text.toLowerCase()))) {
                const session = movieCache.get(from);
                let selectedQuality = text.toLowerCase();

                if (selectedQuality === '1') selectedQuality = '480p';
                if (selectedQuality === '2') selectedQuality = '720p';
                if (selectedQuality === '3') selectedQuality = '1080p';

                const targetLink = session.qualities[selectedQuality] || Object.values(session.qualities)[0];

                if (!targetLink) {
                    return await sock.sendMessage(from, { text: "❌ තෝරාගත් Quality එක සඳහා Download Link එකක් හමු වූයේ නැත!" }, { quoted: msg });
                }

                await sock.sendMessage(from, { text: `⏳ *${selectedQuality.toUpperCase()} Link එක සූදානම් කරමින් පවතී...*` }, { quoted: msg });

                movieCache.delete(from);

                const downloadMsg = `🎬 *${session.title}*\n` +
                                    `📺 *Quality:* ${selectedQuality.toUpperCase()}\n` +
                                    `🌐 *Source:* Cinesubz.lk\n\n` +
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

            await sock.sendMessage(from, { text: "🔎 *Chama API මඟින් Cinesubz සෙවීම සිදු කරයි...*" }, { quoted: msg });

            // 1. Search API Call
            const searchRes = await axios.get(`${BASE_URL}/search?q=${encodeURIComponent(text)}&api_key=${API_KEY}`);
            const searchData = searchRes.data;

            const results = searchData.data || [];

            if (!results.length) {
                return await sock.sendMessage(from, { text: "❌ *Cinesubz එකේ මෙම චිත්‍රපටය හමු වූයේ නැත!* නම නිවැරදිව ටයිප් කරන්න." }, { quoted: msg });
            }

            // Get first movie search result
            const firstMovie = results[0];
            const movieUrl = firstMovie.link || firstMovie.url;
            const movieTitle = firstMovie.title || text;
            const movieImg = firstMovie.image || firstMovie.thumbnail || 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

            await sock.sendMessage(from, { text: "⬇️ *Download Links සහ Qualities ලබාගනිමින් පවතී...*" }, { quoted: msg });

            // 2. Info & Download API Call
            const infoRes = await axios.get(`${BASE_URL}/infodl?q=${encodeURIComponent(movieUrl)}&api_key=${API_KEY}`);
            const infoData = infoRes.data;

            
const qualities = {};

            const downloads = infoData.downloads || [];

            downloads.forEach(dl => {
                const q=(dl.quality||"").toLowerCase();
                if(!dl.link) return;
                if(q.includes("480")) qualities["480p"]=dl.link;
                if(q.includes("720")) qualities["720p"]=dl.link;
                if(q.includes("1080")) qualities["1080p"]=dl.link;
            });

            if(Object.keys(qualities).length===0){
                return await sock.sendMessage(from,{text:"❌ Download Links හමු වුණේ නැහැ!"},{quoted:msg});
            }

            // Session Save

            movieCache.set(from, {
                title: movieTitle,
                img: movieImg,
                qualities: qualities
            });

            const qualityMenu = `🎬 *${movieTitle.toUpperCase()}* (Cinesubz)\n\n` +
                                `මෙම Message එකට *Reply* කර ඔබට අවශ්‍ය Quality එකේ අංකය යවන්න:\n\n` +
                                `1️⃣ - 480p (SD Quality)\n` +
                                `2️⃣ - 720p (HD Quality)\n` +
                                `3️⃣ - 1080p (Full HD Quality)\n\n` +
                                `> *AKASH-MD Cinesubz Downloader*`;

            await sock.sendMessage(from, {
                image: { url: movieImg },
                caption: qualityMenu
            }, { quoted: msg });

        } catch (e) {
            console.log("CINESUBZ API ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Cinesubz API එකෙන් දත්ත ලබාගැනීමේදී දෝෂයක් සිදු විය!" }, { quoted: msg });
        }
    }
};

