import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
DATASETS_DIR = ROOT / 'datasets'
MODELS_DIR = ROOT / 'models'
ARTIFACTS_DIR = ROOT / 'artifacts'
NOTEBOOKS_DIR = ROOT / 'notebooks'

for p in [DATA_DIR, DATASETS_DIR, MODELS_DIR, ARTIFACTS_DIR, NOTEBOOKS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

DATASET = os.getenv('ORIMS_DATASET', 'supermarket').lower()
ML_API_KEY = os.getenv('ML_API_KEY', 'dev-ml-api-key')
MODEL_PATH = Path(os.getenv('MODEL_PATH', str(MODELS_DIR)))
MODEL_PATH.mkdir(parents=True, exist_ok=True)
FEATURE_SCHEMA_VERSION = '2.0'

