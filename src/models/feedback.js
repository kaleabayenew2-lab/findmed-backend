const { registerSchema, getModel } = require('../config/db');
const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  sourceIp: { type: String, default: '' },
  replied: { type: Boolean, default: false },
  reply: { type: String, default: null },
  replyMethod: { type: String, default: null },
  repliedAt: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const db = require('../config/db');
registerSchema('Feedback', FeedbackSchema);
module.exports = db.createProxy('Feedback');
