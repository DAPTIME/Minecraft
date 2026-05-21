#!/usr/bin/env python3
"""Generate icons/icon-192.png and icons/icon-512.png using pure stdlib."""

import os
import struct
import zlib


def det_noise(x, y):
    """Deterministic noise hash returning a value 0..255."""
    r = (x * 2654435761 + y * 2246822519) & 0xffffffff
    r = ((r ^ (r >> 16)) * 0x45d9f3b) & 0xffffffff
    return r & 0xff


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, v))


def make_icon(size):
    border = size // 16

    # height thresholds
    grass_end  = int(size * 0.18)
    trans_end  = int(size * 0.23)
    # rest is dirt

    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # border → dark background
            if x < border or x >= size - border or y < border or y >= size - border:
                row.append((0x14, 0x14, 0x14))
                continue

            n = det_noise(x, y)

            if y < grass_end:
                # grass green with ±15 variation
                vary = int((n / 255.0) * 30) - 15
                r = clamp(0x5E + vary)
                g = clamp(0x9D + vary)
                b = clamp(0x34 + vary)
                row.append((r, g, b))

            elif y < trans_end:
                # darker transition
                row.append((0x44, 0x50, 0x32))

            else:
                # dirt: #866043 with noise
                nr = clamp(0x86 + (int((n / 255.0) * 20) - 10))
                ng = clamp(0x60 + (int((n / 255.0) * 20) - 10))
                nb = clamp(0x43 + (int((n / 255.0) * 20) - 10))

                # occasional dark or light speckles
                n2 = det_noise(x + 1000, y + 1000)
                if n2 < 20:
                    # dark speckle
                    nr, ng, nb = 0x65, 0x48, 0x32
                elif n2 > 235:
                    # light speckle
                    nr, ng, nb = 0xA0, 0x78, 0x55

                row.append((nr, ng, nb))
        pixels.append(row)

    return pixels


def write_png(filename, size, pixels):
    """Write a minimal PNG from a 2D list of (r,g,b) tuples."""
    def png_chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # IDAT — raw scanlines: filter byte 0 + RGB data
    raw_lines = b''
    for row in pixels:
        line = b'\x00'  # filter type 0 = None
        for (r, g, b) in row:
            line += struct.pack('BBB', r, g, b)
        raw_lines += line
    idat = png_chunk(b'IDAT', zlib.compress(raw_lines, 9))

    # IEND
    iend = png_chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)
    print(f"  wrote {filename} ({size}x{size})")


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for size in (192, 512):
        pixels = make_icon(size)
        write_png(os.path.join(script_dir, 'icons', f'icon-{size}.png'), size, pixels)
    print("Done.")
