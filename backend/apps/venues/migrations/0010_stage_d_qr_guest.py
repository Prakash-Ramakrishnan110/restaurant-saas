import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
        ("venues", "0009_alter_diningtable_table_type_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="branchcapabilities",
            name="allows_service_requests",
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name="QRDailyScan",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("scan_date", models.DateField(db_index=True)),
                ("scan_count", models.PositiveIntegerField(default=0)),
                (
                    "branch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="tenants.branch",
                    ),
                ),
                (
                    "qr_code",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="daily_scans",
                        to="venues.qrcode",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "ordering": ["-scan_date"],
            },
        ),
        migrations.AddConstraint(
            model_name="qrdailyscan",
            constraint=models.UniqueConstraint(
                fields=("qr_code", "scan_date"),
                name="unique_qr_daily_scan_date",
            ),
        ),
    ]
