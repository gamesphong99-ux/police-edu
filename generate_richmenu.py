from PIL import Image, ImageDraw, ImageFont

W, H   = 1200, 810
DIVX   = 800
DIVY   = 405

# Colours
CA  = "#1b3d6e"   # A  dark navy
CB  = "#1a56a0"   # B  mid blue
CC  = "#2266b8"   # C  lighter blue
WHITE = "#ffffff"

FONT_TH  = "/Library/Fonts/Arial Unicode.ttf"
FONT_EN  = "/System/Library/Fonts/Helvetica.ttc"

def font(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

def tc(draw, txt, fnt, cx, cy, fill=WHITE):
    bb = fnt.getbbox(txt)
    draw.text((cx-(bb[2]-bb[0])//2, cy-(bb[3]-bb[1])//2), txt, font=fnt, fill=fill)

def circle(draw, cx, cy, r, fill, outline=None, lw=0):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill,
                 outline=outline, width=lw)

# ── Canvas (flat, no gradient) ──────────────────────────
img  = Image.new("RGB", (W, H), CA)
draw = ImageDraw.Draw(img)

draw.rectangle([0, 0, DIVX-1, H],    fill=CA)
draw.rectangle([DIVX, 0, W, DIVY-1], fill=CB)
draw.rectangle([DIVX, DIVY, W, H],   fill=CC)

# Borders
BW = 4
draw.line([(DIVX, 0),(DIVX, H)],    fill=WHITE, width=BW)
draw.line([(DIVX, DIVY),(W, DIVY)], fill=WHITE, width=BW)
draw.rectangle([0,0,W-1,H-1],       outline=WHITE, width=BW)

# Fonts
fTH_A = font(FONT_TH, 70)
fTH_S = font(FONT_TH, 48)
fEN   = font(FONT_EN, 23)

# ════════════════════════════════════════════════════════
#  SECTION A  (0,0)→(800,810)  เช็คชื่อเข้าเรียน
# ════════════════════════════════════════════════════════
ax, ay = DIVX//2, H//2

# Icon circle
ICR = 90
circle(draw, ax, ay-175, ICR, (255,255,255,40))
circle(draw, ax, ay-175, ICR, None, WHITE, 3)

# Checkmark  ✓  drawn with lines
ck = [(ax-38, ay-175+5), (ax-10, ay-175+36), (ax+42, ay-175-30)]
draw.line(ck[:2], fill="#3de87a", width=14)
draw.line(ck[1:], fill="#3de87a", width=14)
for px,py in ck:
    circle(draw, px, py, 7, "#3de87a")

# Text
tc(draw, "เช็คชื่อเข้าเรียน", fTH_A, ax, ay+14)
tc(draw, "Check-in Attendance", fEN,   ax, ay+80, fill="#8dc4f8")

# Underline pill
uw=250
draw.rounded_rectangle([ax-uw//2, ay+62, ax+uw//2, ay+66],
                        radius=3, fill=(255,255,255,90))

# ════════════════════════════════════════════════════════
#  SECTION B  (800,0)→(1200,405)  ผลการเช็คชื่อ
# ════════════════════════════════════════════════════════
bx, by = DIVX+200, DIVY//2

ICR2 = 68
circle(draw, bx, by-118, ICR2, (255,255,255,35))
circle(draw, bx, by-118, ICR2, None, WHITE, 3)

# Clipboard icon
cx1, cy1 = bx, by-118
# board body
draw.rounded_rectangle([cx1-28, cy1-35, cx1+28, cy1+34],
                        radius=6, fill=WHITE)
# clip tab (dark)
draw.rounded_rectangle([cx1-14, cy1-43, cx1+14, cy1-25],
                        radius=4, fill=CB)
# 3 lines on board
for yoff in [-12, 1, 14]:
    draw.line([(cx1-18, cy1+yoff),(cx1+18, cy1+yoff)],
              fill=CB, width=4)

tc(draw, "ผลการเช็คชื่อ", fTH_S, bx, by+18)
tc(draw, "Attendance Report",  fEN,   bx, by+66, fill="#9ecfff")
draw.rounded_rectangle([bx-95, by+48, bx+95, by+52],
                        radius=3, fill=(255,255,255,90))

# ════════════════════════════════════════════════════════
#  SECTION C  (800,405)→(1200,810)  สื่อการเรียน
# ════════════════════════════════════════════════════════
cx2, cy2 = DIVX+200, DIVY+DIVY//2

circle(draw, cx2, cy2-118, ICR2, (255,255,255,35))
circle(draw, cx2, cy2-118, ICR2, None, WHITE, 3)

# Open-book icon
bkx, bky = cx2, cy2-118
# left page
draw.polygon([(bkx-38,bky-28),(bkx-4, bky-20),
              (bkx-4, bky+28),(bkx-38,bky+20)], fill=WHITE)
# right page
draw.polygon([(bkx+4, bky-20),(bkx+38,bky-28),
              (bkx+38,bky+20),(bkx+4, bky+28)], fill=(220,235,255))
# spine
draw.line([(bkx, bky-32),(bkx, bky+32)], fill=CC, width=5)
# page lines left
for yoff in [-10, 2, 14]:
    draw.line([(bkx-30,bky+yoff),(bkx-8,bky+yoff)], fill=CC, width=3)
# page lines right
for yoff in [-10, 2, 14]:
    draw.line([(bkx+8,bky+yoff),(bkx+30,bky+yoff)], fill=CC, width=3)

tc(draw, "สื่อการเรียน", fTH_S, cx2, cy2+18)
tc(draw, "Learning Materials", fEN, cx2, cy2+66, fill="#9ecfff")
draw.rounded_rectangle([cx2-95, cy2+48, cx2+95, cy2+52],
                        radius=3, fill=(255,255,255,90))

# ── Save ─────────────────────────────────────────────────
out = "/Users/lightsaber/Desktop/Code/police-edu/richmenu.png"
img.save(out, "PNG", dpi=(144,144))
print(f"✅  {out}  ({W}×{H})")
