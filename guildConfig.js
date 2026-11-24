const fs = require("fs");
const path = require("path");
const {
  TICKET_LOGS_CHANNEL_ID,
  TICKET_PING_ROLE_ID,
  STAFF_ROLE_ID,
  VOUCH_CHANNEL_ID,
  HOSTER_ROLE_ID,
  CLAIM_CATEGORY_ID,
  STAFF_ROLE_IDS,
  TICKET_MANAGER_ROLE_IDS,
  TICKET_CATEGORIES,
  ticketStore
} = require("./config");

const TICKETS_FILE = process.env.TICKET_DATA_FILE
  ? path.resolve(process.env.TICKET_DATA_FILE)
  : path.join(__dirname, "tickets-data.json");

// Optional seed only for your main server if not yet saved in JSON
const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID || "1481370041352982670";

function persistStoreSafely() {
  try {
    fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
    const tempFile = `${TICKETS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(ticketStore, null, 2), "utf8");
    fs.renameSync(tempFile, TICKETS_FILE);
  } catch (err) {
    console.error("❌ Failed to safely save ticketStore:", err);
  }
}

function getDefaultGuildConfig(guildId) {
  const isPrimary = Boolean(PRIMARY_GUILD_ID && guildId === PRIMARY_GUILD_ID);
  return {
    logsChannelId: isPrimary ? TICKET_LOGS_CHANNEL_ID : null,
    pingRoleId: isPrimary ? TICKET_PING_ROLE_ID : null,
    staffRoleId: isPrimary ? STAFF_ROLE_ID : null,
    staffRoleIds: isPrimary ? [...STAFF_ROLE_IDS] : [],
    managerRoleIds: isPrimary ? [...TICKET_MANAGER_ROLE_IDS] : [],
    hosterRoleId: isPrimary ? HOSTER_ROLE_ID : null,
    vouchChannelId: isPrimary ? VOUCH_CHANNEL_ID : null,
    vouchCount: isPrimary ? (typeof ticketStore.vouchCount === "number" ? ticketStore.vouchCount : 0) : 0,
    lastRenamedVouchCount: isPrimary
      ? (typeof ticketStore.lastRenamedVouchCount === "number" ? ticketStore.lastRenamedVouchCount : 0)
      : 0,
    categories: isPrimary
      ? { ...TICKET_CATEGORIES }
      : { support: null, claim: null, purchases: null }
  };
}

function getGuildConfig(guildId) {
  if (!guildId) return getDefaultGuildConfig(null);

  if (!ticketStore.guilds || typeof ticketStore.guilds !== "object") {
    ticketStore.guilds = {};
  }

  if (!ticketStore.guilds[guildId]) {
    ticketStore.guilds[guildId] = getDefaultGuildConfig(guildId);
    persistStoreSafely();
  } else {
    // Ensure new fields added in future code updates are merged without wiping saved data
    const defaults = getDefaultGuildConfig(guildId);
    const existing = ticketStore.guilds[guildId];
    ticketStore.guilds[guildId] = {
      ...defaults,
      ...existing,
      staffRoleIds: Array.isArray(existing.staffRoleIds) ? existing.staffRoleIds : defaults.staffRoleIds,
      managerRoleIds: Array.isArray(existing.managerRoleIds)
        ? existing.managerRoleIds
        : defaults.managerRoleIds,
      categories: {
        ...defaults.categories,
        ...(existing.categories && typeof existing.categories === "object" ? existing.categories : {})
      }
    };
  }

  return ticketStore.guilds[guildId];
}

function setGuildConfig(guildId, patch) {
  const current = getGuildConfig(guildId);
  ticketStore.guilds[guildId] = {
    ...current,
    ...patch,
    categories: {
      ...current.categories,
      ...(patch.categories && typeof patch.categories === "object" ? patch.categories : {})
    }
  };
  persistStoreSafely();
  return ticketStore.guilds[guildId];
}

function addGuildStaffRole(guildId, roleId) {
  const cfg = getGuildConfig(guildId);
  const staffSet = new Set(cfg.staffRoleIds || []);
  staffSet.add(roleId);

  const managerSet = new Set(cfg.managerRoleIds || []);
  managerSet.add(roleId);

  return setGuildConfig(guildId, {
    staffRoleId: cfg.staffRoleId || roleId,
    staffRoleIds: [...staffSet],
    managerRoleIds: [...managerSet]
  });
}

function resolveCategoryForGuild(guild, type) {
  const cfg = getGuildConfig(guild.id);
  const configuredId = cfg.categories?.[type] || (type === "claim" ? CLAIM_CATEGORY_ID : null);
  if (configuredId) return configuredId;

  // Smart fallback: find a matching category by name in the server
  const nameMap = {
    support: ["support", "tickets", "help"],
    claim: ["claim", "claims", "giveaway claims", "winners"],
    purchases: ["purchases", "purchase", "orders", "store", "shop"]
  };
  const candidates = nameMap[type] || [type];
  const matched = guild.channels.cache.find(
    (ch) => ch.type === 4 && candidates.includes(ch.name.toLowerCase().trim())
  );
  return matched ? matched.id : null;
}

module.exports = {
  TICKETS_FILE,
  persistStoreSafely,
  getGuildConfig,
  setGuildConfig,
  addGuildStaffRole,
  resolveCategoryForGuild
};
