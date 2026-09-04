const { Pool, types } = require('pg');
require('dotenv').config();

// PostgreSQL DATE OID 1082 -> return exact YYYY-MM-DD string (prevents UTC timezone shift)
types.setTypeParser(1082, (str) => str);

const poolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,        // Close idle clients after 30s before cloud poolers drop them
  connectionTimeoutMillis: 10000,  // Return an error after 10s if connection cannot be established
  keepAlive: true,                 // Send keep-alive packets to prevent cloud firewalls from closing idle sockets
  keepAliveInitialDelayMillis: 10000
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      ...poolConfig
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: false,
      ...poolConfig
    });


// Handle idle client errors gracefully without killing the server process
pool.on('error', (err) => {
  console.error('⚠️ Idle database client warning / connection drop:', err.message || err);
  // Do NOT exit process. node-postgres automatically discards the dead client and creates a new one on demand.
});

module.exports = pool;