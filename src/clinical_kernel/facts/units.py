"""Governed unit aliases and conversions; no implicit medical conversion."""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType


@dataclass(frozen=True, slots=True)
class UnitRule:
    source_unit: str
    canonical_unit: str
    multiplier: Decimal = Decimal("1")
    offset: Decimal = Decimal("0")
    rule_id: str = ""

    def __post_init__(self) -> None:
        if not self.source_unit.strip() or not self.canonical_unit.strip() or not self.rule_id.strip():
            raise ValueError("a governed unit rule requires units and rule_id")


class GovernedUnitRegistry:
    def __init__(self, rules: tuple[UnitRule, ...], *, release_id: str) -> None:
        if not release_id.strip():
            raise ValueError("unit registry requires a release_id")
        by_source = {rule.source_unit: rule for rule in rules}
        if len(by_source) != len(rules):
            raise ValueError("source units must be unique within a release")
        self.release_id = release_id
        self._rules: Mapping[str, UnitRule] = MappingProxyType(by_source)

    def normalize(self, value: int | float, unit: str) -> tuple[float, str, str]:
        if type(value) not in (int, float):
            raise ValueError("unit normalization requires a numeric value")
        try:
            rule = self._rules[unit]
        except KeyError as exc:
            raise ValueError(f"unit is not governed by release {self.release_id}: {unit}") from exc
        normalized = Decimal(str(value)) * rule.multiplier + rule.offset
        return float(normalized), rule.canonical_unit, rule.rule_id
