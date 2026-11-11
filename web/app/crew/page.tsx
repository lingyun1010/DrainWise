"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CrewApp from "../CrewApp";
import LoginDialog from "../LoginDialog";
import { getSession, setSession, type Session } from "../../lib/demoAuth";

// The crew phone. A crew signs in (simulated) and sees only its own run. A signed-in manager sees the crew picker.
export default function Crew() {
  const router = useRouter();
  const [session, setS] = useState<Session | null | undefined>(undefined); // undefined = not read yet
  useEffect(() => {
    queueMicrotask(() => setS(getSession()));
  }, []);
  const out = () => {
    setSession(null);
    router.push("/");
  };
  return (
    <main className="fr-crewmain" style={{ minHeight: "100dvh", background: "#0B2233" }}>
      <div className="fr-device">
        {session === null && <LoginDialog kind="crew" onSuccess={setS} onCancel={() => router.push("/")} />}
        {session && (
          <CrewApp
            standalone
            lockedCrewId={session.role === "crew" ? session.crewId : undefined}
            onSignOut={out}
            onSwitchRole={() => router.push("/")}
          />
        )}
      </div>
    </main>
  );
}
