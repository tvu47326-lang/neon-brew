export const SAVE_SCHEMA_VERSION = 1;

export const INGREDIENTS = {
  beans: { label: "Hạt cà phê", unit: "gói", pack: 10, price: 32000 },
  milk: { label: "Sữa tươi", unit: "hộp", pack: 10, price: 22000 },
  condensed: { label: "Sữa đặc", unit: "lon", pack: 8, price: 18000 },
  sugar: { label: "Đường", unit: "gói", pack: 10, price: 12000 },
  ice: { label: "Đá viên", unit: "túi", pack: 10, price: 8000 },
  cups: { label: "Ly giấy", unit: "chồng", pack: 10, price: 15000 },
  tea: { label: "Trà lài", unit: "gói", pack: 10, price: 24000 },
  peach: { label: "Đào ngâm", unit: "hũ", pack: 8, price: 28000 },
  cocoa: { label: "Bột cacao", unit: "gói", pack: 8, price: 26000 }
};

export const RECIPES = {
  "ca-phe-sua": {
    name: "Cà phê sữa đá", price: 42000, prep: 5,
    ingredients: { beans: 1, condensed: 1, ice: 1, cups: 1 }
  },
  "bac-xiu": {
    name: "Bạc xỉu", price: 46000, prep: 6,
    ingredients: { beans: 1, milk: 2, condensed: 1, ice: 1, cups: 1 }
  },
  "tra-dao": {
    name: "Trà đào cam sả", price: 48000, prep: 6,
    ingredients: { tea: 1, peach: 1, sugar: 1, ice: 1, cups: 1 }
  },
  cacao: {
    name: "Cacao sữa nóng", price: 45000, prep: 6,
    ingredients: { cocoa: 1, milk: 2, sugar: 1, cups: 1 }
  }
};

export const STAFF = [
  { id: "tuan", name: "Tuấn", role: "Hướng dẫn", color: "sage" },
  { id: "nhan", name: "Nhân", role: "Điều phối đơn", color: "clay" },
  { id: "nam", name: "Nam", role: "Pha chế", color: "mustard" },
  { id: "thuy", name: "Thúy", role: "Phục vụ", color: "rose" },
  { id: "ly", name: "Ly", role: "Thu ngân", color: "plum" }
];

export const DAY_LENGTH_SECONDS = 150;
export const EMPLOYMENT_CASH_THRESHOLD = 10_000_000;
export const HIREABLE_STAFF = ["nhan", "nam", "thuy", "ly"];

export function createInitialState() {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    phase: "playing",
    day: 1,
    secondsLeft: DAY_LENGTH_SECONDS,
    cash: 320000,
    totalRevenue: 0,
    dayRevenue: 0,
    dayExpenses: 0,
    dayBonus: 0,
    totalBonus: 0,
    orders: [],
    nextOrderNumber: 1,
    rngSeed: 14821,
    inventory: {
      beans: 18, milk: 20, condensed: 14, sugar: 12, ice: 24,
      cups: 26, tea: 10, peach: 8, cocoa: 6
    },
    upgrades: { machine: 0, service: 0 },
    hiredStaffId: null,
    playerWork: null,
    unlockedRecipes: ["ca-phe-sua", "bac-xiu"],
    staff: Object.fromEntries(STAFF.map(({ id }) => [id, { status: "idle", orderId: null }])),
    customerSpawnIn: 3,
    quest: { completed: 0, failed: 0, goal: 5, reward: 60000, claimed: false },
    dayStats: { arrived: 0, completed: 0, failed: 0 },
    reputationTotal: 5,
    reputationCount: 5
  };
}

export function normalizeEmploymentState(state) {
  if (!HIREABLE_STAFF.includes(state.hiredStaffId)) state.hiredStaffId = null;
  if (!state.playerWork) state.playerWork = null;

  if (!state.hiredStaffId && !state.playerWork) {
    const legacyStages = { checking: "barQueue", brewing: "barQueue", serving: "ready", payment: "served" };
    for (const order of state.orders) {
      if (legacyStages[order.status]) order.status = legacyStages[order.status];
    }
  }

  for (const [staffId, person] of Object.entries(state.staff)) {
    if (staffId !== "tuan" && staffId !== state.hiredStaffId) {
      person.status = "idle";
      person.orderId = null;
      person.workLeft = 0;
    }
  }
  return state;
}