"use client";

import { CATEGORIES } from "@/lib/context-sections";
import ProgressBar from "./ProgressBar";

interface SidebarProps {
  activeSection: string;
  onSelect: (sectionId: string) => void;
  status: Record<string, boolean>;
}

export default function Sidebar({ activeSection, onSelect, status }: SidebarProps) {
  const totalSections = CATEGORIES.flatMap((c) => c.sections).length;
  const filledSections = Object.values(status).filter(Boolean).length;

  return (
    <aside className="w-[280px] shrink-0 bg-surface border-r border-border sticky top-[57px] self-start h-[calc(100vh-57px)] overflow-y-auto">
      <div className="pt-5">
        <ProgressBar filled={filledSections} total={totalSections} />
      </div>

      <nav className="pb-6">
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="mt-2">
            <div className="px-5 py-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold shrink-0">
                  {cat.number}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{cat.title}</div>
                  <div className="text-[10px] text-muted truncate">{cat.subtitle}</div>
                </div>
              </div>
            </div>

            <ul className="mt-0.5">
              {cat.sections.map((section) => {
                const isActive = activeSection === section.id;
                const isComplete = status[section.id] ?? false;

                return (
                  <li key={section.id}>
                    <button
                      onClick={() => onSelect(section.id)}
                      className={`w-full text-left px-5 py-1.5 text-sm flex items-center gap-2.5 transition-colors ${
                        isActive
                          ? "bg-accent-light text-accent font-medium"
                          : "text-muted hover:text-foreground hover:bg-background"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isComplete ? "bg-success" : "bg-border"
                        }`}
                      />
                      <span className="truncate">{section.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
