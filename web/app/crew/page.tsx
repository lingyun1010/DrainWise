"use client";

import { useRouter } from "next/navigation";
import CrewApp from "../CrewApp";

export default function Crew() {
  const router = useRouter();
  return (
    <main className="fr-crewmain" style={{ minHeight: "100vh", background: "#0B2233" }}>
      <div className="fr-device">
        <CrewApp standalone onSwitchRole={() => router.push("/")} />
      </div>
    </main>
  );
}
