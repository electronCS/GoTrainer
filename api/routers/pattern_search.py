"""
Pattern search WebSocket endpoint.

Protocol:
  Client sends: { "type": "start", "pattern_template": [...], "pattern_turn": 1|2,
                  "start_after": null|"filename", "max_files": 100 }
  Server streams: { "type": "hit", "sgf_file": "...", "move_number": N }
                  { "type": "progress", "scanned": N, "total": N, "current_file": "..." }
                  { "type": "done", "scanned": N }
  Client sends: { "type": "cancel" } to stop early
"""

import asyncio
import json
import threading

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from lib.pattern_search import search_directory

router = APIRouter()


@router.websocket("/ws/patternsearch")
async def pattern_search_ws(ws: WebSocket):
    await ws.accept()
    cancel_event = threading.Event()
    worker_thread = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "cancel":
                cancel_event.set()
                await ws.send_json({"type": "cancelling"})
                continue

            if msg_type != "start":
                continue

            # Cancel any previous search
            cancel_event.set()
            if worker_thread and worker_thread.is_alive():
                worker_thread.join(timeout=2)
            cancel_event.clear()

            pattern_template = msg["pattern_template"]
            pattern_turn = msg.get("pattern_turn", 1)
            max_files = msg.get("max_files", 100)
            start_after = msg.get("start_after")
            loop = asyncio.get_event_loop()

            def send(data):
                """Thread-safe send."""
                asyncio.run_coroutine_threadsafe(
                    ws.send_json(data), loop
                )

            def work():
                scanned = 0
                seen = set()
                last_file = None
                print(f"[PatternSearch] Starting search:")
                print(f"  pattern_turn={pattern_turn}")
                print(f"  max_files={max_files}")
                print(f"  start_after={start_after}")
                print(f"  pattern_template ({len(pattern_template)}x{len(pattern_template[0]) if pattern_template else 0}):")
                for row in pattern_template:
                    print(f"    {row}")

                def on_progress(s, t, f):
                    nonlocal scanned, last_file
                    scanned = s
                    last_file = f
                    if s % 5 == 0 or s == t:  # send progress every 5 files
                        send({"type": "progress", "scanned": s, "total": t, "current_file": f})

                try:
                    for hit in search_directory(
                        pattern_template,
                        pattern_turn,
                        max_files=max_files,
                        start_after=start_after,
                        on_progress=on_progress,
                    ):
                        if cancel_event.is_set():
                            break
                        key = (hit["sgf_file"], hit["move_number"])
                        if key in seen:
                            continue
                        seen.add(key)
                        send({"type": "hit", **hit})
                except Exception as e:
                    send({"type": "error", "message": str(e)})

                send({"type": "done", "scanned": scanned, "lastFile": last_file})

            worker_thread = threading.Thread(target=work, daemon=True)
            worker_thread.start()

    except WebSocketDisconnect:
        cancel_event.set()
    except Exception:
        cancel_event.set()
