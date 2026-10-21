import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const dbName = process.env.DB_NAME || 'orims';

  console.log(`[ORIMS DB Verifier] Initiating read-only check to MySQL at ${host}:${port} as '${user}'...`);

  let connection;
  try {
    // Connect without database first to verify credentials and server version/port
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password: process.env.DB_PASSWORD,
    });

    // 1. Run read-only query
    const [versionRows] = await connection.query('SELECT VERSION() AS version, @@port AS port;');
    const { version, port: activePort } = versionRows[0];
    console.log(`[SUCCESS] Connected to MySQL Server!`);
    console.log(`  - Version: ${version}`);
    console.log(`  - Port: ${activePort}`);

    const isVersion84 = version.startsWith('8.4');
    const isPort3306 = Number(activePort) === 3306;
    if (isVersion84) {
      console.log(`  - MySQL 8.4 requirement: VERIFIED (detected ${version})`);
    } else {
      console.log(`  - MySQL 8.4 requirement: NOTICE (detected ${version})`);
    }
    if (isPort3306) {
      console.log(`  - Port 3306 requirement: VERIFIED`);
    } else {
      console.log(`  - Port 3306 requirement: NOTICE (detected port ${activePort})`);
    }

    // 2. Verify configured application database exists
    const [dbRows] = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?;',
      [dbName]
    );

    if (dbRows.length > 0) {
      console.log(`[SUCCESS] Application database '${dbName}' exists.`);
    } else {
      console.log(`[ATTENTION] Application database '${dbName}' was not found in the schemas list.`);
      // List existing non-system schemas safely
      const [allSchemas] = await connection.query(
        "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys');"
      );
      const userSchemas = allSchemas.map(s => s.SCHEMA_NAME);
      console.log(`  - Existing non-system databases: [${userSchemas.join(', ')}]`);
    }

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error(`[FAILURE] Database connection could not be established.`);
    console.error(`  - Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`  - Error Number: ${err.errno || 'N/A'}`);
    console.error(`  - SQL State: ${err.sqlState || 'N/A'}`);
    console.error(`  - Message: ${err.message?.replace(process.env.DB_PASSWORD, '******') || 'No details'}`);

    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`\nDiagnostic Guide for ER_ACCESS_DENIED_ERROR:`);
      console.error(`  1. The password supplied for user '${user}' was rejected by MySQL Server 8.4.`);
      console.error(`  2. Ensure process.env.DB_PASSWORD in 'backend/.env' matches your local MySQL root password.`);
      console.error(`  3. You can verify your password interactively by opening MySQL Workbench and testing connection to 127.0.0.1:3306 with user 'root'.`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`\nDiagnostic Guide for ECONNREFUSED:`);
      console.error(`  1. MySQL Server is not accepting connections at ${host}:${port}.`);
      console.error(`  2. Verify that the Windows service MySQL84 is running.`);
    }

    if (connection) {
      try { await connection.end(); } catch {}
    }
    process.exit(1);
  }
}

main();
