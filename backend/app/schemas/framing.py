"""Seat 0: the framing the user reviews before the council starts."""

from __future__ import annotations

from .base import StrictModel


class Framing(StrictModel):
    working_name: str
    target_customer: str
    customer_problem: str
    product_scope: str

    def markdown(self) -> str:
        return (
            f"**Working name:** {self.working_name}\n\n"
            f"**Target Customer:** {self.target_customer}\n\n"
            f"**Customer Problem:** {self.customer_problem}\n\n"
            f"**Product Scope:** {self.product_scope}"
        )


class FramingOutput(StrictModel):
    framing: Framing
    key_insight: str


class Brief(StrictModel):
    """The confirmed brief: the idea as written plus the framing the user accepted."""

    idea: str
    framing: Framing
    key_insight: str | None


class FramingFeedback(StrictModel):
    target_customer: str = ""
    customer_problem: str = ""
    product_scope: str = ""

    def is_empty(self) -> bool:
        return not any([self.target_customer.strip(), self.customer_problem.strip(), self.product_scope.strip()])
