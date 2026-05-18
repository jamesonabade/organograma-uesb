const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
(async () => {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='comum' AND table_name LIKE '%unidade%'");
    console.log(res.rows);
    const cRes = await pool.query("SELECT * FROM comum.classificacao_unidade LIMIT 2");
    console.log('classificacao:', cRes.rows);
    try {
      const tRes = await pool.query("SELECT * FROM comum.tipo_unidade LIMIT 2");
      console.log('tipo:', tRes.rows);
    } catch(e) {
      console.log('no tipo_unidade');
    }
  } catch(e) {
    console.error(e);
  }
  pool.end();
})();
