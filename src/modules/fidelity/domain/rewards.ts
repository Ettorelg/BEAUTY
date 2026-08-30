export function calculateEarnedPoints(priceEuros: number, spendCents: number, pointsAward: number) {
  if (priceEuros < 0 || spendCents <= 0 || pointsAward <= 0) return 0;
  return Math.floor(Math.round(priceEuros * 100) / spendCents) * pointsAward;
}

export function canRedeemReward(currentPoints: number, requiredPoints: number) {
  return requiredPoints > 0 && currentPoints >= requiredPoints;
}
