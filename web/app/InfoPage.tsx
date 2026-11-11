import Link from "next/link";

// Shared shell for the plain information pages (About, How to use). Server component, no state.
export const card: React.CSSProperties = {
  background: "var(--fr-panel)",
  border: "3px solid var(--fr-line)",
  borderRadius: 24,
  padding: 20,
};
export const eyebrow: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fr-mute)",
  fontWeight: 700,
};
export const h2: React.CSSProperties = { margin: "4px 0 10px", fontSize: 22, fontFamily: "var(--font-fredoka)" };

export default function InfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 48px", width: "100%" }}>
      <Link href="/" className="fr-btn fr-ghost" style={{ textDecoration: "none" }}>
        Back to DrainWise
      </Link>
      <h1 style={{ margin: "8px 0 4px", fontSize: 34, fontFamily: "var(--font-fredoka)" }}>{title}</h1>
      <p style={{ margin: "0 0 16px", color: "var(--fr-soft)", maxWidth: 720 }}>{intro}</p>
      <div style={{ display: "grid", gap: 16 }}>{children}</div>
    </main>
  );
}
