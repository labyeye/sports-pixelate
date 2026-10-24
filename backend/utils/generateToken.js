const jwt = require("jsonwebtoken");

// `claims` carries extras like { otp: true } (phone proven via WhatsApp code).
// `tv` (token version) lets the server revoke every older token of a user: it is bumped whenever the password
// changes and `protect` rejects a token whose `tv` no longer matches. Version 0 is omitted so old tokens stay valid.
const generateToken = (id, claims = {}, tokenVersion = 0) =>
  jwt.sign(
    tokenVersion ? { id, tv: tokenVersion, ...claims } : { id, ...claims },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
      algorithm: "HS256",
    },
  );

// Proof that the password step succeeded, spent on /auth/2fa/verify. Never a session: `protect` rejects any
// token that carries a `purpose` claim.
const generatePendingToken = (id) =>
  jwt.sign({ id, purpose: "2fa" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
    algorithm: "HS256",
  });

const verifyPendingToken = (token) => {
  const decoded = jwt.verify(String(token), process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
  if (decoded.purpose !== "2fa") throw new Error("Wrong token purpose");
  return decoded;
};

module.exports = generateToken;
module.exports.generatePendingToken = generatePendingToken;
module.exports.verifyPendingToken = verifyPendingToken;
