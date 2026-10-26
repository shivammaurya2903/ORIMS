/**
 * Authoritative risk classification rule:
 * Evaluates stockout probability, days of supply, and safety stock deficit.
 * Documented thresholds:
 *   - HIGH: stockoutProbability > 0.7 OR daysOfSupply < leadTime (default 7 days)
 *   - MEDIUM: stockoutProbability > 0.4 OR daysOfSupply < 1.5 * leadTime (default 10.5 days)
 *   - LOW: all other states
 * Fallback (when stockout probability is unavailable):
 *   - HIGH: deficit > safetyStock * 2
 *   - MEDIUM: deficit > safetyStock
 *   - LOW: deficit <= safetyStock
 */
export function determineRiskLevel(stockoutProb, daysOfSupply, deficit, safetyStock) {
  if (stockoutProb !== null && stockoutProb !== undefined && !isNaN(stockoutProb)) {
    if (stockoutProb > 0.7 || (daysOfSupply !== null && daysOfSupply !== undefined && !isNaN(daysOfSupply) && daysOfSupply < 7)) {
      return 'HIGH';
    }
    if (stockoutProb > 0.4 || (daysOfSupply !== null && daysOfSupply !== undefined && !isNaN(daysOfSupply) && daysOfSupply < 10.5)) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
  // Baseline fallback: safety stock deficit
  if (deficit > safetyStock * 2) return 'HIGH';
  if (deficit > safetyStock) return 'MEDIUM';
  return 'LOW';
}
