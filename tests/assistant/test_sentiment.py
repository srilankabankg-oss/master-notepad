import pytest


def test_sentiment_stub():
    from src.analysis.sentiment import _stub_sentiment
    r = _stub_sentiment("отлично качественно вовремя")
    assert r["positive"] > r["negative"]

    r2 = _stub_sentiment("плохо срыв нарушение задержка")
    assert r2["negative"] > r2["positive"]


def test_patterns_keyword_fallback():
    from src.analysis.patterns import _stub_patterns
    patterns = _stub_patterns(["срыв сроков поставки", "проблемы качества бетона", "забыли датчики"])
    assert len(patterns) > 0


def test_config_defaults():
    from src.config import settings
    assert settings.port == 3002
    assert settings.main_api_url == "http://localhost:3355"