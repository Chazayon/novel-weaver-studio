cd ~/Downloads/novel-weaver-studio/backend && uv run python -m src.main


cd backend && uv run python -m src.workflows.worker


docker-compose down -v

docker-compose up -d


cd backend
uv run python -m src.main

cd backend
uv run python -m src.workflows.worker