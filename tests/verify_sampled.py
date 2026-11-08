# Decodes the sampled-frame exports with zipfile and OpenCV and checks them against what the app said it would write.
# Usage: python verify_sampled.py <dir with sampled-expanded.zip, sampled-unique.zip, sampled-expect.json>
import json, sys, zipfile, os
import cv2, numpy as np
d = sys.argv[1]
exp = json.load(open(os.path.join(d, 'sampled-expect.json')))
ze = zipfile.ZipFile(os.path.join(d, 'sampled-expanded.zip')); zu = zipfile.ZipFile(os.path.join(d, 'sampled-unique.zip'))
assert ze.testzip() is None and zu.testzip() is None
dec = lambda z, n: cv2.imdecode(np.frombuffer(z.read(n), np.uint8), cv2.IMREAD_UNCHANGED)
ne = sorted(n for n in ze.namelist() if n.endswith('.png')); nu = sorted(n for n in zu.namelist() if n.endswith('.png'))
fe = [dec(ze, n) for n in ne]
runs = []
for f in fe:
    if runs and np.array_equal(runs[-1][0], f): runs[-1][1] += 1
    else: runs.append([f, 1])
man = json.loads(ze.read('manifest.json')); mu = json.loads(zu.read('manifest.json'))
res = {
    'expandedFiles': len(ne), 'expectedFrames': exp['frames'], 'size': sorted({f.shape for f in fe}),
    'runLengths': [r[1] for r in runs], 'expectedHolds': exp['holds'],
    'uniqueFiles': len(nu), 'manifestSlices': len(man['sampler']['slices']), 'manifestLabels': [s['label'] for s in man['sampler']['slices']],
    'expectedLabels': exp['labels'], 'uniqueRuns': [e['lengthFrames'] for e in mu['exposures']],
    'fps': man['fps'], 'note': man['sampler']['note'][:48],
}
print(json.dumps({k: (list(v) if isinstance(v, set) else v) for k, v in res.items()}, default=str))
assert len(ne) == exp['frames'] and res['runLengths'] == exp['holds'] and len(nu) == len(exp['holds'])
assert res['manifestLabels'] == exp['labels'] and res['uniqueRuns'] == exp['holds']
# the unique drawings, held for their exposures, rebuild the expanded frames exactly
rebuilt = []
for n, e in zip(nu, mu['exposures']): rebuilt += [dec(zu, n)] * e['lengthFrames']
assert len(rebuilt) == len(fe) and all(np.array_equal(a, b) for a, b in zip(rebuilt, fe))
print('OK: counts, holds, labels and the unique-plus-exposure rebuild all match')
