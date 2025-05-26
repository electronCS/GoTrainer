import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.sessions import SessionMiddlewareStack
from django.core.asgi import get_asgi_application
from django.urls import path
from backend.goTrainer.websocket_handlers import KataGoConsumer  # we'll write this next

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.goTrainer.settings")

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": SessionMiddlewareStack(
        URLRouter([
            path("ws/katago/", KataGoConsumer.as_asgi()),
        ])
    ),
})
