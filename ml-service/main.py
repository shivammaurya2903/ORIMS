"""
Compatibility wrapper for ORIMS ML Service.
Re-exports FastAPI app from api.py to support existing deployment scripts and tests.
"""

from api import app, load_artifacts

__all__ = ['app', 'load_artifacts']

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
