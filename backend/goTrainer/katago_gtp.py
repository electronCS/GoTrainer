import subprocess
import threading

class KataGoGTP:
    def __init__(self, katago_path, config_path, model_path):
        self.katago = subprocess.Popen(
            [katago_path, "gtp", "-config", config_path, "-model", model_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line-buffered
        )
        self.lock = threading.Lock()

    def send(self, command):
        with self.lock:
            self.katago.stdin.write(command + "\n")
            self.katago.stdin.flush()

    def read_lines(self, callback):
        def loop():
            print("[KataGoGTP] Starting read loop...")
            for line in self.katago.stdout:
                # print("[KataGoGTP] stdout:", line.strip())  # log every line

                if line.startswith("info move"):
                    callback(line.strip())
        threading.Thread(target=loop, daemon=True).start()

    def close(self):
        self.katago.terminate()
