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
        self._callbacks = []
        self._reader_started = False
        self._start_reader()

    def _start_reader(self):
        """Start a single stdout reader thread that fans out to all registered callbacks."""
        if self._reader_started:
            return
        self._reader_started = True
        def loop():
            print("[KataGoGTP] Starting read loop...")
            for line in self.katago.stdout:
                if line.startswith("info move"):
                    stripped = line.strip()
                    for cb in list(self._callbacks):
                        try:
                            cb(stripped)
                        except Exception:
                            pass
        threading.Thread(target=loop, daemon=True).start()

    def is_alive(self):
        return self.katago.poll() is None

    def send(self, command):
        with self.lock:
            try:
                self.katago.stdin.write(command + "\n")
                self.katago.stdin.flush()
            except (BrokenPipeError, OSError):
                print("[KataGoGTP] Broken pipe — KataGo process died")
                # Don't raise; caller will handle reconnection

    def read_lines(self, callback):
        """Register a callback. Replaces any existing callback (one active connection at a time)."""
        self._callbacks = [callback]

    def close(self):
        self.katago.terminate()
