"""OCR extraction from categorias.png using PaddleOCR."""


def extract_categories_from_image(image_path: str = None):
    """
    Extract category names from the categorias.png image using OCR.
    Falls back to Tesseract if PaddleOCR is not available.
    """
    if image_path is None:
        from pathlib import Path
        image_path = str(Path(__file__).resolve().parent.parent.parent / "categorias.png")

    print(f"Processing OCR on: {image_path}")

    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(lang="spanish", use_angle_cls=True, show_log=False)
        result = ocr.ocr(image_path, cls=True)
        texts = []
        for line in result:
            for word_info in line:
                texts.append(word_info[1][0])
        print(f"OCR extracted {len(texts)} text fragments")
        return texts
    except ImportError:
        print("PaddleOCR not installed. Install with: pip install paddleocr paddlepaddle")
        print("Falling back to Tesseract...")
        return _ocr_tesseract(image_path)


def _ocr_tesseract(image_path: str) -> list:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, lang="spa")
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        print(f"Tesseract extracted {len(lines)} text fragments")
        return lines
    except ImportError:
        print("Tesseract not available either.")
        return []
