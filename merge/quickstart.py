import asyncio
import os
from dotenv import load_dotenv
from promptlab import PromptLab
from promptlab.types import PromptTemplate, Dataset

# Load API keys from .env
load_dotenv(dotenv_path="../.env")

async def main():
    # Initialize PromptLab with local tracer
    tracer_config = {
        "type": "local",
        "db_file": "./promptlab.db"
    }
    pl = PromptLab(tracer_config)

    # Create a prompt template
    prompt_name = "essay_feedback"
    prompt_description = "A prompt for generating feedback on essays"
    system_prompt = "You are a helpful assistant who can provide feedback on essays."
    user_prompt = """The essay topic is - <essay_topic>.
               The submitted essay is - <essay>
               Now write feedback on this essay."""

    prompt_template = PromptTemplate(
        name=prompt_name,
        description=prompt_description,
        system_prompt=system_prompt,
        user_prompt=user_prompt
    )
    pt = pl.asset.create(prompt_template)
    print(f"Created prompt template: {pt.name}")

    # Create dataset
    dataset_name = "essay_samples"
    dataset_description = "dataset for evaluating the essay_feedback prompt"
    dataset_file_path = "./essay_feedback.jsonl"
    dataset = Dataset(
        name=dataset_name,
        description=dataset_description,
        file_path=dataset_file_path
    )
    ds = pl.asset.create(dataset)
    print(f"Created dataset: {ds.name}")

    # Create experiment with Mistral via OpenAI-compatible API
    mistral_api_key = os.getenv("MISTRAL_API_KEY")
    mistral_model = os.getenv("MISTRAL_MODEL", "mistral-large-latest")
    if not mistral_api_key:
        raise ValueError("MISTRAL_API_KEY not found in .env file")

    experiment_config = {
        "name": "demo_experiment",
        "completion_model_config": {
            "name": f"deepseek/{mistral_model}",
            "type": "completion",
            "api_key": mistral_api_key,
            "endpoint": "https://api.mistral.ai/v1"
        },
        "embedding_model_config": {
            "name": "deepseek/mistral-embed",
            "type": "embedding",
            "api_key": mistral_api_key,
            "endpoint": "https://api.mistral.ai/v1"
        },
        "prompt_template": pt,
        "dataset": ds,
        "evaluation": [
            {
                "metric": "relevance",
                "column_mapping": {
                    "response": "$completion",
                    "query": "essay_topic",
                },
            },
        ],
    }

    await pl.experiment.run_async(experiment_config)
    print("Experiment completed successfully!")

    # Start PromptLab Studio
    print("Starting PromptLab Studio on http://localhost:8000")
    print("Press Ctrl+C to stop the server")
    await pl.studio.start_async(8000)

if __name__ == "__main__":
    asyncio.run(main())
