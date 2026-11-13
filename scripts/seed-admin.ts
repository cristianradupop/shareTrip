// Creates the first administrator from ADMIN_* env vars. Safe to run many times.
import { ensureUser } from "./_users";

async function main() {
  const { ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local");
  }
  if (ADMIN_PASSWORD.length < 10) {
    throw new Error("ADMIN_PASSWORD must have at least 10 characters");
  }

  const id = await ensureUser({
    email: ADMIN_EMAIL,
    username: ADMIN_USERNAME || "admin",
    password: ADMIN_PASSWORD,
    firstName: "Admin",
    lastName: "TripTogether",
    phone: "+40000000000",
    address: "N/A",
    birthDate: "1990-01-01",
    role: "admin",
  });
  console.log(`Admin ready: ${ADMIN_EMAIL} (id ${id})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
