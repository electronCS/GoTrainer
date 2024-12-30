from django.db import migrations

def create_initial_board(apps, schema_editor):
    Board = apps.get_model('goTrainer', 'Board')  # Updated app label
    if Board.objects.count() == 0:
        Board.objects.create(size=19, position="")

class Migration(migrations.Migration):

    dependencies = [
        ('goTrainer', '0001_initial'),  # Updated to match the new app's initial migration
    ]

    operations = [
        migrations.RunPython(create_initial_board),
    ]
