"use client";

import { useState } from "react";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f59e0b"];

export default function Home() {
  const [colorIndex, setColorIndex] = useState(0);

  const handleClick = () => {
    setColorIndex((prev) => (prev + 1) % COLORS.length);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-950">
      <h1 className="text-4xl font-bold text-white">My First Vibe App</h1>

      <button
        onClick={handleClick}
        data-testid="color-button"
        style={{ backgroundColor: COLORS[colorIndex] }}
        className="rounded-2xl px-10 py-5 text-2xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
      >
        Click me!
      </button>

      <p data-testid="color-display" className="text-lg text-zinc-400">
        Current color: <span className="font-mono text-white">{COLORS[colorIndex]}</span>
      </p>
    </div>
  );
}
