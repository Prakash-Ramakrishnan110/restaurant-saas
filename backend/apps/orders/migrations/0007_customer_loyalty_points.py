from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_cashiershiftcloseout_cash_in_paise_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="loyalty_points",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Available guest loyalty points (1 point = ₹1 / 100 paise discount)",
            ),
        ),
        migrations.AddField(
            model_name="customer",
            name="lifetime_points_earned",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="customer",
            name="lifetime_points_redeemed",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
