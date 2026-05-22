# AI Analysis API endpoints
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from ..analysis.sentiment import analyze_sentiment, summarize_text
from ..analysis.patterns import detect_patterns
from ..analysis.audio_pipeline import transcribe_audio, audio_to_protocol

router = APIRouter(prefix="/api/ai", tags=["analysis"])


class SentimentRequest(BaseModel):
    texts: List[str]

class PatternRequest(BaseModel):
    descriptions: List[str]

class SummarizeRequest(BaseModel):
    text: str

@router.post("/analyze/sentiment")
async def sentiment_endpoint(req: SentimentRequest):
    results = await analyze_sentiment(req.texts)
    return {"results": results}

@router.post("/analyze/patterns")
async def patterns_endpoint(req: PatternRequest):
    patterns = await detect_patterns(req.descriptions)
    return {"patterns": patterns}

@router.post("/analyze/summarize")
async def summarize_endpoint(req: SummarizeRequest):
    summary = await summarize_text(req.text)
    return {"summary": summary}

@router.post("/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    import tempfile, os
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        transcript = await transcribe_audio(tmp_path)
        return {"transcript": transcript}
    finally:
        os.unlink(tmp_path)

@router.post("/transcribe/protocol")
async def transcribe_protocol_endpoint(file: UploadFile = File(...)):
    import tempfile, os
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        protocol = await audio_to_protocol(tmp_path)
        return protocol
    finally:
        os.unlink(tmp_path)