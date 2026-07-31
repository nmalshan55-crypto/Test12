const { cmd } = require("../command");
const { getGroupAdmins } = require("../lib/functions");
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Helper function to extract target user from mention, reply, or args
function getTargetUser(mek, quoted, args) {
  if (mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    return mek.message.extendedTextMessage.contextInfo.mentionedJid[0];
  } else if (quoted?.sender) {
    return quoted.sender;
  } else if (args[0]) {
    let cleanNum = args[0].replace(/[^0-9]/g, "");
    if (cleanNum.length >= 9) {
      return `${cleanNum}@s.whatsapp.net`;
    }
  }
  return null;
}

// 1. KICK MEMBER
cmd({
  pattern: "kick",
  react: "👢",
  desc: "Kick user from group",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply, participants, quoted, args }) => {
  if (!isGroup) return reply("*⚠️ This command can only be used in groups!*");
  if (!isAdmins) return reply("*⚠️ Only group admins can use this command!*");
  if (!isBotAdmins) return reply("*⚠️ I need to be a Group Admin to perform this action!*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*⚠️ Please mention or reply to a user to kick!*");

  const groupAdmins = getGroupAdmins(participants);
  if (groupAdmins.includes(target)) 
    return reply("*⚠️ I cannot kick an Admin!*");

  try {
    await danuwa.groupParticipantsUpdate(from, [target], "remove");
    return reply(`*✅ Kicked:* @${target.split("@")[0]}`, { mentions: [target] });
  } catch (e) {
    return reply(`*❌ Failed to kick user:* ${e.message}`);
  }
});

// 2. TAG ALL MEMBERS
cmd({
  pattern: "tagall",
  react: "📢",
  desc: "Tag all group members",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { isGroup, isAdmins, reply, participants }) => {
  if (!isGroup) return reply("*⚠️ This command can only be used in groups!*");
  if (!isAdmins) return reply("*⚠️ Only group admins can use this command!*");

  let validParticipants = participants.filter(p => {
    const number = p.id.split("@")[0];
    return /^\d{9,15}$/.test(number);
  });

  if (validParticipants.length === 0) {
    return reply("*⚠️ No valid phone numbers found to tag.*");
  }

  let mentions = validParticipants.map(p => p.id);
  let text = "📢 *Attention Everyone:*\n\n";

  let displayNumbers = validParticipants.map(p => `@${p.id.split("@")[0]}`);
  text += displayNumbers.join(" ");

  return reply(text, { mentions });
});

// 3. SET GROUP PROFILE PICTURE
cmd({
  pattern: "setpp",
  react: "🖼️",
  desc: "Set group profile picture",
  category: "group",
  filename: __filename
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply, quoted }) => {
  if (!isGroup) return reply("❌ This command can only be used in groups!");
  if (!isAdmins) return reply("❌ You must be a group admin to use this command!");
  if (!isBotAdmins) return reply("❌ I need to be an admin to update profile picture!");

  if (!quoted?.message?.imageMessage) return reply("🖼️ Please reply to an image to set as the group profile photo.");

  try {
    const media = await downloadMediaMessage(quoted, 'buffer');
    await danuwa.updateProfilePicture(from, media);
    reply("✅ Group profile picture updated successfully!");
  } catch (e) {
    console.error("❌ SetPP Error:", e);
    reply(`⚠️ Failed to set profile picture: ${e.message}`);
  }
});

// 4. LIST ADMINS
cmd({
  pattern: "admins",
  react: "👑",
  desc: "List all group admins",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { isGroup, reply, participants }) => {
  if (!isGroup) return reply("*⚠️ This command is for groups only.*");

  const admins = participants.filter(p => p.admin).map(p => `@${p.id.split("@")[0]}`).join("\n");
  const adminJids = participants.filter(p => p.admin).map(a => a.id);

  return reply(`👑 *Group Admins:*\n\n${admins}`, { mentions: adminJids });
});

// 5. ADD MEMBER
cmd({
    pattern: "add",
    alias: ["invite"],
    react: "➕",
    desc: "Add a user to the group.",
    category: "group",
    filename: __filename
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply, args }) => {
    try {
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");
        if (!isAdmins) return reply("⚠️ Only group admins can use this command!");
        if (!isBotAdmins) return reply("⚠️ I need to be an admin to add members!");

        if (!args[0]) return reply("⚠️ Please provide the phone number of the user to add! (e.g. .add 9477xxxxxxx)");

        let cleanNum = args[0].replace(/[^0-9]/g, "");
        const target = `${cleanNum}@s.whatsapp.net`;

        await danuwa.groupParticipantsUpdate(from, [target], "add");
        return reply(`✅ Successfully added: @${cleanNum}`, { mentions: [target] });
    } catch (e) {
        console.error("Add Error:", e);
        reply(`❌ Failed to add the user: ${e.message}`);
    }
});

// 6. PROMOTE TO ADMIN
cmd({
  pattern: "promote",
  react: "⬆️",
  desc: "Promote user to admin",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply, quoted, args }) => {
  if (!isGroup) return reply("*⚠️ This command is for groups only.*");
  if (!isAdmins) return reply("*⚠️ Only group admins can use this command!*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to promote members!*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*⚠️ Mention or reply to a user to promote.*");

  try {
    await danuwa.groupParticipantsUpdate(from, [target], "promote");
    return reply(`*✅ Promoted:* @${target.split("@")[0]}`, { mentions: [target] });
  } catch (e) {
    return reply(`*❌ Failed to promote:* ${e.message}`);
  }
});

// 7. DEMOTE ADMIN
cmd({
  pattern: "demote",
  react: "⬇️",
  desc: "Demote admin to member",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply, quoted, args }) => {
  if (!isGroup) return reply("*⚠️ This command is for groups only.*");
  if (!isAdmins) return reply("*⚠️ Only group admins can use this command!*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to demote admins!*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*⚠️ Mention or reply to a user to demote.*");

  try {
    await danuwa.groupParticipantsUpdate(from, [target], "demote");
    return reply(`*✅ Demoted:* @${target.split("@")[0]}`, { mentions: [target] });
  } catch (e) {
    return reply(`*❌ Failed to demote:* ${e.message}`);
  }
});

// 8. UNMUTE / OPEN GROUP
cmd({
    pattern: "open",
    alias: ["unmute"],
    react: "🔓",
    desc: "Allow everyone to send messages in the group.",
    category: "group",
    filename: __filename
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");
        if (!isAdmins) return reply("⚠️ This command is only for group admins!");
        if (!isBotAdmins) return reply("⚠️ I need to be an admin to unmute the group!");

        await danuwa.groupSettingUpdate(from, "not_announcement");
        return reply("✅ Group has been unmuted. Everyone can send messages now!");
    } catch (e) {
        console.error("Unmute Error:", e);
        reply(`❌ Failed to unmute group: ${e.message}`);
    }
});

// 9. MUTE / CLOSE GROUP
cmd({
    pattern: "close",
    alias: ["mute", "lock"],
    react: "🔒",
    desc: "Set group chat to admin-only messages.",
    category: "group",
    filename: __filename
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");
        if (!isAdmins) return reply("⚠️ This command is only for group admins!");
        if (!isBotAdmins) return reply("⚠️ I need to be an admin to mute the group!");

        await danuwa.groupSettingUpdate(from, "announcement");
        return reply("✅ Group has been muted. Only admins can send messages now!");
    } catch (e) {
        console.error("Mute Error:", e);
        reply(`❌ Failed to mute group: ${e.message}`);
    }
});

// 10. RESET INVITE LINK
cmd({
  pattern: "revoke",
  react: "♻️",
  desc: "Reset group invite link",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
  if (!isGroup) return reply("*⚠️ Group command only.*");
  if (!isAdmins) return reply("*⚠️ Only admins can reset link.*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to reset invite link.*");

  try {
    await danuwa.groupRevokeInvite(from);
    return reply("*✅ Group invite link has been reset successfully!*");
  } catch (e) {
    return reply(`*❌ Error:* ${e.message}`);
  }
});

// 11. GET GROUP INVITE LINK
cmd({
  pattern: "grouplink",
  alias: ["link"],
  react: "🔗",
  desc: "Get current invite link",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isBotAdmins, reply }) => {
  if (!isGroup) return reply("*⚠️ Group command only.*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to fetch the invite link!*");

  try {
    const code = await danuwa.groupInviteCode(from);
    return reply(`🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}`);
  } catch (e) {
    return reply(`*❌ Error:* ${e.message}`);
  }
});

// 12. CHANGE GROUP SUBJECT / NAME
cmd({
  pattern: "setsubject",
  react: "✏️",
  desc: "Change group name",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
  if (!isGroup) return reply("*⚠️ Group command only.*");
  if (!isAdmins) return reply("*⚠️ Only admins can change group name.*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to change group name.*");

  if (!args[0]) return reply("*⚠️ Please provide a new group name.*");

  try {
    await danuwa.groupUpdateSubject(from, args.join(" "));
    return reply("*✅ Group name updated successfully!*");
  } catch (e) {
    return reply(`*❌ Error:* ${e.message}`);
  }
});

// 13. CHANGE GROUP DESCRIPTION
cmd({
  pattern: "setdesc",
  react: "📝",
  desc: "Change group description",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
  if (!isGroup) return reply("*⚠️ Group command only.*");
  if (!isAdmins) return reply("*⚠️ Only admins can change description.*");
  if (!isBotAdmins) return reply("*⚠️ I need to be an admin to change description.*");

  if (!args[0]) return reply("*⚠️ Please provide a new group description.*");

  try {
    await danuwa.groupUpdateDescription(from, args.join(" "));
    return reply("*✅ Group description updated successfully!*");
  } catch (e) {
    return reply(`*❌ Error:* ${e.message}`);
  }
});

// 14. GROUP INFO
cmd({
  pattern: "groupinfo",
  alias: ["ginfo"],
  react: "📄",
  desc: "Show group details",
  category: "group",
  filename: __filename,
}, async (danuwa, mek, m, { from, isGroup, reply }) => {
  if (!isGroup) return reply("*⚠️ This command is for groups only.*");

  try {
    const metadata = await danuwa.groupMetadata(from);
    const adminsCount = metadata.participants.filter(p => p.admin).length;
    const creation = new Date(metadata.creation * 1000).toLocaleString();
    const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id;
    const desc = metadata.desc || "No description.";

    let txt = `👥 *Group Name:* ${metadata.subject}\n`;
    txt += `🆔 *Group ID:* ${metadata.id}\n`;
    txt += `🧑‍💼 *Owner:* ${owner ? `@${owner.split("@")[0]}` : "Not found"}\n`;
    txt += `📅 *Created On:* ${creation}\n`;
    txt += `👤 *Total Members:* ${metadata.participants.length}\n`;
    txt += `🛡️ *Total Admins:* ${adminsCount}\n\n`;
    txt += `📝 *Description:*\n${desc}`;

    return reply(txt, { mentions: owner ? [owner] : [] });
  } catch (e) {
    return reply(`*❌ Error:* ${e.message}`);
  }
});

