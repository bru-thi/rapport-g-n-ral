#!/usr/bin/env python3
"""Génère les icônes PNG de la PWA (aucune dépendance externe)."""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

BG_TOP = (37, 99, 235)      # #2563eb
BG_BOTTOM = (29, 78, 216)    # #1d4ed8
FACE = (30, 64, 175)        # #1e40af
WHITE = (255, 255, 255)


def write_png(path, size, pixels):
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data +
                struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF))

    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *px) for px in row) for row in pixels)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
                chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def dist_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def make_pixels(size, maskable):
    radius = size * (0.0 if maskable else 0.18)
    safe = size * 0.80 if maskable else size * 0.92
    cx = cy = size / 2.0
    ring_r = safe * 0.36
    ring_w = max(1.5, size * 0.035)
    hand_w = max(1.5, size * 0.032)

    hour_ang = math.radians(300)
    minute_ang = math.radians(60)
    hour_len = ring_r * 0.55
    minute_len = ring_r * 0.85
    hx = cx + hour_len * math.sin(hour_ang)
    hy = cy - hour_len * math.cos(hour_ang)
    mx = cx + minute_len * math.sin(minute_ang)
    my = cy - minute_len * math.cos(minute_ang)

    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            fx, fy = x + 0.5, y + 0.5
            inside = True
            if radius > 0:
                qx = min(max(fx, radius), size - radius)
                qy = min(max(fy, radius), size - radius)
                if math.hypot(fx - qx, fy - qy) > radius:
                    inside = False
            if not inside:
                row.append((0, 0, 0, 0))
                continue
            t = fy / size
            color = lerp(BG_TOP, BG_BOTTOM, t)
            d = math.hypot(fx - cx, fy - cy)
            if d <= ring_r:
                color = FACE
            if abs(d - ring_r) <= ring_w:
                color = WHITE
            if dist_to_segment(fx, fy, cx, cy, hx, hy) <= hand_w:
                color = WHITE
            if dist_to_segment(fx, fy, cx, cy, mx, my) <= hand_w:
                color = WHITE
            if math.hypot(fx - cx, fy - cy) <= max(1.5, size * 0.03):
                color = WHITE
            row.append((color[0], color[1], color[2], 255))
        pixels.append(row)
    return pixels


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, maskable in [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-maskable-512.png', 512, True),
    ]:
        path = os.path.join(OUT, name)
        write_png(path, size, make_pixels(size, maskable))
        print('écrit :', os.path.normpath(path), os.path.getsize(path), 'octets')


if __name__ == '__main__':
    main()
