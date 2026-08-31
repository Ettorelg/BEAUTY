export type BookingReward = { type: string; value: number } | undefined;

export function calculateBookingPriceCents(basePriceCents: number, promotionPercent = 0, reward?: BookingReward, allowStacking = false) {
  const base = Math.max(0, Math.round(basePriceCents));
  const promotionPrice = Math.round(base * (100 - Math.min(100, Math.max(0, promotionPercent))) / 100);
  if (!reward) return promotionPrice;
  let rewardPrice = base;
  if (reward.type === "FREE_SERVICE") rewardPrice = 0;
  else if (reward.type === "DISCOUNT_PERCENT") rewardPrice = Math.round(base * (100 - Math.min(100, Math.max(0, reward.value))) / 100);
  else if (reward.type === "DISCOUNT_EUR") rewardPrice = Math.max(0, base - Math.max(0, reward.value));
  else throw new Error("Tipo di premio non valido.");
  if (!allowStacking) return Math.min(promotionPrice, rewardPrice);
  if (reward.type === "FREE_SERVICE") return 0;
  if (reward.type === "DISCOUNT_PERCENT") return Math.round(promotionPrice * (100 - Math.min(100, Math.max(0, reward.value))) / 100);
  return Math.max(0, promotionPrice - Math.max(0, reward.value));
}
