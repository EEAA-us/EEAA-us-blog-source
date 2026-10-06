"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useEffects, type FallingEffect } from "@/components/providers/EffectProvider";

type ParticleKind = "petal" | "firefly" | "leaf" | "snow" | "star" | "feather";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
  kind: ParticleKind;
  color: string;
}

const palettes: Record<ParticleKind, string[]> = {
  petal: ["#f9a8d4", "#f472b6", "#fbcfe8", "#fda4af", "#fce7f3"],
  firefly: ["#fef08a", "#fde047", "#bef264", "#ffffff"],
  leaf: ["#fbbf24", "#d97706", "#f59e0b", "#ca8a04", "#fde68a"],
  snow: ["#ffffff", "#e0f2fe", "#dbeafe"],
  star: ["#fef08a", "#fde047", "#f9a8d4", "#a5f3fc", "#c4b5fd"],
  feather: ["#ffffff", "#e2e8f0", "#fce7f3", "#e0e7ff"],
};

function seasonalKind(): ParticleKind {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "petal";
  if (month >= 5 && month <= 7) return "firefly";
  if (month >= 8 && month <= 10) return "leaf";
  return "snow";
}

function resolveKind(effect: Exclude<FallingEffect, "none">): ParticleKind {
  if (effect === "seasonal") return seasonalKind();
  if (effect === "sakura") return "petal";
  if (effect === "ginkgo") return "leaf";
  if (effect === "stardust") return "star";
  if (effect === "feathers") return "feather";
  if (effect === "constellation") return "firefly";
  return "snow";
}

function createConstellationParticle(width: number, height: number): Particle {
  const colors = ["#67e8f9", "#c4b5fd", "#f9a8d4", "#fef3c7"];
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    size: 0.9 + Math.random() * 1.8,
    opacity: 0.35 + Math.random() * 0.45,
    rotation: 0,
    rotationSpeed: 0,
    phase: Math.random() * Math.PI * 2,
    kind: "firefly",
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function drawConstellation(context: CanvasRenderingContext2D, items: Particle[], width: number, height: number, pointer: { x: number; y: number; active: boolean }, now: number) {
  const linkDistance = width < 768 ? 92 : 132;
  for (const particle of items) {
    if (pointer.active) {
      const dx = particle.x - pointer.x;
      const dy = particle.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 150) {
        const force = (150 - distance) / 150 * 0.018;
        particle.vx += dx / distance * force;
        particle.vy += dy / distance * force;
      }
    }
    particle.vx *= 0.994;
    particle.vy *= 0.994;
    particle.vx += Math.sin(now * 0.00025 + particle.phase) * 0.0008;
    particle.vy += Math.cos(now * 0.0002 + particle.phase) * 0.0008;
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < -8) particle.x = width + 8;
    if (particle.x > width + 8) particle.x = -8;
    if (particle.y < -8) particle.y = height + 8;
    if (particle.y > height + 8) particle.y = -8;
  }

  context.lineWidth = 0.7;
  for (let first = 0; first < items.length; first++) {
    for (let second = first + 1; second < items.length; second++) {
      const distance = Math.hypot(items[first].x - items[second].x, items[first].y - items[second].y);
      if (distance >= linkDistance) continue;
      context.globalAlpha = (1 - distance / linkDistance) * 0.2;
      const gradient = context.createLinearGradient(items[first].x, items[first].y, items[second].x, items[second].y);
      gradient.addColorStop(0, items[first].color);
      gradient.addColorStop(1, items[second].color);
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(items[first].x, items[first].y);
      context.lineTo(items[second].x, items[second].y);
      context.stroke();
    }
  }

  for (const particle of items) {
    const pulse = 0.72 + Math.sin(now * 0.0018 + particle.phase) * 0.28;
    context.globalAlpha = particle.opacity * pulse;
    const glow = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 5);
    glow.addColorStop(0, particle.color);
    glow.addColorStop(0.25, particle.color);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size * 5, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function createParticle(kind: ParticleKind, width: number, height: number, prefill = false): Particle {
  const upward = kind === "firefly";
  const size = kind === "feather" ? 8 + Math.random() * 8 : kind === "star" ? 3 + Math.random() * 5 : kind === "snow" ? 2 + Math.random() * 4 : 5 + Math.random() * 8;
  return {
    x: Math.random() * width,
    y: prefill ? Math.random() * height : upward ? height + 20 : -20,
    vx: (Math.random() - 0.5) * (kind === "star" ? 1.2 : 0.55),
    vy: upward ? -(0.25 + Math.random() * 0.45) : 0.35 + Math.random() * (kind === "feather" ? 0.35 : 0.75),
    size,
    opacity: 0.4 + Math.random() * 0.5,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * (kind === "feather" ? 0.018 : 0.04),
    phase: Math.random() * Math.PI * 2,
    kind,
    color: palettes[kind][Math.floor(Math.random() * palettes[kind].length)],
  };
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle, now: number) {
  const { kind, size } = particle;
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.globalAlpha = particle.opacity;
  context.fillStyle = particle.color;
  context.strokeStyle = particle.color;

  if (kind === "petal") {
    context.beginPath();
    context.ellipse(0, 0, size / 2, size / 4, 0, 0, Math.PI * 2);
    context.fill();
  } else if (kind === "leaf") {
    context.beginPath();
    context.moveTo(0, -size / 2);
    context.quadraticCurveTo(size / 2, 0, 0, size / 2);
    context.quadraticCurveTo(-size / 2, 0, 0, -size / 2);
    context.fill();
  } else if (kind === "snow") {
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
  } else if (kind === "star") {
    context.beginPath();
    for (let point = 0; point < 8; point++) {
      const angle = point * Math.PI / 4;
      const radius = point % 2 === 0 ? size : size * 0.28;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.closePath();
    context.fill();
  } else if (kind === "feather") {
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(0, 0, size * 0.3, size, 0.25, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha *= 0.7;
    context.beginPath();
    context.moveTo(0, -size);
    context.lineTo(0, size * 1.15);
    context.stroke();
  } else {
    const glow = Math.sin(now * 0.003 + particle.phase) * 0.35 + 0.65;
    context.globalAlpha *= glow;
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, size * 4);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, size * 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export default function SeasonalEffect() {
  const pathname = usePathname();
  const { fallingEffect } = useEffects();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef(0);
  const disabled = pathname?.startsWith("/garden/") || fallingEffect === "none";

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const constellation = fallingEffect === "constellation";
    const kind = resolveKind(fallingEffect);
    const pointer = { x: 0, y: 0, active: false };
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const updatePointer = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true; };
    const clearPointer = () => { pointer.active = false; };
    if (constellation) {
      window.addEventListener("pointermove", updatePointer, { passive: true });
      window.addEventListener("pointerleave", clearPointer);
    }

    const maximum = constellation ? (window.innerWidth < 768 ? 24 : 52) : (window.innerWidth < 768 ? 18 : 36);
    particles.current = Array.from({ length: maximum }, () => constellation ? createConstellationParticle(canvas.width, canvas.height) : createParticle(kind, canvas.width, canvas.height, true));
    let frame = 0;

    const loop = (now: number) => {
      frame += 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (constellation) {
        drawConstellation(context, particles.current, canvas.width, canvas.height, pointer, now);
        animationFrame.current = requestAnimationFrame(loop);
        return;
      }
      if (frame % 28 === 0 && particles.current.length < maximum) particles.current.push(createParticle(kind, canvas.width, canvas.height));
      particles.current = particles.current.filter((particle) => {
        particle.x += particle.vx + Math.sin(now * 0.0015 + particle.phase) * (particle.kind === "feather" ? 0.75 : 0.3);
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;
        const margin = 40;
        return particle.x > -margin && particle.x < canvas.width + margin && particle.y > -margin && particle.y < canvas.height + margin;
      });
      for (const particle of particles.current) drawParticle(context, particle, now);
      animationFrame.current = requestAnimationFrame(loop);
    };
    animationFrame.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", clearPointer);
      cancelAnimationFrame(animationFrame.current);
      particles.current = [];
    };
  }, [disabled, fallingEffect]);

  if (disabled) return null;
  return <canvas ref={canvasRef} className={`fixed inset-0 pointer-events-none ${fallingEffect === "constellation" ? "z-[1]" : "z-[9997]"}`} aria-hidden="true" />;
}
