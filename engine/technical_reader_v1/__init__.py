"""Source-preserving chart, table and text reader for the Technical Database."""
__version__ = "1.0.0"

from .numeric import Axis, ReaderError, interpolate, parse_number, piecewise
from .models import evaluate, linearize, validate_model
from .store import TechnicalStore

__all__ = ["Axis", "ReaderError", "TechnicalStore", "evaluate", "interpolate",
           "linearize", "parse_number", "piecewise", "validate_model"]
