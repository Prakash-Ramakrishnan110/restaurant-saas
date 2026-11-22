import json, os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
with open(os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json"), encoding="utf-8") as f:
    walk = json.load(f)

print("=== SAMPLE VISUAL DEFECTS BY FLOW ===")
for x in walk:
    samples = []
    if x["brokenMedia"]:
        m = x["brokenMedia"][0]
        samples.append(f"brokenMedia({m['alt']} @ {m['x']},{m['y']})")
    if x["skeletonStillVisibleAfter10s"]:
        samples.append("skeleton10s=True")
    if x["counterTableWords"]:
        samples.append(f"counterTable={x['counterTableWords']}")
    if x["smallTapTargets"]:
        t = x["smallTapTargets"][0]
        samples.append(f"tap<{56 if x['viewport']=='390x844' else 48}({t['w']}x{t['h']} '{t['text']}' @ {t['x']},{t['y']})")
    if x["smallText"]:
        s = x["smallText"][0]
        samples.append(f"text={s['fontSize']}px('{s['text']}' @ {s['x']},{s['y']})")
    if x["lowContrast"]:
        c = x["lowContrast"][0]
        samples.append(f"contrast={c['ratio']}:1('{c['text']}' {c['fg']} on {c['bg']} @ {c['x']},{c['y']})")
    if x["orangeText"]:
        o = x["orangeText"][0]
        samples.append(f"orangeText('{o['text']}' {o['color']} @ {o['x']},{o['y']})")
    if samples and x["stepId"].startswith(("01", "02", "03")):
        print(f"{x['flowId']} {x['stepId']} [{x['viewport']}] ({x['shotPath']}): " + " | ".join(samples[:4]))
