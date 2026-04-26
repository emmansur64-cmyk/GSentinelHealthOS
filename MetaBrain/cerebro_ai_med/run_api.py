import os

import uvicorn


if __name__ == "__main__":
    host = os.getenv("CEREBRO_HOST", "0.0.0.0")
    port = int(os.getenv("CEREBRO_PORT", "8000"))
    workers = int(os.getenv("CEREBRO_WORKERS", "1"))
    uvicorn.run(
        "cerebro_ai_med.main:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
    )
