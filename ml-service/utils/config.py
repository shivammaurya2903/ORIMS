import os
import warnings
from pathlib import Path

# Silence loky/joblib wmic CPU detection warning on modern Windows
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))
try:
    import joblib.externals.loky.backend.context as _loky_context
    _loky_context.physical_cores_cache = os.cpu_count() or 4
except Exception:
    pass

warnings.filterwarnings("ignore", message=r".*Could not find the number of physical cores.*", category=UserWarning)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
DATASETS_DIR = ROOT / 'datasets'
MODELS_DIR = ROOT / 'models'
ARTIFACTS_DIR = ROOT / 'artifacts'
NOTEBOOKS_DIR = ROOT / 'notebooks'

for p in [DATA_DIR, DATASETS_DIR, MODELS_DIR, ARTIFACTS_DIR, NOTEBOOKS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

PYTHON_ENV = os.getenv('PYTHON_ENV', os.getenv('NODE_ENV', 'development')).lower()
DATASET = os.getenv('ORIMS_DATASET', 'supermarket').lower()

# Secret contract: check ML_SERVICE_API_KEY first, fallback to ML_API_KEY
_raw_key = os.getenv('ML_SERVICE_API_KEY') or os.getenv('ML_API_KEY')
KNOWN_DEV_KEYS = {'dev-ml-api-key', 'your-ml-service-api-key', 'default-key', 'secret', 'test'}

def validate_ml_api_key(env_name: str, key_val: str | None) -> str:
    env = (env_name or 'development').lower()
    if env in ('production', 'staging'):
        if not key_val or not key_val.strip():
            raise RuntimeError(f"[SECURITY] ML_SERVICE_API_KEY is required in {env} environment")
        if key_val.strip() in KNOWN_DEV_KEYS:
            raise RuntimeError(f"[SECURITY] ML_SERVICE_API_KEY cannot use known development default in {env} environment")
        if len(key_val.strip()) < 16:
            raise RuntimeError(f"[SECURITY] ML_SERVICE_API_KEY must be at least 16 characters in {env} environment")
    return key_val.strip() if key_val else 'dev-ml-api-key'

ML_API_KEY = validate_ml_api_key(PYTHON_ENV, _raw_key)
MODEL_PATH = Path(os.getenv('MODEL_PATH', str(MODELS_DIR)))
MODEL_PATH.mkdir(parents=True, exist_ok=True)
FEATURE_SCHEMA_VERSION = '2.0'
