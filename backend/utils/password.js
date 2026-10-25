// Early, friendly check for passwords an admin sets on someone else's behalf
// (staff, parents, guardians). Uses the same rules the User model enforces on
// save (utils/passwordPolicy.js), so the error shows up before any write.
const { checkPasswordRules } = require("./passwordPolicy");

function passwordProblem(password) {
  if (typeof password === "string" && password.length > 128)
    return "Password too long";
  return checkPasswordRules(password);
}

module.exports = { passwordProblem };
