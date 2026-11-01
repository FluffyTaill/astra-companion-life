"""Things she holds and things around her: a book, a cup, a plush bear (3D, held in her own holding
poses from tools/gen_hold.cjs), and pictures for particles — a star and a firefly.

    python -I tools/gen_life_assets.py assets

A prop lies on the plane the engine places in front of her (Y up, -Z away from her). Sizes are metres.
"""
import json
import math
import os
import struct
import sys

from PIL import Image, ImageDraw, ImageFilter


def mtoon(name, rgb, alpha=1.0, emissive=(0, 0, 0)):
    m = {"name": name, "doubleSided": True,
         "pbrMetallicRoughness": {"baseColorFactor": [*rgb, alpha], "metallicFactor": 0.0, "roughnessFactor": 1.0},
         "emissiveFactor": list(emissive),
         "extensions": {"VRMC_materials_mtoon": {"specVersion": "1.0", "shadeColorFactor": [c * 0.75 for c in rgb], "shadingToonyFactor": 0.9,
                                                 "shadingShiftFactor": 0.0, "giEqualizationFactor": 0.9, "outlineWidthFactor": 0.0,
                                                 "rimLightingMixFactor": 0.0, "transparentWithZWrite": False}}}
    if alpha < 1:
        m["alphaMode"] = "BLEND"
    return m


class Model:
    def __init__(self):
        self.buf = bytearray()
        self.acc, self.views, self.meshes, self.nodes, self.mats = [], [], [], [], []

    def _add(self, data, fmt, typ, target, minmax=False):
        off = len(self.buf)
        flat = [c for v in data for c in (v if isinstance(v, tuple) else (v,))]
        self.buf.extend(struct.pack("<%d%s" % (len(flat), fmt), *flat))
        while len(self.buf) % 4:
            self.buf.append(0)
        self.views.append({"buffer": 0, "byteOffset": off, "byteLength": len(flat) * struct.calcsize(fmt), "target": target})
        a = {"bufferView": len(self.views) - 1, "componentType": 5126 if fmt == "f" else 5125, "count": len(data), "type": typ}
        if minmax:
            a["min"] = [min(v[i] for v in data) for i in range(3)]
            a["max"] = [max(v[i] for v in data) for i in range(3)]
        self.acc.append(a)
        return len(self.acc) - 1

    def mat(self, m):
        self.mats.append(m)
        return len(self.mats) - 1

    def mesh(self, name, tris, material, at=(0, 0, 0)):
        """tris: [(p0, p1, p2)] — flat-shaded, a normal per face."""
        pos, nrm = [], []
        for a, b, c in tris:
            u = [b[i] - a[i] for i in range(3)]
            v = [c[i] - a[i] for i in range(3)]
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            ln = math.sqrt(sum(x * x for x in n)) or 1
            n = tuple(x / ln for x in n)
            pos += [tuple(a), tuple(b), tuple(c)]
            nrm += [n, n, n]
        p = self._add(pos, "f", "VEC3", 34962, True)
        q = self._add(nrm, "f", "VEC3", 34962)
        i = self._add(list(range(len(pos))), "I", "SCALAR", 34963)
        self.meshes.append({"primitives": [{"attributes": {"POSITION": p, "NORMAL": q}, "indices": i, "material": material}]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1, "translation": list(at)})

    def key(self, n, at):
        """a grip point: a tiny invisible-ish quad with a material of its own"""
        m = self.mat(mtoon(f"key.{n}", (1, 1, 1), 0.01))
        s = 0.006
        self.mesh(f"key.{n}", [((-s, 0, -s), (s, 0, s), (s, 0, -s)), ((-s, 0, -s), (-s, 0, s), (s, 0, s))], m, at)

    def write(self, out):
        g = {"asset": {"version": "2.0", "generator": "gen_life_assets.py (Companion Life)"},
             "extensionsUsed": ["VRMC_materials_mtoon"], "scene": 0, "scenes": [{"nodes": list(range(len(self.nodes)))}],
             "nodes": self.nodes, "meshes": self.meshes, "materials": self.mats,
             "accessors": self.acc, "bufferViews": self.views, "buffers": [{"byteLength": len(self.buf)}]}
        js = json.dumps(g, separators=(",", ":")).encode()
        js += b" " * (-len(js) % 4)
        glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.buf))
        glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(self.buf), 0x004E4942) + bytes(self.buf)
        open(out, "wb").write(glb)
        print(out, len(glb), "bytes")


def box(w, h, d, x=0, y=0, z=0):
    X, Y, Z = w / 2, h / 2, d / 2
    v = [(x + sx * X, y + sy * Y, z + sz * Z) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tris = []
    for a, b, c, d2 in f:
        tris += [(v[a], v[b], v[c]), (v[a], v[c], v[d2])]
    return tris


def cylinder(r, h, n=20, x=0, y=0, z=0, cap=True):
    tris = []
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        p0 = (x + r * math.cos(a0), y, z + r * math.sin(a0))
        p1 = (x + r * math.cos(a1), y, z + r * math.sin(a1))
        q0, q1 = (p0[0], y + h, p0[2]), (p1[0], y + h, p1[2])
        tris += [(p0, q1, p1), (p0, q0, q1)]
        tris.append(((x, y, z), p1, p0))
        if cap:
            tris.append(((x, y + h, z), q0, q1))
    return tris


def sphere(r, x=0, y=0, z=0, rings=8, segs=12, sy=1.0):
    tris = []
    def pt(i, j):
        th, ph = math.pi * i / rings, 2 * math.pi * j / segs
        return (x + r * math.sin(th) * math.cos(ph), y + r * sy * math.cos(th), z + r * math.sin(th) * math.sin(ph))
    for i in range(rings):
        for j in range(segs):
            a, b, c, d = pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)
            tris += [(a, b, c), (a, c, d)]
    return tris


def book(out):
    m = Model()
    cover, page, ink = m.mat(mtoon("cover", (0.4, 0.5, 0.88))), m.mat(mtoon("page", (0.98, 0.96, 0.9))), m.mat(mtoon("ink", (0.45, 0.45, 0.55)))
    # an open book: two covers, two page blocks a little raised towards the spine, lines of text
    m.mesh("cover", box(0.30, 0.006, 0.21), cover)
    m.mesh("pages_l", box(0.135, 0.012, 0.195, x=-0.07, y=0.009), page)
    m.mesh("pages_r", box(0.135, 0.012, 0.195, x=0.07, y=0.009), page)
    lines = []
    for side in (-1, 1):
        for r in range(7):
            lines += box(0.09, 0.001, 0.006, x=side * 0.07, y=0.016, z=-0.07 + r * 0.022)
    m.mesh("text", lines, ink)
    m.key(1, (-0.13, 0.02, 0.06))
    m.key(2, (0.13, 0.02, 0.06))
    m.key(3, (0.12, 0.02, -0.06))
    m.write(out)


def cup(out):
    m = Model()
    body, tea, handle = m.mat(mtoon("cup", (0.62, 0.9, 0.84))), m.mat(mtoon("tea", (0.6, 0.35, 0.2))), m.mat(mtoon("handle", (0.45, 0.78, 0.72)))
    # held from below with both hands, so most of it shows above them
    m.mesh("body", cylinder(0.052, 0.11, cap=False), body)
    m.mesh("tea", cylinder(0.049, 0.098), tea)
    m.mesh("handle", box(0.014, 0.06, 0.014, x=0.066, y=0.058) + box(0.024, 0.012, 0.014, x=0.056, y=0.086) + box(0.024, 0.012, 0.014, x=0.056, y=0.03), handle)
    m.key(1, (-0.05, 0.012, 0.01))
    m.key(2, (0.05, 0.012, 0.01))
    m.write(out)


def plush(out):
    m = Model()
    fur, dark, pink = m.mat(mtoon("fur", (0.85, 0.66, 0.5))), m.mat(mtoon("eyes", (0.15, 0.1, 0.1))), m.mat(mtoon("pink", (1.0, 0.7, 0.75)))
    m.mesh("body", sphere(0.07, y=0.07, sy=1.1), fur)
    m.mesh("head", sphere(0.055, y=0.18), fur)
    m.mesh("ears", sphere(0.02, x=-0.04, y=0.23) + sphere(0.02, x=0.04, y=0.23), fur)
    m.mesh("eyes", sphere(0.007, x=-0.018, y=0.19, z=0.05) + sphere(0.007, x=0.018, y=0.19, z=0.05), dark)
    m.mesh("muzzle", sphere(0.018, y=0.17, z=0.045, sy=0.8), pink)
    m.key(1, (-0.065, 0.09, 0.02))
    m.key(2, (0.065, 0.09, 0.02))
    m.write(out)


def star_png(out):
    S = 128
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((20, 20, 108, 108), fill=(255, 240, 160, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    pts = []
    for k in range(10):
        r = 52 if k % 2 == 0 else 22
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((64 + r * math.cos(a), 64 + r * math.sin(a)))
    d = ImageDraw.Draw(img)
    d.polygon(pts, fill=(255, 230, 110, 255), outline=(255, 200, 60, 255))
    glow.alpha_composite(img)
    glow.save(out)
    print(out)


def firefly_png(out):
    S = 96
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((18, 18, 78, 78), fill=(200, 255, 140, 110))
    img = img.filter(ImageFilter.GaussianBlur(10))
    ImageDraw.Draw(img).ellipse((38, 38, 58, 58), fill=(240, 255, 200, 255))
    img.save(out)
    print(out)


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    book(os.path.join(out, "book.glb"))
    cup(os.path.join(out, "cup.glb"))
    plush(os.path.join(out, "plush.glb"))
    star_png(os.path.join(out, "star.png"))
    firefly_png(os.path.join(out, "firefly.png"))
