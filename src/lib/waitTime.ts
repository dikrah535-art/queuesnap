/**
 * Calculates estimated wait time for a queue position.
 * Uses real historical avg if available, falls back to 3 min/person.
 */
export function calcEstimatedWait(
  position: number,
  historicalAvgMs: number | null,
  fallbackMinutesPerPerson = 3
): { minutes: number; label: string } {
  if (position <= 0) return { minutes: 0, label: "It's your turn!" };

  const msPerPerson = historicalAvgMs ?? fallbackMinutesPerPerson * 60 * 1000;
  const totalMs = position * msPerPerson;
  const minutes = Math.ceil(totalMs / 60000);

  if (minutes < 1) return { minutes: 0, label: "Less than a minute" };
  if (minutes === 1) return { minutes: 1, label: "~1 minute" };
  if (minutes < 60) return { minutes, label: `~${minutes} minutes` };

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    minutes,
    label: mins > 0 ? `~${hours}h ${mins}m` : `~${hours} hour${hours > 1 ? "s" : ""}`
  };
}
