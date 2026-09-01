from pathlib import Path
from PIL import Image

# Source and destination folders
SOURCE_FOLDER = Path("images")
DESTINATION_FOLDER = Path("img")

# Supported image formats
SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".gif"
}

QUALITY = 85  # Recommended: 80-85

converted = 0
skipped = 0

for image_path in SOURCE_FOLDER.rglob("*"):
    if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        continue

    # Preserve folder structure
    relative_path = image_path.relative_to(SOURCE_FOLDER)
    output_path = DESTINATION_FOLDER / relative_path.with_suffix(".webp")

    # Create destination folder if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with Image.open(image_path) as img:
            if img.mode in ("RGBA", "LA", "P"):
                img.save(output_path, "WEBP", quality=QUALITY, method=6)
            else:
                img.convert("RGB").save(
                    output_path,
                    "WEBP",
                    quality=QUALITY,
                    method=6
                )

        print(f"✓ {relative_path}")
        converted += 1

    except Exception as e:
        print(f"✗ Failed: {relative_path}")
        print(e)
        skipped += 1

print("\n----------------------------")
print(f"Converted : {converted}")
print(f"Skipped   : {skipped}")
print(f"Saved to  : {DESTINATION_FOLDER.resolve()}")
print("----------------------------")