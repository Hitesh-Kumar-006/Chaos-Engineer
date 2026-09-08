const PptxGenJS = require("pptxgenjs");
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "M. Mashood Ur Rehman Khan & Hitesh Kumar";
pptx.title = "Qoder - AI-Powered Chaos Engineering IDE";

const BG = "0F0F1A", ACCENT = "42AFFA", WHITE = "E0E0E0";

function titleSlide(main, sub, extras) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addText(main, { x: 0.5, y: 1.5, w: 12.3, h: 1.2, fontSize: 54, fontFace: "Segoe UI", color: ACCENT, bold: true, align: "center" });
  s.addText(sub, { x: 0.5, y: 2.8, w: 12.3, h: 0.8, fontSize: 26, fontFace: "Segoe UI", color: "CCCCCC", align: "center" });
  if (extras) {
    const rows = extras.map(l => ({ text: l, options: { fontSize: 18, color: WHITE, align: "center", paraSpaceAfter: 6, fontFace: "Segoe UI" } }));
    s.addText(rows, { x: 0.5, y: 3.9, w: 12.3, h: 3.0, valign: "top" });
  }
}

function bulletSlide(title, bullets) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addText(title, { x: 0.6, y: 0.3, w: 11.5, h: 0.9, fontSize: 32, fontFace: "Segoe UI", color: ACCENT, bold: true });
  const rows = bullets.map(b => {
    if (typeof b === "object") return { text: b.t, options: { fontSize: 18, color: WHITE, bullet: { code: "25B8" }, indentLevel: b.i || 0, paraSpaceAfter: 8, fontFace: "Segoe UI" } };
    return { text: b, options: { fontSize: 18, color: WHITE, bullet: { code: "25B8" }, indentLevel: 0, paraSpaceAfter: 8, fontFace: "Segoe UI" } };
  });
  s.addText(rows, { x: 0.6, y: 1.4, w: 11.5, h: 5.4, valign: "top" });
}

// 1 - Title
titleSlide("Qoder", "Chaos Engineering Meets AI", ["Building Resilient Code Before Production Breaks It", "", "Team Leader: M. Mashood Ur Rehman Khan", "Team Member: Hitesh Kumar"]);

// 2 - Problem
bulletSlide("The Problem: Testing's Blind Spot", ["Unit tests, integration tests, and E2E tests assume ideal conditions", "Production failures are intermittent: API timeouts, 503 errors, memory spikes, network jitter", "Developers discover bugs AFTER deployment when users are already impacted", "Junior developers and CS students lack safe environments to practice chaos engineering", "Engineering teams deploying AI integrations face unpredictable model latency and token limits"]);

// 3 - Who Pays
bulletSlide("Who Pays the Price?", ["University CS Students: Graduate without exposure to fault-tolerant design patterns", "Junior Developers: Learn resilience the hard way through production outages", "Engineering Teams: Ship AI integrations that fail unpredictably under load", "End Users: Experience crashes, timeouts, and data loss", "Business Impact: Downtime costs, reputation damage, emergency hotfixes"]);

// 4 - Solution
bulletSlide("Qoder: Chaos Engineering, Reimagined", ["Interactive IDE with a Chaos Matrix for real-time fault injection", "Chaos Copilot powered by Google Gemini for instant code analysis", "Simulate disasters before they happen:", { t: "Network Lag | Memory Bloat | Crash Rates | Event-Loop Blocking", i: 1 }, "Practice resilience patterns in a safe, educational environment", "Stress-test logic against production-like chaos before deployment"]);

// 5 - Audience
bulletSlide("Who Is Qoder For?", ["CS Students: Learn resilience patterns - retry logic, circuit breakers, graceful degradation", "Junior Developers: Stress-test code against realistic failures without risking real systems", "Engineering Teams: Validate AI integrations under unpredictable API behavior", "DevOps and SRE Teams: Generate post-mortem telemetry and track MTBF improvements", "Educators: Teach chaos engineering with interactive, gamified challenges"]);

// 6 - Need
bulletSlide("Why Now? Shift Left on Resilience", ["Traditional testing catches logic bugs, not system failures", "Chaos engineering has been a Netflix/Amazon practice - too complex for everyday developers", "AI integrations introduce new failure modes: model drift, token exhaustion, hallucination crashes", "Proactive error handling is always cheaper than reactive hotfixes", "Industry demand for resilient systems is growing faster than developer training"]);

// 7 - Impact
bulletSlide("Measurable Outcomes", ["Higher System Reliability: Code is stress-tested against chaos before deployment", "Proactive Error Handling: Developers write retry logic and circuit breakers by default", "Automated Post-Mortem Telemetry: Every stress test generates exportable incident reports", "Faster Learning Curve: Students gain production-grade intuition in hours, not years", "Reduced Downtime: Teams catch resilience gaps before users do"]);

// 8 - Tech
bulletSlide("Innovation and Technology", ["Next.js 15.5.24: Server-side rendering, API routes, production build pipeline", "Google Gemini API: Powers the Chaos Copilot for instant code analysis and explainability", "Custom Telemetry Engine: SLA grades (A-F), MTBF, latency percentiles (P50, P95, P99)", "Chaos Injection Engine: Real-time fault injection for network lag, memory bloat, crash rates", "CodeMirror 6: In-browser editor with blame highlighting for failed iterations"]);

// 9 - Feasibility
bulletSlide("Feasibility - Working Implementation", ["Fully functional algorithm validators (e.g., robust configuration validator)", "Working production build pipeline (npm run prod)", "Live chaos fault-injection simulation with real-time console output", "Exportable JSON incident post-mortem telemetry reports", "Interactive 5-round resilience challenges (Mild / Moderate / Chaos)", "AI-powered Chaos Copilot with contextual analysis and suggestions"]);

// 10 - Demo
bulletSlide("See It in Action", ["1. Challenge Mode: Select a resilience challenge", "2. Chaos Matrix: Adjust sliders for latency, memory, crash rate, and event-loop blocking", "3. Stress Test: Run 5 rounds - fix code on failure, retry, and improve", "4. Post-Mortem Report: Export JSON telemetry with SLA grade, MTBF, and latency percentiles", "5. Chaos Copilot: Ask Gemini for an architectural breakdown of what failed and how to fix it"]);

// 11 - Competitive
bulletSlide("Why Qoder Stands Out", ["Educational Focus: Gamified challenges make chaos engineering accessible to students", "AI-Powered Guidance: Gemini provides instant explainability, not just failure reports", "Developer-Centric: Runs in-browser - no infrastructure setup required", "Actionable Telemetry: Exportable post-mortem reports, not just dashboards", "Real Code Execution: Tests actual user code, not simulated scenarios"]);

// 12 - Roadmap
bulletSlide("What's Next for Qoder?", ["Multi-Language Support: Expand chaos injection to Python, Java, C++, Go", "Team Collaboration: Share challenges, post-mortem reports, and resilience scores", "CI/CD Integration: Run chaos tests as part of your deployment pipeline", "Custom Chaos Scenarios: Let users define their own failure modes", "Leaderboards: Compete on resilience scores across universities and teams"]);

// 13 - Closing
titleSlide("Qoder", "Build Resilient Code, Before Production Breaks It", ["", "Chaos engineering is no longer just for Netflix and Amazon", "Every developer deserves a safe space to break their code", "", "Try it. Break it. Fix it. Ship it.", "", "Thank you - Questions?"]);

pptx.writeFile({ fileName: "Qoder_Presentation.pptx" }).then(() => console.log("Saved: Qoder_Presentation.pptx")).catch(e => console.error(e));
