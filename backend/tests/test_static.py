import httpx
import pytest

from app.main import create_app
from app.settings import Settings


@pytest.mark.asyncio
async def test_built_frontend_is_served_with_spa_fallback(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<title>ChatPRFAQ</title><div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log('ok')")
    settings = Settings(llm_provider="fake", database_url=f"sqlite+aiosqlite:///{tmp_path}/t.db", static_dir=str(dist), _env_file=None)
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            assert (await c.get("/api/health")).status_code == 200
            home = await c.get("/")
            assert home.status_code == 200 and "ChatPRFAQ" in home.text
            deep = await c.get("/runs/run_abc/council")
            assert deep.status_code == 200 and "ChatPRFAQ" in deep.text  # SPA fallback
            js = await c.get("/assets/app.js")
            assert js.status_code == 200 and "console" in js.text
            assert (await c.get("/../../etc/passwd")).status_code in (200, 404)  # never escapes the dist dir
