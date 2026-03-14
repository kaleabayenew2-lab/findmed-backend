const { registerSchema, getModel } = require('../config/db');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  phone: { type: String },
  // ...existing fields...
}, { timestamps: true });

// also create explicit partial index (safer)
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $exists: true, $ne: null } } }
);

const db = require('../config/db');
registerSchema('MobileUser', userSchema);
module.exports = db.createProxy('MobileUser');