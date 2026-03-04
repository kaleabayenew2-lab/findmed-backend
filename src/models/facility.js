const { registerSchema, getModel } = require('../config/db');
const mongoose = require('mongoose');

const FacilitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['hospital','pharmacy'], required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [lng, lat]
  },
  address: String,
  email: String,
  altPhone: { type: [String], default: [] },
  phone: String,
  // Optional agent account credentials for facility management
  username: { type: String, unique: true, sparse: true },
  passwordHash: String,
  services: [String],
  // Agent identifier created by bot during registration (short uuid)
  agentId: { type: String, unique: true, sparse: true, index: true },
  openingHours: String,
  // Optional classificiation by type
  hospitalType: String,
  pharmacyType: String,
  // Ownership: 'private' or 'public'
  ownership: { type: String, enum: ['private', 'public'], default: 'private' },
  notes: String,
  // URLs for profile picture and additional album images
  photoUrl: String,
  photos: { type: [String], default: [] },
  isEmergency: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  // Usage statistics
  viewsTotal: { type: Number, default: 0, index: true },
  lastViewedAt: { type: Date },
  // Simple rating aggregation
  ratingCount: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// unique index on name
FacilitySchema.index({ name: 1 }, { unique: true });
// 2dsphere index for location
FacilitySchema.index({ location: '2dsphere' });

// encrypt some fields before save and decrypt helper
const { encrypt: _encrypt, decrypt: _decrypt } = require('../utils/encryption');

FacilitySchema.pre('save', function (next) {
  if (this.isModified('phone') && this.phone) {
    this.phone = _encrypt(this.phone);
  }
  if (this.isModified('email') && this.email) {
    this.email = _encrypt(this.email);
  }
  next();
});

FacilitySchema.methods.decryptFields = function () {
  try {
    if (this.phone) this.phone = _decrypt(this.phone);
    if (this.email) this.email = _decrypt(this.email);
  } catch (_) {}
  return this;
};

FacilitySchema.post('init', function (doc) {
  try { doc.decryptFields(); } catch (_) {}
});
const db = require('../config/db');
registerSchema('Facility', FacilitySchema);
module.exports = db.createProxy('Facility');
