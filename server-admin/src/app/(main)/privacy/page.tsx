import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const cookies = [
  {
    name: "better-auth.session_token (named __Secure-better-auth.session_token in production)",
    purpose: "Keeps you signed in",
    category: "Necessary",
    duration: "Up to 7 days (renewed while you use the site)",
  },
  {
    name: "tt_consent",
    purpose: "Remembers your cookie choice",
    category: "Necessary",
    duration: "180 days",
  },
  {
    name: "tt_vid",
    purpose: "Anonymous visitor id for analytics",
    category: "Analytics (only with consent)",
    duration: "180 days",
  },
  {
    name: "tt_sid",
    purpose: "Anonymous session id for analytics",
    category: "Analytics (only with consent)",
    duration: "30 minutes of inactivity",
  },
  {
    name: "theme (localStorage)",
    purpose: "Remembers light or dark mode",
    category: "Necessary",
    duration: "Until you clear your browser data",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-3 mt-3 rounded-[2rem] bg-card px-6 py-12 text-sm leading-6 sm:mx-auto sm:mt-4 sm:w-full sm:max-w-3xl sm:px-12">
      <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
        Back to TripTogether
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Privacy</h1>
      <p className="mt-2 text-muted-foreground">How TripTogether handles your personal data.</p>

      <h2 className="mt-8 text-xl font-semibold">Who is responsible</h2>
      <p className="mt-2">
        The controller is the TripTogether team, a course project. Contact:{" "}
        <a className="underline underline-offset-4" href="mailto:contact@triptogether.example">
          contact@triptogether.example
        </a>
        .
      </p>

      <h2 className="mt-8 text-xl font-semibold">What we process</h2>
      <h3 className="mt-4 font-medium">Your account</h3>
      <p className="mt-1">
        Name, first and last name, email, username, phone number, address, birth date, gender (optional), profile photo, a
        password hash, and the account role and ban status. The photo is stored in Supabase Storage.
      </p>
      <h3 className="mt-4 font-medium">Your trips</h3>
      <p className="mt-1">
        Trips you organize (destination, dates, group size, gender preference, budget, transport, theme), the requests you
        send to join a trip and its decision, and the trips you are a member of.
      </p>
      <h3 className="mt-4 font-medium">Security data</h3>
      <p className="mt-1">
        Each sign-in session stores your IP address and user agent. Rate-limit counters keyed by your IP address (sign-in, sign-up)
        are deleted at the next cleanup once they have been idle for 24 hours (the cleanup runs while analytics data arrives, so on a quiet day it can take longer); the rate-limit keys of analytics are hashed. An audit log records account and trip changes.
      </p>
      <h3 className="mt-4 font-medium">Analytics (only if you accept)</h3>
      <p className="mt-1">
        An anonymous visitor id and session id, a hash of your IP address made with a salt that changes every day (the IP itself
        is not stored), device and browser family, the pages you visit, clicks, page timings and loading performance. These
        records are deleted after 30 days. Admin pages are never tracked.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Why, and on what legal basis</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Running your account and trips: performance of a contract.</li>
        <li>Analytics to improve the site: your consent, which you can refuse or withdraw at any time.</li>
        <li>
          Session IP and user agent, rate limiting and the audit log, to protect the service against abuse: our legitimate
          interest in security.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Who processes data for us</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Supabase: database and photo storage (region: Frankfurt, EU).</li>
        <li>Vercel: hosting (region fra1, Frankfurt).</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Your rights</h2>
      <p className="mt-2">
        You can ask for access, correction, deletion, restriction or a copy of your data, and object to processing based on
        legitimate interest, by writing to the contact above. You can withdraw your consent at any time with the Cookie settings
        button in the footer. You can also complain to the Romanian data protection authority, ANSPDCP (dataprotection.ro).
      </p>
      <p className="mt-2">
        If your browser sends a Global Privacy Control or Do Not Track signal, we treat it as a refusal of analytics.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Cookies and local storage</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Purpose</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((c) => (
              <tr key={c.name} className="border-b align-top">
                <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                <td className="py-2 pr-4">{c.purpose}</td>
                <td className="py-2 pr-4">{c.category}</td>
                <td className="py-2">{c.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
