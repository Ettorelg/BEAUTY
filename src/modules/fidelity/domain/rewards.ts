export type FidelityAwardMode="BY_SPEND"|"PER_SERVICE"|"PER_APPOINTMENT";
export function calculateEarnedPoints(priceEuros: number, spendCents: number, pointsAward: number, awardMode:FidelityAwardMode="BY_SPEND") {
  if (priceEuros < 0 || spendCents <= 0 || pointsAward <= 0) return 0;
  if(awardMode==="PER_SERVICE"||awardMode==="PER_APPOINTMENT")return pointsAward;
  return Math.floor(Math.round(priceEuros * 100) / spendCents) * pointsAward;
}

export function describePointAward(mode:string,spendCents:number,pointsAward:number){if(mode==="PER_SERVICE")return `${pointsAward} ${pointsAward===1?"punto":"punti"} per ogni servizio effettuato`;if(mode==="PER_APPOINTMENT")return `${pointsAward} ${pointsAward===1?"punto":"punti"} per ogni prenotazione completata`;return `${pointsAward} ${pointsAward===1?"punto":"punti"} ogni € ${(spendCents/100).toFixed(2)} spesi`;}

export function canRedeemReward(currentPoints: number, requiredPoints: number) {
  return requiredPoints > 0 && currentPoints >= requiredPoints;
}
