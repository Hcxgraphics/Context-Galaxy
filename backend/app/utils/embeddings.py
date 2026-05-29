from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingService:
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            # Load small, high-performance model locally
            cls._model = SentenceTransformer("all-MiniLM-L6-v2")
        return cls._model

    @classmethod
    def get_embedding(cls, text: str) -> list[float]:
        if not text or not text.strip():
            return [0.0] * 384  # Dimension of all-MiniLM-L6-v2
        model = cls.get_model()
        embedding = model.encode(text)
        return embedding.tolist()

    @classmethod
    def cosine_similarity(cls, a: list[float], b: list[float]) -> float:
        if not a or not b:
            return 0.0
        arr_a = np.array(a)
        arr_b = np.array(b)
        norm_a = np.linalg.norm(arr_a)
        norm_b = np.linalg.norm(arr_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))
