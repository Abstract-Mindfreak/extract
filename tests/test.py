import os

def list_files(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            filepath = os.path.join(root, file)
            size = os.path.getsize(filepath)
            format_ = os.path.splitext(file)[1]
            print(f"Filename: {file}, Format: {format_}, Size: {size} bytes")

# Usage
directory_path = r"D:\WORK\CLIENTS\extract"
list_files(directory_path)