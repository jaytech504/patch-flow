"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { appleSprings } from "@/lib/springs";

const commands = [
  { text: "[PatchFlow] Chaos scanning billing-api (FastAPI / Python)...", delay: 800, type: "system" },
  { text: "⚡ Injected failure: Socket timeout + DB drop on /api/v1/orders", delay: 2000, type: "error" },
  { text: "🚨 Unhandled 500: SQLAlchemyError at routes/orders.py:42", delay: 3000, type: "error" },
  { text: "🤖 FixAgent: Synthesized resilient patch with HTTPException & fallback", delay: 4400, type: "system" },
  { text: "🛡️ ReviewAgent: AST syntax verified & error handler validated", delay: 5800, type: "system" },
  { text: "🔨 Compiler: python -m py_compile routes/orders.py passed ✓", delay: 7200, type: "success" },
  { text: "🚀 GitHubAgent: Pull Request #14 opened with merge-ready fix!", delay: 8800, type: "success" },
  { text: "✨ Reliability hardened: API score updated to 98/100.", delay: 10400, type: "system" }
];

export function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    let isActive = true;

    const runAnimation = () => {
      setVisibleLines(0);
      
      commands.forEach((cmd, index) => {
        const timeout = setTimeout(() => {
          if (isActive) setVisibleLines(index + 1);
        }, cmd.delay);
        timeouts.push(timeout);
      });

      // Restart animation 3.5 seconds after the last command
      const resetTimeout = setTimeout(() => {
        if (isActive) runAnimation();
      }, 10800 + 3500);
      timeouts.push(resetTimeout);
    };

    runAnimation();

    return () => {
      isActive = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#111110]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.7)]">
      {/* macOS-style window header */}
      <div className="flex items-center px-4 py-3 border-b border-white/[0.08] bg-[#1A1A18]/80 backdrop-blur-md">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-2xs"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-2xs"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-2xs"></div>
        </div>
        <div className="mx-auto text-[11px] font-mono text-[#8C8881] font-medium tracking-wide">
          patchflow-cli — zsh
        </div>
        <div className="w-12" />
      </div>

      {/* Terminal terminal body */}
      <div className="p-5 font-mono text-[13px] sm:text-[14px] leading-relaxed h-[290px] overflow-y-auto flex flex-col gap-2">
        {commands.slice(0, visibleLines).map((cmd, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={appleSprings.default}
            className="flex items-start"
          >
            {!cmd.type && <span className="text-[#8C8881] mr-2.5 select-none font-bold">❯</span>}
            <span
              className={
                cmd.type === "error"
                  ? "text-[#EF4444] font-medium"
                  : cmd.type === "success"
                  ? "text-[#22C55E] font-medium"
                  : cmd.type === "system"
                  ? "text-[#9C9891]"
                  : "text-[#F5F5F4]"
              }
            >
              {cmd.text}
            </span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="w-2 h-4.5 bg-[#FF5A1F] mt-1 inline-block rounded-xs shadow-[0_0_8px_rgba(255,90,31,0.6)]"
        />
      </div>
    </div>
  );
}
