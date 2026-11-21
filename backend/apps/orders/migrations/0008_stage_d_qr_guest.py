import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0007_customer_loyalty_points"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="guest_label",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AlterField(
            model_name="servicerequest",
            name="request_type",
            field=models.CharField(
                choices=[
                    ("WATER", "Water"),
                    ("NAPKINS", "Extra Napkins"),
                    ("CALL_WAITER", "Call Waiter"),
                    ("BILL", "Request Bill"),
                    ("CUTLERY", "Cutlery"),
                ],
                default="CALL_WAITER",
                max_length=30,
            ),
        ),
        migrations.CreateModel(
            name="OrderFeedback",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("food_rating", models.PositiveSmallIntegerField()),
                ("service_rating", models.PositiveSmallIntegerField()),
                ("item_ratings", models.JSONField(blank=True, default=dict)),
                ("comment", models.TextField(blank=True, default="")),
                (
                    "suggestion_type",
                    models.CharField(
                        choices=[
                            ("FOOD", "Food"),
                            ("SERVICE", "Service"),
                            ("CLEANLINESS", "Cleanliness"),
                            ("PRICE", "Price"),
                            ("OTHER", "Other"),
                        ],
                        default="OTHER",
                        max_length=20,
                    ),
                ),
                ("is_hidden", models.BooleanField(default=False)),
                ("is_resolved", models.BooleanField(default=False)),
                ("owner_note", models.TextField(blank=True, default="")),
                (
                    "branch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="tenants.branch",
                    ),
                ),
                (
                    "order",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback",
                        to="orders.order",
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
                "ordering": ["-created_at"],
            },
        ),
    ]
