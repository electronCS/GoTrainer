from django.db import migrations

def create_initial_board(apps, schema_editor):
    Board = apps.get_model('playground', 'Board')
    if Board.objects.count() == 0:
        Board.objects.create(size=19, position="")

class Migration(migrations.Migration):

    dependencies = [
        ('playground', '0001_initial'),  # Ensure this matches your initial migration name
    ]

    operations = [
        migrations.RunPython(create_initial_board),
    ]
