const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
  isTicketChannel,
  isTicketStaff,
  canManageTicketMembers,
  addUserToTicket
} = require("../permissions");
const { claimTicket, unclaimTicket } = require("../claims");
const { closeTicketChannel } = require("../transcript");
const { buildTicketPanelPayload } = require("../panel");
const { botInfoSlashCommand, handleBotInfoSlash } = require("../botInfo");
const {
  ticketSetupSlashCommand,
  handleTicketSetupSlash
} = require("../ticketSetup");

const slashCommands = [
  ticketSetupSlashCommand,
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send the ticket creation panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a user to the current ticket")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to add").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Rename the current ticket channel")
    .addStringOption((opt) =>
      opt.setName("name").setDescription("New ticket channel name").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the current ticket and generate an HTML transcript")
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for closing").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim the current ticket"),
  new SlashCommandBuilder()
    .setName("unclaim")
    .setDescription("Unclaim the current ticket (only works for the claimer)")
];

async function handleSlashCommand(interaction) {
  const { guild, user, member, channel, commandName: cmd } = interaction;

  if (cmd === "ticketsetup") {
    return handleTicketSetupSlash(interaction);
  }

  if (cmd === "ticketpanel") {
    if (!isTicketStaff(member)) {
      return interaction.reply({
        content: "❌ Only staff members can send the ticket panel.",
        ephemeral: true
      });
    }
    await channel.send(buildTicketPanelPayload());
    return interaction.reply({ content: "✅ Ticket panel sent.", ephemeral: true });
  }

  if (!isTicketChannel(channel)) {
    return interaction.reply({
      content: "❌ This command can only be used inside a ticket channel.",
      ephemeral: true
    });
  }

  if (cmd === "add") {
    if (!canManageTicketMembers(member, channel)) {
      return interaction.reply({
        content: "❌ Only staff members can add users to tickets.",
        ephemeral: true
      });
    }
    const targetUser = interaction.options.getUser("user", true);
    const res = await addUserToTicket({ channel, guild, targetUser, addedBy: user });
    if (!res.ok) return interaction.reply({ content: res.error, ephemeral: true });
    return interaction.reply({ content: `✅ Added ${targetUser} to ${channel}.` });
  }

  if (cmd === "rename") {
    if (!isTicketStaff(member, channel)) {
      return interaction.reply({
        content: "❌ Only staff members can rename tickets.",
        ephemeral: true
      });
    }
    const rawName = interaction.options.getString("name", true);
    const cleanName = rawName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 90);
    if (!cleanName) {
      return interaction.reply({ content: "❌ Invalid channel name.", ephemeral: true });
    }
    await channel.setName(cleanName);
    return interaction.reply({ content: `✏️ Renamed ticket to **#${cleanName}**.` });
  }

  if (cmd === "close") {
    if (!isTicketStaff(member, channel)) {
      return interaction.reply({
        content: "❌ Only staff members can close tickets.",
        ephemeral: true
      });
    }
    const reason = interaction.options.getString("reason") || "No reason provided";
    await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
    return closeTicketChannel({
      channel,
      guild,
      closedBy: user,
      reason,
      method: "Slash Command"
    });
  }

  if (cmd === "claim") {
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

  if (cmd === "unclaim") {
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
}

if (cmd === "botinfo") {
  return handleBotInfoSlash(interaction);
}

module.exports = {
  slashCommands,
  handleSlashCommand
};
