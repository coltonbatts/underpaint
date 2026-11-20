/**
 * Generates a rich, classic studio still-life reference image on an offscreen
 * canvas so beginners can try Underpaint in a single click without uploading a photo.
 */
export async function generateSampleStudyBlob(): Promise<Blob> {
  const w = 1200;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize sample canvas.");
  }

  // 1. Moody cool-slate studio backdrop with warm upper-left window glow
  const bgGrad = ctx.createRadialGradient(260, 180, 60, 600, 420, 960);
  bgGrad.addColorStop(0, "#4e5c6b");
  bgGrad.addColorStop(0.45, "#2f3a47");
  bgGrad.addColorStop(1, "#161b22");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle sunlit window wash across the backdrop
  const beamGrad = ctx.createLinearGradient(0, 0, 820, 620);
  beamGrad.addColorStop(0, "rgba(255, 232, 194, 0.16)");
  beamGrad.addColorStop(0.55, "rgba(255, 224, 180, 0.04)");
  beamGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Warm walnut tabletop
  const tableTopY = 585;
  const tableGrad = ctx.createLinearGradient(0, tableTopY, 0, h);
  tableGrad.addColorStop(0, "#5c402c");
  tableGrad.addColorStop(0.35, "#472f20");
  tableGrad.addColorStop(1, "#241710");
  ctx.fillStyle = tableGrad;
  ctx.fillRect(0, tableTopY, w, h - tableTopY);

  // Tabletop horizon bevel highlight
  ctx.fillStyle = "rgba(235, 200, 155, 0.14)";
  ctx.fillRect(0, tableTopY, w, 4);

  // 3. Soft cream-ochre linen cloth draped across the right/center of the table
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(290, 610);
  ctx.quadraticCurveTo(560, 568, 860, 598);
  ctx.quadraticCurveTo(1060, 625, 1180, 745);
  ctx.lineTo(1180, h);
  ctx.lineTo(175, h);
  ctx.quadraticCurveTo(220, 700, 290, 610);
  ctx.closePath();

  const clothGrad = ctx.createLinearGradient(240, 580, 980, 890);
  clothGrad.addColorStop(0, "#e2d4bc");
  clothGrad.addColorStop(0.45, "#c5b396");
  clothGrad.addColorStop(0.8, "#8c7a61");
  clothGrad.addColorStop(1, "#5c4e3d");
  ctx.fillStyle = clothGrad;
  ctx.fill();

  // Soft linen fold shadows
  ctx.fillStyle = "rgba(58, 43, 30, 0.24)";
  ctx.beginPath();
  ctx.moveTo(460, 690);
  ctx.quadraticCurveTo(640, 760, 820, 900);
  ctx.lineTo(660, 900);
  ctx.quadraticCurveTo(550, 785, 460, 690);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 248, 234, 0.28)";
  ctx.beginPath();
  ctx.moveTo(295, 622);
  ctx.quadraticCurveTo(445, 650, 520, 790);
  ctx.quadraticCurveTo(400, 730, 295, 622);
  ctx.fill();
  ctx.restore();

  // 4. Cast shadows on the table/cloth (warm deep umber-slate)
  const drawCastShadow = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    alpha: number
  ) => {
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx);
    g.addColorStop(0, `rgba(24, 18, 16, ${alpha})`);
    g.addColorStop(0.6, `rgba(34, 24, 22, ${alpha * 0.55})`);
    g.addColorStop(1, "rgba(34, 24, 22, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawCastShadow(560, 685, 235, 58, 0.72); // Pitcher shadow
  drawCastShadow(730, 735, 165, 42, 0.68); // Oranges shadow
  drawCastShadow(900, 715, 150, 38, 0.62); // Pear shadow

  // 5. Terracotta ceramic pitcher (left-center hero)
  ctx.save();
  // Pitcher handle
  ctx.strokeStyle = "#8a4225";
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(410, 325);
  ctx.bezierCurveTo(285, 315, 275, 495, 385, 535);
  ctx.stroke();

  // Warm rim highlight along handle
  ctx.strokeStyle = "rgba(235, 158, 108, 0.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(395, 324);
  ctx.bezierCurveTo(295, 322, 285, 468, 365, 518);
  ctx.stroke();

  // Pitcher silhouette
  ctx.beginPath();
  ctx.moveTo(418, 250);
  ctx.quadraticCurveTo(465, 238, 526, 252); // spout rim
  ctx.bezierCurveTo(506, 305, 508, 348, 558, 412);
  ctx.bezierCurveTo(616, 488, 608, 605, 535, 672);
  ctx.quadraticCurveTo(468, 694, 398, 670);
  ctx.bezierCurveTo(324, 600, 326, 482, 384, 410);
  ctx.bezierCurveTo(426, 355, 428, 305, 418, 250);
  ctx.closePath();

  const pitcherGrad = ctx.createRadialGradient(405, 455, 22, 472, 485, 215);
  pitcherGrad.addColorStop(0, "#e38c54");
  pitcherGrad.addColorStop(0.32, "#bd5c31");
  pitcherGrad.addColorStop(0.68, "#7c331c");
  pitcherGrad.addColorStop(0.92, "#461b12");
  pitcherGrad.addColorStop(1, "#5c3429"); // subtle bounce light on far shadow edge
  ctx.fillStyle = pitcherGrad;
  ctx.fill();

  // Pitcher glossy specular highlight
  const specGrad = ctx.createRadialGradient(408, 462, 4, 412, 470, 56);
  specGrad.addColorStop(0, "rgba(255, 245, 228, 0.92)");
  specGrad.addColorStop(0.45, "rgba(255, 214, 172, 0.35)");
  specGrad.addColorStop(1, "rgba(255, 214, 172, 0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(412, 468, 26, 54, -0.22, 0, Math.PI * 2);
  ctx.fill();

  // Pitcher dark mouth interior
  ctx.fillStyle = "#24110c";
  ctx.beginPath();
  ctx.ellipse(472, 252, 54, 14, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Back orange (slightly deeper, warm shadowed orange)
  const drawOrange = (
    cx: number,
    cy: number,
    r: number,
    bright: boolean
  ) => {
    ctx.save();
    const g = ctx.createRadialGradient(
      cx - r * 0.32,
      cy - r * 0.34,
      r * 0.06,
      cx,
      cy,
      r * 1.04
    );
    if (bright) {
      g.addColorStop(0, "#ffd17a");
      g.addColorStop(0.24, "#f08c28");
      g.addColorStop(0.65, "#c45114");
      g.addColorStop(0.9, "#6d250a");
      g.addColorStop(1, "#893b1a"); // warm cloth bounce light
    } else {
      g.addColorStop(0, "#e9a246");
      g.addColorStop(0.35, "#c5601a");
      g.addColorStop(0.75, "#7e2f0e");
      g.addColorStop(1, "#4a1b08");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Crisp specular light dot
    const hi = ctx.createRadialGradient(
      cx - r * 0.34,
      cy - r * 0.36,
      2,
      cx - r * 0.34,
      cy - r * 0.36,
      r * 0.32
    );
    hi.addColorStop(0, bright ? "rgba(255, 250, 232, 0.85)" : "rgba(255, 226, 175, 0.45)");
    hi.addColorStop(1, "rgba(255, 240, 200, 0)");
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.arc(cx - r * 0.34, cy - r * 0.36, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawOrange(740, 622, 74, false);

  // 7. Olive-green leaf tucked behind the front orange
  ctx.save();
  ctx.translate(658, 594);
  ctx.rotate(-0.48);
  const leafGrad = ctx.createLinearGradient(-55, -20, 65, 20);
  leafGrad.addColorStop(0, "#8ea352");
  leafGrad.addColorStop(0.55, "#4d6630");
  leafGrad.addColorStop(1, "#27381a");
  ctx.fillStyle = leafGrad;
  ctx.beginPath();
  ctx.moveTo(-62, 0);
  ctx.quadraticCurveTo(0, -34, 68, 0);
  ctx.quadraticCurveTo(0, 30, -62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(210, 224, 150, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-54, 0);
  ctx.lineTo(54, 0);
  ctx.stroke();
  ctx.restore();

  // 8. Front hero orange
  drawOrange(652, 675, 84, true);

  // 9. Golden-green pear resting to the right
  ctx.save();
  ctx.translate(855, 620);
  ctx.rotate(0.14);
  ctx.beginPath();
  ctx.moveTo(0, -108);
  ctx.bezierCurveTo(32, -104, 42, -55, 58, -16);
  ctx.bezierCurveTo(84, 40, 64, 108, 0, 112);
  ctx.bezierCurveTo(-64, 108, -82, 42, -56, -16);
  ctx.bezierCurveTo(-40, -56, -30, -104, 0, -108);
  ctx.closePath();

  const pearGrad = ctx.createRadialGradient(-26, -18, 12, 8, 20, 125);
  pearGrad.addColorStop(0, "#ece088");
  pearGrad.addColorStop(0.35, "#b8b04d");
  pearGrad.addColorStop(0.72, "#6d6e2c");
  pearGrad.addColorStop(1, "#373c1a");
  ctx.fillStyle = pearGrad;
  ctx.fill();

  // Warm rosy blush on pear cheek
  const blushGrad = ctx.createRadialGradient(-24, 30, 6, -24, 30, 52);
  blushGrad.addColorStop(0, "rgba(210, 96, 48, 0.42)");
  blushGrad.addColorStop(1, "rgba(210, 96, 48, 0)");
  ctx.fillStyle = blushGrad;
  ctx.fill();

  // Pear specular highlight
  ctx.fillStyle = "rgba(255, 252, 224, 0.65)";
  ctx.beginPath();
  ctx.ellipse(-28, 14, 10, 22, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Pear stem
  ctx.strokeStyle = "#3a2416";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -106);
  ctx.quadraticCurveTo(6, -132, 18, -142);
  ctx.stroke();
  ctx.restore();

  // 10. Subtle organic paint/photo grain so flat gradients feel natural
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  let seed = 1337;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed & 255) / 255 - 0.5) * 9;
    d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n));
    d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n));
    d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create sample study image."));
      },
      "image/jpeg",
      0.92
    );
  });
}
