from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5433/master_notepad"
    main_api_url: str = "http://localhost:3001"
    llm_api_url: str = "https://api.stepfun.com/step_plan/v1"
    llm_api_key: str = ""
    llm_model: str = "step-3.5-flash"
    embedding_model: str = "intfloat/multilingual-e5-base"
    port: int = 3002
    log_level: str = "info"

    model_config = {"env_file": "../../.env", "env_prefix": "", "extra": "allow"}


settings = Settings()