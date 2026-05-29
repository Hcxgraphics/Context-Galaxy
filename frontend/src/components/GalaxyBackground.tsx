"use client";

import React, { useEffect, useRef } from "react";

export default function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle class
    class Star {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      alpha: number;
      alphaSpeed: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.5 + 0.2;
        this.speedX = Math.random() * 0.15 - 0.075;
        this.speedY = Math.random() * 0.15 - 0.075;
        this.alpha = Math.random();
        this.alphaSpeed = Math.random() * 0.015 + 0.005;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Wrap around boundaries
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        // Twinkle effect
        this.alpha += this.alphaSpeed;
        if (this.alpha > 1 || this.alpha < 0.2) {
          this.alphaSpeed = -this.alphaSpeed;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = this.alpha;
        c.fillStyle = "#ffffff";
        c.shadowBlur = this.size * 3;
        c.shadowColor = "#a78bfa";
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    // Initialize particles
    const starCount = 120;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push(new Star());
    }

    // Track mouse coordinates for parallax overlay reaction
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Render loop
    const render = () => {
      // Direct mouse ease filter
      mouseX += (targetMouseX - mouseX) * 0.03;
      mouseY += (targetMouseY - mouseY) * 0.03;

      // Draw dark starry sky and glowing nebula gradients
      ctx.fillStyle = "#010105";
      ctx.fillRect(0, 0, width, height);

      // Nebula 1 (Rose Glow)
      const grad1 = ctx.createRadialGradient(
        width * 0.3 + (mouseX - width / 2) * 0.05,
        height * 0.4 + (mouseY - height / 2) * 0.05,
        0,
        width * 0.3,
        height * 0.4,
        Math.max(width * 0.5, 400)
      );
      grad1.addColorStop(0, "rgba(244, 63, 94, 0.07)");
      grad1.addColorStop(0.5, "rgba(139, 92, 246, 0.02)");
      grad1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Nebula 2 (Indigo Core Glow)
      const grad2 = ctx.createRadialGradient(
        width * 0.7 - (mouseX - width / 2) * 0.08,
        height * 0.6 - (mouseY - height / 2) * 0.08,
        0,
        width * 0.7,
        height * 0.6,
        Math.max(width * 0.6, 500)
      );
      grad2.addColorStop(0, "rgba(99, 102, 241, 0.06)");
      grad2.addColorStop(0.4, "rgba(6, 182, 212, 0.02)");
      grad2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Update and draw stars with parallax shifts
      stars.forEach((star) => {
        star.update();
        // Translate coordinates slightly based on mouse offset to simulate deep depth
        const shiftX = (mouseX - width / 2) * (star.size * 0.015);
        const shiftY = (mouseY - height / 2) * (star.size * 0.015);
        
        ctx.save();
        ctx.translate(shiftX, shiftY);
        star.draw(ctx);
        ctx.restore();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    // Cleanups
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.9 }}
    />
  );
}
