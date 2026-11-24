const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { PREFIX } = require("./config");

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || "419893791844204546";
const BOT_OWNER_LABEL = process.env.BOT_OWNER_LABEL || "Laura";

const botInfoSlashCommand = new SlashCommandBuilder()
  .setName("botinfo")
  .setDescription("Show what this ticket bot does, how to set it up, and who owns it");

function buildBotInfoEmbed(client, guild) {
  const botName = client?.user?.username || "Ticket Bot";
  const serverCount = client?.guilds?.cache?.size ?? 1;
  const activeGuildName = guild?.name || "this server";

  return new EmbedBuilder()
    .setTitle(`🤖 ${botName} — Info & Setup`)
    .setColor(0x5865f2)
    .setDescription(
      `Multi-server ticket system built for **Support**, **Claims**, and **Purchases** with claiming, HTML transcripts, Hoster claim access, and auto vouch channel counter updates.\n\n` +
      `**Owner:** ${BOT_OWNER_LABEL} (<@${BOT_OWNER_ID}>)\n` +
      `**Servers:** \`${serverCount}\` • **Current Server:** **${activeGuildName}**`
    )
    .addFields(
      {
        name: "✨ Key Features",
        value:
          "• **Ticket Panels & Categories:** Support, Claims, and Purchases tickets\n" +
          "• **Claim & Unclaim System:** Prevents double-claiming and keeps claim flow clean\n" +
          "• **Hoster Claim Access:** Hoster role gets scoped access strictly to Claim tickets\n" +
          "• **Auto Vouch Counter:** Tracks vouches and renames the vouch channel automatically\n" +
          "• **HTML Transcripts:** Logs closed tickets and transcripts per server"
      },
      {
        name: "⚙️ Quick Server Setup",
        value:
          `Run \`/ticketsetup view\` or \`${PREFIX}tsetup view\` to check settings:\n` +
          `• \`${PREFIX}tsetup staff @Role\` / \`${PREFIX}tsetup pingrole @Role\`\n` +
          `• \`${PREFIX}tsetup hoster @Role\` / \`${PREFIX}tsetup logs [#channel]\`\n` +
          `• \`${PREFIX}tsetup category <support|claim|purchases> <categoryId>\`\n` +
          `• \`${PREFIX}tsetup vouch [#channel] [count]\``
      },
      {
        name: "🎫 Ticket Commands",
        value:
          `\`${PREFIX}ticketpanel\`, \`${PREFIX}claim\`, \`${PREFIX}unclaim\`, \`${PREFIX}add @user\`, \`${PREFIX}rename <name>\`, \`${PREFIX}close [reason]\``
      }
    )
    .setFooter({ text: `${botName} • Owned by ${BOT_OWNER_LABEL}` })
    .setTimestamp();
}

async function handleBotInfoSlash(interaction) {
  const embed = buildBotInfoEmbed(interaction.client, interaction.guild);
  return interaction.reply({ embeds: [embed] });
}

async function handleBotInfoPrefix(message, client) {
  const embed = buildBotInfoEmbed(client, message.guild);
  return message.reply({ embeds: [embed] });
}

module.exports = {
  BOT_OWNER_ID,
  BOT_OWNER_LABEL,
  botInfoSlashCommand,
  buildBotInfoEmbed,
  handleBotInfoSlash,
  handleBotInfoPrefix
};
