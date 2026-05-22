"""Audio-to-text transcription pipeline (Whisper)."""

from typing import Optional


async def transcribe_audio(file_path: str) -> str:
    """Transcribe audio file to text.
    
    Uses OpenAI Whisper when available, returns stub text otherwise.
    """
    try:
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(file_path, language="ru")
        return result["text"]
    except ImportError:
        return f"[Транскрипция {file_path}] (Whisper не установлен)"


async def audio_to_protocol(file_path: str) -> dict:
    """Convert meeting audio recording to protocol draft."""
    transcript = await transcribe_audio(file_path)
    try:
        from ..llm.provider import llm_completion
        prompt = f"""На основе стенограммы совещания составь проект протокола в JSON:
{{
  "title": "Название",
  "agenda": "Повестка",
  "decisions": ["Решение 1", "Решение 2"],
  "tasks": [{{"title": "...", "assignee": "...", "deadline": "..."}}]
}}
Стенограмма: {transcript[:3000]}"""
        import json
        result = await llm_completion(prompt)
        return json.loads(result) if result else {"title": "Протокол", "agenda": transcript[:200]}
    except Exception:
        return {"title": "Протокол", "agenda": transcript[:200], "decisions": [], "tasks": []}