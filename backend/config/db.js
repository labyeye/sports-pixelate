const dns = require("dns");
const mongoose = require("mongoose");

// Treat query-filter objects as literal values, never operators ($ne, $gt, ...).
mongoose.set("sanitizeFilter", true);

const connectDB = async () => {
  // Some local resolvers can't answer SRV lookups needed by mongodb+srv:// URIs.
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
  }
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

module.exports = connectDB;
