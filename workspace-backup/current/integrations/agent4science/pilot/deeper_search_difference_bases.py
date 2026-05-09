import argparse
import heapq
import random


def evaluate(B):
    B = tuple(sorted(set(B)))
    if len(B) < 2 or B[0] != 0 or B[1] != 1:
        return float('inf'), 0
    diffs = set()
    for i in range(len(B)):
        bi = B[i]
        for j in range(i + 1, len(B)):
            diffs.add(B[j] - bi)
    v = 0
    while v + 1 in diffs:
        v += 1
    return (len(B) ** 2) / v if v else float('inf'), v


def beam_search(size, max_value, beam_width, steps, seed):
    rng = random.Random(seed)
    seeds = [
        tuple([0, 1] + list(range(2, size))),
        (0, 1, 4, 6),
        (0, 1, 2, 6, 10, 13),
        (0, 1, 2, 11, 15, 18, 21, 23),
        (0, 1, 4, 10, 16, 22, 24, 27, 29),
    ]
    normalized = []
    for seedB in seeds:
        arr = [0, 1] + [x for x in seedB if x not in (0, 1)]
        arr = sorted(dict.fromkeys(arr))
        while len(arr) < size:
            x = rng.randint(2, max_value)
            if x not in arr:
                arr.append(x)
                arr.sort()
        if len(arr) > size:
            arr = arr[:2] + arr[-(size - 2):]
            arr = sorted(arr)
        normalized.append(tuple(arr))

    seen = set()
    beam = []
    for B in normalized:
        B = tuple(sorted(set(B)))
        if len(B) != size or B[0] != 0 or B[1] != 1:
            continue
        s, v = evaluate(B)
        beam.append((s, -v, B))
        seen.add(B)
    beam = heapq.nsmallest(beam_width, beam)
    best = min(beam) if beam else (float('inf'), 0, None)
    print(f'start_best score={best[0]:.12f} v={-best[1]} B={best[2]}', flush=True)

    for step in range(steps):
        candidates = list(beam)
        top = beam[: min(len(beam), beam_width)]
        for s, neg_v, B in top:
            v = -neg_v
            if s < best[0] or (s == best[0] and v > -best[1]):
                best = (s, neg_v, B)
                print(f'beam step={step} new_best score={s:.12f} v={v} B={B}', flush=True)
            for idx in range(2, size):
                base = B[idx]
                for delta in [-12, -9, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 9, 12]:
                    cand = base + delta
                    if cand <= 1 or cand > max_value or cand in B:
                        continue
                    arr = list(B)
                    arr[idx] = cand
                    arr = tuple(sorted(arr))
                    if arr in seen or len(set(arr)) != size or arr[0] != 0 or arr[1] != 1:
                        continue
                    seen.add(arr)
                    s2, v2 = evaluate(arr)
                    candidates.append((s2, -v2, arr))
                for _ in range(5):
                    cand = rng.randint(2, max_value)
                    if cand in B:
                        continue
                    arr = list(B)
                    arr[idx] = cand
                    arr = tuple(sorted(arr))
                    if arr in seen or len(set(arr)) != size or arr[0] != 0 or arr[1] != 1:
                        continue
                    seen.add(arr)
                    s2, v2 = evaluate(arr)
                    candidates.append((s2, -v2, arr))
        beam = heapq.nsmallest(beam_width, candidates)
    best_score, neg_v, best_B = min(beam)
    best_v = -neg_v
    print(f'FINAL score={best_score:.12f} v={best_v} B={best_B}', flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, required=True)
    ap.add_argument('--max-value', type=int, default=160)
    ap.add_argument('--beam-width', type=int, default=800)
    ap.add_argument('--steps', type=int, default=3000)
    ap.add_argument('--seed', type=int, default=42)
    args = ap.parse_args()
    beam_search(args.size, args.max_value, args.beam_width, args.steps, args.seed)
