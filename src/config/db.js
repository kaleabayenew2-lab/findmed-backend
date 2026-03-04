const mongoose = require('mongoose');

// the environment variable may contain several URIs separated by commas; if you only
// supply one the behaviour is identical to the old version. support both the old
// single-variable names and the new MONGODB_URIS list for backwards compatibility.
const rawUris =
  process.env.MONGODB_URIS ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/mobile_users';

// normalise into an array of strings
const uriList = rawUris
  .toString()
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// optional human‑readable labels for each URI; useful when logging
const labelList = (process.env.MONGODB_DB_LABELS || '')
  .toString()
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// store the mongoose connections and a simple schema registry
const connections = [];
const schemaRegistry = {}; // name -> mongoose.Schema
const modelCache = {}; // connIndex -> { name -> model }

// classification function stub; callers may override or supply their own logic.
// `context` argument will usually contain `{ model, data }` where `model` is
// the name of the Mongoose model being accessed and `data` is the first
// argument passed to the operation (query object, document, etc).  Return an
// integer index into `uriList` indicating which connection should be used.
// The default implementation splits by model name to route:
//   * 0 : admin/general collections
//   * 1 : user & facility data
//   * 2 : chat/telegram/message data
//
// Override this function from elsewhere if you need custom rules.  See
// docs/backend/db.md for examples.
function classify(context) {
  if (context && context.model) {
    const m = context.model;
    // facility / user oriented collections
    if (
      m === 'User' ||
      m === 'Facility' ||
      m === 'MobileUser' ||
      m === 'Feedback' ||
      m === 'FacilityStats'
    ) {
      return 1;
    }
    // chat/telegram/related collections
    if (m === 'ChatMessage' || m === 'TelegramContact') {
      return 2;
    }
    // everything else (ads, content, settings, etc) defaults to admin DB
  }
  return 0;
}

// open all configured connections when the module is initialised
function connectAll() {
  const maxAttempts = 6;

  let connectedCount = 0;
  uriList.forEach((uri, idx) => {
    let attempt = 0;
    const tryConnect = () => {
      attempt += 1;
      const conn = mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      conn.on('connected', () => {
        const label = labelList[idx] || `db${idx}`;
        console.log(`MongoDB connected [${idx}] (${label}): ${uri}`);
        connectedCount += 1;
        if (connectedCount === uriList.length) {
          const labels = uriList
            .map((_, i) => labelList[i] || `db${i}`)
            .join(',');
          console.log(`All databases connected: ${labels}`);
        }
      });
      conn.on('error', (err) => {
        console.error(
          `Mongo connect error [${idx}] (attempt ${attempt}/${maxAttempts}):`,
          err && err.message ? err.message : err
        );
        if (attempt < maxAttempts) {
          const wait = 1000 * Math.pow(2, attempt - 1);
          setTimeout(tryConnect, wait);
        }
      });

      connections[idx] = conn;
    };

    tryConnect();
  });
}

// helper that returns a connection object; falls back to index 0
function getConnection(index) {
  if (typeof index === 'string') {
    const parsed = parseInt(index, 10);
    if (!isNaN(parsed)) index = parsed;
  }
  const idx = Number.isInteger(index) ? index : 0;
  return connections[idx] || connections[0];
}

// register a schema so that models can be created on-demand per connection
function registerSchema(name, schema) {
  schemaRegistry[name] = schema;
}

// get or create a model bound to a specific connection
function getModel(name, opts = {}) {
  const connIdx = opts.connection != null ? opts.connection : 0;
  // pass both model & data to classifier for smarter decisions
  const idx = classify({ model: name, data: opts.data != null ? opts.data : null }) || connIdx;
  if (!modelCache[idx]) modelCache[idx] = {};
  if (!modelCache[idx][name]) {
    const conn = getConnection(idx);
    if (!conn) {
      throw new Error(`no mongoose connection available for index ${idx}`);
    }
    const schema = schemaRegistry[name];
    if (!schema) {
      throw new Error(`schema not registered for model "${name}"`);
    }
    modelCache[idx][name] = conn.model(name, schema);
  }
  return modelCache[idx][name];
}

// create a proxy object for a model name that automatically classifies based on
// the first argument passed to most mongoose static methods or when instantiating.
function createProxy(name) {
  // Defer model creation until a method/property is actually used. This
  // prevents eager model compilation which can trigger Mongoose's
  // "Schema hasn't been registered" errors when models reference each
  // other (e.g., populate on a ref) and the referenced schema hasn't yet
  // been registered. Use a lightweight proxy that resolves the concrete
  // model on first access.
  const base = {}; // empty target; real model resolved on demand
  const handler = {
    get(_target, prop) {
      // return a function that forwards to the real model's property
      return function (...args) {
        const sample = args[0];
        const m = getModel(name, { data: sample });
        const val = m[prop];
        if (typeof val === 'function') return val.apply(m, args);
        // if it's not a function, just return the value
        return val;
      };
    },
    construct(_target, args) {
      const m = getModel(name, { data: args[0] });
      // instantiate the concrete model
      // eslint-disable-next-line new-cap
      return new m(...args);
    },
  };
  return new Proxy(base, handler);
}

// convenience wrapper that chooses a connection based on data
function modelForData(name, data) {
  const idx = classify({ model: name, data });
  return getModel(name, { connection: idx });
}

// export public API (single export ensures functions aren't overwritten)
module.exports = {
  mongoose,
  connectAll,
  connections,
  registerSchema,
  getModel,
  modelForData,
  classify,
  getConnection,
  createProxy,
};

// automatically kick off the wiring when this file is required
connectAll();


