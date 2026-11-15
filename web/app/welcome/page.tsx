// Landing page for the WSTI Festi submission: idea, team, plan, data, privacy, responsible AI.
// Server component. Plain facts; everything simulated is called sample data. No accuracy claims.
import Image from "next/image";
import Link from "next/link";
import { FallingLeaves } from "../HomeBackdrop";
import { card, eyebrow, h2 } from "../InfoPage";

export const metadata = {
  title: "DrainWise · team and plan (sample data)",
  description: "Clean the right gross pollutant traps before they fill. Who built DrainWise, the plan and the data.",
};

type Person = { name: string; role: string; brings: string };

const TEAM: Person[] = [
  {
    name: "Lingyun Zhao",
    role: "Founder · Product and AI engineering",
    brings: "Designed and built the prototype: planner, risk model and apps.",
  },
  {
    name: "Aaron Wong",
    role: "Civil Engineer · Flood modelling advisor",
    brings: "Grounds the problem in real drainage and flood practice.",
  },
  {
    name: "Eric Zhu",
    role: "Operating Partner · Business insight",
    brings: "Shapes the operating model and how a council would adopt it.",
  },
];

const STEPS: { title: string; text: string }[] = [
  {
    title: "Predict",
    text: "A model gives each gross pollutant trap (GPT) a chance of blocking, with the reasons: tree cover, leaf fall, rain, days since the last clean.",
  },
  {
    title: "Plan",
    text: "The manager ranks the GPTs and gets a suggested truck run that fits the truck, riskiest and nearest first. The contractor picks the day and the crew.",
  },
  {
    title: "Prove",
    text: "The crew closes each stop with a before and an after photo. Sites with a camera need none. Records show the proof of work.",
  },
  {
    title: "Learn",
    text: "Before photos are designed to become training data. Nothing is retrained yet.",
  },
];

const NEXT: { title: string; text: string }[] = [
  {
    title: "Pilot on one run",
    text: "Run DrainWise next to the contractor's next 10 to 15 GPT run, using council asset locations and the real cleaning list.",
  },
  {
    title: "Get real data, lawfully",
    text: "Ask Council for GPT locations, camera sites and cleaning or blockage records under a data-sharing agreement, even a small or anonymised sample first. Then swap the training data and retrain. The API stays the same.",
  },
  {
    title: "Test with the people who do the work",
    text: "Put the crew phone view in front of contractor crews and council inspectors, and change it from what they say.",
  },
];

const AI_USES: { tool: string; use: string; check: string }[] = [
  {
    tool: "Gradient boosting (scikit-learn)",
    use: "Scores each GPT's chance of blocking and lists the top reasons.",
    check: "Trained on simulated history only. The manager decides; a score never sends a crew by itself.",
  },
  {
    tool: "Claude assistant (chat)",
    use: "Answers questions about rain, risk ranking, crew progress and learned rules, through 4 read-only tools.",
    check: "It cannot change anything. Answers can be wrong, so check them against the page.",
  },
  {
    tool: "Photo reading",
    use: "Suggests how full a net looks from a picture.",
    check: "A person confirms before anything becomes a training label. Prototype only, with just 7 sample photos.",
  },
  {
    tool: "Claude Code",
    use: "Helped write and test the prototype code.",
    check: "A person reads and runs the result; tests run before every merge.",
  },
];

const RISKS = [
  "The model has never seen a real blockage, so its scores are not evidence. We make no accuracy claim.",
  "It could miss a GPT that is filling (false negative) or send a truck to a clean one (false positive). That is why a person approves each run and crews still inspect.",
  "Tree canopy and leaf fall can stand in for other causes, such as a nearby building site. Real records would show this.",
  "A photo model can fail on glare, night or a blocked camera view, so a person reviews each label.",
];

function Item({ title, text }: { title: string; text: string }) {
  return (
    <li>
      <strong>{title}</strong>
      <div style={{ color: "var(--fr-soft)" }}>{text}</div>
    </li>
  );
}

const list: React.CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 };

export default function WelcomePage() {
  return (
    <>
      <div className="fr-bg" aria-hidden="true">
        <FallingLeaves />
      </div>
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "20px 16px 48px",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <section aria-label="Idea" style={{ textAlign: "center", padding: "12px 0 8px" }}>
          <Image src="/brand-mascot.png" alt="" width={96} height={83} unoptimized style={{ margin: "0 auto" }} />
          <h1 style={{ margin: "8px 0 6px", fontSize: 38, fontFamily: "var(--font-fredoka)" }}>DrainWise</h1>
          <p style={{ margin: "0 auto 10px", fontSize: 20, color: "var(--fr-text)", maxWidth: 640 }}>
            Clean the right gross pollutant traps before they fill.
          </p>
          <p style={{ margin: "0 auto 16px", color: "var(--fr-soft)", maxWidth: 680 }}>
            Council has 30+ gross pollutant traps (GPTs) and about one clean every 3 months. Nobody knows which nets are
            full, and checking is by hand. DrainWise predicts which GPTs fill next, suggests a truck run for the
            contractor, and closes every job with proof. City of Parramatta, WSTI Festi 2026, Challenge 5 (AI for
            Smarter Asset and Environmental Management), with Challenge 1 as secondary.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <Link href="/" className="fr-btn fr-pri" style={{ textDecoration: "none" }}>
              Try the prototype
            </Link>
            <Link href="/guide" className="fr-btn fr-sec" style={{ textDecoration: "none" }}>
              How to use it
            </Link>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--fr-mute)" }}>
            Prototype with sample data. Not council data and not an official council product.
          </p>
        </section>

        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <section style={card} aria-label="About the team">
            <div style={eyebrow}>About the team</div>
            <h2 style={h2}>Who is behind DrainWise</h2>
            <ul style={{ ...list, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {TEAM.map((p) => (
                <li
                  key={p.name}
                  style={{
                    border: "2px solid var(--fr-line)",
                    borderRadius: 16,
                    padding: 16,
                    display: "grid",
                    gap: 6,
                    alignContent: "start",
                  }}
                >
                  <strong style={{ fontSize: 18 }}>{p.name}</strong>
                  <span style={{ color: "var(--fr-blue)", fontWeight: 700 }}>{p.role}</span>
                  <span style={{ color: "var(--fr-soft)" }}>{p.brings}</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: "14px 0 0", color: "var(--fr-mute)" }}>
              We also used what council experts told us in the online sessions on 9 and 13 Nov 2026.
            </p>
          </section>

          <section style={card} aria-label="How it works">
            <div style={eyebrow}>The idea</div>
            <h2 style={h2}>Predict, plan, prove, learn</h2>
            <ol style={{ ...list, paddingLeft: 0 }}>
              {STEPS.map((s) => (
                <Item key={s.title} title={s.title} text={s.text} />
              ))}
            </ol>
          </section>

          <section style={card} aria-label="Plan">
            <div style={eyebrow}>The plan</div>
            <h2 style={h2}>Our next step</h2>
            <ul style={list}>
              {NEXT.map((s) => (
                <Item key={s.title} title={s.title} text={s.text} />
              ))}
            </ul>
            <h3 style={{ margin: "18px 0 6px", fontSize: 17 }}>Council&apos;s role</h3>
            <p style={{ margin: 0, color: "var(--fr-soft)" }}>
              Partner and help make it happen. Council holds the GPT locations, records and camera sites, and the
              outsourced contractor runs the trucks. DrainWise does not replace either, and it does not compete with the
              existing flood warning (FloodSmart / FLASH). It adds one thing: which GPT to clean next, and the proof it
              was done.
            </p>
            <h3 style={{ margin: "18px 0 6px", fontSize: 17 }}>Fit with Council&apos;s plans</h3>
            <p style={{ margin: 0, color: "var(--fr-soft)" }}>
              Today the work is a manual check and roughly one run every 3 months. We have not yet matched DrainWise to
              a named Council strategy. That is a question for the council experts, and we will say so rather than
              guess.
            </p>
          </section>

          <section style={card} aria-label="Data">
            <div style={eyebrow}>Your data</div>
            <h2 style={h2}>What data we used</h2>
            <ul style={list}>
              <Item
                title="Public and real"
                text="Bureau of Meteorology rain forecast and rain reading, OpenStreetMap and OpenFreeMap for the map, and 7 council sample photos that are public."
              />
              <Item
                title="Dummy data made by us"
                text="36 invented GPTs placed near real creeks, tree cover and leaf fall numbers, camera sites, and a risk model trained on 20,000 simulated assets with an assumed rule."
              />
              <Item
                title="Assumptions"
                text="A 3 m³ truck, and a storm alert at 60%+ chance and 25 mm or more. Both are assumptions to confirm with Council."
              />
              <Item
                title="Not available to us"
                text="Real GPT locations, cleaning and blockage history, truck and bin sizes. Only Council has them."
              />
            </ul>
            <p style={{ margin: "14px 0 0" }}>
              <Link href="/about" style={{ color: "var(--fr-blue)" }}>
                Full list on About the data and models
              </Link>
            </p>
          </section>

          <section style={card} aria-label="Privacy">
            <div style={eyebrow}>Privacy</div>
            <h2 style={h2}>No sensitive personal information</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: "var(--fr-soft)" }}>
              <li>The GPTs, crews and records in the demo are made up. No resident or customer data is used.</li>
              <li>
                Crew sign-in is a simulation inside the page. It is not security, and real use would need council single
                sign-on.
              </li>
              <li>
                Photos taken in testing are kept only in a sample project. None is used to train a model, and we would
                check for faces and number plates before any photo is used for training.
              </li>
              <li>Emails in the demo are simulated: nothing is sent.</li>
            </ul>
          </section>

          <section style={card} aria-label="Responsible AI">
            <div style={eyebrow}>Responsible AI</div>
            <h2 style={h2}>Which AI we used, and who checks it</h2>
            <ul style={list}>
              {AI_USES.map((a) => (
                <li key={a.tool}>
                  <strong>{a.tool}</strong>
                  <div style={{ color: "var(--fr-soft)" }}>{a.use}</div>
                  <div style={{ color: "var(--fr-mute)" }}>{a.check}</div>
                </li>
              ))}
            </ul>
            <h3 style={{ margin: "18px 0 6px", fontSize: 17 }}>Risks we know about</h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: "var(--fr-soft)" }}>
              {RISKS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p style={{ margin: "14px 0 0" }}>
              <Link href="/model" style={{ color: "var(--fr-blue)" }}>
                How the risk model works
              </Link>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
