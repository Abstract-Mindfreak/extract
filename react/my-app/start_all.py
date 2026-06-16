#!/usr/bin/env python3
"""Start the local Extract stack in separate Windows consoles.

This launcher first frees the managed ports so an old React or API process
cannot mask the current working tree with stale UI/output.
"""

from __future__ import annotations

import os
import subprocess

MANAGED_PORTS = (3001, 3456, 8766, 8002)


def find_pid_on_port(port: int) -> int | None:
    try:
        output = subprocess.check_output(
            ["netstat", "-ano"],
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except Exception:
        return None

    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or f":{port}" not in line or "LISTENING" not in line:
            continue

        parts = line.split()
        if len(parts) < 5:
            continue

        try:
            return int(parts[-1])
        except ValueError:
            continue

    return None


def stop_pid(pid: int) -> None:
    try:
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/F"],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception:
        pass


def cleanup_managed_ports() -> None:
    print("Checking managed ports before launch...")
    for port in MANAGED_PORTS:
        pid = find_pid_on_port(port)
        if not pid:
            continue
        print(f"Stopping stale process on port {port}: PID {pid}")
        stop_pid(pid)


def launch_in_console(command: str, working_dir: str) -> subprocess.Popen:
    return subprocess.Popen(
        ["powershell.exe", "-NoExit", "-Command", f"cd '{working_dir}'; {command}"],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )


def main() -> None:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(parent_dir)

    archiver_cmd = "npm run archiver:server"
    react_cmd = "npm start"
    flowmusic_agent_cmd = (
        f"{project_root}\\venv\\Scripts\\python.exe "
        f"-m uvicorn react_agent.flowmusic_agent_server:app --reload --port 8766 --app-dir {project_root}"
    )
    extract_agent_cmd = (
        f"{project_root}\\venv\\Scripts\\python.exe "
        f"-m uvicorn extract_agent.server:app --reload --port 8002 --app-dir {project_root}"
    )

    print("Starting archiver server, React UI, Flowmusic Agent, and Extract Agent...")
    print(f"Working directory: {current_dir}")
    print(f"Project root: {project_root}")

    cleanup_managed_ports()

    launch_in_console(archiver_cmd, current_dir)
    launch_in_console(react_cmd, current_dir)
    launch_in_console(flowmusic_agent_cmd, current_dir)
    launch_in_console(extract_agent_cmd, current_dir)

    print("All four processes have been launched in separate consoles.")
    print("Press Enter to close this launcher. The started processes will keep running.")
    try:
        input()
    except EOFError:
        pass


if __name__ == "__main__":
    main()
