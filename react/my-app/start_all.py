#!/usr/bin/env python3
"""
Запуск archiver server и React приложения в отдельных терминалах
"""
import subprocess
import os
import sys

# Текущая директория
current_dir = os.path.dirname(os.path.abspath(__file__))

# Команды для запуска
archiver_cmd = "npm run archiver:server"
react_cmd = "npm start"

print("Запуск archiver server и React приложения...")
print(f"Рабочая директория: {current_dir}")

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

print("Оба процесса запущены в отдельных терминалах.")
print("Нажмите Enter для закрытия скрипта (процессы продолжат работу)...")
input()

print("Скрипт завершен.")
