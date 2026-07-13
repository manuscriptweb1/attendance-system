const pool = require('./config/database');
pool.query("SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'trusted_devices' AND column_name = 'approved_status'").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
