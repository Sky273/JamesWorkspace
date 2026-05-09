from itertools import combinations


def diffs(B):
    out = set()
    for i in range(len(B)):
        for j in range(i + 1, len(B)):
            out.add(B[j] - B[i])
    return out


def contiguous_v(B):
    d = diffs(B)
    v = 0
    while v + 1 in d:
        v += 1
    return v, d


def exhaustive(size, max_value):
    best = None
    for comb in combinations(range(2, max_value + 1), size - 2):
        B = (0, 1) + comb
        v, d = contiguous_v(B)
        score = (size * size) / v if v else float('inf')
        if best is None or score < best[0] or (score == best[0] and v > best[1]):
            best = (score, v, B)
    return best


def find_meeting_threshold(size, target_v, max_value):
    hits = []
    for comb in combinations(range(2, max_value + 1), size - 2):
        B = (0, 1) + comb
        v, d = contiguous_v(B)
        if v >= target_v:
            hits.append((v, B))
    hits.sort(reverse=True)
    return hits


if __name__ == '__main__':
    print('size5_best_<=20', exhaustive(5, 20))
    print('size5_need_v>=10 hits<=20', find_meeting_threshold(5, 10, 20)[:20])
    print('size6_best_<=25', exhaustive(6, 25))
    print('size6_need_v>=14 hits<=25', find_meeting_threshold(6, 14, 25)[:20])
    print('size7_best_<=40', exhaustive(7, 40))
    print('size7_need_v>=19 hits<=40', find_meeting_threshold(7, 19, 40)[:20])
