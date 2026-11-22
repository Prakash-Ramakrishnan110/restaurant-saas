from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0010_stage_d_qr_guest"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffsectionassignment",
            name="shift_name",
            field=models.CharField(default="FULL_DAY", max_length=20),
        ),
        migrations.AddField(
            model_name="staffsectionassignment",
            name="shift_start",
            field=models.CharField(blank=True, default="07:00", max_length=10),
        ),
        migrations.AddField(
            model_name="staffsectionassignment",
            name="shift_end",
            field=models.CharField(blank=True, default="23:00", max_length=10),
        ),
    ]
