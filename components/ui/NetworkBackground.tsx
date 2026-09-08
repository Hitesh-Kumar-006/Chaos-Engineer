"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Packet {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_COUNT = 40;
const MAX_LINK_DIST = 160;
const PACKET_COUNT = 12;
const NODE_SPEED = 0.3;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  // Keep theme ref in sync without re-running the animation loop
  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let w = 0;
    let h = 0;

    /* ---- Resize --------------------------------------------------- */
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w;
      canvas!.height = h;
    }
    resize();
    window.addEventListener("resize", resize);

    /* ---- Initialise nodes ----------------------------------------- */
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * NODE_SPEED * 2,
      vy: (Math.random() - 0.5) * NODE_SPEED * 2,
      radius: 2 + Math.random() * 2,
    }));

    /* ---- Initialise packets --------------------------------------- */
    const packets: Packet[] = Array.from({ length: PACKET_COUNT }, () => ({
      fromNode: Math.floor(Math.random() * NODE_COUNT),
      toNode: Math.floor(Math.random() * NODE_COUNT),
      progress: Math.random(),
      speed: 0.003 + Math.random() * 0.006,
    }));

    /* ---- Animation loop ------------------------------------------- */
    function frame() {
      const isDark = themeRef.current === "dark";

      // Clear
      ctx!.clearRect(0, 0, w, h);

      // Move nodes
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
      }

      // Draw links
      const linkColor = isDark ? "rgba(100,180,255,0.08)" : "rgba(50,100,200,0.07)";
      ctx!.strokeStyle = linkColor;
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_LINK_DIST) {
            const alpha = 1 - dist / MAX_LINK_DIST;
            ctx!.globalAlpha = alpha;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }
      ctx!.globalAlpha = 1;

      // Draw nodes
      const nodeColor = isDark ? "rgba(100,200,255,0.5)" : "rgba(60,120,220,0.45)";
      ctx!.fillStyle = nodeColor;
      for (const node of nodes) {
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Draw packets
      const packetColor = isDark ? "#60a5fa" : "#3b82f6";
      ctx!.fillStyle = packetColor;
      for (const pkt of packets) {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          pkt.progress = 0;
          pkt.fromNode = pkt.toNode;
          pkt.toNode = Math.floor(Math.random() * NODE_COUNT);
        }
        const from = nodes[pkt.fromNode];
        const to = nodes[pkt.toNode];
        const px = from.x + (to.x - from.x) * pkt.progress;
        const py = from.y + (to.y - from.y) * pkt.progress;

        // Glow
        ctx!.shadowColor = packetColor;
        ctx!.shadowBlur = 8;
        ctx!.beginPath();
        ctx!.arc(px, py, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      animId = requestAnimationFrame(frame);
    }
    animId = requestAnimationFrame(frame);

    /* ---- Cleanup -------------------------------------------------- */
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []); // Runs once on mount

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
