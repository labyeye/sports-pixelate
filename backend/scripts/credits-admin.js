// Turn WhatsApp credits on for a company, or gift credits.
//   node scripts/credits-admin.js enable <companyId> [bonusCredits]
//   node scripts/credits-admin.js enable-all [bonusCredits]      (every company; only after you reprice the plans)
//   node scripts/credits-admin.js show <companyId>
require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const credits = require("../services/creditsService");

(async () => {
  const [cmd, arg, bonusArg] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  if (cmd === "enable" || cmd === "enable-all") {
    const bonus = Number(cmd === "enable" ? bonusArg : arg) || 0;
    const ids =
      cmd === "enable"
        ? [arg]
        : (await Company.find().select("_id")).map((c) => c._id);
    for (const id of ids) {
      await credits.enable(id);
      if (bonus)
        await credits.grantBonus(id, {
          credits: bonus,
          refId: `gift:${id}:${Date.now()}`,
          note: "Gift",
        });
    }
    console.log(
      `credits enabled for ${ids.length} company(ies)` +
        (bonus ? `, +${bonus} bonus each` : ""),
    );
  } else if (cmd === "show") {
    console.log(await credits.getBalance(arg));
  } else {
    console.log(
      "usage: enable <companyId> [bonus] | enable-all [bonus] | show <companyId>",
    );
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
