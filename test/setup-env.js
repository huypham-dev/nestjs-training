/**
 * Setup test environment variables
 * This file is loaded before tests run via jest setupFiles
 */
const dotenv = require('dotenv');
const path = require('path');

// Load .env.test.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.test.local') });

console.log(`[TEST ENV] Using database: ${process.env.DB_NAME}`);
