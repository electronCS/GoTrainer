import asyncio
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from goTrainer.katago_sample import KataGo
import sgfmill.boards

from .katago_gtp import KataGoGTP

katago = KataGoGTP(
    "/opt/homebrew/bin/katago",
    "/opt/homebrew/Cellar/katago/1.16.0/share/katago/configs/gtp_example.cfg",
    "goTrainer/kata1-b28c512nbt-s8536703232-d4684449769.bin.gz"
)

class KataGoConsumer(AsyncWebsocketConsumer):
    # async def connect(self):
    #     await self.accept()
    #
    #     # Start streaming KataGo info lines
    #     def handle_info(line):
    #         asyncio.run_coroutine_threadsafe(self.send(text_data=line), asyncio.get_event_loop())
    #
    #     katago.read_lines(handle_info)

    async def connect(self):
        await self.accept()

        # Save the correct event loop
        self.loop = asyncio.get_event_loop()

        # Stream KataGo info lines
        def handle_info(line):
            asyncio.run_coroutine_threadsafe(
                self.send(text_data=json.dumps({"line": line})),
                self.loop
            )

        katago.read_lines(handle_info)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            moves = data.get("moves", [])
            # process moves as before...
            print("Got JSON KataGo moves:", moves)
        except json.JSONDecodeError:
            # treat as raw GTP command from test UI
            print("Got raw GTP command:", text_data)
            katago.send(text_data)



    async def disconnect(self, close_code):
        katago.close()
