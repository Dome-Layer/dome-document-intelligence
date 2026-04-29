from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # LLM
    llm_provider: Literal["claude", "azure_openai", "ollama"] = "claude"
    anthropic_api_key: str = ""

    # Azure OpenAI (enterprise)
    azure_openai_endpoint: str = ""
    azure_openai_key: str = ""
    azure_openai_deployment: str = ""

    # Ollama (air-gapped)
    ollama_url: str = "http://localhost:11434"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # App
    environment: Literal["development", "production"] = "development"
    cors_origins: str = "http://localhost:3000"
    max_file_size_mb: int = 20
    dev_bypass_auth: bool = False

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()
