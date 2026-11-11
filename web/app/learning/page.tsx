// How the system learns from the scheduler's edits (ticket 32). Everything here is a SIMULATION.
import LearningClient from "./LearningClient";

export const metadata = { title: "Learning from feedback · DrainWise (simulation)" };

export default function LearningPage() {
  return <LearningClient />;
}
