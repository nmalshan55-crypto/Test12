const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Helper function to extract target user from mention, reply, or args
function getTargetUser(msg, args) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned && mentioned.length > 0) return mentioned[0];

  const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedSender) return quotedSender;

  if (args && args[0]) {
    let cleanNum = args[0].replace(/[^0-9]/g, "");
    if (cleanNum.length >= 9) return `${cleanNum}@s.whatsapp.net`;
  }
  return null;
}

// Universal Group Handler
async function handleGroupCommand(sock, msg, from, args, extra, commandLogic) {
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: "⚠️ *This command can only be used in groups!*" }, { quoted: msg });
  }

  try {
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants || [];
    
    // Check sender admin status
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderAdmin = participants.find(p => p.id === sender)?.admin;
    const isAdmins = !!senderAdmin;

    // Check bot admin status
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botAdmin = participants.find(p => p.id === botJid)?.admin;
    const isBotAdmins = !!botAdmin;

    const reply = async (text, options = {}) => {
      return sock.sendMessage(from, { text, ...options }, { quoted: msg });
    };

    await commandLogic({
      groupMetadata,
      participants,
      sender,
      isAdmins,
      isBotAdmins,
      reply,
      botJid
    });
  } catch (err) {
    console.error("Group Command Error:", err);
    await sock.sendMessage(from, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
  }
}

// 1. KICK MEMBER
const kick = {
  cmd: "kick",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ participants, isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can use this command!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be a Group Admin to kick members!*");

      const target = getTargetUser(msg, args);
      if (!target) return reply("⚠️ *Please mention or reply to a user to kick!*");

      const isAdminTarget = participants.find(p => p.id === target)?.admin;
      if (isAdminTarget) return reply("⚠️ *I cannot kick an Admin!*");

      await sock.groupParticipantsUpdate(from, [target], "remove");
      return reply(`✅ *Kicked:* @${target.split("@")[0]}`, { mentions: [target] });
    });
  }
};

// 2. TAG ALL MEMBERS
const tagall = {
  cmd: "tagall",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ participants, isAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can use this command!*");

      let validParticipants = participants.filter(p => /^\d{9,15}$/.test(p.id.split("@")[0]));
      if (validParticipants.length === 0) return reply("⚠️ *No valid numbers found to tag.*");

      let mentions = validParticipants.map(p => p.id);
      let text = "📢 *Attention Everyone:*\n\n" + validParticipants.map(p => `@${p.id.split("@")[0]}`).join(" ");

      return reply(text, { mentions });
    });
  }
};

// 3. SET GROUP PROFILE PICTURE
const setpp = {
  cmd: "setpp",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("❌ *You must be an admin to use this command!*");
      if (!isBotAdmins) return reply("❌ *I need to be an admin to set group picture!*");

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage) return reply("🖼️ *Please reply to an image to set as group profile photo.*");

      const media = await downloadMediaMessage({ message: quotedMsg }, 'buffer');
      await sock.updateProfilePicture(from, media);
      return reply("✅ *Group profile picture updated successfully!*");
    });
  }
};

// 4. LIST ADMINS
const admins = {
  cmd: "admins",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ participants, reply }) => {
      const adminList = participants.filter(p => p.admin);
      const text = `👑 *Group Admins:*\n\n` + adminList.map(p => `@${p.id.split("@")[0]}`).join("\n");
      return reply(text, { mentions: adminList.map(a => a.id) });
    });
  }
};

// 5. ADD MEMBER
const add = {
  cmd: "add",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can use this command!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to add members!*");
      if (!args[0]) return reply("⚠️ *Please provide the number! (e.g. .add 9477xxxxxxx)*");

      let cleanNum = args[0].replace(/[^0-9]/g, "");
      const target = `${cleanNum}@s.whatsapp.net`;

      await sock.groupParticipantsUpdate(from, [target], "add");
      return reply(`✅ *Successfully added:* @${cleanNum}`, { mentions: [target] });
    });
  }
};

// 6. PROMOTE TO ADMIN
const promote = {
  cmd: "promote",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can use this command!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to promote!*");

      const target = getTargetUser(msg, args);
      if (!target) return reply("⚠️ *Mention or reply to a user to promote.*");

      await sock.groupParticipantsUpdate(from, [target], "promote");
      return reply(`✅ *Promoted:* @${target.split("@")[0]}`, { mentions: [target] });
    });
  }
};

// 7. DEMOTE ADMIN
const demote = {
  cmd: "demote",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can use this command!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to demote!*");

      const target = getTargetUser(msg, args);
      if (!target) return reply("⚠️ *Mention or reply to a user to demote.*");

      await sock.groupParticipantsUpdate(from, [target], "demote");
      return reply(`✅ *Demoted:* @${target.split("@")[0]}`, { mentions: [target] });
    });
  }
};

// 8. UNMUTE / OPEN GROUP
const openGroup = {
  cmd: "open",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can open the group!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to open the group!*");

      await sock.groupSettingUpdate(from, "not_announcement");
      return reply("🔓 *Group has been unmuted. Everyone can send messages now!*");
    });
  }
};

// 9. MUTE / CLOSE GROUP
const closeGroup = {
  cmd: "close",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only group admins can close the group!*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to close the group!*");

      await sock.groupSettingUpdate(from, "announcement");
      return reply("🔒 *Group has been muted. Only admins can send messages now!*");
    });
  }
};

// 10. RESET INVITE LINK
const revoke = {
  cmd: "revoke",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only admins can reset group link.*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to reset invite link.*");

      await sock.groupRevokeInvite(from);
      return reply("♻️ *Group invite link has been reset successfully!*");
    });
  }
};

// 11. GET GROUP INVITE LINK
const grouplink = {
  cmd: "grouplink",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isBotAdmins, reply }) => {
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to fetch group link!*");

      const code = await sock.groupInviteCode(from);
      return reply(`🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}`);
    });
  }
};

// 12. CHANGE GROUP SUBJECT / NAME
const setsubject = {
  cmd: "setsubject",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only admins can change group name.*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to change group name.*");
      if (!args[0]) return reply("⚠️ *Please provide a new group name.*");

      await sock.groupUpdateSubject(from, args.join(" "));
      return reply("✅ *Group name updated successfully!*");
    });
  }
};

// 13. CHANGE GROUP DESCRIPTION
const setdesc = {
  cmd: "setdesc",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ isAdmins, isBotAdmins, reply }) => {
      if (!isAdmins) return reply("⚠️ *Only admins can change description.*");
      if (!isBotAdmins) return reply("⚠️ *I need to be an admin to change description.*");
      if (!args[0]) return reply("⚠️ *Please provide a new description.*");

      await sock.groupUpdateDescription(from, args.join(" "));
      return reply("✅ *Group description updated successfully!*");
    });
  }
};

// 14. GROUP INFO
const groupinfo = {
  cmd: "groupinfo",
  handler: async (sock, msg, from, args) => {
    await handleGroupCommand(sock, msg, from, args, null, async ({ groupMetadata, participants, reply }) => {
      const adminsCount = participants.filter(p => p.admin).length;
      const creation = new Date(groupMetadata.creation * 1000).toLocaleString();
      const owner = groupMetadata.owner || participants.find(p => p.admin === 'superadmin')?.id;
      const desc = groupMetadata.desc || "No description.";

      let txt = `👥 *Group Name:* ${groupMetadata.subject}\n`;
      txt += `🆔 *Group ID:* ${groupMetadata.id}\n`;
      txt += `🧑‍💼 *Owner:* ${owner ? `@${owner.split("@")[0]}` : "Not found"}\n`;
      txt += `📅 *Created On:* ${creation}\n`;
      txt += `👤 *Total Members:* ${participants.length}\n`;
      txt += `🛡️ *Total Admins:* ${adminsCount}\n\n`;
      txt += `📝 *Description:*\n${desc}`;

      return reply(txt, { mentions: owner ? [owner] : [] });
    });
  }
};

// Export main command (Kick default) and handlers
module.exports = kick;
module.exports.tagall = tagall;
module.exports.setpp = setpp;
module.exports.admins = admins;
module.exports.add = add;
module.exports.promote = promote;
module.exports.demote = demote;
module.exports.open = openGroup;
module.exports.close = closeGroup;
module.exports.revoke = revoke;
module.exports.grouplink = grouplink;
module.exports.setsubject = setsubject;
module.exports.setdesc = setdesc;
module.exports.groupinfo = groupinfo;
