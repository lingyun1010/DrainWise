// What data DrainWise uses and what each model is. Plain facts, no claims of accuracy.
import InfoPage, { card, eyebrow, h2 } from "../InfoPage";

export const metadata = { title: "About the data and models · DrainWise (sample data)" };

type Row = { name: string; note: string };

// Public = real and open. Synthetic = made by us. Missing = only the council has it.
const PUBLIC: Row[] = [
  {
    name: "Rain forecast",
    note: "Bureau of Meteorology (BoM) public forecast for Parramatta, read live and kept for 1 hour.",
  },
  { name: "Rain since 9am", note: "BoM reading from the Sydney Olympic Park weather station, read live." },
  { name: "Map", note: "OpenStreetMap data drawn with OpenFreeMap tiles. The creek lines are real." },
  {
    name: "Council sample photos",
    note: "7 photos of real nets from the council session. Public, and used here as camera pictures.",
  },
];
const SYNTHETIC: Row[] = [
  {
    name: "GPT positions and cameras",
    note: "36 invented GPTs placed near real creeks. Which ones have a camera is invented too.",
  },
  {
    name: "Tree canopy and leaf fall",
    note: "Sample numbers per GPT. The real source (NSW tree canopy 2024-25) is not wired in yet.",
  },
  {
    name: "Blockage history",
    note: "None exists. The risk model learns from 20,000 simulated assets with an assumed rule.",
  },
  {
    name: "Camera pictures with a circle",
    note: "Edits of the council sample photos, made to show a full, broken or fallen net. Not live cameras.",
  },
  {
    name: "Terrain and 3-hourly rain",
    note: "Procedural terrain and an invented 3-hourly strip. LiDAR terrain is planned.",
  },
];
const MISSING: Row[] = [
  { name: "Real GPT locations", note: "Only the council has them." },
  { name: "Cleaning and blockage records", note: "Needed to train on real history." },
  { name: "Truck and bin sizes", note: "The 3 m³ truck is an assumption you can change." },
];

const MODELS: { name: string; what: string; data: string }[] = [
  {
    name: "Risk model",
    what: "Gradient boosting that gives each GPT a chance of blocking, with reasons. Powers the queue and the truck run.",
    data: "Trained on simulated data. Sample data only, no accuracy claim.",
  },
  {
    name: "Camera reading",
    what: "Compares a camera picture with a clean reference and turns the changed area into a fullness band. It is not a trained model.",
    data: "Stored sample readings, not live. A person confirms before anything becomes a label.",
  },
  {
    name: "Chat assistant",
    what: "A Claude model that answers questions with 4 read-only tools: BoM rain, risk ranking, crew progress, learned rules.",
    data: "It reads the same sample data as the page. It cannot change anything.",
  },
];

function List({ label, tone, rows }: { label: string; tone: string; rows: Row[] }) {
  return (
    <section style={card} aria-label={label}>
      <div style={{ ...eyebrow, color: tone }}>{label}</div>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <li key={r.name}>
            <strong>{r.name}</strong>
            <div style={{ color: "var(--fr-soft)" }}>{r.note}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AboutPage() {
  return (
    <InfoPage
      title="About the data and models"
      intro="DrainWise is a prototype for gross pollutant traps (GPTs). Most of what you see is sample data. This page says which parts are real."
    >
      <List label="Public and real" tone="var(--fr-green)" rows={PUBLIC} />
      <List label="Synthetic: made by us" tone="var(--fr-yellow)" rows={SYNTHETIC} />
      <List label="Not available to us yet" tone="var(--fr-mute)" rows={MISSING} />
      <section style={card} aria-label="Models">
        <div style={eyebrow}>The three models</div>
        <h2 style={h2}>Which model is which</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {MODELS.map((m) => (
            <li key={m.name}>
              <strong>{m.name}</strong>
              <div style={{ color: "var(--fr-soft)" }}>{m.what}</div>
              <div style={{ color: "var(--fr-mute)" }}>{m.data}</div>
            </li>
          ))}
        </ul>
      </section>
      <section style={card} aria-label="Email rules">
        <div style={eyebrow}>Emails</div>
        <h2 style={h2}>When the admin gets an email</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: "var(--fr-soft)" }}>
          <li>Once a day the system checks the whole 7-day BoM forecast.</li>
          <li>Normally it sends one weekly 7-day report, at most every 7 days.</li>
          <li>
            If any of the next 7 days looks like a storm (60%+ chance of rain and 25 mm or more, our assumption), it
            sends an alert at once, even if the weekly report went out yesterday. It repeats every day until a run has
            been planned.
          </li>
          <li>These emails go to the admin only, who reviews the run and confirms it.</li>
          <li>
            A crew is never emailed automatically. The admin can send the planned run to a crew by hand from the
            planner.
          </li>
          <li>In this demo there is no scheduler and nothing is really sent: emails are simulated.</li>
        </ul>
      </section>
      <section style={card} aria-label="Credits">
        <div style={eyebrow}>Credits</div>
        <p style={{ margin: "6px 0 0", color: "var(--fr-soft)" }}>
          Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Forecast and rain readings from the Bureau of
          Meteorology. Built for the City of Parramatta hackathon challenge 5. Not an official council product.
        </p>
      </section>
    </InfoPage>
  );
}
