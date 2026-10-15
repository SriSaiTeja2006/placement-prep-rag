import os
import sys
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv()

from src.generation.groq_client import GroqClient

try:
    client = GroqClient()
    res = client.generate("Say hello and confirm you are working.")
    with open("groq_debug.txt", "w") as f:
        f.write(f"SUCCESS: {res}\n")
    print("Success")
except Exception as e:
    with open("groq_debug.txt", "w") as f:
        f.write(f"ERROR: {e}\n")
    print(f"Error: {e}")
