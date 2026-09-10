export function createBusinessCode(prefix) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `${prefix}${stamp}${Math.floor(100 + Math.random() * 900)}`;
}
export async function createDailyOrderCode(tx, now = new Date()) {
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const sequence = await tx.dailyOrderSequence.upsert({
    where: { date },
    create: { date, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `${date}-${String(sequence.lastValue).padStart(4, "0")}`;
}