# Local speech and document embeddings

Run these commands from your Wao checkout on **any drive**. Docker Desktop must be running with Linux containers. These are optional CPU services; no GPU is required. Wao remains a desktop client and calls their HTTP endpoints.

## Start

```powershell
docker compose -f compose.local.yml up -d
docker compose -f compose.local.yml logs --tail 30
```

The first start downloads container images and the embedding model. Wait for both services to finish loading before testing. Kokoro includes its voice/model assets in its image; do not mount an empty directory over them. The embedding model cache is retained in a named Docker volume.

Already running Kokoro on port 8880? Keep that instance and start only embeddings:

```powershell
docker compose -f compose.local.yml up -d embeddings
```

Already running an embedding server, such as llama.cpp/Jina on port 8085? Keep that service and its current Wao configuration. Start only Kokoro with `docker compose -f compose.local.yml up -d kokoro`, or start neither if both services already work. The Compose embeddings service is a separate TEI/BGE service on 8086; it does not manage your existing server or provide llama-ui. Use 8087 for Wao's optional chat API when 8085 is occupied.

Both published ports bind to this computer only. These local endpoints have no API authentication; do not expose them publicly. Image/model downloads require internet access. These third-party services are separate from Wao's privacy audit.

## Configure Wao

In **Settings → Default Models → Read aloud**, enable read aloud and use:

| Setting | Value |
| --- | --- |
| Speech server URL | `http://localhost:8880` |
| Speech model | `kokoro` |
| Voice | `af_heart` |
| Speech speed | `1.1` |
| API key | Leave empty |

Auto-read replies is controlled separately by the speaker button beside the message input.

For documents, add a **custom OpenAI-compatible provider** in Model Providers:

| Setting | Value |
| --- | --- |
| Name | Local Embeddings |
| API host/base URL | `http://localhost:8086/v1` |
| API key | `local` if the field requires a value; otherwise empty |
| Model ID | `text-embeddings-inference` |
| Model type | Embedding |

Select this model under **Default Models → Knowledge search (Embedding)** and when creating a knowledge base. The default English model produces 384-dimensional vectors and accepts up to 512 tokens per input. Keep document chunks within this limit; longer input may be truncated by the server. Use a new/reindexed knowledge base when changing embedding models. This container does not supply reranking; leave Rerank unconfigured unless you have a separate service. Your normal chat provider remains unchanged.

## Test

Wao document ingestion now sends batches of at most 32 inputs, matching TEI's default maximum client batch size. This avoids the `batch size 50 > maximum allowed batch size 32` failure. You can remove the temporary compose.batch.yml override after updating Wao and recreating the embeddings service with only compose.local.yml.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-LocalServices.ps1
```

This sends a short speech sample and an embedding request. It saves the MP3 to your temporary folder and prints its path and the returned vector size. Then test Wao's speaker button and upload a small document to a new knowledge base, asking a question whose answer is in that document.

If startup is still in progress, inspect logs and retry the test. To stop services while preserving the model cache:

```powershell
docker compose -f compose.local.yml down
```

The Kokoro default follows upstream's mutable `latest` CPU image. For reproducible deployments, set `KOKORO_IMAGE` to a tested image digest before starting. To deliberately refresh images, use `docker compose -f compose.local.yml pull` and then `up -d` again.

## Whisper dictation is separate

Whisper dictation runs inside the desktop app using whisper.cpp, without Docker. Before building a Windows installer, run `scripts/setup-local-speech.ps1` from your source checkout. It prepares `assets/whisper` for packaging. An installed app reads **its own** `resources/assets/whisper` directory, regardless of which drive held the source. Rebuild and reinstall after preparing these assets; a JavaScript build alone does not update your installed application.

## Upstream documentation

- [Kokoro CPU container](https://github.com/remsky/Kokoro-FastAPI/blob/master/docker/cpu/docker-compose.yml)
- [Kokoro configuration and packaged assets](https://github.com/remsky/Kokoro-FastAPI/blob/master/docs/configuration.md)
- [TEI supported CPU images](https://huggingface.co/docs/text-embeddings-inference/en/supported_models)
- [TEI OpenAI-compatible endpoint and cache](https://huggingface.co/docs/text-embeddings-inference/quick_tour)
- [TEI arguments](https://huggingface.co/docs/text-embeddings-inference/cli_arguments)
- [Default embedding model configuration](https://huggingface.co/BAAI/bge-small-en-v1.5/blob/main/config.json)
