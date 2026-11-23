const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { ticketStore, saveTickets } = require("./config");
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

module.exports = {
  buildClaimRow,
  claimTicket,
  unclaimTicket
};
