import pytest


@pytest.mark.asyncio
async def test_audio_stub():
    from src.analysis.audio_pipeline import transcribe_audio
    text = await transcribe_audio("/tmp/nonexistent.mp3")
    assert "Транскрипция" in text or "Whisper" in text


@pytest.mark.asyncio
async def test_protocol_draft():
    from src.analysis.audio_pipeline import audio_to_protocol
    result = await audio_to_protocol("/tmp/nonexistent.mp3")
    assert result["title"] == "Протокол"
    assert "agenda" in result