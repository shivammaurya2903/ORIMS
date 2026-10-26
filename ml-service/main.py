"""
Compatibility wrapper for ORIMS ML Service.
Re-exports FastAPI app from api.py to support existing deployment scripts and tests.
"""

import os
import warnings

# On modern Windows (Windows 11+), wmic.exe is deprecated/uninstalled by default.
# Joblib's loky backend attempts to run 'wmic' to count physical CPU cores and emits a WinError 2 UserWarning.
# Pre-populating loky's physical_cores_cache and setting LOKY_MAX_CPU_COUNT completely resolves this.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))
try:
    import joblib.externals.loky.backend.context as _loky_context
    _loky_context.physical_cores_cache = os.cpu_count() or 4
except Exception:
    pass

warnings.filterwarnings("ignore", message=r".*Could not find the number of physical cores.*", category=UserWarning)

from api import app, load_artifacts

__all__ = ['app', 'load_artifacts']

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
