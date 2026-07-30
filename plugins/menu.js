module.exports = {
    cmd: 'menu',
    desc: 'Display menu',
    handler: async (sock, msg, from, args, { BOT_NAME }) => {
        await sock.sendMessage(from, { text: 'Testing Menu Command!' }, { quoted: msg });
    }
};
