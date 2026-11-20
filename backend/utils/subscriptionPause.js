const DAY_MS = 86400000;

// Shifts the renewal date forward by the days a plan was frozen, so a student
// who pauses isn't charged for time they couldn't attend.
function applyResume(subscription, now = new Date()) {
  const days = subscription.pausedAt
    ? Math.max(0, Math.round((now - subscription.pausedAt) / DAY_MS))
    : 0;
  if (days > 0 && subscription.renewalDate) {
    subscription.renewalDate = new Date(
      subscription.renewalDate.getTime() + days * DAY_MS,
    );
  }
  subscription.status = "active";
  subscription.pausedAt = undefined;
  subscription.pauseUntil = undefined;
  subscription.pauseReason = undefined;
  return days;
}

module.exports = { applyResume };
