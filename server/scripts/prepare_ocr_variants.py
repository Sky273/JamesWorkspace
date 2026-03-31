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


def detect_text_blocks(gray):
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    threshold = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 12
    )
    threshold = remove_speckles(threshold, min_area=24)
    dilated = cv2.dilate(threshold, np.ones((9, 35), np.uint8), iterations=1)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blocks = []
    min_area = max(1500, int(gray.shape[0] * gray.shape[1] * 0.0025))

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < min_area:
            continue
        if w < 120 or h < 40:
            continue
        pad_x = max(12, int(w * 0.03))
        pad_y = max(10, int(h * 0.08))
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(gray.shape[1], x + w + pad_x)
        y1 = min(gray.shape[0], y + h + pad_y)
        blocks.append({
            "x0": int(x0),
            "y0": int(y0),
            "x1": int(x1),
            "y1": int(y1),
            "width": int(x1 - x0),
            "height": int(y1 - y0),
        })

    if not blocks:
        return []

    median_width = np.median([b["width"] for b in blocks])
    column_gap = max(40, int(median_width * 0.35))
    blocks.sort(key=lambda b: (b["x0"], b["y0"]))

    columns = []
    for block in blocks:
        center_x = (block["x0"] + block["x1"]) / 2.0
        matched = None
        for column in columns:
            if abs(center_x - column["center_x"]) <= column_gap:
                matched = column
                break
        if matched is None:
            matched = {"center_x": center_x, "blocks": []}
            columns.append(matched)
        matched["blocks"].append(block)
        matched["center_x"] = np.mean(
            [((item["x0"] + item["x1"]) / 2.0) for item in matched["blocks"]]
        )

    columns.sort(key=lambda c: c["center_x"])
    ordered_blocks = []
    order = 0
    for column in columns:
        for block in sorted(column["blocks"], key=lambda b: (b["y0"], b["x0"])):
            block["order"] = order
            ordered_blocks.append(block)
            order += 1

    return ordered_blocks


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


def write_blocks(gray, output_dir):
    blocks = detect_text_blocks(gray)
    written = []

    for block in blocks:
        crop = gray[block["y0"]:block["y1"], block["x0"]:block["x1"]]
        if crop.size == 0:
            continue
        crop = upscale_if_needed(crop, min_width=1600)
        out_path = output_dir / f"block-{block['order']:02d}.png"
        cv2.imwrite(str(out_path), crop)
        written.append({
            "name": f"python-block-{block['order']:02d}",
            "path": str(out_path),
            "order": int(block["order"]),
            "bbox": {
                "x0": int(block["x0"]),
                "y0": int(block["y0"]),
                "x1": int(block["x1"]),
                "y1": int(block["y1"]),
            },
            "width": int(crop.shape[1]),
            "height": int(crop.shape[0]),
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
    blocks = write_blocks(upscale_if_needed(cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)), output_dir)
    print(json.dumps({"variants": written, "blocks": blocks}))


if __name__ == "__main__":
    main()
