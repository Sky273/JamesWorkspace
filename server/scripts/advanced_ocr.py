import argparse
import json
import sys


def run_paddleocr(image_path):
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception as exc:
        raise RuntimeError(f"PaddleOCR unavailable: {exc}") from exc

    lang = "fr"
    ocr = PaddleOCR(
        use_angle_cls=False,
        lang=lang,
        show_log=False,
        use_gpu=False
    )
    result = ocr.ocr(image_path, cls=False)

    lines = []
    confidences = []
    for block in result or []:
        for item in block or []:
            if len(item) < 2:
                continue
            text, confidence = item[1]
            if text:
                lines.append(text)
                try:
                    confidences.append(float(confidence))
                except Exception:
                    pass

    text = "\n".join(lines).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return {"text": text, "confidence": avg_conf, "engine": "paddleocr-python", "lang": lang}


def healthcheck_paddleocr():
    try:
        from paddleocr import PaddleOCR  # type: ignore
        _ = PaddleOCR(
            use_angle_cls=False,
            lang="fr",
            show_log=False,
            use_gpu=False
        )
        return {"ok": True, "engine": "paddleocr-python"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--backend", default="paddleocr")
    parser.add_argument("--healthcheck", action="store_true")
    args = parser.parse_args()

    if args.backend != "paddleocr":
        print(json.dumps({"error": f"Unsupported backend: {args.backend}"}))
        sys.exit(2)

    try:
        if args.healthcheck:
            print(json.dumps(healthcheck_paddleocr()))
            return
        result = run_paddleocr(args.image)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(3)


if __name__ == "__main__":
    main()
