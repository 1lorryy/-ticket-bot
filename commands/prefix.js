const { PREFIX } = require("../config");
const {
  isTicketChannel,
  isTicketStaff,
  canManageTicketMembers,
  addUserToTicket
} = require("../permissions");
const {
  claimTicket,
  unclaimTicket,
  isClaimTicket,
  buildVouchCheckPayload
} = require("../claims");
const { closeTicketChannel } = require("../transcript");
const { buildTicketPanelPayload } = require("../panel");
const { handleTicketSetupPrefix } = require("../ticketSetup");
const { handleBotInfoPrefix } = require("../botInfo");

function deleteAfter(msg, delayMs = 5000) {
  if (!msg) return;
  const timer = setTimeout(() => {
    msg.delete().catch(() => null);
  }, delayMs);
  if (typeof timer.unref === "function") timer.unref();
}

async function handlePrefixCommand(message, client) {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const { guild, member, channel, author } = message;

  if (cmd === "botinfo" || cmd === "about") {
    return handleBotInfoPrefix(message, client);
  }

  if (cmd === "tsetup" || cmd === "ticketsetup") {
    return handleTicketSetupPrefix(message, args);
  }

  if (cmd === "ticketpanel") {
    if (!isTicketStaff(member)) {
      return message.reply("❌ Only staff members can send the ticket panel.");
    }
    await message.delete().catch(() => null);
    return channel.send(buildTicketPanelPayload());
  }

  if (!["add", "rename", "close", "claim", "unclaim"].includes(cmd)) return;

  if (!isTicketChannel(channel)) {
    return message.reply("❌ This command can only be used inside a ticket channel.");
  }

  if (cmd === "add") {
    if (!canManageTicketMembers(member, channel)) {
      return message.reply("❌ Only staff members can add users to tickets.");
    }
    const rawTarget = args[0]?.replace(/[<@!>]/g, "");
    const targetUser =
      message.mentions.users.first() ||
      (rawTarget ? await client.users.fetch(rawTarget).catch(() => null) : null);

    if (!targetUser) {
      return message.reply(`❌ Usage: \`${PREFIX}add @user\` or \`${PREFIX}add userId\``);
    }

    const res = await addUserToTicket({ channel, guild, targetUser, addedBy: author });
    if (!res.ok) return message.reply(res.error);
    return message.reply(`✅ Added ${targetUser} to ${channel}.`);
  }

  if (cmd === "rename") {
    if (!isTicketStaff(member, channel)) {
      return message.reply("❌ Only staff members can rename tickets.");
    }
    const rawName = args.join("-");
    const cleanName = rawName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 90);

    if (!cleanName) {
      return message.reply(`❌ Usage: \`${PREFIX}rename new-name\``);
    }
    await message.delete().catch(() => null);
    await channel.setName(cleanName);
    const notice = await channel.send(`✏️ Renamed ticket to **#${cleanName}**.`);
    deleteAfter(notice, 5000);
    return notice;
  }

  if (cmd === "close") {
    if (!isTicketStaff(member, channel)) {
      return message.reply("❌ Only staff members can close tickets.");
    }
    const reason = args.join(" ").trim() || "No reason provided";
    await message.delete().catch(() => null);

    if (isClaimTicket(channel)) {
      channel._pendingCloseReason = reason;
      channel._pendingCloseMethod = "Prefix Command";
      const vouchPayload = await buildVouchCheckPayload(channel, guild);
      const promptMsg = await channel.send(vouchPayload);
      deleteAfter(promptMsg, 30000);
      return promptMsg;
    }

    return closeTicketChannel({
      channel,
      guild,
      closedBy: author,
      reason,
      method: "Prefix Command"
    });
  }

  if (cmd === "claim") {
    if (!isTicketStaff(member, channel)) {
      return message.reply("❌ Only staff members can claim tickets.");
    }
    const res = await claimTicket({ channel, guild, user: author });
    if (!res.ok) return message.reply(res.error);
    return message.reply({ embeds: [res.embed] });
  }

  if (cmd === "unclaim") {
    if (!isTicketStaff(member, channel)) {
      return message.reply("❌ Only staff members can manage ticket claims.");
    }
    const res = await unclaimTicket({ channel, user: author });
    if (!res.ok) return message.reply(res.error);
    return message.reply(res.content);
  }
}

module.exports = {
  handlePrefixCommand
};
