# Decodes walkbase/tmp/orbit.zip (a 24-frame, 360-degree turntable export) with zipfile and OpenCV.
import json, sys, zipfile
import cv2, numpy as np
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
names = sorted(n for n in z.namelist() if n.endswith('.png'))
frames = [cv2.imdecode(np.frombuffer(z.read(n), np.uint8), cv2.IMREAD_UNCHANGED) for n in names]
man = json.loads(z.read('manifest.json'))
shapes = {f.shape for f in frames}
diffs = [int((cv2.absdiff(frames[i], frames[i + 1]).max(axis=2) > 8).sum()) for i in range(len(frames) - 1)]
print(json.dumps({
    'files': len(names), 'shapes': [list(s) for s in shapes], 'manifestFrames': len(man['frames']), 'fps': man['fps'],
    'firstName': names[0], 'orbit': man.get('style', {}).get('camYaw'), 'everyFrameDiffers': all(d > 100 for d in diffs),
    'minDiffPixels': min(diffs), 'hasRecipe': 'IMPORT-RECIPE.txt' in z.namelist(),
}))
assert len(names) == 24 and shapes == {(360, 640, 4)} and all(d > 100 for d in diffs)
