from django.db import models

# Create your models here.
from django.db import models

class Board(models.Model):
    size = models.IntegerField(default=19)  # 19x19 is the standard size
    position = models.TextField()  # Store the position as a serialized string or JSON
    created_at = models.DateTimeField(auto_now_add=True)
