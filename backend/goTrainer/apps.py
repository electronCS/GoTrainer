from django.apps import AppConfig


# class PlaygroundConfig(AppConfig):
#     default_auto_field = "django.db.models.BigAutoField"
#     name = "playground"
#
#     def ready(self):
#         print("PlaygroundConfig ready method called.")
#         from django.db.models.signals import post_migrate
#         from .models import Board
#
#         def create_initial_board(sender, **kwargs):
#             print("create_initial_board called.")  # Add this line for debugging
#             if Board.objects.count() == 0:
#                 Board.objects.create(size=19, position="")
#                 print("Initial Board created.")
#
#         post_migrate.connect(create_initial_board, sender=self)
#
