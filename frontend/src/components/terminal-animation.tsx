"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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

      // Restart animation 3 seconds after the last command
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
    <div className="w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-border-strong bg-[#111110] shadow-2xl">
      <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#1A1A1A]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ED6A5E]"></div>
          <div className="w-3 h-3 rounded-full bg-[#F4BF4F]"></div>
          <div className="w-3 h-3 rounded-full bg-[#61C554]"></div>
        </div>
        <div className="mx-auto text-xs font-mono text-[#A3A099]">patchflow-cli</div>
      </div>
      <div className="p-5 font-mono text-sm sm:text-base h-[280px] overflow-y-auto flex flex-col gap-2">
        {commands.slice(0, visibleLines).map((cmd, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            {!cmd.type && <span className="text-[#A3A099] mr-3">❯</span>}
            <span
              className={
                cmd.type === "error"
                  ? "text-[#DC2626]"
                  : cmd.type === "success"
                  ? "text-[#16A34A]"
                  : cmd.type === "system"
                  ? "text-[#6F6B66]"
                  : "text-[#FAFAF9]"
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
          className="w-2 h-5 bg-[#FF5A1F] mt-1 inline-block"
        />
      </div>
    </div>
  );
}
