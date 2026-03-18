import asyncio
import json
import threading
import os

from channels.generic.websocket import AsyncWebsocketConsumer
from goTrainer.katago_sample import KataGo
from goTrainer.pattern_search import pattern_search

import sgfmill.boards

from .katago_gtp import KataGoGTP

KATAGO_PATH = "/opt/homebrew/bin/katago"
KATAGO_CONFIG = "/opt/homebrew/Cellar/katago/1.16.0/share/katago/configs/gtp_example.cfg"
KATAGO_MODEL = "goTrainer/kata1-b28c512nbt-s8536703232-d4684449769.bin.gz"

katago = KataGoGTP(KATAGO_PATH, KATAGO_CONFIG, KATAGO_MODEL)

def get_katago():
    """Return the global KataGo instance, restarting it if the process has died."""
    global katago
    if not katago.is_alive():
        print("[KataGoGTP] Process died, restarting...")
        try:
            katago.close()
        except Exception:
            pass
        katago = KataGoGTP(KATAGO_PATH, KATAGO_CONFIG, KATAGO_MODEL)
    return katago

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

        # Ensure KataGo is running (restart if it died)
        k = get_katago()

        # Stream KataGo info lines
        def handle_info(line):
            asyncio.run_coroutine_threadsafe(
                self.send(text_data=json.dumps({"line": line})),
                self.loop
            )

        k.read_lines(handle_info)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            moves = data.get("moves", [])
            print("Got JSON KataGo moves:", moves)
        except json.JSONDecodeError:
            # treat as raw GTP command from test UI
            print("Got raw GTP command:", text_data)
            get_katago().send(text_data)

    async def disconnect(self, close_code):
        # Don't terminate KataGo on disconnect — it's shared across connections
        pass

class PatternSearchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self._cancel = False
        self._worker = None
        self.loop = asyncio.get_event_loop()

    async def receive(self, text_data):
        print("PatternSearchConsumer.receive called with:", text_data)

        try:
            msg = json.loads(text_data)
        except Exception:
            return

        print("continuing with processing")

        t = msg.get("type")
        if t == "start":
            # expected keys:
            #   pattern_template: list[list[int]]
            #   pattern_turn: int
            #   directory: str (e.g. "goTrainer/go4go_collection")
            #   max_files: int (optional)
            pattern_template = msg["pattern_template"]
            pattern_turn = msg["pattern_turn"]
            directory = msg.get("directory", "goTrainer/go4go_collection")
            max_files = msg.get("max_files", 100)

            start_after = msg.get("start_after_filename")

            # launch worker
            self._cancel = False
            def work():
                count = 0
                last_file = None
                seen = set()  # deduplicate by (file, move_number)
                all_files = sorted(os.listdir(directory), reverse=True)

                # If paginating, skip until we pass the start_after file
                skip = start_after is not None
                for fname in all_files:
                    if self._cancel:
                        break
                    # Skip files up to and including start_after
                    if skip:
                        full_path_check = os.path.join(directory, fname)
                        if full_path_check == start_after or fname == os.path.basename(start_after or ''):
                            skip = False
                        continue

                    full_path = os.path.join(directory, fname)
                    if not os.path.isfile(full_path):
                        continue
                    last_file = full_path
                    for hit in pattern_search(pattern_template, pattern_turn, full_path, katago=None, stream=True):
                        key = (hit.get("sgf_file"), hit.get("move_number"))
                        if key in seen:
                            continue
                        seen.add(key)
                        asyncio.run_coroutine_threadsafe(
                            self.send(text_data=json.dumps({"type":"hit", **hit})),
                            self.loop
                        )
                    count += 1
                    if max_files and count >= max_files:
                        break
                asyncio.run_coroutine_threadsafe(
                    self.send(text_data=json.dumps({"type":"done", "scanned": count, "lastFile": last_file})),
                    self.loop
                )

            if self._worker and self._worker.is_alive():
                self._cancel = True
                self._worker.join(timeout=1)

            self._worker = threading.Thread(target=work, daemon=True)
            self._worker.start()

        elif t == "cancel":
            self._cancel = True
            await self.send(json.dumps({"type":"cancelling"}))

    async def disconnect(self, close_code):
        self._cancel = True
        if self._worker and self._worker.is_alive():
            self._worker.join(timeout=1)
