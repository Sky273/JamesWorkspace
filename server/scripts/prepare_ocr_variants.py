import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def ensure_dir(path_str):
    path = Path(path_str)
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_grayscale(image_path):
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise RuntimeError(f"Unable to read image: {image_path}")
    return image


def upscale_if_needed(image, min_width=1800):
    if image.shape[1] >= min_width:
        return image
    scale = min_width / image.shape[1]
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def remove_speckles(binary, min_area=18):
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    cleaned = np.zeros_like(binary)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            cleaned[labels == i] = 255
    return cleaned


def find_content_bbox(gray):
    blurred = cv2.medianBlur(gray, 3)
    _, threshold = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    cleaned = remove_speckles(threshold)
    coords = cv2.findNonZero(cleaned)
    if coords is None:
        return 0, 0, gray.shape[1], gray.shape[0]
    x, y, w, h = cv2.boundingRect(coords)
    padding = 24
    return (
        max(0, x - padding),
        max(0, y - padding),
        min(gray.shape[1], x + w + padding),
        min(gray.shape[0], y + h + padding),
    )


def detect_dense_column(gray):
    _, threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    cleaned = remove_speckles(threshold)
    projection = cleaned.sum(axis=0).astype(np.float32)
    if projection.max() <= 0:
        return 0, gray.shape[1]

    kernel = np.ones(25, dtype=np.float32) / 25.0
    smoothed = np.convolve(projection, kernel, mode="same")
    active = np.where(smoothed > max(20.0, smoothed.max() * 0.08))[0]
    if active.size == 0:
        return 0, gray.shape[1]

    x0 = int(active.min())
    x1 = int(active.max()) + 1
    padding = max(20, int((x1 - x0) * 0.08))
    return max(0, x0 - padding), min(gray.shape[1], x1 + padding)


def build_variants(gray):
    variants = []

    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    upscaled = upscale_if_needed(normalized)

    denoised = cv2.fastNlMeansDenoising(upscaled, None, 18, 7, 21)
    adaptive = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 13
    )
    otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    morph = cv2.morphologyEx(adaptive, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

    variants.append(("python-upscaled-gray", upscaled))
    variants.append(("python-denoised-gray", denoised))
    variants.append(("python-adaptive-threshold", adaptive))
    variants.append(("python-otsu-threshold", otsu))
    variants.append(("python-opened-threshold", morph))

    x0, y0, x1, y1 = find_content_bbox(denoised)
    content_crop = denoised[y0:y1, x0:x1]
    if content_crop.size:
        content_crop = upscale_if_needed(content_crop, min_width=2000)
        variants.append(("python-content-crop", content_crop))
        variants.append((
            "python-content-adaptive",
            cv2.adaptiveThreshold(content_crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 13),
        ))

        col0, col1 = detect_dense_column(content_crop)
        column_crop = content_crop[:, col0:col1]
        if column_crop.size:
            column_crop = upscale_if_needed(column_crop, min_width=1800)
            variants.append(("python-column-crop", column_crop))
            variants.append((
                "python-column-adaptive",
                cv2.adaptiveThreshold(column_crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11),
            ))
            variants.append((
                "python-column-otsu",
                cv2.threshold(column_crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
            ))

    return variants


def write_variants(variants, output_dir):
    written = []
    seen = set()

    for name, image in variants:
        if image is None or image.size == 0:
            continue
        key = (name, image.shape[1], image.shape[0], int(image.mean()))
        if key in seen:
            continue
        seen.add(key)

        out_path = output_dir / f"{name}.png"
        cv2.imwrite(str(out_path), image)
        written.append({
            "name": name,
            "path": str(out_path),
            "width": int(image.shape[1]),
            "height": int(image.shape[0]),
        })

    return written


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = ensure_dir(args.output_dir)

    gray = load_grayscale(input_path)
    variants = build_variants(gray)
    written = write_variants(variants, output_dir)
    print(json.dumps({"variants": written}))


if __name__ == "__main__":
    main()
