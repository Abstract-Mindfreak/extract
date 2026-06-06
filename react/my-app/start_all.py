#!/usr/bin/env python3
"""
Запуск archiver server, React приложения и Flowmusic Agent в отдельных терминалах
"""
import subprocess
import os
import sys

# Текущая директория
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(parent_dir)

# Команды для запуска
archiver_cmd = "npm run archiver:server"
react_cmd = "npm start"
flowmusic_agent_cmd = f"{project_root}\\venv\\Scripts\\python.exe -m uvicorn react_agent.flowmusic_agent_server:app --reload --port 8766 --app-dir {project_root}"

print("Запуск archiver server, React приложения и Flowmusic Agent...")
print(f"Рабочая директория: {current_dir}")
print(f"Родительская директория: {parent_dir}")

# Запуск archiver server в новом терминале
archiver_process = subprocess.Popen(
    ["powershell.exe", "-NoExit", "-Command", f"cd '{current_dir}'; {archiver_cmd}"],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)

# Запуск React приложения в новом терминале
react_process = subprocess.Popen(
    ["powershell.exe", "-NoExit", "-Command", f"cd '{current_dir}'; {react_cmd}"],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)

# Запуск Flowmusic Agent в новом терминале
flowmusic_agent_process = subprocess.Popen(
    ["powershell.exe", "-NoExit", "-Command", flowmusic_agent_cmd],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)

print("Все три процесса запущены в отдельных терминалах.")
print("Нажмите Enter для закрытия скрипта (процессы продолжат работу)...")
input()

print("Скрипт завершен.")
