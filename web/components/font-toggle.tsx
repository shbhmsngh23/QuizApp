"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";

export function FontToggle() {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("dyslexic-font") === "true";
    setEnabled(stored);
    document.body.classList.toggle("font-dyslexic", stored);
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    window.localStorage.setItem("dyslexic-font", String(checked));
    document.body.classList.toggle("font-dyslexic", checked);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">Dyslexia font</span>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
    </div>
  );
}
