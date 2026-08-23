"""Code-governed, one-round evidence retrieval boundary."""

from dataclasses import dataclass
from hashlib import sha256
from types import MappingProxyType
from typing import Mapping, Protocol
from urllib.parse import urlparse

from .contracts import (
    EvidenceBundle, EvidenceDocument, EvidenceNeed, EvidenceRetrievalStatus,
)


class EvidenceProvider(Protocol):
    provider_id: str

    def retrieve(self, need: EvidenceNeed) -> tuple[EvidenceDocument, ...]: ...


@dataclass(frozen=True, slots=True)
class EvidenceRetrievalPolicy:
    policy_version: str
    allowed_domains_by_provider: Mapping[str, frozenset[str]]
    max_documents_per_need: int = 10

    def __post_init__(self) -> None:
        if not self.policy_version.strip() or self.max_documents_per_need < 1:
            raise ValueError("evidence policy identity and positive document limit are required")
        object.__setattr__(
            self,
            "allowed_domains_by_provider",
            MappingProxyType(dict(self.allowed_domains_by_provider)),
        )


class EvidenceGateway:
    def __init__(self, providers: tuple[EvidenceProvider, ...], policy: EvidenceRetrievalPolicy) -> None:
        self._providers = {provider.provider_id: provider for provider in providers}
        if len(self._providers) != len(providers):
            raise ValueError("evidence provider IDs must be unique")
        self._policy = policy

    def retrieve_once(self, need: EvidenceNeed, *, provider_id: str) -> EvidenceBundle:
        query_fingerprint = sha256(
            "|".join((
                self._policy.policy_version,
                provider_id,
                need.capability.value,
                *sorted(need.concept_ids),
                *sorted(need.rule_ids),
            )).encode("utf-8")
        ).hexdigest()
        provider = self._providers.get(provider_id)
        allowed_domains = self._policy.allowed_domains_by_provider.get(provider_id)
        if provider is None or not allowed_domains:
            return EvidenceBundle(
                need.need_id, (), provider_id, query_fingerprint, False,
                EvidenceRetrievalStatus.REJECTED_BY_POLICY, "PROVIDER_NOT_ALLOWED",
            )
        try:
            documents = provider.retrieve(need)
        except Exception:
            return EvidenceBundle(
                need.need_id, (), provider_id, query_fingerprint, False,
                EvidenceRetrievalStatus.UNAVAILABLE, "PROVIDER_FAILURE",
            )
        accepted: list[EvidenceDocument] = []
        for document in documents[: self._policy.max_documents_per_need]:
            hostname = (urlparse(document.canonical_url).hostname or "").casefold()
            if hostname not in {domain.casefold() for domain in allowed_domains}:
                return EvidenceBundle(
                    need.need_id, (), provider_id, query_fingerprint, False,
                    EvidenceRetrievalStatus.REJECTED_BY_POLICY, "SOURCE_DOMAIN_NOT_ALLOWED",
                )
            accepted.append(document)
        return EvidenceBundle(
            need.need_id,
            tuple(accepted),
            provider_id,
            query_fingerprint,
            bool(accepted),
            EvidenceRetrievalStatus.RETRIEVED,
            None,
        )
