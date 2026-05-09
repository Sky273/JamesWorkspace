import argparse
import heapq
import random
import time
from itertools import combinations


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


def exact_search(size, max_value):
    best = (float('inf'), 0, None)
    for comb in combinations(range(2, max_value + 1), size - 2):
        B = (0, 1) + comb
        score, v = evaluate(B)
        if score < best[0] or (score == best[0] and v > best[1]):
            best = (score, v, B)
            print(f"exact size={size} new_best score={score:.12f} v={v} B={B}", flush=True)
    return best


def beam_search(size, max_value, beam_width, steps, seed):
    rng = random.Random(seed)
    seed_sets = [
        tuple([0, 1] + list(range(2, size))),
        (0, 1, 4, 6) + tuple(range(7, 7 + max(0, size - 4))),
        (0, 1, 2, 6, 10, 13, 19)[:size],
        (0, 1, 4, 7, 9, 15, 18)[:size],
    ]
    seen = set()
    beam = []
    for B in seed_sets:
        B = tuple(sorted(set(B)))
        if len(B) != size:
            continue
        score, v = evaluate(B)
        state = (score, -v, B)
        heapq.heappush(beam, state)
        seen.add(B)
    best = min(beam) if beam else (float('inf'), 0, None)

    for step in range(steps):
        candidates = []
        top = sorted(beam)[:beam_width]
        for score, neg_v, B in top:
            v = -neg_v
            if score < best[0] or (score == best[0] and v > -best[1]):
                best = (score, neg_v, B)
                print(f"beam step={step} new_best score={score:.12f} v={v} B={B}", flush=True)
            for idx in range(2, size):
                for delta in [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]:
                    cand = B[idx] + delta
                    if cand <= 1 or cand > max_value:
                        continue
                    if cand in B:
                        continue
                    B2 = list(B)
                    B2[idx] = cand
                    B2 = tuple(sorted(B2))
                    if B2 in seen or len(B2) != size or B2[0] != 0 or B2[1] != 1:
                        continue
                    seen.add(B2)
                    s2, v2 = evaluate(B2)
                    candidates.append((s2, -v2, B2))
                # random jumps
                for _ in range(3):
                    cand = rng.randint(2, max_value)
                    if cand in B:
                        continue
                    B2 = list(B)
                    B2[idx] = cand
                    B2 = tuple(sorted(B2))
                    if B2 in seen or len(B2) != size or B2[0] != 0 or B2[1] != 1:
                        continue
                    seen.add(B2)
                    s2, v2 = evaluate(B2)
                    candidates.append((s2, -v2, B2))
        if not candidates:
            continue
        beam = heapq.nsmallest(beam_width, candidates)
    score, neg_v, B = best
    return score, -neg_v, B


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--exact-size', type=int)
    ap.add_argument('--exact-max', type=int, default=40)
    ap.add_argument('--beam-size', type=int)
    ap.add_argument('--beam-max', type=int, default=60)
    ap.add_argument('--beam-width', type=int, default=200)
    ap.add_argument('--beam-steps', type=int, default=200)
    ap.add_argument('--seed', type=int, default=42)
    args = ap.parse_args()

    if args.exact_size:
        print('EXACT_RESULT', exact_search(args.exact_size, args.exact_max), flush=True)
    if args.beam_size:
        print('BEAM_RESULT', beam_search(args.beam_size, args.beam_max, args.beam_width, args.beam_steps, args.seed), flush=True)


if __name__ == '__main__':
    main()
