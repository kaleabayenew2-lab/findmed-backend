const { registerSchema, getModel } = require('../config/db');
const mongoose = require('mongoose');

const FacilityStatsSchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, unique: true },
  viewsWeek: { type: Number, default: 0 },
  viewsMonth: { type: Number, default: 0 },
  viewsTotal: { type: Number, default: 0 },
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date },
  // arbitrary counters/metrics
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

FacilityStatsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const db = require('../config/db');
registerSchema('FacilityStats', FacilityStatsSchema);
module.exports = db.createProxy('FacilityStats');
