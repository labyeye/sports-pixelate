const JobLock = require("../models/JobLock");

// Try to take the named lock for `ttlMs`. Returns true if this caller got it.
// Atomic: the upsert only matches when the previous lock has lapsed, and a
// concurrent winner makes the loser hit the unique index (E11000).
async function acquire(name, ttlMs) {
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);
  try {
    const doc = await JobLock.findOneAndUpdate(
      { name, lockedUntil: { $lt: now } },
      { $set: { lockedUntil: until, expireAt: new Date(until.getTime() + 60000) } },
      { new: true },
    );
    if (doc) return true;
    await JobLock.create({
      name,
      lockedUntil: until,
      expireAt: new Date(until.getTime() + 60000),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

// Run `fn` only if no other instance holds `name`. The lock is simply left to
// expire (ttl) rather than released, which doubles as "don't re-run within ttl".
async function withJobLock(name, ttlMs, fn) {
  if (!(await acquire(name, ttlMs))) return false;
  await fn();
  return true;
}

module.exports = { acquire, withJobLock };
