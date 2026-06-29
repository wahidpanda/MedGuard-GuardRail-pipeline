import { useEffect, useState } from "react";

const STAGES = [
  { key: "injection", label: "Injection", grName: "Prompt Injection" },
  { key: "toxicity", label: "Safety", grName: "Safety & Toxicity" },
  { key: "pii", label: "PII Redact", grName: "PII Detection" },
  { key: "retrieve", label: "Retrieve", grName: null },
  { key: "generate", label: "Generate", grName: null },
  { key: "grounded", label: "Groundedness", grName: "Groundedness" },
];

const STATUS_COLOR = { pass: "var(--pass)", flag: "var(--flag)", block: "var(--block)" };

function stageState(stage, result, animatedTo) {
  const idx = STAGES.findIndex((s) => s.key === stage.key);
  if (idx > animatedTo) return { phase: "idle", color: "var(--line)" };
  if (!result) return { phase: "active", color: "var(--teal)" };

  const allGr = [...(result.input_guardrails || []), ...(result.output_guardrails || [])];
  const gr = stage.grName ? allGr.find((g) => g.name === stage.grName) : null;
  if (gr) return { phase: "done", color: STATUS_COLOR[gr.status] || "var(--teal)", gr };

  // retrieve/generate stages: skipped if blocked at input
  if (result.blocked && (stage.key === "retrieve" || stage.key === "generate")) {
    const inputBlocked = (result.input_guardrails || []).some((g) => g.status === "block");
    if (inputBlocked) return { phase: "skip", color: "var(--line)" };
  }
  return { phase: "done", color: "var(--teal)" };
}

export default function PipelineRail({ result, running }) {
  const [animatedTo, setAnimatedTo] = useState(-1);

  useEffect(() => {
    if (running) {
      setAnimatedTo(-1);
      let i = -1;
      const id = setInterval(() => {
        i += 1;
        setAnimatedTo(i);
        if (i >= STAGES.length - 1) clearInterval(id);
      }, 220);
      return () => clearInterval(id);
    } else if (result) {
      setAnimatedTo(STAGES.length - 1);
    }
  }, [running, result]);

  return (
    <div className="rail">
      <div className="rail-head">
        <span className="rail-title">Request pipeline</span>
        <span className="rail-sub mono">input → retrieve → generate → output</span>
      </div>
      <div className="rail-track">
        {STAGES.map((stage, i) => {
          const st = stageState(stage, result, animatedTo);
          return (
            <div className="rail-node-wrap" key={stage.key}>
              <div
                className={`rail-node ${st.phase}`}
                style={{ "--c": st.color }}
                title={st.gr ? st.gr.detail : stage.label}
              >
                <span className="rail-dot" />
              </div>
              <span className="rail-label">{stage.label}</span>
              {st.gr && (
                <span className="rail-score mono" style={{ color: st.color }}>
                  {st.gr.status}
                </span>
              )}
              {i < STAGES.length - 1 && (
                <span
                  className={`rail-link ${animatedTo > i ? "lit" : ""}`}
                  style={{ "--c": animatedTo > i ? "var(--teal)" : "var(--line)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .rail {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 18px 20px 22px;
        }
        .rail-head { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; gap:12px; flex-wrap:wrap; }
        .rail-title { font-family: var(--serif); font-size: 17px; letter-spacing: 0.2px; }
        .rail-sub { font-size: 11px; color: var(--ink-mute); }
        .rail-track { display:flex; align-items:flex-start; justify-content:space-between; position:relative; }
        .rail-node-wrap { display:flex; flex-direction:column; align-items:center; position:relative; flex:1; min-width:0; }
        .rail-node {
          width: 30px; height: 30px; border-radius: 50%;
          border: 1.5px solid var(--c);
          display:flex; align-items:center; justify-content:center;
          background: var(--bg-elevated);
          transition: border-color .35s ease, box-shadow .35s ease;
          z-index: 2;
        }
        .rail-dot { width:8px; height:8px; border-radius:50%; background: var(--c); transition: background .35s ease; }
        .rail-node.idle .rail-dot { background: var(--line); }
        .rail-node.active { box-shadow: 0 0 0 5px color-mix(in srgb, var(--teal) 18%, transparent); animation: pulse 1s infinite; }
        .rail-node.skip { opacity: .4; }
        .rail-label { font-size: 10.5px; color: var(--ink-soft); margin-top: 9px; text-align:center; letter-spacing:.2px; }
        .rail-score { font-size: 9.5px; margin-top: 3px; text-transform: uppercase; letter-spacing:.5px; }
        .rail-link {
          position:absolute; top:15px; left:50%; width:100%; height:1.5px;
          background: var(--c); transform-origin:left; z-index:1;
          transition: background .4s ease;
        }
        .rail-link.lit { background: var(--teal); }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 22%,transparent);} 50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--teal) 6%,transparent);} }
      `}</style>
    </div>
  );
}
