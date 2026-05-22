"""Pattern detection in contractor events using clustering."""

from typing import List, Dict


async def detect_patterns(descriptions: List[str]) -> List[Dict]:
    """Detect recurring patterns in event descriptions.
    
    Uses DBSCAN clustering when sklearn available, falls back to keyword grouping.
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.cluster import DBSCAN

        if len(descriptions) < 3:
            return [{"label": "Недостаточно данных", "count": len(descriptions), "items": descriptions}]

        vectorizer = TfidfVectorizer(max_features=100)
        X = vectorizer.fit_transform(descriptions)
        clustering = DBSCAN(eps=0.5, min_samples=2).fit(X.toarray())

        patterns: Dict[int, List[str]] = {}
        for i, label in enumerate(clustering.labels_):
            patterns.setdefault(int(label), []).append(descriptions[i])

        return [
            {"label": f"Паттерн {k}" if k >= 0 else "Шум",
             "count": len(v), "items": v[:5]}
            for k, v in patterns.items()
        ]
    except ImportError:
        return _stub_patterns(descriptions)


def _stub_patterns(descriptions: List[str]) -> List[Dict]:
    keywords = {"срок": "Нарушение сроков", "качество": "Проблемы качества",
                "датчик": "Проблемы автоматизации", "фундамент": "Проблемы фундамента"}
    groups: Dict[str, List[str]] = {}
    for d in descriptions:
        for kw, label in keywords.items():
            if kw in d.lower():
                groups.setdefault(label, []).append(d)
                break
        else:
            groups.setdefault("Прочее", []).append(d)
    return [{"label": k, "count": len(v), "items": v[:3]} for k, v in groups.items()]