import os
import shlex
import subprocess
from typing import Dict, Any, Tuple


class DockerSandbox:
    def __init__(
        self, image: str = "python:3.11-slim", container_name: str = "herclew-sandbox"
    ):
        self.image = image
        self.container_name = container_name
        self.use_docker = self._check_docker_available()

    def _check_docker_available(self) -> bool:
        try:
            res = subprocess.run(
                ["docker", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            return res.returncode == 0
        except FileNotFoundError:
            return False

    def start(self) -> bool:
        if not self.use_docker:
            return False
        # Stop existing container if running
        subprocess.run(
            ["docker", "stop", self.container_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            ["docker", "rm", self.container_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Start detached container
        cmd = [
            "docker",
            "run",
            "-d",
            "--name",
            self.container_name,
            "-v",
            f"{os.getcwd()}:/workspace",
            "-w",
            "/workspace",
            self.image,
            "tail",
            "-f",
            "/dev/null",
        ]
        res = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        return res.returncode == 0

    def execute_command(self, command: str) -> Tuple[int, str]:
        if self.use_docker:
            cmd: Any = ["docker", "exec", self.container_name, "bash", "-c", command]
            shell = False
        else:
            # Fallback to local execution. A bare string with ``shell=False``
            # makes subprocess.exec try to run a file literally named
            # "echo hello_world" (FileNotFoundError -> -1 on every POSIX
            # machine without Docker, e.g. CI), so split it into argv like
            # the Docker path does. Windows keeps ``shell=True`` because
            # cmd.exe interprets the string natively.
            if os.name == "nt":
                cmd = command
                shell = True
            else:
                cmd = shlex.split(command)
                shell = False

        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=shell,
                timeout=120,
            )
            return res.returncode, res.stdout + res.stderr
        except subprocess.TimeoutExpired:
            return -1, "Command timed out."
        except Exception as e:
            return -1, str(e)

    def stop(self) -> None:
        if self.use_docker:
            subprocess.run(
                ["docker", "stop", self.container_name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            subprocess.run(
                ["docker", "rm", self.container_name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
