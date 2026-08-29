from pathlib import Path

from dotenv import dotenv_values
from supabase import create_client

BASE_DIR = Path(__file__).resolve().parent
vals = dotenv_values(BASE_DIR / ".env")
client = create_client(vals["SUPABASE_URL"], vals["SUPABASE_SECRET_KEY"])

data = client.storage.from_("photos").download("test.jpg")
print(type(data).__name__)
print(len(data))
output_path = BASE_DIR / "downloaded_test.jpg"
output_path.write_bytes(data)
print(output_path.name)
