"use client";

import { useRouter } from "next/navigation";
import CrewApp from "../CrewApp";

export default function Crew() {
  const router = useRouter();
  return (
    <main style={{ minHeight: "100vh", background: "#0B2233", padding: 16 }}>
      <CrewApp standalone onSwitchRole={() => router.push("/")} />
    </main>
  );
}
