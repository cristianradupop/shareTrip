// Fictional demo data (users, trips, members) for the presentation. Safe to run many times:
// users are matched by email, and trips are only inserted if the demo organizers have none yet.
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { tripMembers, trips, user } from "@/db/schema";
import { ensureUser, type SeedUser } from "./_users";

const DEMO_PASSWORD = "Demo-Pass-123!";

const people: Omit<SeedUser, "password" | "role">[] = [
  { email: "alex.popescu@demo.test", username: "alex", firstName: "Alex", lastName: "Popescu", phone: "+40700000001", address: "Cluj-Napoca, Romania", birthDate: "1996-04-12" },
  { email: "maria.ionescu@demo.test", username: "maria", firstName: "Maria", lastName: "Ionescu", phone: "+40700000002", address: "Brasov, Romania", birthDate: "1998-09-03" },
  { email: "andrei.dumitru@demo.test", username: "andrei", firstName: "Andrei", lastName: "Dumitru", phone: "+40700000003", address: "Bucharest, Romania", birthDate: "1994-01-27" },
  { email: "ioana.marin@demo.test", username: "ioana", firstName: "Ioana", lastName: "Marin", phone: "+40700000004", address: "Sibiu, Romania", birthDate: "2000-06-18" },
  { email: "radu.stan@demo.test", username: "radu", firstName: "Radu", lastName: "Stan", phone: "+40700000005", address: "Timisoara, Romania", birthDate: "1993-11-09" },
  { email: "elena.toma@demo.test", username: "elena", firstName: "Elena", lastName: "Toma", phone: "+40700000006", address: "Iasi, Romania", birthDate: "1997-02-21" },
  { email: "vlad.georgescu@demo.test", username: "vlad", firstName: "Vlad", lastName: "Georgescu", phone: "+40700000007", address: "Constanta, Romania", birthDate: "1999-07-30" },
  { email: "ana.radu@demo.test", username: "ana", firstName: "Ana", lastName: "Radu", phone: "+40700000008", address: "Oradea, Romania", birthDate: "2001-12-05" },
];

type Gender = "male" | "female" | "mixed";
type Transport = "plane" | "car" | "bus" | "train" | "ship" | "other";

// [organizer index, city, country, days from today, trip length (days), max travelers, gender, budget, currency, transport, theme]
const tripData: [number, string, string, number, number, number, Gender, number, string, Transport, string][] = [
  [0, "Brasov", "Romania", 12, 3, 8, "mixed", 250, "EUR", "car", "Carpathian hike: Piatra Craiului ridge and cabin nights."],
  [0, "Sibiu", "Romania", 40, 2, 6, "mixed", 150, "EUR", "car", "Christmas market weekend and old-town food tour."],
  [0, "Transfagarasan", "Romania", 75, 3, 5, "mixed", 300, "RON", "car", "Road trip on Transfagarasan with a stop at Balea Lake."],
  [1, "Paris", "France", 20, 4, 6, "female", 700, "EUR", "plane", "Girls' city break: museums, cafes and the Seine at night."],
  [1, "Barcelona", "Spain", 55, 5, 8, "mixed", 850, "EUR", "plane", "Gaudi architecture, tapas and a beach day."],
  [1, "Lisbon", "Portugal", 95, 5, 6, "mixed", 800, "EUR", "plane", "Tram 28, pasteis de nata and a day trip to Sintra."],
  [2, "Vienna", "Austria", 18, 3, 6, "male", 500, "EUR", "train", "Coffee houses, classical concert and the Naschmarkt."],
  [2, "Prague", "Czechia", 48, 4, 8, "mixed", 450, "EUR", "bus", "Old Town, castle at sunrise and a beer-hall evening."],
  [2, "Istanbul", "Turkey", 82, 5, 10, "mixed", 600, "EUR", "plane", "Bazaars, Bosphorus ferry and Turkish breakfast."],
  [3, "Rome", "Italy", 25, 4, 6, "female", 750, "EUR", "plane", "Colosseum, Trastevere dinners and a gelato crawl."],
  [3, "Dubai", "UAE", 120, 6, 6, "mixed", 1400, "EUR", "plane", "Desert safari, Burj Khalifa and the old souks."],
  [3, "Constanta", "Romania", 150, 3, 10, "mixed", 200, "EUR", "train", "Black Sea weekend: beach, seafood and Vama Veche party."],
  [4, "London", "United Kingdom", 33, 5, 5, "mixed", 1000, "EUR", "plane", "Museums, West End show and Camden market."],
  [4, "Munich", "Germany", 60, 3, 8, "male", 550, "EUR", "train", "Beer gardens, Bavarian Alps day trip and Neuschwanstein."],
  [4, "Budapest", "Hungary", 70, 3, 8, "mixed", 400, "EUR", "bus", "Thermal baths, ruin bars and a Danube night cruise."],
  [5, "Brasov", "Romania", 28, 2, 6, "female", 120, "EUR", "train", "Spa weekend with Tampa mountain walk."],
  [5, "Athens", "Greece", 105, 5, 8, "mixed", 650, "EUR", "plane", "Acropolis, island day trip to Hydra and souvlaki."],
  [6, "Iasi", "Romania", 15, 2, 8, "mixed", 100, "EUR", "car", "Monasteries of Moldavia and wine tasting."],
  [6, "Amsterdam", "Netherlands", 65, 4, 6, "mixed", 900, "EUR", "plane", "Canal bike rides, Van Gogh museum and tulip markets."],
  [7, "Cluj-Napoca", "Romania", 22, 2, 10, "mixed", 90, "EUR", "bus", "Untold-style music weekend and old-town bars."],
  [7, "Sibiu", "Romania", 90, 3, 6, "female", 180, "EUR", "car", "Fagaras mountains day hike and Brukenthal museum."],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

async function main() {
  const ids: string[] = [];
  for (const p of people) ids.push(await ensureUser({ ...p, password: DEMO_PASSWORD, role: "user" }));
  console.log(`Demo users ready: ${ids.length}`);

  const already = await db.select({ id: trips.id }).from(trips).where(inArray(trips.organizerId, ids)).limit(1);
  if (already.length > 0) {
    console.log("Demo trips already exist, skipping.");
    process.exit(0);
  }

  const created = await db
    .insert(trips)
    .values(
      tripData.map(([org, city, country, start, len, max, gender, budget, currency, transport, theme]) => ({
        organizerId: ids[org],
        destinationCity: city,
        destinationCountry: country,
        departureDate: iso(addDays(start)),
        returnDate: iso(addDays(start + len)),
        maxTravelers: max,
        gender,
        budgetEstimate: String(budget),
        currency,
        transport,
        theme,
      })),
    )
    .returning({ id: trips.id, organizerId: trips.organizerId, maxTravelers: trips.maxTravelers });

  // Deterministic "joined" counts so the dashboard has numbers to show.
  const members: { tripId: string; userId: string }[] = [];
  created.forEach((t, i) => {
    const others = ids.filter((id) => id !== t.organizerId);
    const count = Math.min(t.maxTravelers - 1, (i * 3) % 5 + 1);
    others.slice(i % others.length, (i % others.length) + count).forEach((userId) => members.push({ tripId: t.id, userId }));
  });
  if (members.length) await db.insert(tripMembers).values(members).onConflictDoNothing();

  const check = await db.select({ id: user.id }).from(user).where(eq(user.role, "user"));
  console.log(`Inserted ${created.length} trips and ${members.length} memberships (${check.length} regular users total).`);
  console.log(`Demo login: any demo user (e.g. alex.popescu@demo.test) with password ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
