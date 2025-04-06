// db.js
const { Pool } = require("pg");

// Create a PostgreSQL connection pool
const pool = new Pool({
  user: "webauthn_user",
  host: "localhost",
  database: "webauthn",
  password: "genius",
  port: 5432,
});

// Function to get a user by email
async function getUserByEmail(email) {
  const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return res.rows[0];
}

// Function to get a user by ID
async function getUserById(id) {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows[0];
}

// Function to create a new user
async function createUser(id, email, passKey) {
  await pool.query(
    "INSERT INTO users (id, email, passkey_id, passkey_public_key, passkey_counter, passkey_device_type, passkey_backed_up, passkey_transports) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      id,
      email,
      passKey.id,
      passKey.publicKey,
      passKey.counter,
      passKey.deviceType,
      passKey.backedUp,
      passKey.transports,
    ]
  );
}

// Function to update a user's passkey counter
async function updateUserCounter(id, counter) {
  await pool.query("UPDATE users SET passkey_counter = $1 WHERE id = $2", [
    counter,
    id,
  ]);
}

// Export the functions
module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  updateUserCounter,
};