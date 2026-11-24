const { VOUCH_CHANNEL_ID, ticketStore, saveTickets } = require("./config");

const RENAME_STEP = 10; // Renames channel every 10 vouches (safe for Discord rate limits)
const MIN_RENAME_INTERVAL_MS = 10 * 60 * 1000; // 10 min safety cooldown
let lastRenameTimestamp = 0;

function extractCountFromName(name) {
  const match = String(name || "").match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

function formatVouchChannelName(currentName, newCount) {
  // Keeps your exact styling e.g. "【📢】vouches・787" -> "【📢】vouches・800"
  if (/(\d+)\s*$/.test(currentName)) {
    return currentName.replace(/(\d+)\s*$/, String(newCount));
  }
  return `【📢】vouches・${newCount}`;
}

function isValidVouchMessage(message) {
  if (!message || message.author?.bot) return false;
  if (message.channel?.id !== VOUCH_CHANNEL_ID) return false;

  const text = String(message.content || "").trim();
  if (!text) return false;

  // Matches messages containing "vouch", "ty", "tysm", or a user mention
  const hasKeyword = /\b(vouch|vouched|ty|tysm|thx|thanks)\b/i.test(text);
  const hasMention = message.mentions?.users?.size > 0;
  return hasKeyword || hasMention;
}

async function handleVouchMessage(message) {
  if (!isValidVouchMessage(message)) return;

  // Sync baseline from channel name if store wasn't initialized yet
  if (typeof ticketStore.vouchCount !== "number") {
    const detected = extractCountFromName(message.channel.name);
    ticketStore.vouchCount = detected ?? 787;
    ticketStore.lastRenamedVouchCount = ticketStore.vouchCount;
  }

  ticketStore.vouchCount += 1;
  const currentTotal = ticketStore.vouchCount;
  const lastRenamed = Number(ticketStore.lastRenamedVouchCount) || 0;
  saveTickets();

  const diff = currentTotal - lastRenamed;
  const hitMilestone = currentTotal % RENAME_STEP === 0 || diff >= RENAME_STEP;
  const now = Date.now();

  if (!hitMilestone || now - lastRenameTimestamp < MIN_RENAME_INTERVAL_MS) {
    return;
  }

  try {
    const nextName = formatVouchChannelName(message.channel.name, currentTotal);
    if (nextName !== message.channel.name) {
      await message.channel.setName(nextName, `Auto vouch counter update (${currentTotal})`);
    }
    ticketStore.lastRenamedVouchCount = currentTotal;
    lastRenameTimestamp = now;
    saveTickets();
  } catch (err) {
    console.error("❌ Failed to rename vouch channel:", err);
  }
}

module.exports = {
  handleVouchMessage
};
