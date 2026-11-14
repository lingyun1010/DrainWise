import Link from "next/link";

const link = { color: "var(--fr-blue)", padding: "10px 0" } as const;

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
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <span>Prototype with sample data. Not council data.</span>
      <nav
        aria-label="Footer"
        style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", justifyContent: "center", alignItems: "center" }}
      >
        <Link href="/about" style={link}>
          About the data and models
        </Link>
        <Link href="/model" style={link}>
          How the risk model works
        </Link>
        <Link href="/learning" style={link}>
          Learning from feedback
        </Link>
        <Link href="/guide" style={link}>
          How to use
        </Link>
      </nav>
    </footer>
  );
}
