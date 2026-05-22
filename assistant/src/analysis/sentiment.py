"""Sentiment analysis for reviews and events using HuggingFace transformers."""

from typing import List, Dict


async def analyze_sentiment(texts: List[str]) -> List[Dict[str, float]]:
    """Analyze sentiment of multiple texts.
    
    Returns list of {positive, neutral, negative} scores per text.
    Uses rubert-base-cased-sentiment when available, falls back to rule-based stub.
    """
    try:
        from transformers import pipeline
        model = pipeline("sentiment-analysis", model="blanchefort/rubert-base-cased-sentiment")
        results = []
        for text in texts:
            r = model(text[:512])[0]
            results.append({"label": r["label"], "score": round(r["score"], 3)})
        return results
    except ImportError:
        return [_stub_sentiment(t) for t in texts]


def _stub_sentiment(text: str) -> Dict[str, float]:
    pos = sum(1 for w in ["отлично", "хорошо", "качественно", "вовремя"] if w in text.lower())
    neg = sum(1 for w in ["плохо", "срыв", "нарушение", "задержка"] if w in text.lower())
    return {"positive": round(pos / max(pos + neg, 1), 3), "neutral": 0.0, "negative": round(neg / max(pos + neg, 1), 3)}


async def summarize_text(text: str) -> str:
    """Summarize text using LLM or fallback."""
    try:
        from ..llm.provider import llm_completion
        return await llm_completion(f"Суммаризируй текст на русском: {text[:2000]}")
    except Exception:
        return text[:500] + ("..." if len(text) > 500 else "")