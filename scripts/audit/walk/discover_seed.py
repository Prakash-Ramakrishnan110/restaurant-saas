"""Read-only discovery of seeded tenants, users, tables, and QR tokens in Docker backend."""
import json
import os
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT_PATH = os.path.join(BASE_DIR, "docs/audit/walk/raw/seed_context.json")

PY_SNIPPET = r"""
import json
from apps.tenants.models import Tenant, Branch
from apps.accounts.models import Membership
from apps.venues.models import DiningTable, QRCode, ServiceArea
from apps.core.context import set_current_tenant

out = {"tenants": {}}
for t in Tenant.objects.all().order_by("slug"):
    set_current_tenant(t)
    branches = []
    for b in Branch.objects.filter(tenant=t):
        caps = getattr(b, "capabilities", None)
        branches.append({
            "id": str(b.id),
            "name": b.name,
            "venue_profile": b.venue_profile,
            "uses_tables": caps.uses_tables if caps else None,
            "qr_ordering_mode": caps.qr_ordering_mode if caps else None,
            "qr_session_policy": caps.qr_session_policy if caps else None,
            "payment_timing": caps.payment_timing if caps else None,
            "allows_room_service": caps.allows_room_service if caps else None,
        })
    users = {}
    for m in Membership.objects.filter(tenant=t, is_active=True).select_related("user"):
        users[m.role] = users.get(m.role, []) + [m.user.email]
    qrs = []
    for q in QRCode.objects.filter(tenant=t, is_active=True).select_related("table", "service_area").order_by("created_at"):
        qrs.append({
            "id": str(q.id),
            "target_type": q.target_type,
            "token": q.public_token,
            "table_label": q.table.label if q.table else None,
            "table_status": q.table.status if q.table else None,
            "area_name": q.service_area.name if q.service_area else None,
        })
    tables = [
        {"id": str(tbl.id), "label": tbl.label, "type": tbl.table_type, "status": tbl.status}
        for tbl in DiningTable.objects.filter(tenant=t).order_by("label")
    ]
    out["tenants"][t.slug] = {
        "id": str(t.id),
        "name": t.name,
        "business_type": t.business_type,
        "branches": branches,
        "users": users,
        "qrs": qrs,
        "tables": tables,
    }
print("__JSON_START__")
print(json.dumps(out))
"""


def main():
    res = subprocess.run(
        ["docker", "exec", "fusion_backend", "python", "manage.py", "shell", "-c", PY_SNIPPET],
        capture_output=True,
        text=True,
        check=True,
    )
    marker = "__JSON_START__"
    idx = res.stdout.find(marker)
    if idx == -1:
        raise RuntimeError(f"Marker not found in output: {res.stdout}\n{res.stderr}")
    data = json.loads(res.stdout[idx + len(marker):].strip())
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {OUT_PATH} with {len(data['tenants'])} tenants.")


if __name__ == "__main__":
    main()
