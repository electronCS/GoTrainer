from django.urls import path
from . import views
from .views import board_view, display_board_controller, display_board, save_sgf_file, pattern_search_api, display_problem_interface, get_sgf

urlpatterns = [
    path('hello/', views.say_hello),
    path('fetch-data/', views.fetch_from_dynamodb),
    path('board/', board_view, name='board'),
    path('display-board/', display_board, name='display_board'),
    path('controller/', display_board_controller, name='display_board_controller'),
    path('problem/', display_problem_interface, name='display_problem_interface'),

    path('controller/save-sgf/', save_sgf_file, name='save_sgf_file'),
    path("katago-analysis/", views.katago_analysis),
    path('pattern_search/', pattern_search_api, name="pattern_search_api"),
    path('get_sgf', get_sgf, name='get_sgf'),
]
