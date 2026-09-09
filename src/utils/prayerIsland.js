export function resolveCurrentIslandPrayer({
  masterEnabled,
  simulatedPrayerId,
  dismissedPrayerId,
  activePrayer,
  userMode,
  prayers
}) {
  if (!masterEnabled) return null

  const prayer = simulatedPrayerId
    ? prayers.find((item) => item.id === simulatedPrayerId) || null
    : activePrayer || (userMode === 'muslim' ? prayers.find((item) => item.enabled) || prayers[0] : null)

  return prayer?.id === dismissedPrayerId ? null : prayer
}
