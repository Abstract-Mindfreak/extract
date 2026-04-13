import os
from dotenv import load_dotenv

# Load API keys from parent directory .env
load_dotenv(dotenv_path="../.env")

mistral_key = os.getenv("MISTRAL_API_KEY")
print(f"Mistral API Key loaded: {bool(mistral_key)}")
if mistral_key:
    print(f"Key prefix: {mistral_key[:15]}...")
    print(f"Key length: {len(mistral_key)}")
else:
    print("ERROR: Key not found! Check .env file path.")
