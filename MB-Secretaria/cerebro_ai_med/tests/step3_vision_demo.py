from __future__ import annotations

from io import BytesIO
from pprint import pprint

from PIL import Image, ImageDraw

from cerebro_ai_med.vision import MedicalImagePredictor


def _build_demo_image_bytes() -> bytes:
    image = Image.new("L", (512, 512), color=20)
    draw = ImageDraw.Draw(image)

    draw.rectangle((96, 96, 420, 420), outline=230, width=5)
    draw.ellipse((170, 150, 350, 330), fill=180)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def run_step3_demo() -> None:
    predictor = MedicalImagePredictor()
    image_bytes = _build_demo_image_bytes()
    output = predictor.predict(image_bytes=image_bytes, modality="XRAY")

    print("PASO 3 demo (vision) OK")
    pprint(output)


if __name__ == "__main__":
    run_step3_demo()