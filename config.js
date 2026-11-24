const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TICKET_BOT_TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.TICKET_CLIENT_ID || process.env.CLIENT_ID;
const PREFIX = process.env.PREFIX || "?";

const TICKET_LOGS_CHANNEL_ID = "1481370050597228661";
const TICKET_PING_ROLE_ID = "1481370041420087475";
const STAFF_ROLE_ID = "1481370041420087474";
const VOUCH_CHANNEL_ID = "1481374265340072047";

// Hoster role only gets access to tickets inside CLAIM_CATEGORY_ID
const HOSTER_ROLE_ID = "1481370041352982674";
const CLAIM_CATEGORY_ID = "1481937769612968038";

const STAFF_ROLE_IDS = [
  "1481370041420087474",
  "1481370041432932379",
  "1481370041441189959"
];

const TICKET_MANAGER_ROLE_IDS = [
  TICKET_PING_ROLE_ID,
  ...STAFF_ROLE_IDS
];

const TICKET_CATEGORIES = {
  support: "1481939936964775946",
  claim: CLAIM_CATEGORY_ID,
  purchases: "1481938314062725281"
};

const ALLOWED_CATEGORY_IDS = Object.values(TICKET_CATEGORIES);

const TICKETS_FILE = process.env.TICKET_DATA_FILE
  ? path.resolve(process.env.TICKET_DATA_FILE)
  : path.join(__dirname, "tickets-data.json");

function loadTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) {
      return { tickets: {}, counter: 0, vouchCount: 787, lastRenamedVouchCount: 787 };
    }
    const parsed = JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
    return {
      tickets: parsed.tickets && typeof parsed.tickets === "object" ? parsed.tickets : {},
      counter: typeof parsed.counter === "number" ? parsed.counter : 0,
      vouchCount: typeof parsed.vouchCount === "number" ? parsed.vouchCount : 787,
      lastRenamedVouchCount:
        typeof parsed.lastRenamedVouchCount === "number" ? parsed.lastRenamedVouchCount : 787
    };
  } catch (err) {
    console.error("❌ Failed to load tickets-data.json:", err);
    return { tickets: {}, counter: 0, vouchCount: 787, lastRenamedVouchCount: 787 };
  }
}

const ticketStore = loadTickets();

function saveTickets() {
  try {
    fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(ticketStore, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Failed to auto-save tickets-data.json:", err);
  }
}

module.exports = {
  TOKEN,
  CLIENT_ID,
  PREFIX,
  TICKET_LOGS_CHANNEL_ID,
  TICKET_PING_ROLE_ID,
  STAFF_ROLE_ID,
  VOUCH_CHANNEL_ID,
  HOSTER_ROLE_ID,
  CLAIM_CATEGORY_ID,
  STAFF_ROLE_IDS,
  TICKET_MANAGER_ROLE_IDS,
  TICKET_CATEGORIES,
  ALLOWED_CATEGORY_IDS,
  ticketStore,
  saveTickets
};
