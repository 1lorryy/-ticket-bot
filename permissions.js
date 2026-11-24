const { PermissionFlagsBits } = require("discord.js");
const {
  STAFF_ROLE_IDS,
  TICKET_MANAGER_ROLE_IDS,
  ALLOWED_CATEGORY_IDS,
  HOSTER_ROLE_ID,
  CLAIM_CATEGORY_ID,
  ticketStore,
  saveTickets
} = require("./config");

function isTicketChannel(channel) {
  if (!channel) return false;
  if (ticketStore.tickets[channel.id]) return true;
  if (channel.parentId && ALLOWED_CATEGORY_IDS.includes(channel.parentId)) return true;
  if (typeof channel.topic === "string" && /Ticket #\d+/i.test(channel.topic)) return true;
  return false;
}

function isClaimCategoryTicket(channel) {
  if (!channel) return false;
  if (channel.parentId === CLAIM_CATEGORY_ID) return true;
  const saved = ticketStore.tickets[channel.id];
  if (saved?.categoryId === CLAIM_CATEGORY_ID || saved?.category === "claim") return true;
  return false;
}

function isHosterForClaimTicket(member, channel) {
  if (!member || !channel) return false;
  if (!member.roles?.cache?.has(HOSTER_ROLE_ID)) return false;
  return isClaimCategoryTicket(channel);
}

function isTicketStaff(member, channel = null) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.roles?.cache) {
    if (STAFF_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
      return true;
    }
    if (channel && isHosterForClaimTicket(member, channel)) {
      return true;
    }
  }
  return false;
}

function canManageTicketMembers(member, channel = null) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.roles?.cache) {
    if (TICKET_MANAGER_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
      return true;
    }
    if (channel && isHosterForClaimTicket(member, channel)) {
      return true;
    }
  }
  return false;
}

function resolveOpenerId(channel) {
  const saved = ticketStore.tickets[channel.id];
  if (saved?.openerId) return saved.openerId;

  const topicMatch = channel.topic?.match(/Opener:\s*(\d{17,20})/i);
  if (topicMatch) return topicMatch[1];

  for (const [id, overwrite] of channel.permissionOverwrites.cache) {
    if (
      overwrite.type === 1 &&
      id !== channel.client.user.id &&
      overwrite.allow.has(PermissionFlagsBits.ViewChannel)
    ) {
      return id;
    }
  }
  return null;
}

async function addUserToTicket({ channel, guild, targetUser, addedBy }) {
  if (!channel || !guild || !targetUser) {
    return { ok: false, error: "❌ Missing ticket channel or target user." };
  }

  await channel.permissionOverwrites.edit(targetUser.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true
  });

  if (ticketStore.tickets[channel.id]) {
    const entry = ticketStore.tickets[channel.id];
    if (!Array.isArray(entry.addedUserIds)) entry.addedUserIds = [];
    if (!entry.addedUserIds.includes(targetUser.id)) {
      entry.addedUserIds.push(targetUser.id);
      saveTickets();
    }
  }

  return { ok: true, addedBy };
}

module.exports = {
  isTicketChannel,
  isClaimCategoryTicket,
  isHosterForClaimTicket,
  isTicketStaff,
  canManageTicketMembers,
  resolveOpenerId,
  addUserToTicket
};
