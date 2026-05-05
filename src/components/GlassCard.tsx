import type { ReactNode } from "react";

export default function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`glass-panel glass-card ${className}`.trim()}>{children}</div>;
}
