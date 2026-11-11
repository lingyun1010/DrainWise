import Link from "next/link";

// One quiet line on every page. Says what the data is and where to read more. Short on the crew phone.
export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--fr-line)",
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        fontSize: 13,
        color: "var(--fr-mute)",
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 16px",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span>Prototype with sample data. Not council data.</span>
      <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", justifyContent: "center" }}>
        <Link href="/about" style={{ color: "var(--fr-blue)", padding: "10px 0" }}>
          About the data and models
        </Link>
        <Link href="/guide" style={{ color: "var(--fr-blue)", padding: "10px 0" }}>
          How to use
        </Link>
      </nav>
    </footer>
  );
}
