const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { VOUCH_CHANNEL_ID, ticketStore, saveTickets } = require("./config");
const { resolveOpenerId } = require("./permissions");

function buildClaimRow(claimedById, viewerId = null) {
  if (!claimedById) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tkt_claim")
        .setLabel("Claim")
        .setEmoji("🙋")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false)
    );
  }

  const isOwner = viewerId && viewerId === claimedById;
  if (isOwner) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tkt_unclaim")
        .setLabel("Unclaim")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(false)
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tkt_claim")
      .setLabel("Claimed")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

async function syncClaimMessageButton(channel, claimedById) {
  if (!channel?.isTextBased()) return;
  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (!recent) return;

  const claimMsg = recent.find(
    (m) =>
      m.author?.id === channel.client.user.id &&
      m.components?.some((row) =>
        row.components?.some(
          (c) => c.customId === "tkt_claim" || c.customId === "tkt_unclaim"
        )
      )
  );

  if (claimMsg) {
    await claimMsg
      .edit({ components: [buildClaimRow(claimedById, claimedById)] })
      .catch(() => null);
  }
}

async function claimTicket({ channel, guild, user }) {
  const existing = ticketStore.tickets[channel.id] || {
    channelId: channel.id,
    guildId: guild.id,
    openerId: resolveOpenerId(channel),
    createdAt: channel.createdTimestamp || Date.now()
  };

  if (existing.claimedById && existing.claimedById !== user.id) {
    return {
      ok: false,
      error: `❌ This ticket is already claimed by <@${existing.claimedById}>. Only they can unclaim it.`
    };
  }

  existing.claimedById = user.id;
  existing.claimedByTag = user.username || user.tag;
  ticketStore.tickets[channel.id] = existing;
  saveTickets();

  await syncClaimMessageButton(channel, user.id);

  const claimEmbed = new EmbedBuilder()
    .setTitle("Claimed Ticket")
    .setColor(0x23a559)
    .setDescription(`Your ticket will be handled by ${user}`)
    .setTimestamp();

  return { ok: true, embed: claimEmbed };
}

async function unclaimTicket({ channel, user }) {
  const existing = ticketStore.tickets[channel.id] || {};
  if (!existing.claimedById) {
    await syncClaimMessageButton(channel, null);
    return {
      ok: false,
      error: "ℹ️ This ticket isn't currently claimed."
    };
  }

  if (existing.claimedById !== user.id) {
    return {
      ok: false,
      error: `❌ Only <@${existing.claimedById}> can unclaim this ticket.`
    };
  }

  existing.claimedById = null;
  existing.claimedByTag = null;
  ticketStore.tickets[channel.id] = existing;
  saveTickets();

  await syncClaimMessageButton(channel, null);

  return {
    ok: true,
    content: `🔓 Ticket unclaimed by ${user}. Another staff member can now claim it.`
  };
}

// ================= GIVEAWAY CLAIM VOUCH CHECK =================
function isClaimTicket(channel) {
  const saved = ticketStore.tickets[channel?.id];
  if (saved?.type === "claim") return true;
  if (typeof channel?.name === "string" && channel.name.startsWith("claim-")) return true;
  if (typeof channel?.topic === "string" && /Type:\s*CLAIM/i.test(channel.topic)) return true;
  return false;
}

async function hasRecentVouchInChannel(guild, openerId) {
  if (!guild || !openerId) return false;
  const vouchChannel = await guild.channels
    .fetch(VOUCH_CHANNEL_ID)
    .catch(() => null);
  if (!vouchChannel || !vouchChannel.isTextBased()) return false;

  const recent = await vouchChannel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!recent) return false;

  return recent.some((msg) => !msg.author?.bot && msg.author?.id === openerId);
}

async function buildVouchCheckPayload(channel, guild) {
  const openerId = resolveOpenerId(channel);
  const openerMention = openerId ? `<@${openerId}>` : "the winner";
  const foundRecent = await hasRecentVouchInChannel(guild, openerId);

  const statusLine = openerId
    ? foundRecent
      ? `🔎 Quick scan: Found a recent message from ${openerMention} in <#${VOUCH_CHANNEL_ID}>.`
      : `🔎 Quick scan: No recent message from ${openerMention} spotted in the last 50 messages of <#${VOUCH_CHANNEL_ID}>.`
    : `🔎 Quick scan: Could not detect ticket opener ID automatically.`;

  const embed = new EmbedBuilder()
    .setTitle("🎟️ Vouch Check Before Closing Claim Ticket")
    .setColor(0xf59e0b)
    .setDescription(
      `Has ${openerMention} already vouched in <#${VOUCH_CHANNEL_ID}>?\n\n` +
      `${statusLine}\n\n` +
      `• **Yes** — Close ticket & generate HTML transcript\n` +
      `• **No** — Keep ticket open so they can vouch first`
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tkt_vouch_yes")
      .setLabel("Yes")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tkt_vouch_no")
      .setLabel("No")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

async function handleVouchCheckButton({
  interaction,
  closeTicketChannel
}) {
  const { guild, user, channel, customId } = interaction;
  const id = customId.toLowerCase();

  if (id === "tkt_vouch_yes") {
    if (channel?._vouchClosing) {
      return interaction.reply({
        content: "⏳ Already closing this ticket...",
        ephemeral: true
      }).catch(() => null);
    }
    if (channel) channel._vouchClosing = true;

    await interaction.update({ components: [] }).catch(() => null);

    try {
      return await closeTicketChannel({
        channel,
        guild,
        closedBy: user,
        reason: channel?._pendingCloseReason || "Confirmed vouched in vouch channel",
        method: channel?._pendingCloseMethod || "Vouch Check (Yes)"
      });
    } catch (err) {
      if (channel) channel._vouchClosing = false;
      throw err;
    }
  }

  if (id === "tkt_vouch_no") {
    await interaction.update({ components: [] }).catch(() => null);

    const openerId = resolveOpenerId(channel);
    const pingText = openerId ? `<@${openerId}> ` : "";

    return channel.send(
      `❌ ${pingText}Ticket kept open — please post your vouch in <#${VOUCH_CHANNEL_ID}> first, then staff can close this ticket.`
    );
  }
}

module.exports = {
  VOUCH_CHANNEL_ID,
  buildClaimRow,
  claimTicket,
  unclaimTicket,
  isClaimTicket,
  buildVouchCheckPayload,
  handleVouchCheckButton
};
