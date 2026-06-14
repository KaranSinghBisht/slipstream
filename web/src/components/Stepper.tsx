import { CheckIcon } from "@phosphor-icons/react";

const STEPS = ["Guardrails", "Squad", "Guard"];

export function Stepper({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-tight transition-colors ${
                current
                  ? "bg-accent/12 text-accent ring-1 ring-accent/30"
                  : done
                    ? "text-fg"
                    : "text-faint"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  current ? "bg-accent text-[#04130d]" : done ? "bg-accent/20 text-accent" : "bg-white/5 text-faint"
                }`}
              >
                {done ? <CheckIcon size={10} weight="bold" /> : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-5 bg-line" />}
          </div>
        );
      })}
    </div>
  );
}
