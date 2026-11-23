const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const {
  PREFIX,
  TICKET_PING_ROLE_ID,
  STAFF_ROLE_ID,
  TICKET_CATEGORIES,
  ticketStore,
  saveTickets
} = require("./config");
const { buildClaimRow } = require("./claims");

function buildTicketPanelPayload() {
  const panelEmbed = new EmbedBuilder()
    .setTitle("🎫 Ticket Center")
    .setColor(0x5865f2)
    .setDescription(
      "Select a category below to open a private ticket with our staff team.\n\n" +
      "🛠️ **Support** — Questions, server help, or member reports\n" +
      "🎁 **Claims** — Giveaway wins, rewards, or event prizes\n" +
      "💳 **Purchases** — Orders, store items, or payment help\n\n" +
      "*Please provide clear details once opened and avoid duplicate tickets.*"
    )
    .setFooter({ text: "Staff will respond as soon as possible" });

  const panelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tkt_open_support")
      .setLabel("Support")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tkt_open_claim")
      .setLabel("Claims")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tkt_open_purchases")
      .setLabel("Purchases")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [panelEmbed], components: [panelRow] };
}

async function createTicketChannel({ guild, user, type }) {
  const categoryId = TICKET_CATEGORIES[type];
  ticketStore.counter += 1;
  const ticketNum = String(ticketStore.counter).padStart(4, "0");
  const cleanUser =
    user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) ||
    "user";
  const channelName = `${type}-${cleanUser}-${ticketNum}`;

  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: TICKET_PING_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  if (STAFF_ROLE_ID && STAFF_ROLE_ID !== TICKET_PING_ROLE_ID) {
    permissionOverwrites.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `Ticket #${ticketNum} | Type: ${type.toUpperCase()} | Opener: ${user.id}`,
    permissionOverwrites
  });

  ticketStore.tickets[ticketChannel.id] = {
    channelId: ticketChannel.id,
    guildId: guild.id,
    openerId: user.id,
    openerTag: user.username || user.tag,
    claimedById: null,
    claimedByTag: null,
    addedUserIds: [],
    type,
    ticketNumber: ticketNum,
    createdAt: Date.now()
  };
  saveTickets();

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(
      `🎫 ${type.charAt(0).toUpperCase() + type.slice(1)} Ticket #${ticketNum}`
    )
    .setColor(0x23a559)
    .setDescription(
      `Thank you for contacting ${type}.\n` +
        `In the meantime, please share all relevant details so our team can assist you.\n\n` +
        `Staff can close this ticket anytime with \`${PREFIX}close [reason]\`, \`/close\`, or the buttons below.`
    )
    .setFooter({ text: "Ticket System" })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tkt_close_reason")
      .setLabel("Close With Reason")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${user} <@&${TICKET_PING_ROLE_ID}>`,
    embeds: [welcomeEmbed],
    components: [closeRow],
    allowedMentions: {
      users: [user.id],
      roles: [TICKET_PING_ROLE_ID]
    }
  });

  await ticketChannel.send({
    components: [buildClaimRow(null)]
  });

  return ticketChannel;
}

module.exports = {
  buildTicketPanelPayload,
  createTicketChannel
};
