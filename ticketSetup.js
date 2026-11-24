const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");
const { getGuildConfig, setGuildConfig, addGuildStaffRole } = require("./guildConfig");

function hasSetupPermission(member) {
  if (!member) return false;
  return (
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function extractNumberFromText(str) {
  const match = String(str || "").match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

function formatConfigEmbed(guild, cfg) {
  const fmtChannel = (id) => (id ? `<#${id}>` : "*Not set (auto/optional)*");
  const fmtRole = (id) => (id ? `<@&${id}>` : "*Not set*");
  const fmtRoles = (arr) =>
    Array.isArray(arr) && arr.length ? arr.map((id) => `<@&${id}>`).join(", ") : "*Not set*";

  return new EmbedBuilder()
    .setTitle(`⚙️ Ticket Setup — ${guild.name}`)
    .setColor(0x5865f2)
    .setDescription(
      "Saved automatically per server and preserved across restarts.\n\n" +
      `**Staff Roles:** ${fmtRoles(cfg.staffRoleIds)}\n` +
      `**Ping Role:** ${fmtRole(cfg.pingRoleId)}\n` +
      `**Hoster Role (Claims only):** ${fmtRole(cfg.hosterRoleId)}\n` +
      `**Logs Channel:** ${fmtChannel(cfg.logsChannelId)}\n` +
      `**Vouch Channel:** ${fmtChannel(cfg.vouchChannelId)}\n` +
      `**Vouch Counter:** \`${cfg.vouchCount ?? 0}\` (last renamed at \`${cfg.lastRenamedVouchCount ?? 0}\`)\n\n` +
      "**Ticket Categories**\n" +
      `• Support: ${fmtChannel(cfg.categories?.support)}\n` +
      `• Claims: ${fmtChannel(cfg.categories?.claim)}\n` +
      `• Purchases: ${fmtChannel(cfg.categories?.purchases)}`
    )
    .setTimestamp();
}

const ticketSetupSlashCommand = new SlashCommandBuilder()
  .setName("ticketsetup")
  .setDescription("Configure ticket roles, categories, logs, and vouch counter for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View current ticket configuration for this server")
  )
  .addSubcommand((sub) =>
    sub
      .setName("staff")
      .setDescription("Add a staff role that can manage tickets")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Staff role").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("pingrole")
      .setDescription("Set the role pinged when new tickets open")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Ping role").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("hoster")
      .setDescription("Set the Hoster role (only gets access to Claim tickets)")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("Hoster role").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("logs")
      .setDescription("Set the ticket transcript & action logs channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Logs text channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("category")
      .setDescription("Set the category for a ticket type")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Ticket type")
          .setRequired(true)
          .addChoices(
            { name: "Support", value: "support" },
            { name: "Claims", value: "claim" },
            { name: "Purchases", value: "purchases" }
          )
      )
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("Target category")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("vouch")
      .setDescription("Set vouch channel and optional starting vouch count")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Vouch text channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Starting vouch count (optional; auto-reads from channel name if omitted)")
          .setMinValue(0)
      )
  );

async function handleTicketSetupSlash(interaction) {
  const { guild, member } = interaction;
  if (!hasSetupPermission(member)) {
    return interaction.reply({
      content: "❌ You need **Manage Server** or **Administrator** to use `/ticketsetup`.",
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();
  const cfg = getGuildConfig(guild.id);

  if (sub === "view") {
    return interaction.reply({ embeds: [formatConfigEmbed(guild, cfg)], ephemeral: true });
  }

  if (sub === "staff") {
    const role = interaction.options.getRole("role", true);
    const updated = addGuildStaffRole(guild.id, role.id);
    return interaction.reply({
      content: `✅ Added ${role} to ticket staff roles.`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }

  if (sub === "pingrole") {
    const role = interaction.options.getRole("role", true);
    const updated = setGuildConfig(guild.id, { pingRoleId: role.id });
    return interaction.reply({
      content: `✅ Set ticket ping role to ${role}.`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }

  if (sub === "hoster") {
    const role = interaction.options.getRole("role", true);
    const updated = setGuildConfig(guild.id, { hosterRoleId: role.id });
    return interaction.reply({
      content: `✅ Set Hoster role to ${role} (scoped strictly to Claim tickets).`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }

  if (sub === "logs") {
    const ch = interaction.options.getChannel("channel", true);
    const updated = setGuildConfig(guild.id, { logsChannelId: ch.id });
    return interaction.reply({
      content: `✅ Set ticket logs channel to ${ch}.`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }

  if (sub === "category") {
    const type = interaction.options.getString("type", true);
    const cat = interaction.options.getChannel("category", true);
    const updated = setGuildConfig(guild.id, {
      categories: { [type]: cat.id }
    });
    return interaction.reply({
      content: `✅ Set **${type}** ticket category to **${cat.name}**.`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }

  if (sub === "vouch") {
    const ch = interaction.options.getChannel("channel", true);
    const providedCount = interaction.options.getInteger("count");
    const detectedCount =
      typeof providedCount === "number"
        ? providedCount
        : (extractNumberFromText(ch.name) ?? cfg.vouchCount ?? 0);

    const updated = setGuildConfig(guild.id, {
      vouchChannelId: ch.id,
      vouchCount: detectedCount,
      lastRenamedVouchCount: detectedCount
    });

    return interaction.reply({
      content: `✅ Vouch channel set to ${ch} with starting count **${detectedCount}**.`,
      embeds: [formatConfigEmbed(guild, updated)],
      ephemeral: true
    });
  }
}

async function handleTicketSetupPrefix(message, args) {
  const { guild, member, channel } = message;
  if (!guild) return false;

  if (!hasSetupPermission(member)) {
    await message.reply("❌ You need **Manage Server** or **Administrator** to use `?tsetup`.");
    return true;
  }

  const sub = (args[0] || "view").toLowerCase();
  const cfg = getGuildConfig(guild.id);

  if (sub === "view") {
    await message.reply({ embeds: [formatConfigEmbed(guild, cfg)] });
    return true;
  }

  if (sub === "staff") {
    const role = message.mentions.roles.first() || guild.roles.cache.get(args[1]);
    if (!role) {
      await message.reply("❌ Usage: `?tsetup staff @Role`");
      return true;
    }
    const updated = addGuildStaffRole(guild.id, role.id);
    await message.reply({ content: `✅ Added ${role} as ticket staff.`, embeds: [formatConfigEmbed(guild, updated)] });
    return true;
  }

  if (sub === "pingrole") {
    const role = message.mentions.roles.first() || guild.roles.cache.get(args[1]);
    if (!role) {
      await message.reply("❌ Usage: `?tsetup pingrole @Role`");
      return true;
    }
    const updated = setGuildConfig(guild.id, { pingRoleId: role.id });
    await message.reply({ content: `✅ Set ticket ping role to ${role}.`, embeds: [formatConfigEmbed(guild, updated)] });
    return true;
  }

  if (sub === "hoster") {
    const role = message.mentions.roles.first() || guild.roles.cache.get(args[1]);
    if (!role) {
      await message.reply("❌ Usage: `?tsetup hoster @Role`");
      return true;
    }
    const updated = setGuildConfig(guild.id, { hosterRoleId: role.id });
    await message.reply({ content: `✅ Set Hoster role to ${role}.`, embeds: [formatConfigEmbed(guild, updated)] });
    return true;
  }

  if (sub === "logs") {
    const ch = message.mentions.channels.first() || guild.channels.cache.get(args[1]) || channel;
    const updated = setGuildConfig(guild.id, { logsChannelId: ch.id });
    await message.reply({ content: `✅ Set ticket logs channel to ${ch}.`, embeds: [formatConfigEmbed(guild, updated)] });
    return true;
  }

  if (sub === "category") {
    const type = (args[1] || "").toLowerCase();
    const catId = args[2]?.replace(/[<#>]/g, "");
    const cat = guild.channels.cache.get(catId);
    if (!["support", "claim", "purchases"].includes(type) || !cat || cat.type !== ChannelType.GuildCategory) {
      await message.reply("❌ Usage: `?tsetup category <support|claim|purchases> <categoryId>`");
      return true;
    }
    const updated = setGuildConfig(guild.id, { categories: { [type]: cat.id } });
    await message.reply({ content: `✅ Set **${type}** category to **${cat.name}**.`, embeds: [formatConfigEmbed(guild, updated)] });
    return true;
  }

  if (sub === "vouch") {
    const ch = message.mentions.channels.first() || guild.channels.cache.get(args[1]) || channel;
    const explicitNum = args.slice(1).find((a) => /^\d+$/.test(a));
    const count = explicitNum
      ? parseInt(explicitNum, 10)
      : (extractNumberFromText(ch.name) ?? cfg.vouchCount ?? 0);

    const updated = setGuildConfig(guild.id, {
      vouchChannelId: ch.id,
      vouchCount: count,
      lastRenamedVouchCount: count
    });
    await message.reply({
      content: `✅ Vouch channel set to ${ch} with count **${count}**.`,
      embeds: [formatConfigEmbed(guild, updated)]
    });
    return true;
  }

  await message.reply(
    "ℹ️ Commands: `?tsetup view`, `?tsetup staff @Role`, `?tsetup pingrole @Role`, `?tsetup hoster @Role`, `?tsetup logs [#channel]`, `?tsetup category <support|claim|purchases> <categoryId>`, `?tsetup vouch [#channel] [count]`"
  );
  return true;
}

module.exports = {
  ticketSetupSlashCommand,
  handleTicketSetupSlash,
  handleTicketSetupPrefix
};
