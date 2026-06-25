"use client";

import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type DayData = { label: string; distance: number; dateKey: string };

export default function WeeklyChart({
  lastSevenDays,
  maxGraphDistance
}: {
  lastSevenDays: DayData[];
  maxGraphDistance: number;
}) {
  const labels = lastSevenDays.map((d) => d.label);
  const dataValues = lastSevenDays.map((d) => Number(d.distance.toFixed(2)));

  // Read CSS variables for theming (client-side only)
  const root = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const accent = (root && root.getPropertyValue("--accent")) || "#1f7a5c";
  const muted = (root && root.getPropertyValue("--muted")) || "#6b6b6b";

  const data = {
    labels,
    datasets: [
      {
        label: "Distance (km)",
        data: dataValues,
        backgroundColor: accent.trim() || "#1f7a5c",
        hoverBackgroundColor: (root && root.getPropertyValue("--accent-dark")) || "#145640",
        borderRadius: 6,
        barThickness: 18
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: "easeOutQuart"
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: muted.trim() || "#6b6b6b" }
      },
      y: {
        beginAtZero: true,
        max: Math.max(maxGraphDistance, 5),
        ticks: {
          stepSize: Math.ceil(Math.max(maxGraphDistance, 5) / 4),
          color: muted.trim() || "#6b6b6b"
        },
        grid: { color: "rgba(0,0,0,0.04)" }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: (root && root.getPropertyValue("--panel-solid")) || "#fff",
        titleColor: (root && root.getPropertyValue("--foreground")) || "#222",
        bodyColor: (root && root.getPropertyValue("--foreground")) || "#222",
        padding: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => `${context.parsed.y} km`
        }
      }
    }
  };

  // Add hover cursor behavior
  options.onHover = (event: any, chartElements: any) => {
    try {
      const target = event?.native?.target || event?.target;
      if (target) target.style.cursor = (chartElements && chartElements.length) ? "pointer" : "default";
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="chart-container" style={{ height: 160 }}>
      <Bar data={data} options={options} />
    </div>
  );
}
