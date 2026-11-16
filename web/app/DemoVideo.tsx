// Demo video, embedded from a public LinkedIn post (LinkedIn "Embed this post" iframe).
// Paste the iframe src from LinkedIn into DEMO_VIDEO_SRC. While it is empty nothing is shown.
// Example: https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:1234567890123456789
import { card, eyebrow, h2 } from "./InfoPage";

export const DEMO_VIDEO_SRC = "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7527923190728372224?compact=1";

export default function DemoVideo() {
  if (!DEMO_VIDEO_SRC) return null;
  return (
    <section style={card} aria-label="Demo video">
      <div style={eyebrow}>Demo video</div>
      <h2 style={h2}>See it working</h2>
      <p style={{ margin: "0 0 12px", color: "var(--fr-soft)" }}>
        A walk through the prototype: Manager plans a run, Crew closes each job with photos. All sample data.
      </p>
      <iframe
        src={DEMO_VIDEO_SRC}
        title="DrainWise demo video on LinkedIn"
        loading="lazy"
        allowFullScreen
        style={{ width: "100%", height: 399, maxWidth: 504, border: 0, borderRadius: 16, display: "block" }}
      />
      <p style={{ margin: "10px 0 0", color: "var(--fr-mute)" }}>
        The video is hosted on LinkedIn. If it does not load, open it there.
      </p>
    </section>
  );
}
