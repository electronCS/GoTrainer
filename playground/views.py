from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
import os
import boto3
import logging
from .models import Board
from .sgf_utils import read_sgf_file, get_sgf_string
import json

# Get an instance of a logger
logger = logging.getLogger(__name__)

# Create your views here.

def say_hello(request):
    #return HttpResponse("Hello, World!")
    return render(request, 'index.html', {'name': 'Alan'})

def board_view(request):
    board = Board.objects.first()  # Fetch the first board for now (you can expand this later)
    return render(request, 'board.html', {'board': board})
    # file_path = "goTrainer/go4go_collection/__go4go_19410518_Kato-Shin_Sekiyama-Riichi.sgf"  # Update this to your actual SGF file path

def display_board(request):
    file_path = "goTrainer/go4go_collection/__go4go_19410518_Kato-Shin_Sekiyama-Riichi.sgf"  # Update this to your actual SGF file path
    sgf_data = read_sgf_file(file_path)

    board_size = sgf_data['board_size']
    final_board_state = sgf_data['final_board_state']

    print("sgf data is ", sgf_data);

    return render_board(request, board_size, final_board_state)

def display_board_controller(request):
    # file_path = "goTrainer/go4go_collection/__go4go_19410518_Kato-Shin_Sekiyama-Riichi.sgf"  # Update this to your actual SGF file path
    file_path = "goTrainer/test.sgf"  # Update this to your actual SGF file path

    sgf_string = get_sgf_string(file_path)
    print("sgf string in backend is ", sgf_string)
    context = {
        "sgf_string": sgf_string
    }
    return render(request, "board_controller.html", context)


def render_board(request, board_size, final_board_state):
    context = {
        "board_size": board_size,
        "final_board_state": json.dumps(final_board_state)  # Serialize to JSON
    }
    return render(request, "board_with_moves.html", context)

def save_sgf_file(request):
    if request.method == "POST":
        sgf_string = request.POST.get("sgf_string", None)
        file_path = "goTrainer/test.sgf"  # Path to save the SGF file

        if not sgf_string:
            return JsonResponse({"error": "No SGF string provided"}, status=400)

        try:
            # Write the SGF string to the file
            with open(file_path, "w", encoding="utf-8") as file:
                file.write(sgf_string)

            return JsonResponse({"message": "SGF file saved successfully"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    else:
        return JsonResponse({"error": "Invalid request method"}, status=405)

def fetch_from_dynamodb(request):
    # Initialize the boto3 DynamoDB client

    logger.debug("Fetching data from DynamoDB")
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('testTable')

        # Fetch data from DynamoDB (for example, scan everything, which is not efficient for large tables)
        response = table.scan()
        data = response['Items']

        # Return data as JSON
        return JsonResponse({'data': data})
    except Exception as e:
        logger.error("ran into error")
        logger.error(e)
        logger.debug("ran into exception", e)
        return JsonResponse({'data': '123'})
