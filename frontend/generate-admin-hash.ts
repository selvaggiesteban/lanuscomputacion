// generate-admin-hash.ts
// Run: npx tsx generate-admin-hash.ts

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const password = "!Jumpjet20012027";
hashPassword(password).then(hash => {
  console.log("Password hash:", hash);
  console.log("\nSQL to run:");
  console.log(`INSERT OR REPLACE INTO customers (id, email, name, password_hash, is_admin, is_b2b, created_at) VALUES ('admin-001', 'selvaggiesteban@gmail.com', 'Esteban Selvaggi', '${hash}', 1, 0, datetime('now'));`);
});
