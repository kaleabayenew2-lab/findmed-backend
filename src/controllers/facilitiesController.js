const Facility = require('../models/facility');
const bcrypt = require('bcryptjs');
const serviceCatalog = require('../config/serviceCatalog');

exports.list = async (req, res) => {
  console.log('Facilities list request received:', req.query);
  
  try {
    const { lat, lng, radius = 5000, type, page = 1, limit = 20 } = req.query;
    const query = {};

    if (type) {
      query.type = String(type).toLowerCase();
    }

    const maxDistance = parseInt(radius, 10) || 5000;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    console.log('Query parameters:', { pageNum, limitNum, skip, maxDistance, type, query });

    // Try a simple query first without geospatial
    try {
      const facilities = await Facility.find(query)
        .skip(skip)
        .limit(limitNum)
        .maxTimeMS(5000);
      
      const total = await Facility.countDocuments(query);
      
      console.log('Query successful, found facilities:', facilities.length);
      
      return res.json({
        data: facilities,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          pages: Math.ceil(total / limitNum),
          hasMore: skip + facilities.length < total
        }
      });
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      
      // Return empty result on database error
      return res.json({
        data: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
          hasMore: false
        }
      });
    }

    // If lat and lng are provided, validate and perform a geospatial near query
    if (lat !== undefined && lng !== undefined) {
      const plat = parseFloat(lat);
      const plng = parseFloat(lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
        return res.status(400).json({ error: 'Invalid lat or lng' });
      }

      query.location = {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [plng, plat] },
          $maxDistance: maxDistance
        }
      };

      try {
        const facilities = await Facility.find(query)
          .skip(skip)
          .limit(limitNum)
          .maxTimeMS(10000);
        
        const total = await Facility.countDocuments(query);
        
        return res.json({
          data: facilities,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            pages: Math.ceil(total / limitNum),
            hasMore: skip + facilities.length < total
          }
        });
      } catch (geoError) {
        console.error('Geospatial query failed:', geoError);
        // Fallback to regular query if geospatial fails
        delete query.location;
        const facilities = await Facility.find(query)
          .skip(skip)
          .limit(limitNum)
          .maxTimeMS(5000);
        
        const total = await Facility.countDocuments(query);
        
        return res.json({
          data: facilities,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            pages: Math.ceil(total / limitNum),
            hasMore: skip + facilities.length < total
          }
        });
      }
    }
  } catch (err) {
    console.error('Facilities list error:', err);
    // Check if it's a database connection error
    if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        error: 'Database temporarily unavailable', 
        message: 'Please try again later' 
      });
    }
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Test database connection
exports.testDb = async (req, res) => {
  try {
    console.log('Testing database connection...');
    const testCount = await Facility.countDocuments();
    console.log('Database connection successful. Total facilities:', testCount);
    
    res.json({
      status: 'success',
      message: 'Database connection working',
      totalFacilities: testCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
exports.addSamples = async (req, res) => {
  try {
    const sampleData = [
      {
        name: 'Kampala General Hospital',
        type: 'hospital',
        location: { type: 'Point', coordinates: [32.5825, 0.3476] },
        address: 'Kampala, Uganda',
        phone: '+256-414-123456',
        services: ['Emergency', 'Pharmacy', 'Outpatient', 'Surgery'],
        openingHours: '24/7',
        isEmergency: true,
        ownership: 'public'
      },
      {
        name: 'Mulago National Referral Hospital',
        type: 'hospital',
        location: { type: 'Point', coordinates: [32.6035, 0.3276] },
        address: 'Mulago Hill, Kampala',
        phone: '+256-414-234567',
        services: ['Emergency', 'Pharmacy', 'Outpatient', 'Specialist Care'],
        openingHours: '24/7',
        isEmergency: true,
        ownership: 'public'
      },
      {
        name: 'City Pharmacy',
        type: 'pharmacy',
        location: { type: 'Point', coordinates: [32.5825, 0.3476] },
        address: 'Kampala City Center',
        phone: '+256-414-345678',
        services: ['Medicines', 'Consultation', 'Medical Supplies'],
        openingHours: '08:00-22:00',
        isEmergency: false,
        ownership: 'private'
      },
      {
        name: 'St. Francis Hospital Nsambya',
        type: 'hospital',
        location: { type: 'Point', coordinates: [32.5765, 0.3076] },
        address: 'Nsambya, Kampala',
        phone: '+256-414-456789',
        services: ['Emergency', 'Pharmacy', 'Outpatient', 'Maternity'],
        openingHours: '24/7',
        isEmergency: true,
        ownership: 'private'
      }
    ];

    // Clear existing sample data
    await Facility.deleteMany({});

    // Insert new sample data
    const facilities = await Facility.insertMany(sampleData);
    
    console.log(`Added ${facilities.length} sample facilities`);
    res.status(201).json({ 
      message: `Added ${facilities.length} sample facilities`,
      count: facilities.length 
    });
  } catch (err) {
    console.error('Error adding sample facilities:', err);
    res.status(500).json({ error: 'Failed to add sample facilities' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    // normalize ownership value
    if (data.ownership) data.ownership = String(data.ownership).toLowerCase();
    if (data.ownership !== 'public' && data.ownership !== 'private') data.ownership = 'private';
    // Basic validation: require name and type
    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Missing required fields: name and type' });
    }

    // If a password is provided, hash it and store as passwordHash
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }
    // If an agentId is supplied (from Telegram bot), store it
    if (data.agentId) {
      data.agentId = String(data.agentId);
    }
    // If a username is provided, ensure it's unique (case-insensitive)
    if (data.username) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await Facility.findOne({ username: { $regex: `^${escapeRegex(String(data.username))}$`, $options: 'i' } });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }
    const facility = new Facility(data);
    await facility.save();
    res.status(201).json(facility);
  } catch (err) {
    console.error(err);
    // Handle duplicate key error just in case
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${key} already exists` });
    }
    res.status(400).json({ error: 'Bad request' });
  }
};

// Facility login via username/password -> returns facility object when credentials match
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const facility = await Facility.findOne({ username: username });
    if (!facility) return res.status(401).json({ error: 'Invalid credentials' });
    if (!facility.passwordHash) return res.status(401).json({ error: 'No password set for this facility' });
    const ok = await bcrypt.compare(password, facility.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json(facility);
  } catch (err) {
    console.error('facility login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get facility by id
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    // Try find by Mongo _id first, if not found try to find by agentId
    let facility = null;
    try {
      facility = await Facility.findById(id);
    } catch (e) {
      facility = null;
    }
    if (!facility) {
      facility = await Facility.findOne({ agentId: id });
    }
    if (!facility) return res.status(404).json({ error: 'Not found' });
    return res.json(facility);
  } catch (err) {
    console.error('facility get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/view
// increments view counters and records last viewed timestamp
exports.recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const query = { $or: [{ _id: id }, { agentId: id }] };
    const update = { $inc: { viewsTotal: 1 }, $set: { lastViewedAt: new Date() } };
    const f = await Facility.findOneAndUpdate(query, update, { new: true });
    if (!f) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, viewsTotal: f.viewsTotal, lastViewedAt: f.lastViewedAt });
  } catch (err) {
    console.error('recordView error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/rate
// body: { rating: number }
exports.rate = async (req, res) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body.rating || 0);
    if (!Number.isFinite(rating) || rating <= 0) return res.status(400).json({ error: 'rating required' });
    const query = { $or: [{ _id: id }, { agentId: id }] };
    // Update aggregated rating fields
    const f = await Facility.findOne(query);
    if (!f) return res.status(404).json({ error: 'Not found' });
    const newCount = (f.ratingCount || 0) + 1;
    const newSum = (f.ratingSum || 0) + rating;
    const avg = newSum / newCount;
    f.ratingCount = newCount;
    f.ratingSum = newSum;
    f.averageRating = Math.round((avg + Number.EPSILON) * 100) / 100; // two decimals
    await f.save();
    return res.json({ ok: true, ratingCount: f.ratingCount, averageRating: f.averageRating });
  } catch (err) {
    console.error('rate error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Update facility by id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.ownership) {
      data.ownership = String(data.ownership).toLowerCase();
      if (data.ownership !== 'public' && data.ownership !== 'private') data.ownership = 'private';
    }
    // If updating name, ensure uniqueness
    if (data.name) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Facility.findOne({ _id: { $ne: id }, name: { $regex: `^${escapeRegex(data.name)}$`, $options: 'i' } });
      if (existing) return res.status(409).json({ error: 'Facility name already exists' });
    }
    // If updating username, ensure it's unique (case-insensitive)
    if (data.username) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await Facility.findOne({ _id: { $ne: id }, username: { $regex: `^${escapeRegex(String(data.username))}$`, $options: 'i' } });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }
    // If password provided, hash it
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }
    // Allow updating by _id or by agentId
    const query = { $or: [{ _id: id }, { agentId: id }] };
    const facility = await Facility.findOneAndUpdate(query, data, { new: true, runValidators: true });
    if (!facility) return res.status(404).json({ error: 'Not found' });
    return res.json(facility);
  } catch (err) {
    console.error('facility update error', err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${key} already exists` });
    }
    return res.status(400).json({ error: 'Bad request' });
  }
};

// POST /api/facilities/:id/reset-password
// If body.password provided, set that as the new password; otherwise generate a temporary one.
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    let { password } = req.body || {};
    // Log incoming request (do not print plaintext here unless DEBUG_PASSWORDS=true)
    try {
      console.log(`resetPassword request: id=${id} bodyContainsPassword=${password ? 'yes' : 'no'}`);
    } catch (e) {}

    // If no password provided, generate a secure temporary password
    if (!password) {
      const rand = () => Math.random().toString(36).slice(2);
      password = `${rand()}${rand()}`.slice(0, 16);
      try { console.log('resetPassword: generated a temporary password (plaintext suppressed)'); } catch (e) {}
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);

    const query = { $or: [{ _id: id }, { agentId: id }] };
    const facility = await Facility.findOneAndUpdate(query, { passwordHash }, { new: true });
    if (!facility) {
      try { console.warn(`resetPassword: facility not found for id=${id}`); } catch (e) {}
      return res.status(404).json({ error: 'Not found' });
    }

    // Log outcome for operator visibility; optionally reveal plaintext when DEBUG_PASSWORDS=true
    try {
      if (process.env.DEBUG_PASSWORDS === 'true') {
        console.log(`resetPassword: facility ${facility._id} password set to: ${password}`);
      } else {
        console.log(`resetPassword: facility ${facility._id} password updated (plaintext suppressed)`);
      }
    } catch (e) { /* ignore logging failures */ }

    // Return the plaintext password so admin UI can display it once
    return res.json({ password });
  } catch (err) {
    console.error('resetPassword error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check if a facility name exists
exports.checkName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Facility.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
    return res.json({ exists: !!existing });
  } catch (err) {
    console.error('checkName error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Return service catalog used by frontend for subtype-specific options
exports.catalog = async (req, res) => {
  try {
    return res.json(serviceCatalog);
  } catch (err) {
    console.error('service catalog error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Delete facility by id
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    // Allow deleting by _id or by agentId
    const query = { $or: [{ _id: id }, { agentId: id }] };
    const facility = await Facility.findOneAndDelete(query);
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    return res.json({ message: `Facility "${facility.name}" has been deleted successfully` });
  } catch (err) {
    console.error('facility delete error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
