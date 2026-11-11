// How to use DrainWise, in the order a person meets it.
import Link from "next/link";
import InfoPage, { card, eyebrow, h2 } from "../InfoPage";

export const metadata = { title: "How to use · DrainWise (sample data)" };

const MANAGER = [
  "Open the app and choose Manager. Everything on screen is sample data.",
  "Read the Check next queue. GPTs are ranked by risk, each with its reasons. High, Medium and Low also have a face and a label.",
  "Use the leaf fall and extra rain sliders to see what changes.",
  "Set the truck size, then plan a run. The stops are numbered on the map. The plan never goes over the truck size.",
  "Send the run to a crew. You can add or remove a stop first.",
  "Watch the bell for cameras that need a look and for new photos. Records shows every job with its photos.",
];
const CREW = [
  "Open the Crew page on a phone, or use the side-by-side view on a laptop.",
  "Accept the run. The screen says Stop 1 of N and shows the load.",
  "At a GPT with a camera, just mark it cleaned. No photos are needed.",
  "At any other GPT, take a BEFORE photo, clean, then take an AFTER photo. You cannot submit without both.",
  "Submit, then go to the next stop. At the last stop, return to the depot.",
];

function Steps({ label, steps }: { label: string; steps: string[] }) {
  return (
    <section style={card} aria-label={label}>
      <div style={eyebrow}>{label}</div>
      <ol style={{ margin: "8px 0 0", paddingLeft: 22, display: "grid", gap: 8, color: "var(--fr-soft)" }}>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

export default function GuidePage() {
  return (
    <InfoPage
      title="How to use DrainWise"
      intro="Clean the right gross pollutant traps before they fill. Two roles work together: the Manager plans a run and a Crew does it."
    >
      <Steps label="Manager" steps={MANAGER} />
      <Steps label="Crew" steps={CREW} />
      <section style={card} aria-label="Tips">
        <div style={eyebrow}>Good to know</div>
        <h2 style={h2}>Trying it with two devices</h2>
        <p style={{ margin: 0, color: "var(--fr-soft)" }}>
          Join the same room on a laptop and a phone with the room chip. The run and the records are shared for 24
          hours. There is no sign-in. Use Reset sample session to start again. To ask a question, open the cloud chat
          button at the bottom right.
        </p>
        <p style={{ margin: "10px 0 0", color: "var(--fr-mute)" }}>
          Not sure what is real? See{" "}
          <Link href="/about" style={{ color: "var(--fr-blue)" }}>
            About the data and models
          </Link>
          .
        </p>
      </section>
    </InfoPage>
  );
}
