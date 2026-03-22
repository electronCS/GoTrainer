"""
KataGo GTP WebSocket endpoint.

Protocol:
  Client sends JSON: { "type": "analyze", "moves": [["b","dd"],["w","pp"]], "turn": "b" }
  Client sends JSON: { "type": "stop" }
  Server streams:    { "type": "analysis", "moves": [{move,visits,winrate,scoreLead,...}] }

The "moves" array uses SGF-style coords: [color, coord] pairs.
Color is "b"/"w", coord is an SGF 2-letter string like "dd".
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from lib.katago_gtp import get_katago

router = APIRouter()

# Map SGF coord (e.g. "dd") to KataGo/GTP coord (e.g. "D16")
LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ"  # no I


def sgf_to_gtp(sgf_coord: str, board_size: int = 19) -> str:
    """Convert SGF coord like 'dd' to GTP coord like 'D16'."""
    if not sgf_coord or len(sgf_coord) != 2:
        return "pass"
    col = ord(sgf_coord[0]) - ord('a')
    row = ord(sgf_coord[1]) - ord('a')
    if col < 0 or col >= board_size or row < 0 or row >= board_size:
        return "pass"
    gtp_col = LETTERS[col]
    gtp_row = board_size - row
    return f"{gtp_col}{gtp_row}"


def parse_info_line(line: str) -> list[dict]:
    """Parse a KataGo info line into a list of move analysis dicts."""
    # Split on "info move", add it back to each part
    chunks = line.split("info move ")
    results = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        full = "info move " + chunk
        parts = full.split()
        info = {}
        i = 0
        while i < len(parts):
            if parts[i] == "move" and i + 1 < len(parts):
                info["move"] = parts[i + 1]
                i += 2
            elif parts[i] == "visits" and i + 1 < len(parts):
                info["visits"] = int(parts[i + 1])
                i += 2
            elif parts[i] == "winrate" and i + 1 < len(parts):
                info["winrate"] = float(parts[i + 1])
                i += 2
            elif parts[i] == "scoreLead" and i + 1 < len(parts):
                info["scoreLead"] = float(parts[i + 1])
                i += 2
            elif parts[i] == "prior" and i + 1 < len(parts):
                info["prior"] = float(parts[i + 1])
                i += 2
            elif parts[i] == "order" and i + 1 < len(parts):
                info["order"] = int(parts[i + 1])
                i += 2
            else:
                i += 1
        if "move" in info:
            results.append(info)
    return results


@router.websocket("/ws/katago")
async def katago_ws(ws: WebSocket):
    await ws.accept()
    loop = asyncio.get_event_loop()
    katago = get_katago()

    def on_info(line: str):
        """Called from KataGo reader thread with an info line."""
        moves = parse_info_line(line)
        if moves:
            asyncio.run_coroutine_threadsafe(
                ws.send_json({"type": "analysis", "moves": moves}),
                loop,
            )

    katago.register_callback(on_info)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                # Treat as raw GTP command (for debugging)
                katago.send(raw.strip())
                continue

            msg_type = msg.get("type")

            if msg_type == "analyze":
                moves = msg.get("moves", [])
                turn = msg.get("turn", "b")
                board_size = msg.get("boardSize", 19)
                interval = msg.get("interval", 10)  # centiseconds
                komi = msg.get("komi")
                rules = msg.get("rules")

                # Clear and replay position (avoids sync bugs)
                katago.send("clear_board")
                katago.send(f"boardsize {board_size}")

                # Set komi if provided
                if komi is not None:
                    katago.send(f"komi {komi}")

                # Set rules if provided (japanese, chinese, etc.)
                if rules:
                    katago.send(f"kata-set-rules {rules}")

                for color, coord in moves:
                    gtp_coord = sgf_to_gtp(coord, board_size)
                    katago.send(f"play {color} {gtp_coord}")

                # Start analysis
                katago.send(f"kata-analyze {turn} {interval}")

            elif msg_type == "stop":
                katago.send("stop")

    except WebSocketDisconnect:
        katago.send("stop")
        katago.unregister_callbacks()
    except Exception:
        katago.send("stop")
        katago.unregister_callbacks()
