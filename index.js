const {
  Client,
  GatewayIntentBits,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  REST,
  Routes
} = require("discord.js");
const { TOKEN, CLIENT_ID } = require("./config");
const { isTicketStaff } = require("./permissions");
const {
  claimTicket,
  unclaimTicket,
  isClaimTicket,
  buildVouchCheckPayload,
  handleVouchCheckButton
} = require("./claims");
const { closeTicketChannel } = require("./transcript");
const { createTicketChannel } = require("./panel");
const { slashCommands, handleSlashCommand } = require("./commands/slash");
const { handlePrefixCommand } = require("./commands/prefix");

async function registerSlashCommands() {
  if (!TOKEN || !CLIENT_ID) {
    console.warn("⚠️ TICKET_CLIENT_ID not set — skipping global slash command registration.");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: slashCommands.map((cmd) => cmd.toJSON())
    });
    console.log("✅ Registered slash commands (/ticketpanel, /add, /rename, /close, /claim, /unclaim).");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.once("ready", async () => {
  console.log(`🎫 Ticket Bot online as ${client.user.tag}`);
  await registerSlashCommands();
});

client.on("interactionCreate", async (interaction) => {
  const { guild, user, member, channel } = interaction;
  if (!guild) return;

  if (interaction.isChatInputCommand()) {
    return handleSlashCommand(interaction);
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "tkt_close_reason_modal"
  ) {
    if (!isTicketStaff(member, channel)) {
      return interaction.reply({
        content: "❌ Only staff members can close tickets.",
        ephemeral: true
      });
    }
    const reason =
      interaction.fields.getTextInputValue("close_reason").trim() ||
      "No reason provided";

    if (isClaimTicket(channel)) {
      channel._pendingCloseReason = reason;
      channel._pendingCloseMethod = "Close With Reason";
      const vouchPayload = await buildVouchCheckPayload(channel, guild);
      return interaction.reply(vouchPayload);
    }

    await interaction.deferUpdate().catch(() => null);

    return closeTicketChannel({
      channel,
      guild,
      closedBy: user,
      reason,
      method: "Close With Reason"
    });
  }

  if (interaction.isButton() && interaction.customId.startsWith("tkt_")) {
    const id = interaction.customId.toLowerCase();

    if (id === "tkt_vouch_yes" || id === "tkt_vouch_no") {
      if (!isTicketStaff(member, channel)) {
        return interaction.reply({
          content: "❌ Only staff members can respond to the vouch check.",
          ephemeral: true
        });
      }
      return handleVouchCheckButton({
        interaction,
        closeTicketChannel
      });
    }

    if (id === "tkt_close") {
      if (!isTicketStaff(member, channel)) {
        return interaction.reply({
          content: "❌ Only staff members can close tickets.",
          ephemeral: true
        });
      }

      if (isClaimTicket(channel)) {
        channel._pendingCloseReason = "Closed via Close button";
        channel._pendingCloseMethod = "Close Button";
        const vouchPayload = await buildVouchCheckPayload(channel, guild);
        return interaction.reply(vouchPayload);
      }

      return closeTicketChannel({
        channel,
        guild,
        closedBy: user,
        reason: "Closed via Close button",
        method: "Close Button"
      });
    }

    if (id === "tkt_close_reason") {
      if (!isTicketStaff(member, channel)) {
        return interaction.reply({
          content: "❌ Only staff members can close tickets.",
          ephemeral: true
        });
      }
      const modal = new ModalBuilder()
        .setCustomId("tkt_close_reason_modal")
        .setTitle("Close Ticket");

      const reasonInput = new TextInputBuilder()
        .setCustomId("close_reason")
        .setLabel("Reason for closing")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    if (id === "tkt_claim") {
      if (!isTicketStaff(member, channel)) {
        return interaction.reply({
          content: "❌ Only staff members can claim tickets.",
          ephemeral: true
        });
      }
      const res = await claimTicket({ channel, guild, user });
      if (!res.ok) return interaction.reply({ content: res.error, ephemeral: true });
      return interaction.reply({ embeds: [res.embed] });
    }

    if (id === "tkt_unclaim") {
      if (!isTicketStaff(member, channel)) {
        return interaction.reply({
          content: "❌ Only staff members can manage ticket claims.",
          ephemeral: true
        });
      }
      const res = await unclaimTicket({ channel, user });
      if (!res.ok) return interaction.reply({ content: res.error, ephemeral: true });
      return interaction.reply({ content: res.content });
    }

    let type = null;
    if (id.includes("support")) type = "support";
    else if (id.includes("claim")) type = "claim";
    else if (id.includes("purchase")) type = "purchases";

    if (!type) return;

    await interaction.deferReply({ ephemeral: true });
    const ticketChannel = await createTicketChannel({ guild, user, type });

    return interaction.editReply({
      content: `✅ Your ticket has been created: ${ticketChannel}`
    });
  }
});

client.on("messageCreate", (message) => {
  handlePrefixCommand(message, client).catch((err) => {
    console.error("❌ Prefix command error:", err);
  });
});

if (!TOKEN) {
  console.error("❌ Missing TICKET_BOT_TOKEN environment variable.");
  process.exit(1);
}

client.login(TOKEN);
