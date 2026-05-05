import type { Difficulty } from "./types";

import badgeUrl from "../assets/share/badge.svg?url";

export interface ShareCardData {
  modeName: string;
  difficulty: Difficulty;
  elapsedLabel: string;
  scoreLabel: string;
  hintsLabel: string;
  pokemonName: string;
  pokemonImageUrl: string;
}

export async function createShareImage(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvasが利用できません。");
  }

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#fff8e9");
  grad.addColorStop(1, "#e7efe8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#2f2c28";
  ctx.fillRect(50, 50, 1100, 530);
  ctx.fillStyle = "#f4efe5";
  ctx.fillRect(64, 64, 1072, 502);

  const [pokeImage, badgeImage] = await Promise.all([
    loadImage(data.pokemonImageUrl).catch(() => null),
    loadImage(badgeUrl),
  ]);

  ctx.drawImage(badgeImage, 88, 82, 80, 80);
  ctx.font = "900 42px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "#2f2c28";
  ctx.fillText(data.modeName, 190, 140);

  ctx.font = "700 28px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "#7b5c2d";
  ctx.fillText("RESULT", 92, 210);

  drawPanel(ctx, 92, 236, 550, 300);
  drawRow(ctx, "TIME", data.elapsedLabel, 128, 296);
  drawRow(ctx, "SCORE", data.scoreLabel, 128, 360);
  drawRow(ctx, "HINTS", data.hintsLabel, 128, 424);

  ctx.fillStyle = "#5d4a32";
  ctx.font = "700 26px 'Noto Sans JP', sans-serif";
  ctx.fillText(`相棒: ${data.pokemonName}`, 92, 526);

  drawPanel(ctx, 700, 150, 392, 392);
  if (pokeImage) {
    ctx.drawImage(pokeImage, 734, 184, 324, 324);
  } else {
    ctx.fillStyle = "#d8c9ad";
    ctx.font = "900 92px 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("?", 896, 372);
    ctx.textAlign = "left";
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("共有画像の生成に失敗しました。"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#cfb78c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawRow(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number): void {
  ctx.fillStyle = "#7d7b75";
  ctx.font = "700 22px 'Noto Sans JP', sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#222";
  ctx.font = "900 42px 'Noto Sans JP', sans-serif";
  ctx.fillText(value, x, y + 44);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`画像読み込みに失敗: ${src}`));
    image.src = src;
  });
}

export function buildShareText(mode: Difficulty, modeName: string, elapsedLabel: string, scoreLabel: string): string {
  if (mode === "silhouette") {
    return `シルエットTAを完走！\n${modeName}\nタイム ${elapsedLabel} が出ました！\nスコア ${scoreLabel}\n#ポケモンクイズ`;
  }

  if (mode === "trainer") {
    return `バトル知識で挑戦！\n${modeName}\nスコア ${scoreLabel} / タイム ${elapsedLabel}\n#ポケモンクイズ`;
  }

  if (mode === "professor") {
    return `博士モードで図鑑力を検証！\n${modeName}\nスコア ${scoreLabel} / タイム ${elapsedLabel}\n#ポケモンクイズ`;
  }

  return `${modeName} をクリア！\nスコア ${scoreLabel} / タイム ${elapsedLabel}\n#ポケモンクイズ`;
}
