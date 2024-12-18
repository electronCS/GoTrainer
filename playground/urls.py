from django.urls import path
from . import views
from .views import board_view, display_board_controller, display_board, save_sgf_file

urlpatterns = [
    path('hello/', views.say_hello),
    path('fetch-data/', views.fetch_from_dynamodb),
    path('board/', board_view, name='board'),
    path('display-board/', display_board, name='display_board'),
    path('controller/', display_board_controller, name='display_board_controller'),
    path('save-sgf/', save_sgf_file, name='save_sgf_file'),

]