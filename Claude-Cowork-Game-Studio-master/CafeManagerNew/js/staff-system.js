import { HIREABLE_STAFF, STAFF } from "./game-state.js";

const STATUS_LABELS = {
  idle: "Sẵn sàng",
  guide: "Đang hướng dẫn",
  checking: "Kiểm đơn",
  brewing: "Đang pha",
  serving: "Đang phục vụ",
  payment: "Đang thanh toán"
};

export function getStaffView(state) {
  return STAFF.map((person) => {
    const current = state.staff[person.id];
    const order = current.orderId ? state.orders.find((item) => item.id === current.orderId) : null;
    const awaitingHire = HIREABLE_STAFF.includes(person.id) && state.hiredStaffId !== person.id;
    return {
      ...person,
      status: current.status,
      statusLabel: awaitingHire ? "Chưa thuê" : STATUS_LABELS[current.status] ?? "Sẵn sàng",
      orderNumber: order?.number ?? null,
      progress: current.workLeft > 0 ? current.workLeft : 0
    };
  });
}

export function idleAllStaff(state) {
  for (const person of Object.values(state.staff)) {
    person.status = "idle";
    person.orderId = null;
    person.workLeft = 0;
  }
}