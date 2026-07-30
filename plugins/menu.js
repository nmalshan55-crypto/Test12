const os = require('os');

// Time & Uptime helper function
function runtime(seconds) {
  seconds = Number(seconds);
  var d = Math.floor(seconds / (3600 * 24));
  var h = Math.floor((seconds % (3600 * 24)) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);
  var dDisplay = d > 0 ? d + "d " : "";
  var hDisplay = h > 0 ? h + "h " : "";
  var mDisplay = m > 0 ? m + "m " : "";
  var sDisplay = s > 0 ? s + "s" : "";
  return dDisplay + hDisplay + mDisplay + sDisplay;
}

module.exports = [
  {
    cmd: 'menu',
    alias: ['help', 'commands', 'list'],
    desc: 'Display all available bot commands',
    handler: async (sock, msg, from, args) => {
      try {
        const uptime = runtime(process.uptime());
        const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

        const menuText = `
┌───「 *AKASH-MD BOT MENU* 」───
│ 
│ 👤 *Owner:* AKASH
│ ⏱️ *Uptime:* ${uptime}
│ 💾 *RAM Usage:* ${(totalRam - freeRam).toFixed(2)}GB / ${totalRam}GB
│ ⚡ *Prefix:* .
│ 
└───「 *COMMAND LIST* 」───

🎵 *DOWNLOAD COMMANDS*
  ├ .song <name/url> - Download MP3 Audio
  ├ .video <name/url> - Download MP4 Video
  └ .tiktok <url> - Download TikTok Video

🖼️ *MEDIA & CONVERTER*
  ├ .sticker - Convert Image/Video to Sticker
  └ .img <text> - Search and Download Images

🤖 *BOT & SYSTEM*
  ├ .menu - Display Command List
  ├ .ping - Check Bot Response Speed
  ├ .alive - Check Bot Status
  └ .owner - Get Owner Contact Info

💡 *UTILITY & FUN*
  ├ .alive - Check if bot is active
  └ .say <text> - Bot echoes your message

─────────────────────
> *AKASH-MD WhatsApp Bot*
`;

        // Send Menu with Banner Image
        await sock.sendMessage(from, {
          image: { url: 'https://i.ibb.co/LZ8yqP9/banner.jpg' }, // ඔයා කැමති Image Link එකක් මෙතනට දාන්න පුළුවන්
          caption: menuText
        }, { quoted: msg });

      } catch (e) {
        console.log("MENU COMMAND ERROR:", e);
        await sock.sendMessage(from, { text: "❌ Menu එක load කිරීමේදී දෝෂයක් සිදු විය!" }, { quoted: msg });
      }
    }
  }
];
