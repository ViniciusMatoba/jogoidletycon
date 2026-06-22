from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


FRAME = 65


def is_key_pixel(r: int, g: int, b: int, a: int, key: str = "magenta") -> bool:
    if a <= 0:
        return True
    if key == "green":
        if g > 185 and r < 115 and b < 115:
            return True
        if g > 145 and r < 100 and b < 120 and g > r + 40 and g > b + 40:
            return True
        return False
    if r > 185 and b > 170 and g < 110:
        return True
    if r > 140 and b > 130 and g < 95 and abs(r - b) < 105:
        return True
    return False


def remove_key(src: Image.Image, key: str) -> Image.Image:
    src = src.convert("RGBA")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    src_px = src.load()
    out_px = out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src_px[x, y]
            if is_key_pixel(r, g, b, a, key):
                continue
            if key == "green" and g > 110 and r < 160 and b < 160:
                g = min(g, max(r, b) + 35)
            elif r > 110 and b > 100 and g < 105:
                b = min(b, max(g + 32, 55))
                r = min(r, 175)
            out_px[x, y] = (r, g, b, 255)
    return out


def components(img: Image.Image) -> list[dict]:
    px = img.load()
    seen: set[tuple[int, int]] = set()
    out = []
    for y in range(img.height):
        for x in range(img.width):
            if (x, y) in seen or px[x, y][3] <= 8:
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < img.width and 0 <= ny < img.height and (nx, ny) not in seen and px[nx, ny][3] > 8:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            if len(pts) > 850:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                out.append({"bbox": (min(xs), min(ys), max(xs) + 1, max(ys) + 1), "size": len(pts)})
    return out


def cluster_rows(comps: list[dict]) -> list[list[dict]]:
    comps = sorted(comps, key=lambda c: (c["bbox"][1] + c["bbox"][3]) / 2)
    rows: list[list[dict]] = []
    for comp in comps:
        cy = (comp["bbox"][1] + comp["bbox"][3]) / 2
        for row in rows:
            rcy = sum((c["bbox"][1] + c["bbox"][3]) / 2 for c in row) / len(row)
            if abs(cy - rcy) < 115:
                row.append(comp)
                break
        else:
            rows.append([comp])
    rows = [sorted(row, key=lambda c: c["bbox"][0]) for row in rows]
    return sorted(rows, key=lambda row: sum((c["bbox"][1] + c["bbox"][3]) / 2 for c in row) / len(row))


def clean_frame(frame: Image.Image, key: str) -> Image.Image:
    frame = frame.convert("RGBA")
    px = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = px[x, y]
            if a and (a < 18 or is_key_pixel(r, g, b, a, key)):
                px[x, y] = (0, 0, 0, 0)

    seen: set[tuple[int, int]] = set()
    comps: list[list[tuple[int, int]]] = []
    for y in range(frame.height):
        for x in range(frame.width):
            if (x, y) in seen or px[x, y][3] <= 8:
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            comp = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < frame.width and 0 <= ny < frame.height and (nx, ny) not in seen and px[nx, ny][3] > 8:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            comps.append(comp)
    if comps:
        largest = max(comps, key=len)
        keep = set(largest)
        remove = [pt for comp in comps for pt in comp if pt not in keep]
    else:
        remove = []
    for x, y in remove:
        px[x, y] = (0, 0, 0, 0)
    return frame


def normalize_count(frames: list[Image.Image], expected: int) -> list[Image.Image]:
    if len(frames) >= expected:
        return frames[:expected]
    if not frames:
        raise ValueError("No frames detected for row")
    while len(frames) < expected:
        frames.append(frames[-1].copy())
    return frames


def frame_from_component(alpha: Image.Image, comp: dict, max_w: int, max_h: int, key: str) -> Image.Image:
    x1, y1, x2, y2 = comp["bbox"]
    pad = max(10, int(max(x2 - x1, y2 - y1) * 0.08))
    crop = alpha.crop((max(0, x1 - pad), max(0, y1 - pad), min(alpha.width, x2 + pad), min(alpha.height, y2 + pad)))
    scale = min(max_w / crop.width, max_h / crop.height)
    nw = max(1, round(crop.width * scale))
    nh = max(1, round(crop.height * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    frame.alpha_composite(resized, ((FRAME - nw) // 2, FRAME - nh - 2))
    return clean_frame(frame, key)


def save_strip(frames: list[Image.Image], path: Path) -> Image.Image:
    strip = Image.new("RGBA", (len(frames) * FRAME, FRAME), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * FRAME, 0))
    strip.save(path)
    return strip


def save_gif(strip: Image.Image, frame_count: int, path: Path, duration: int) -> None:
    frames = [strip.crop((i * FRAME, 0, (i + 1) * FRAME, FRAME)) for i in range(frame_count)]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration, loop=0, disposal=2, transparency=0)


def build_preview_html(slug: str, display_name: str, outdir: Path) -> None:
    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Simulacao Pet {display_name}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; min-height: 100vh; overflow: hidden; background: #111419; color: #f3dfaa; font-family: system-ui, sans-serif; }}
    canvas {{ display: block; width: 100vw; height: 100vh; image-rendering: pixelated; image-rendering: crisp-edges; background: #6ea53e; }}
    .hud {{ position: fixed; left: 8px; right: 8px; top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 9px; border: 1px solid rgba(95, 68, 36, 0.9); background: rgba(16, 19, 23, 0.78); font-size: 12px; pointer-events: none; }}
    .hud strong {{ color: #fff3bc; }}
    .hud span {{ color: #c6b27a; }}
  </style>
</head>
<body>
  <canvas id="scene"></canvas>
  <div class="hud"><strong>{display_name} pet</strong><span>idle + walk + costas</span></div>
  <script>
    const canvas = document.getElementById('scene');
    const ctx = canvas.getContext('2d');
    const idle = new Image();
    const walk = new Image();
    const backWalk = new Image();
    idle.src = '{slug}_engine_idle_strip.png';
    walk.src = '{slug}_engine_walk_strip.png';
    backWalk.src = '{slug}_engine_back_walk_strip.png';
    const pet = {{ x: innerWidth * 0.5, y: Math.max(220, innerHeight * 0.68), targetX: innerWidth * 0.5, targetY: 110, speed: 78, wait: 0.5, state: 'walk', dirY: -1, dirX: 1 }};
    let last = performance.now();
    let time = 0;
    function resize() {{ const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; }}
    function chooseTarget(preferBack = false) {{ const marginX = Math.max(42, innerWidth * 0.08); const top = 78; const bottom = Math.max(top + 80, innerHeight - 58); if (preferBack) {{ pet.targetX = innerWidth * 0.5; pet.targetY = top + 34; return; }} pet.targetX = marginX + Math.random() * Math.max(80, innerWidth - marginX * 2); pet.targetY = top + Math.random() * Math.max(90, bottom - top); }}
    function drawIsoGround() {{ const w = innerWidth; const h = innerHeight; const grd = ctx.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#79ad42'); grd.addColorStop(1, '#5e9236'); ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h); const tileW = 72; const tileH = 36; const cols = Math.ceil(w / tileW) + 10; const rows = Math.ceil(h / tileH) + 10; const originX = w / 2; const originY = -tileH * 2; for (let row = -rows; row < rows; row++) {{ for (let col = -cols; col < cols; col++) {{ const x = originX + (col - row) * tileW / 2; const y = originY + (col + row) * tileH / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tileW / 2, y + tileH / 2); ctx.lineTo(x, y + tileH); ctx.lineTo(x - tileW / 2, y + tileH / 2); ctx.closePath(); ctx.strokeStyle = (col + row) % 2 === 0 ? 'rgba(214,166,41,.22)' : 'rgba(47,125,58,.28)'; ctx.stroke(); }} }} drawProp(w * 0.2, h * 0.26, '#8a5a2d', '#d8b47a'); drawProp(w * 0.78, h * 0.22, '#6d6f73', '#c5c8ba'); drawTree(w * 0.15, h * 0.72); drawTree(w * 0.84, h * 0.67); }}
    function drawProp(x, y, wall, roof) {{ ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(30, 38, 24, 0.22)'; ctx.beginPath(); ctx.ellipse(0, 42, 38, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = wall; ctx.fillRect(-24, 0, 48, 38); ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-32, 2); ctx.lineTo(0, -20); ctx.lineTo(32, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#302016'; ctx.fillRect(-5, 18, 10, 20); ctx.restore(); }}
    function drawTree(x, y) {{ ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(30, 38, 24, 0.2)'; ctx.beginPath(); ctx.ellipse(0, 24, 24, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#5a3924'; ctx.fillRect(-4, 3, 8, 24); ctx.fillStyle = '#2f6e3b'; ctx.beginPath(); ctx.arc(0, -8, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3d8748'; ctx.beginPath(); ctx.arc(-8, -2, 14, 0, Math.PI * 2); ctx.arc(9, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }}
    function update(dt) {{ time += dt; const dx = pet.targetX - pet.x; const dy = pet.targetY - pet.y; const dist = Math.hypot(dx, dy); if (dist < 5) {{ pet.state = 'idle'; pet.wait -= dt; if (pet.wait <= 0) {{ chooseTarget(); pet.wait = 0.45 + Math.random() * 1.2; }} return; }} pet.state = 'walk'; pet.dirY = dy < -4 ? -1 : 1; pet.dirX = dx < -4 ? -1 : 1; const step = Math.min(dist, pet.speed * dt); pet.x += dx / dist * step; pet.y += dy / dist * step; }}
    function drawPet() {{ const sheet = pet.state === 'idle' ? idle : (pet.dirY < 0 ? backWalk : walk); const frames = pet.state === 'idle' ? 6 : 8; const fps = pet.state === 'idle' ? 7 : 10; const frame = Math.floor(time * fps) % frames; const size = Math.max(54, Math.min(72, innerWidth * 0.14)); const drawX = Math.round(pet.x - size / 2); const drawY = Math.round(pet.y - size + 10); const flipX = pet.state === 'walk' && pet.dirY >= 0 && pet.dirX < 0; ctx.fillStyle = 'rgba(22, 28, 20, 0.28)'; ctx.beginPath(); ctx.ellipse(pet.x, pet.y + 8, size * 0.3, size * 0.09, 0, 0, Math.PI * 2); ctx.fill(); if (sheet.complete) {{ ctx.save(); if (flipX) {{ ctx.translate(drawX + size, drawY); ctx.scale(-1, 1); ctx.drawImage(sheet, frame * 65, 0, 65, 65, 0, 0, size, size); }} else {{ ctx.drawImage(sheet, frame * 65, 0, 65, 65, drawX, drawY, size, size); }} ctx.restore(); }} }}
    function loop(now) {{ const dt = Math.min(0.05, (now - last) / 1000); last = now; resize(); update(dt); drawIsoGround(); drawPet(); requestAnimationFrame(loop); }}
    chooseTarget(true); requestAnimationFrame(loop);
  </script>
</body>
</html>
"""
    (outdir / "game-sim.html").write_text(html, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--out-root", default="assets/sprites/pets")
    parser.add_argument("--key", choices=("magenta", "green"), default="magenta")
    args = parser.parse_args()

    source = Path(args.source)
    out_root = Path(args.out_root)
    outdir = out_root / f"{args.slug}_engine_prototype"
    refs = out_root / "ai_refs"
    outdir.mkdir(parents=True, exist_ok=True)
    refs.mkdir(parents=True, exist_ok=True)
    ref_path = refs / f"{args.slug}_engine_ai_full_01.png"
    ref_path.write_bytes(source.read_bytes())

    alpha = remove_key(Image.open(source), args.key)
    rows = cluster_rows(components(alpha))
    if len(rows) < 3:
        raise SystemExit(f"Expected 3 rows, found {len(rows)}")
    rows = rows[:3]

    row_specs = [
        ("idle", 6, 57, 59, 180),
        ("walk", 8, 60, 60, 95),
        ("back_walk", 8, 59, 62, 95),
    ]
    strips: dict[str, Image.Image] = {}
    for row, (name, expected, max_w, max_h, duration) in zip(rows, row_specs):
        frames = [frame_from_component(alpha, comp, max_w, max_h, args.key) for comp in row]
        frames = normalize_count(frames, expected)
        strip = save_strip(frames, outdir / f"{args.slug}_engine_{name}_strip.png")
        save_gif(strip, expected, outdir / f"{args.slug}_engine_{name}.gif", duration)
        strips[name] = strip

    strips["idle"].crop((0, 0, FRAME, FRAME)).save(outdir / f"{args.slug}_engine_icon.png")

    contact = Image.new("RGBA", (8 * FRAME, 3 * FRAME + 42), (18, 21, 26, 255))
    draw = ImageDraw.Draw(contact)
    draw.text((2, 2), "idle", fill=(243, 223, 170, 255))
    draw.text((2, 73), "walk side", fill=(243, 223, 170, 255))
    draw.text((2, 145), "walk back", fill=(243, 223, 170, 255))
    for i in range(6):
        contact.alpha_composite(strips["idle"].crop((i * FRAME, 0, (i + 1) * FRAME, FRAME)), (i * FRAME, 17))
    for i in range(8):
        contact.alpha_composite(strips["walk"].crop((i * FRAME, 0, (i + 1) * FRAME, FRAME)), (i * FRAME, 89))
        contact.alpha_composite(strips["back_walk"].crop((i * FRAME, 0, (i + 1) * FRAME, FRAME)), (i * FRAME, 161))
    contact.save(outdir / f"{args.slug}_engine_contact_sheet.png")

    manifest = {
        "slug": args.slug,
        "displayName": args.display_name,
        "frameSize": FRAME,
        "animations": {
            "idle": {"file": f"{args.slug}_engine_idle_strip.png", "frames": 6, "durationMs": 180},
            "walk": {"file": f"{args.slug}_engine_walk_strip.png", "frames": 8, "durationMs": 95},
            "backWalk": {"file": f"{args.slug}_engine_back_walk_strip.png", "frames": 8, "durationMs": 95},
        },
        "source": str(ref_path).replace("\\", "/"),
    }
    (outdir / f"{args.slug}_engine_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    build_preview_html(args.slug, args.display_name, outdir)
    print(json.dumps({"outdir": str(outdir), "rows": [len(row) for row in rows]}, indent=2))


if __name__ == "__main__":
    main()
