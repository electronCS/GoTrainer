from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
import os
import boto3
import logging
from .models import Board
from .sgf_utils import read_sgf_file, get_sgf_string
import json
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

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

def display_problem_interface(request):
    try:
        # Get problemId and tag from the request
        problem_id = request.GET.get('problemId')  # Current problem ID
        # tag = request.GET.get('tag', 'test')  # Tag to filter by
        tags = request.GET.get('tags', 'test').split(',')  # Split tags by comma

        current_index = int(request.GET.get('index', 0))  # Default to the first problem

        print("Session tags:", request.session.get('tags'))
        print("Requested tags:", tags)

        if 'problem_ids' not in request.session or request.session.get('tags') != tags:
            print("Refreshing problem_ids for tags:", tags)
            es_results = search_problems_by_tags(tags)
            request.session['problem_ids'] = es_results
            request.session['tags'] = tags
            current_index = 0  # Reset to the first problem
        else:
            print("Using cached problem_ids for tags:", tags)

        # Get the problem ID for the current index
        problem_ids = request.session.get('problem_ids', [])
        print("problem ids are ", problem_ids)
        print("current index is ", current_index)

        problem_ids = request.session.get('problem_ids', [])
        if not problem_ids:
            print("No problems found for the tags. Defaulting to problem with ID 'default'.")
            problem_ids = ['default']
            request.session['problem_ids'] = problem_ids
            request.session['tags'] = ['default']
            current_index = 0

        if current_index >= len(problem_ids):
            return JsonResponse({"error": "No more problems available."}, status=404)

        problem_id = problem_ids[current_index]

        # Fetch problem data from DynamoDB
        problem_data = fetch_from_dynamodb(problem_id)
        item = problem_data.get('Item', {})
        position = item.get('position', '')
        correct_answers = item.get('correctAnswers', [])
        file_path = item.get('filePath', 'goTrainer/test.sgf')
        correct_answers = json.dumps(correct_answers)

        # Load the SGF file
        sgf_string = get_sgf_string(file_path)

        # Prepare context for the frontend
        context = {
            "sgfString": sgf_string,
            "position": position,
            "correctAnswers": correct_answers,
            "currentIndex": current_index,
            "tags": ','.join(tags)  # Pass tags back to the frontend
        }

        return render(request, "do_problem.html", context)
    except Exception as e:
        logger.error("Error in display_problem_interface: %s", e)
        return JsonResponse({"error": str(e)}, status=500)


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

def get_problem(request):
    pass
    # sgf_file = "goTrainer/problems.sgf"  # Replace with your actual SGF file path
    # try:
    #     # Load and parse SGF file
    #     sgf_string = get_sgf_string(sgf_file)
    #     problem_node = parse_sgf_to_problem(sgf_string)  # Your function to extract the problem
    #     return JsonResponse({"problem": problem_node})
    # except Exception as e:
    #     return JsonResponse({"error": str(e)}, status=500)



def fetch_from_dynamodb(problem_id):
    logger.debug("Fetching data from DynamoDB")
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('problems2')

        response = table.get_item(Key={"problemId": problem_id})

        if 'Item' not in response:
            return {"error": f"Problem with ID {problem_id} not found"}

        return response
    except Exception as e:
        logger.error("Error fetching from DynamoDB: %s", e)
        return {"error": str(e)}


def search_problems_by_tags(tags):
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        print("credentials are ", credentials.secret_key, credentials.access_key, credentials.token)
        region = 'us-east-1'  # Replace with your OpenSearch region

        # Create AWS4Auth
        awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'es',
                           session_token=credentials.token)

        # Initialize OpenSearch client with AWS4Auth
        client = OpenSearch(
            hosts=[{'host': 'search-domain-test-l7githvhafgmj5ckm7tt3l3wnu.us-east-1.es.amazonaws.com', 'port': 443}],
            http_auth=awsauth,
            use_ssl=True,
            verify_certs=True,
            connection_class = RequestsHttpConnection
        )

        # query = {
        #     "query": {
        #         "terms": {
        #             "doc.tags.keyword": tags
        #         }
        #     },
        #     "_source": ["doc.id"]
        # }

        query = {
            "query": {
                "terms_set": {
                    "doc.tags.keyword": {
                        "terms": tags,
                        "minimum_should_match_script": {
                            "source": "params.num_terms"
                        }
                    }
                }
            }
        }


        response = client.search(index="problems", body=query)

        problem_ids = [hit["_source"]["doc"]["id"] for hit in response["hits"]["hits"]]
        return problem_ids
    except Exception as e:
        logger.error(f"Error querying OpenSearch: {e}")
        return []
