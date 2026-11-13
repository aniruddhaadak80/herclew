import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class ChromaMemory:
    def __init__(self, persist_directory: str = "./.hermes_memory/chroma"):
        # chromadb is no longer a pinned dependency: nothing in the codebase
        # imports this module, and every published chromadb release (<= 1.5.9)
        # currently carries open critical advisories with no patched version
        # ( Dependabot alerts #393-#397 ).  Import lazily so the class survives
        # for optional use once upstream ships a fixed release.
        import chromadb

        self.persist_directory = persist_directory
        self.client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="herclew_long_term_memory"
        )
        logger.info(f"Initialized ChromaDB at {persist_directory}")

    def add_memory(
        self, document: str, metadata: Dict[str, Any] = None, memory_id: str = None
    ):
        if not memory_id:
            import uuid

            memory_id = str(uuid.uuid4())

        self.collection.add(
            documents=[document],
            metadatas=[metadata] if metadata else [{"source": "system"}],
            ids=[memory_id],
        )
        logger.info(f"Added memory: {memory_id}")
        return memory_id

    def retrieve(self, query: str, n_results: int = 5) -> List[str]:
        results = self.collection.query(query_texts=[query], n_results=n_results)
        if not results["documents"]:
            return []
        return results["documents"][0]
