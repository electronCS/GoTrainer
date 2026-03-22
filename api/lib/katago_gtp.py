"""
KataGo GTP process manager.

Manages a single KataGo GTP subprocess. Supports sending commands
and streaming `kata-analyze` output to registered callbacks.
"""

import subprocess
import threading
import os


KATAGO_PATH = os.environ.get("KATAGO_PATH", "/opt/homebrew/bin/katago")
KATAGO_CONFIG = os.environ.get("KATAGO_CONFIG", "/opt/homebrew/Cellar/katago/1.16.0/share/katago/configs/gtp_example.cfg")
KATAGO_MODEL = os.environ.get("KATAGO_MODEL", "goTrainer/kata1-b28c512nbt-s8536703232-d4684449769.bin.gz")


class KataGoGTP:
    """Wraps a KataGo GTP subprocess."""

    def __init__(self, katago_path=None, config_path=None, model_path=None):
        katago_path = katago_path or KATAGO_PATH
        config_path = config_path or KATAGO_CONFIG

        # Model path: resolve relative to project root
        model_path = model_path or KATAGO_MODEL
        from pathlib import Path
        project_root = Path(__file__).resolve().parent.parent.parent
        if not os.path.isabs(model_path):
            model_path = str(project_root / model_path)

        print(f"[KataGo] Starting: {katago_path} gtp -config {config_path} -model {model_path}")

        self.process = subprocess.Popen(
            [katago_path, "gtp", "-config", config_path, "-model", model_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.lock = threading.Lock()
        self._callbacks = []
        self._reader_started = False
        self._start_reader()

    def _start_reader(self):
        if self._reader_started:
            return
        self._reader_started = True

        def read_stdout():
            print("[KataGo] stdout reader started")
            for line in self.process.stdout:
                stripped = line.strip()
                if not stripped:
                    continue
                # Forward info lines (from kata-analyze) to callbacks
                if stripped.startswith("info move"):
                    for cb in list(self._callbacks):
                        try:
                            cb(stripped)
                        except Exception:
                            pass

        def read_stderr():
            for line in self.process.stderr:
                print(f"[KataGo stderr] {line.strip()}")

        threading.Thread(target=read_stdout, daemon=True).start()
        threading.Thread(target=read_stderr, daemon=True).start()

    def is_alive(self):
        return self.process.poll() is None

    def send(self, command: str):
        """Send a GTP command to KataGo."""
        with self.lock:
            try:
                self.process.stdin.write(command + "\n")
                self.process.stdin.flush()
            except (BrokenPipeError, OSError):
                print("[KataGo] Broken pipe — process died")

    def register_callback(self, callback):
        """Register a callback for analysis output lines."""
        self._callbacks = [callback]

    def unregister_callbacks(self):
        self._callbacks = []

    def close(self):
        try:
            self.process.terminate()
        except Exception:
            pass


# Singleton instance (lazy init)
_instance: KataGoGTP | None = None
_instance_lock = threading.Lock()


def get_katago() -> KataGoGTP:
    """Get or create the global KataGo instance."""
    global _instance
    with _instance_lock:
        if _instance is None or not _instance.is_alive():
            if _instance is not None:
                print("[KataGo] Process died, restarting...")
                try:
                    _instance.close()
                except Exception:
                    pass
            _instance = KataGoGTP()
        return _instance
