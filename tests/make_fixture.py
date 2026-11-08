# Draws a synthetic animation sheet: ten walking figures in two rows on grainy paper, with frame numbers, a caption, specks and a smudge.
# It is entirely made up here, so it is safe to keep in the repository. Usage: python make_fixture.py out.png
import math
import sys

import cv2
import numpy as np

rng = np.random.default_rng(3)
W, H = 1800, 900
img = np.full((H, W, 3), (232, 238, 241), np.uint8)             # warm paper, in BGR
img = np.clip(img.astype(int) + rng.integers(-7, 7, (H, W, 1)), 0, 255).astype(np.uint8)
# slow shading, like a lit scan
yy, xx = np.mgrid[0:H, 0:W]
img = np.clip(img - (np.sin(xx / 400.0) * 6 + yy / 200.0).astype(int)[..., None], 0, 255).astype(np.uint8)


def figure(cx, base, phase, scale=1.0, colour=(45, 45, 50)):
    s = scale
    hip = (cx, base - int(95 * s))
    shoulder = (cx + int(6 * s), base - int(175 * s))
    head = (cx + int(8 * s), base - int(205 * s))
    cv2.circle(img, head, int(17 * s), colour, 3, cv2.LINE_AA)
    cv2.line(img, shoulder, hip, colour, 4, cv2.LINE_AA)
    for sgn, c in ((1, colour), (-1, (60, 60, 190))):             # the far leg and arm in red pencil
        foot = (cx + int(sgn * phase * s), base)
        knee = (cx + int(sgn * phase * 0.55 * s) + int(12 * s), base - int(48 * s))
        cv2.line(img, hip, knee, c, 4, cv2.LINE_AA)
        cv2.line(img, knee, foot, c, 4, cv2.LINE_AA)
        cv2.line(img, foot, (foot[0] + int(20 * s), foot[1]), c, 4, cv2.LINE_AA)
        hand = (cx + int(-sgn * phase * 0.7 * s), base - int(95 * s))
        cv2.line(img, shoulder, hand, c, 3, cv2.LINE_AA)


phases = [10, 28, 44, 28, 10, 28]
for i, ph in enumerate(phases):                                     # row one: six drawings
    figure(150 + i * 280, 370, ph)
    cv2.putText(img, str(i + 1), (130 + i * 280, 420), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.0, (70, 70, 80), 2, cv2.LINE_AA)
for i, ph in enumerate([44, 28, 10, 28]):                           # row two: four drawings
    figure(290 + i * 280, 800, ph, 1.0)
    cv2.putText(img, str(7 + i), (270 + i * 280, 850), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.0, (70, 70, 80), 2, cv2.LINE_AA)
cv2.putText(img, 'WALK CYCLE', (700, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (80, 80, 90), 2, cv2.LINE_AA)
for _ in range(14):                                                 # specks
    cv2.circle(img, (int(rng.integers(20, W - 20)), int(rng.integers(100, H - 20))), int(rng.integers(1, 3)), (70, 70, 80), -1)
cv2.ellipse(img, (1500, 620), (34, 20), 25, 0, 360, (150, 160, 170), -1)   # a smudge
img = cv2.GaussianBlur(img, (3, 3), 0.6)
cv2.imwrite(sys.argv[1], img)
print('wrote', sys.argv[1], img.shape)
