const os = require('os');

// Runtime/Uptime calculator helper
function runtime(seconds) {
  seconds = Number(seconds);
  var d = Math.floor(seconds / (3600 * 24));
  var h = Math.floor((seconds % (3600 * 24)) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
    cmd: 'system',
    alias: ['sys', 'botinfo', 'ping'],
    desc: 'Check bot system info and status',
    handler: async (sock, msg, from, args) => {
        try {
            const start = new Date().getTime();
            
            // Send initial ping message
            const initialMsg = await sock.sendMessage(from, { text: '1 pinging...' }, { quoted: msg });
            const latency = new Date().getTime() - start;

            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
            const usedRam = (totalRam - freeRam).toFixed(2);

            // System Info Text
            const systemText = `╭─── [ *AKASH-MD SYSTEM* ] ───❖\n` +
                               `│ 🤖 *Bot Name:* AKASH-MD\n` +
                               `│ 👑 *Owner:* AKASH\n` +
                               `│ ⚙️ *Platform:* Heroku (Cloud)\n` +
                               `│ ⚡ *Speed (Ping):* ${latency}ms\n` +
                               `│ ⏱️ *Uptime:* ${runtime(process.uptime())}\n` +
                               `│ 💾 *RAM Usage:* ${usedRam}GB / ${totalRam}GB\n` +
                               `│ 🖥️ *Host OS:* ${os.platform()}\n` +
                               `│ 🚀 *Mode:* Public\n` +
                               `╰────────────────────────❖\n\n` +
                               `> *AKASH-MD WhatsApp Bot is Active!*`;

            const imageUrl = 'https://i.ibb.co/7xtcf5Vv/file-0000000002d48230a5ad48cf94c182d7.png';

            // Send Final System Card with Image
            await sock.sendMessage(from, {
                image: { url: imageUrl },
                caption: systemText
            }, { quoted: msg });

        } catch (e) {
            console.log("SYSTEM COMMAND ERROR:", e);
            await sock.sendMessage(from, { text: "❌ Error loading system info!" }, { quoted: msg });
        }
    }
};

